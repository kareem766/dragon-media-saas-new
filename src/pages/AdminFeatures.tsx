import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '../components/ui'
import { supabase } from '../lib/supabaseClient'

type Feature = {
  feature_key: string
  label: string
  description: string
  category: string
  enabled: boolean
  sort_order: number
  updated_at: string
}

const categoryOrder = ['أساسي','مبيعات','تسويق','ذكاء اصطناعي','تواصل','أتمتة','إدارة','تحليلات','تكاملات','دعم','مالية']

export default function AdminFeatures() {
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const token = useCallback(async () => {
    if (!supabase) throw new Error('تعذر الاتصال بقاعدة البيانات.')
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session?.access_token) throw new Error('انتهت جلسة الدخول. سجل الدخول مرة أخرى.')
    return data.session.access_token
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const accessToken = await token()
      const response = await fetch('/api/admin/platform-features', { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'تعذر تحميل مميزات المنصة.')
      setFeatures(Array.isArray(payload.features) ? payload.features : [])
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل مميزات المنصة.')
    } finally { setLoading(false) }
  }, [token])

  useEffect(() => { void load() }, [load])

  const toggle = async (feature: Feature) => {
    if (busy) return
    setBusy(feature.feature_key); setError(null); setSuccess(null)
    try {
      const accessToken = await token()
      const response = await fetch('/api/admin/platform-features', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ feature_key: feature.feature_key, enabled: !feature.enabled }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'تعذر تغيير حالة الميزة.')
      setFeatures(current => current.map(item => item.feature_key === feature.feature_key ? { ...item, enabled: !feature.enabled } : item))
      setSuccess(`${feature.label}: تم ${!feature.enabled ? 'التفعيل' : 'الإيقاف'} بنجاح.`)
    } catch (e: any) {
      setError(e?.message || 'تعذر تغيير حالة الميزة.')
    } finally { setBusy(null) }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Feature[]>()
    for (const feature of features) {
      if (!map.has(feature.category)) map.set(feature.category, [])
      map.get(feature.category)!.push(feature)
    }
    return Array.from(map.entries()).sort((a,b) => {
      const ai = categoryOrder.indexOf(a[0]); const bi = categoryOrder.indexOf(b[0])
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
    })
  }, [features])

  const enabledCount = features.filter(feature => feature.enabled).length

  return <div dir="rtl" className="mx-auto w-full max-w-7xl space-y-6 p-1 sm:p-2">
    <div>
      <h2 className="text-xl font-bold tracking-tight text-ink-950 sm:text-2xl">تحكم مميزات المنصة</h2>
      <p className="mt-1 text-sm leading-6 text-ink-900/50">تحكم مركزي في فتح وإغلاق مميزات Dragon Media. الإيقاف هنا يؤثر على جميع الشركات فورًا، بينما صلاحيات الباقات تحدد من يملك الميزة عند تفعيلها.</p>
    </div>

    <Card className="border border-blue-100/80 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,47,107,0.05)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-bold text-ink-950">حالة المنصة</div>
          <div className="mt-1 text-xs text-ink-900/50">يمكنك من هنا التحكم في المميزات دون حذف بيانات الشركات أو الاشتراكات.</div>
        </div>
        <div className="rounded-xl bg-sand-50 px-4 py-3 text-sm font-bold text-ink-950">المميزات المفتوحة: {enabledCount} / {features.length}</div>
      </div>
    </Card>

    {error && <div role="alert" className="rounded-2xl border border-red-500/15 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {success && <div role="status" className="rounded-2xl border border-emerald-500/15 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

    {loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({length:6}).map((_,i)=><div key={i} className="h-32 animate-pulse rounded-2xl bg-sand-100" />)}</div> :
      <div className="space-y-6">{grouped.map(([category, items]) => <section key={category}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-bold text-ink-950">{category}</h3><span className="text-xs text-ink-900/40">{items.length} مميزات</span></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(feature => <Card key={feature.feature_key} className="border border-sand-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0"><h4 className="font-bold text-ink-950">{feature.label}</h4><p className="mt-1 text-xs leading-5 text-ink-900/50">{feature.description}</p></div>
            <button type="button" disabled={busy === feature.feature_key || feature.feature_key === 'dashboard'} onClick={() => void toggle(feature)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${feature.enabled ? 'bg-emerald-500' : 'bg-sand-300'} disabled:cursor-not-allowed disabled:opacity-60`} aria-label={feature.enabled ? `إيقاف ${feature.label}` : `تفعيل ${feature.label}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${feature.enabled ? 'left-1' : 'right-1'}`} />
            </button>
          </div>
          <div className={`mt-4 text-xs font-bold ${feature.enabled ? 'text-emerald-600' : 'text-red-600'}`}>{feature.enabled ? 'مفعّل على مستوى المنصة' : 'مغلق على مستوى المنصة'}</div>
        </Card>)}</div>
      </section>)}</div>}
  </div>
}
