import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

type Integration = {
  provider: string
  connected: boolean
  status: string
  metadata: Record<string, unknown>
  error_message: string | null
}

const cards = [
  { provider: 'whatsapp', title: 'WhatsApp Business', text: 'اربط رقم WhatsApp Business مباشرة من خلال مسار Meta الرسمي.' },
  { provider: 'facebook', title: 'Facebook', text: 'ربط صفحات Facebook سيستخدم نفس طبقة Meta الرسمية بعد اكتمال WhatsApp.' },
  { provider: 'instagram', title: 'Instagram', text: 'ربط Instagram سيستخدم نفس طبقة Meta الرسمية بعد اكتمال WhatsApp.' },
]

export default function MetaConnections() {
  const { organizationId } = useOrganization()
  const [rows, setRows] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)

  const load = async () => {
    if (!organizationId || !supabase) return
    setLoading(true)
    setError('')
    const { data, error: fetchError } = await supabase
      .from('integrations')
      .select('provider,connected,status,metadata,error_message')
      .eq('organization_id', organizationId)
      .in('provider', ['whatsapp', 'facebook', 'instagram'])

    if (fetchError) setError('تعذر تحميل حالة اتصالات Meta.')
    setRows((data ?? []) as Integration[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [organizationId])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('meta_status')
    const message = params.get('meta_message')
    if (status === 'connected') void load()
    if (status === 'error' && message) setError(decodeURIComponent(message))
  }, [])

  const startWhatsApp = async () => {
    if (!organizationId || !supabase) return
    setError('')
    setConnecting(true)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error('انتهت جلسة الدخول. سجّل الدخول مرة أخرى.')
      }

      const response = await fetch('/api/meta/oauth/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ organizationId }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.url) throw new Error(result.error || 'تعذر بدء اتصال Meta.')
      window.location.assign(result.url)
    } catch (err) {
      setConnecting(false)
      setError(err instanceof Error ? err.message : 'تعذر بدء اتصال Meta.')
    }
  }

  return (
    <div dir="rtl" className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-950">اتصالات Meta</h1>
        <p className="mt-1 text-sm text-ink-600">مسار واحد واضح لربط WhatsApp وFacebook وInstagram بدون خلط بين OAuth القديم والجديد.</p>
      </div>
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
        تم فصل الربط الجديد عن المحاولات السابقة. الـ redirect URI المستخدم في بدء OAuth وفي تبادل الكود ثابت ومطابق حرفيًا.
      </div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const row = rows.find((item) => item.provider === card.provider)
          const connected = Boolean(row?.connected && row.status === 'connected')
          return (
            <div key={card.provider} className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-ink-950">{card.title}</h2>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{connected ? 'متصل' : 'غير متصل'}</span>
              </div>
              <p className="mt-3 min-h-12 text-sm leading-6 text-ink-600">{card.text}</p>
              {card.provider === 'whatsapp' ? (
                <button onClick={startWhatsApp} disabled={connecting || loading} className="mt-5 w-full rounded-xl bg-ink-950 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  {connecting ? 'جارٍ فتح Meta…' : connected ? 'إدارة اتصال WhatsApp' : 'ربط WhatsApp'}
                </button>
              ) : (
                <button disabled className="mt-5 w-full rounded-xl border border-ink-900/10 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">سيتم تفعيله بعد WhatsApp</button>
              )}
            </div>
          )
        })}
      </div>
      {loading && <p className="text-sm text-ink-500">جارٍ تحميل حالة الاتصال…</p>}
    </div>
  )
}
