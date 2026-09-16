import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

declare global {
  interface Window {
    FB?: {
      init: (options: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void
      login: (
        callback: (response: { status?: string; authResponse?: { code?: string } }) => void,
        options: {
          config_id: string
          response_type: 'code'
          override_default_response_type: boolean
          extras?: Record<string, unknown>
        },
      ) => void
    }
    fbAsyncInit?: () => void
  }
}

type Integration = {
  provider: string
  connected: boolean
  status: string
  metadata: Record<string, unknown>
  error_message: string | null
}

type SessionInfo = {
  waba_id: string
  phone_number_id?: string
  business_id?: string
}

type PendingSignup = {
  state: string
  code: string
  session: SessionInfo | null
}

const cards = [
  { provider: 'whatsapp', title: 'WhatsApp Business', text: 'اربط رقم WhatsApp Business مباشرة من خلال مسار Meta الرسمي.' },
  { provider: 'facebook', title: 'Facebook', text: 'ربط صفحات Facebook سيستخدم نفس طبقة Meta الرسمية بعد اكتمال WhatsApp.' },
  { provider: 'instagram', title: 'Instagram', text: 'ربط Instagram سيستخدم نفس طبقة Meta الرسمية بعد اكتمال WhatsApp.' },
]

function normalizeSessionInfo(value: any): SessionInfo | null {
  let data = value
  if (typeof data === 'string') {
    try { data = JSON.parse(data) } catch { return null }
  }
  if (data?.data && typeof data.data === 'object') data = data.data
  const wabaId = data?.waba_id ?? data?.wabaId ?? data?.waba?.id
  const phoneId = data?.phone_number_id ?? data?.phoneNumberId ?? data?.phone?.id
  const businessId = data?.business_id ?? data?.businessId ?? data?.business?.id
  if (!wabaId) return null
  return {
    waba_id: String(wabaId),
    phone_number_id: phoneId ? String(phoneId) : undefined,
    business_id: businessId ? String(businessId) : undefined,
  }
}

export default function MetaConnections() {
  const { organizationId } = useOrganization()
  const [rows, setRows] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const pendingRef = useRef<PendingSignup | null>(null)
  const completingRef = useRef(false)

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
    const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : ''
    const hashParams = new URLSearchParams(hashQuery)
    const status = params.get('meta_status') || hashParams.get('meta_status')
    const message = params.get('meta_message') || hashParams.get('meta_message')
    if (status === 'connected') void load()
    if (status === 'error' && message) setError(message)
  }, [organizationId])

  const completeSignup = async () => {
    if (completingRef.current) return
    const pending = pendingRef.current
    if (!pending?.code || !pending.session?.waba_id) return
    completingRef.current = true
    setError('')
    try {
      if (!supabase) throw new Error('تعذر الوصول إلى جلسة Supabase.')
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session?.access_token) throw new Error('انتهت جلسة الدخول. سجّل الدخول مرة أخرى.')
      const response = await fetch('/api/meta/oauth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({
          code: pending.code,
          state: pending.state,
          waba_id: pending.session.waba_id,
          phone_number_id: pending.session.phone_number_id,
          business_id: pending.session.business_id,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.connected) throw new Error(result.error || 'تعذر إكمال حفظ اتصال WhatsApp.')
      pendingRef.current = null
      setConnecting(false)
      await load()
    } catch (err) {
      setConnecting(false)
      setError(err instanceof Error ? err.message : 'تعذر إكمال اتصال WhatsApp.')
    } finally {
      completingRef.current = false
    }
  }

  useEffect(() => {
    const sessionInfoListener = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://facebook.com') return
      let data: any = event.data
      if (typeof data === 'string') {
        try { data = JSON.parse(data) } catch { return }
      }
      if (data?.type !== 'WA_EMBEDDED_SIGNUP') return
      if (data.event === 'ERROR') {
        pendingRef.current = null
        completingRef.current = false
        setConnecting(false)
        setError(String(data.data?.error_message || data.error_message || 'Meta لم تُكمل عملية ربط WhatsApp.'))
        return
      }
      if (data.event === 'CANCEL') {
        pendingRef.current = null
        completingRef.current = false
        setConnecting(false)
        setError('تم إلغاء ربط WhatsApp قبل اكتماله.')
        return
      }
      if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA' || data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
        const session = normalizeSessionInfo(data)
        const current = pendingRef.current
        if (!current || !session) return
        current.session = session
        if (current.code) void completeSignup()
      }
    }
    window.addEventListener('message', sessionInfoListener)
    return () => window.removeEventListener('message', sessionInfoListener)
  }, [])

  const loadMetaSdk = async (appId: string) => {
    if (window.FB) {
      window.FB.init({ appId, cookie: true, xfbml: true, version: 'v23.0' })
      return
    }
    await new Promise<void>((resolve, reject) => {
      const existing = document.getElementById('facebook-jssdk')
      const finish = () => {
        if (!window.FB) reject(new Error('تعذر تحميل Meta JavaScript SDK.'))
        else {
          window.FB.init({ appId, cookie: true, xfbml: true, version: 'v23.0' })
          resolve()
        }
      }
      window.fbAsyncInit = finish
      if (existing) {
        window.setTimeout(finish, 5000)
        return
      }
      const script = document.createElement('script')
      script.id = 'facebook-jssdk'
      script.async = true
      script.defer = true
      script.crossOrigin = 'anonymous'
      script.src = 'https://connect.facebook.net/en_US/sdk.js'
      script.onerror = () => reject(new Error('تعذر تحميل Meta JavaScript SDK.'))
      document.body.appendChild(script)
    })
  }

  const startWhatsApp = async () => {
    if (!organizationId || !supabase) return
    setError('')
    setConnecting(true)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session?.access_token) throw new Error('انتهت جلسة الدخول. سجّل الدخول مرة أخرى.')
      const response = await fetch('/api/meta/oauth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ organizationId }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.state || !result.app_id || !result.config_id) throw new Error(result.error || 'تعذر تجهيز ربط Meta.')
      pendingRef.current = { state: String(result.state), code: '', session: null }
      await loadMetaSdk(String(result.app_id))
      if (!window.FB) throw new Error('Meta JavaScript SDK غير متاح.')
      window.FB.login(
        (loginResponse) => {
          const code = loginResponse.authResponse?.code
          if (loginResponse.status !== 'connected' || !code) {
            pendingRef.current = null
            setConnecting(false)
            setError('Meta لم تُرجع authorization code صالحًا.')
            return
          }
          const pending = pendingRef.current
          if (!pending) return
          pending.code = String(code)
          if (pending.session?.waba_id) void completeSignup()
        },
        {
          config_id: String(result.config_id),
          response_type: 'code',
          override_default_response_type: true,
          extras: { setup: {}, sessionInfoVersion: '3' },
        },
      )
    } catch (err) {
      pendingRef.current = null
      setConnecting(false)
      setError(err instanceof Error ? err.message : 'تعذر بدء اتصال Meta.')
    }
  }

  return (
    <div dir="rtl" className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-950">اتصالات Meta</h1>
        <p className="mt-1 text-sm text-ink-600">ربط WhatsApp عبر Meta Embedded Signup الرسمي مع حفظ WABA ورقم الهاتف المحدد من داخل مسار Meta.</p>
      </div>
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">استخدم زر «ربط WhatsApp» الموجود هنا لبدء Embedded Signup. سيتم التقاط بيانات WABA ورقم الهاتف من جلسة Meta وإرسالها مباشرة إلى Dragon Media.</div>
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
                <button onClick={startWhatsApp} disabled={connecting || loading} className="mt-5 w-full rounded-xl bg-ink-950 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{connecting ? 'جارٍ فتح Meta…' : connected ? 'إدارة اتصال WhatsApp' : 'ربط WhatsApp'}</button>
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
