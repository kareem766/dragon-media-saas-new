import React, { useCallback, useEffect, useState } from 'react'
import { Card, Badge } from '../components/ui'
import { useAuth } from '../lib/AuthContext'

type Health = {
  checked_at: string
  database: { status: string; organizations: number; active_users: number; error: string | null }
  integrations: { total: number; connected: number; errors: number; stale: number; recent: Array<{ provider: string; status: string | null; connected: boolean; error_message: string | null; last_verified_at: string | null }> }
  ryan: { total: number; active: number; error: string | null }
  operations: { open_handoffs: number; pending_payments: number }
  environment: { supabase: boolean; gemini: boolean; meta: boolean }
}

const label: Record<string,string> = { facebook: 'Facebook', instagram: 'Instagram', whatsapp: 'WhatsApp', messenger: 'Messenger' }

export default function AdminPlatformHealth() {
  const { user } = useAuth()
  const [data, setData] = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (manual = false) => {
    if (!user) return
    if (manual) setRefreshing(true); else setLoading(true)
    setError('')
    try {
      const { data: session } = await (await import('../lib/supabaseClient')).supabase!.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('جلسة الدخول غير صالحة')
      const response = await fetch('/api/admin/platform-health', { headers: { Authorization: `Bearer ${token}` } })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'تعذر تحميل حالة المنصة')
      setData(payload as Health)
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل حالة المنصة')
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [user])

  useEffect(() => { void load() }, [load])

  const status = (ok: boolean) => ok ? <Badge tone="success">يعمل</Badge> : <Badge tone="danger">يحتاج مراجعة</Badge>

  if (loading) return <div className="flex min-h-[420px] items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-ink-900/15 border-t-ink-900" /></div>
  if (error) return <Card className="border-red-200 bg-red-50/60 p-6"><p className="font-semibold text-red-800">{error}</p><button onClick={() => void load(true)} className="mt-4 rounded-xl bg-ink-950 px-4 py-2 text-sm font-bold text-white">إعادة المحاولة</button></Card>

  const healthy = data && data.database.status === 'healthy' && data.integrations.errors === 0 && Boolean(data.environment.supabase)
  return <div dir="rtl" className="mx-auto w-full max-w-7xl space-y-6 pb-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold text-gold-600">تشغيل المنصة</p><h1 className="mt-1 text-2xl font-black text-ink-950 sm:text-3xl">صحة المنصة ومراقبة التشغيل</h1><p className="mt-1 text-sm text-ink-900/50">فحص مباشر للمكونات الأساسية بدون عرض أي أسرار أو مفاتيح.</p></div>
      <div className="flex items-center gap-2"><Badge tone={healthy ? 'success' : 'warning'}>{healthy ? 'المنصة تعمل بشكل طبيعي' : 'توجد عناصر تحتاج مراجعة'}</Badge><button onClick={() => void load(true)} disabled={refreshing} className="rounded-xl border border-ink-900/10 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">{refreshing ? 'جاري الفحص…' : 'فحص الآن'}</button></div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="p-5"><div className="text-xs text-ink-900/45">قاعدة البيانات</div><div className="mt-2 flex items-center justify-between"><b className="text-xl">{data?.database.organizations.toLocaleString('ar-EG')} شركة</b>{status(data?.database.status === 'healthy')}</div><p className="mt-2 text-xs text-ink-900/45">{data?.database.active_users.toLocaleString('ar-EG')} مستخدم نشط</p></Card>
      <Card className="p-5"><div className="text-xs text-ink-900/45">التكاملات</div><div className="mt-2 flex items-center justify-between"><b className="text-xl">{data?.integrations.connected.toLocaleString('ar-EG')}</b>{status(data?.integrations.errors === 0)}</div><p className="mt-2 text-xs text-ink-900/45">{data?.integrations.errors} بها أخطاء · {data?.integrations.stale} تحتاج تحقق</p></Card>
      <Card className="p-5"><div className="text-xs text-ink-900/45">Ryan</div><div className="mt-2 flex items-center justify-between"><b className="text-xl">{data?.ryan.active} نشط</b>{status(!data?.ryan.error)}</div><p className="mt-2 text-xs text-ink-900/45">{data?.ryan.total} إعدادات Ryan مسجلة</p></Card>
      <Card className="p-5"><div className="text-xs text-ink-900/45">عمليات تحتاج متابعة</div><div className="mt-2 text-xl font-black">{(data?.operations.open_handoffs || 0) + (data?.operations.pending_payments || 0)}</div><p className="mt-2 text-xs text-ink-900/45">{data?.operations.open_handoffs} تحويل بشري · {data?.operations.pending_payments} طلب دفع</p></Card>
    </div>
    <Card className="p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">متغيرات التشغيل المطلوبة</h2><p className="mt-1 text-xs text-ink-900/45">يتم عرض وجود المتغير فقط، وليس قيمته.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{[['Supabase',data?.environment.supabase],['Gemini',data?.environment.gemini],['Meta',data?.environment.meta]].map(([name,ok])=><div key={String(name)} className="flex items-center justify-between rounded-xl border border-ink-900/10 bg-sand-50 p-3"><span className="text-sm font-semibold">{String(name)}</span>{status(Boolean(ok))}</div>)}</div></Card>
    <Card className="overflow-hidden p-0"><div className="border-b border-ink-900/10 px-5 py-4"><h2 className="font-bold">آخر حالات التكاملات</h2></div><div className="divide-y divide-ink-900/5">{(data?.integrations.recent || []).length ? data?.integrations.recent.map((item, i) => <div key={`${item.provider}-${i}`} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><b className="text-sm">{label[item.provider] || item.provider}</b><p className="mt-1 text-xs text-ink-900/45">{item.error_message || (item.last_verified_at ? `آخر تحقق: ${new Date(item.last_verified_at).toLocaleString('ar-EG')}` : 'لم يتم التحقق بعد')}</p></div>{status(Boolean(item.connected) && !item.error_message)}</div>) : <div className="p-8 text-center text-sm text-ink-900/45">لا توجد تكاملات مسجلة حتى الآن.</div>}</div></Card>
    <p className="text-[11px] text-ink-900/35">آخر فحص: {data?.checked_at ? new Date(data.checked_at).toLocaleString('ar-EG') : '—'}</p>
  </div>
}
