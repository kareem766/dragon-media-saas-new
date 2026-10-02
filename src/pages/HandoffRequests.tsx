import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, StatCard } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'
import { usePermissions } from '../lib/usePermissions'

interface DBRequest {
  id: string
  organization_id: string
  customer_name: string | null
  reason: string | null
  status: string
  created_at: string
  resolved_at?: string | null
  conversation_id?: string | null
}

type Filter = 'all' | 'open' | 'resolved'

function Icon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    handoff: <><path d="M7 8h10M7 12h6"/><path d="M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5l-4 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.9-4L3 10"/><path d="M3 5v5h5"/><path d="M4 13a8 8 0 0 0 14.9 4L21 14"/><path d="M21 19v-5h-5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    search: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></>,
    inbox: <><path d="M4 5h16v12H4z"/><path d="m4 13 3 3h10l3-3"/></>,
    close: <><path d="M6 6l12 12M18 6 6 18"/></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function statusLabel(status: string) {
  if (status === 'open') return 'جديد'
  if (status === 'resolved') return 'تم التعامل معه'
  return status === 'pending' ? 'قيد المتابعة' : status || 'غير محدد'
}

function statusTone(status: string): 'success' | 'warning' | 'default' {
  if (status === 'resolved') return 'success'
  if (status === 'pending') return 'warning'
  return 'warning'
}

export default function HandoffRequests() {
  const { can, loading: permissionsLoading } = usePermissions()
  const canView = can('handoff_requests', 'view')
  const canEdit = can('handoff_requests', 'edit')
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization()

  const [requests, setRequests] = useState<DBRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('open')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!supabase || !organizationId) {
      setRequests([])
      setLoading(false)
      return
    }
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('human_handoff_requests')
      .select('id, organization_id, customer_name, reason, status, created_at, resolved_at, conversation_id')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (queryError) {
      setError('تعذر تحميل طلبات التحويل. حاول تحديث الصفحة مرة أخرى.')
    } else {
      setRequests((data ?? []) as DBRequest[])
    }
    setLoading(false)
    setRefreshing(false)
  }, [organizationId])

  useEffect(() => {
    if (organizationId) void load()
  }, [organizationId, load])

  useEffect(() => {
    if (!supabase || !organizationId) return
    const channel = supabase
      .channel(`handoff-requests-${organizationId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'human_handoff_requests',
        filter: `organization_id=eq.${organizationId}`,
      }, () => { void load(true) })
      .subscribe()

    return () => { void supabase?.removeChannel(channel) }
  }, [organizationId, load])

  const resolve = async (request: DBRequest) => {
    if (!canEdit) {
      setError('ليس لديك صلاحية تنفيذ هذا الإجراء.')
      return
    }
    if (!supabase || request.status === 'resolved') return

    setResolvingId(request.id)
    setError(null)

    const { error: updateError } = await supabase
      .from('human_handoff_requests')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', request.id)
      .eq('organization_id', organizationId)
      .eq('status', 'open')

    if (updateError) {
      setError('تعذر تحديث الطلب. تأكد من الصلاحيات وحاول مرة أخرى.')
    } else {
      setRequests(current => current.map(item =>
        item.id === request.id
          ? { ...item, status: 'resolved', resolved_at: new Date().toISOString() }
          : item
      ))
    }
    setResolvingId(null)
  }

  const counts = useMemo(() => ({
    all: requests.length,
    open: requests.filter(r => r.status === 'open' || r.status === 'pending').length,
    resolved: requests.filter(r => r.status === 'resolved').length,
  }), [requests])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return requests.filter(request => {
      if (filter === 'open' && !['open', 'pending'].includes(request.status)) return false
      if (filter === 'resolved' && request.status !== 'resolved') return false
      if (!q) return true
      return [request.customer_name ?? '', request.reason ?? ''].some(value => value.toLowerCase().includes(q))
    })
  }, [requests, filter, search])

  if (orgLoading || permissionsLoading) {
    return <div dir="rtl" className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      <div className="h-16 animate-pulse rounded-3xl bg-sand-100" />
      <div className="grid gap-4 sm:grid-cols-3"><div className="h-28 animate-pulse rounded-2xl bg-sand-100"/><div className="h-28 animate-pulse rounded-2xl bg-sand-100"/><div className="h-28 animate-pulse rounded-2xl bg-sand-100"/></div>
      <div className="h-96 animate-pulse rounded-3xl bg-sand-100" />
    </div>
  }

  if (orgError) {
    return <Card className="mx-auto flex min-h-[420px] max-w-6xl items-center justify-center p-6"><div className="text-center" role="alert"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">!</div><b>تعذر تحميل المؤسسة</b><p className="mt-2 text-sm text-red-600">{orgError}</p></div></Card>
  }

  if (!canView) {
    return <Card className="mx-auto flex min-h-[420px] max-w-6xl items-center justify-center p-6"><div className="text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">!</div><b className="text-ink-950">ليس لديك صلاحية الوصول</b><p className="mt-2 text-sm text-ink-900/50">اطلب من مدير المؤسسة منحك صلاحية مشاهدة طلبات التحويل للدعم البشري.</p></div></Card>
  }

  return (
    <div dir="rtl" className="mx-auto w-full max-w-6xl space-y-5 pb-10">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-950 via-blue-950 to-blue-800 p-5 text-white shadow-[0_18px_50px_rgba(15,47,107,.18)] sm:p-7">
        <div className="absolute -left-12 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/15"><Icon name="handoff" className="h-6 w-6"/></div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">طلبات التحويل للدعم البشري</h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-white/70">تابع العملاء الذين يحتاجون إلى تدخل من فريقك، وتعامل مع الطلبات بسرعة من مكان واحد.</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => void load(true)} disabled={refreshing} className="border-white/15 bg-white/10 text-white hover:bg-white/15">
            <span className="inline-flex items-center gap-2"><Icon name="refresh" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}/>{refreshing ? 'جاري التحديث...' : 'تحديث الطلبات'}</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="كل الطلبات" value={String(counts.all)} sub="إجمالي طلبات التحويل" />
        <StatCard label="تحتاج متابعة" value={String(counts.open)} sub="طلبات لم يتم التعامل معها بعد" accent="gold" />
        <StatCard label="تم التعامل معها" value={String(counts.resolved)} sub="طلبات أغلقت بنجاح" accent="clay" />
      </div>

      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-start gap-2"><span className="mt-0.5 font-extrabold">!</span><span>{error}</span></div>
          <button type="button" onClick={() => setError(null)} aria-label="إغلاق" className="rounded-lg p-1 hover:bg-red-100"><Icon name="close" className="h-4 w-4"/></button>
        </div>
      )}

      <Card className="overflow-hidden shadow-[0_10px_35px_rgba(32,28,22,.05)]">
        <div className="border-b border-sand-100 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {([
                ['open', `تحتاج متابعة · ${counts.open}`],
                ['all', `الكل · ${counts.all}`],
                ['resolved', `تم التعامل معها · ${counts.resolved}`],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${filter === value ? 'bg-ink-950 text-white shadow-sm' : 'border border-sand-200 bg-white text-ink-700 hover:bg-sand-50'}`}>{label}</button>
              ))}
            </div>
            <div className="relative w-full lg:max-w-xs">
              <Icon name="search" className="absolute right-3 top-3 h-4 w-4 text-ink-900/30"/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث باسم العميل أو سبب التحويل..." className="h-10 w-full rounded-xl border border-sand-200 bg-sand-50/60 pr-9 pl-3 text-sm outline-none transition focus:border-ink-400 focus:bg-white" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">{[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-sand-100"/>)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[300px] items-center justify-center p-8">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Icon name="inbox" className="h-7 w-7"/></div>
              <h3 className="mt-4 text-base font-extrabold text-ink-950">{search ? 'لا توجد نتائج مطابقة' : filter === 'open' ? 'لا توجد طلبات تحتاج متابعة' : 'لا توجد طلبات هنا'}</h3>
              <p className="mt-1.5 text-sm text-ink-900/45">{search ? 'جرّب اسمًا مختلفًا أو امسح البحث.' : 'سيظهر أي طلب جديد هنا تلقائيًا.'}</p>
              {search && <button type="button" onClick={() => setSearch('')} className="mt-3 text-sm font-bold text-blue-700 hover:underline">مسح البحث</button>}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-sand-100">
            {filtered.map(request => (
              <div key={request.id} className="group p-4 transition hover:bg-sand-50/50 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 font-extrabold text-blue-700">
                      {(request.customer_name || 'ع').trim().slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-extrabold text-ink-950">{request.customer_name || 'عميل غير معروف'}</h3>
                        <Badge tone={statusTone(request.status)}>{statusLabel(request.status)}</Badge>
                      </div>
                      <p className="mt-1.5 text-sm leading-6 text-ink-900/65">{request.reason || 'لم يتم تحديد سبب التحويل.'}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-ink-900/40">
                        <span className="inline-flex items-center gap-1"><Icon name="clock" className="h-3.5 w-3.5"/>{formatDate(request.created_at)}</span>
                        {request.resolved_at && <span className="inline-flex items-center gap-1"><Icon name="check" className="h-3.5 w-3.5"/>{formatDate(request.resolved_at)}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 lg:justify-end">
                    {request.status !== 'resolved' && canEdit && (
                      <Button onClick={() => void resolve(request)} disabled={resolvingId === request.id} className="min-w-32">
                        <span className="inline-flex items-center justify-center gap-2"><Icon name="check" className="h-4 w-4"/>{resolvingId === request.id ? 'جاري الحفظ...' : 'تم التعامل معه'}</span>
                      </Button>
                    )}
                    {request.status === 'resolved' && (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><Icon name="check" className="h-4 w-4"/>تم التعامل معه</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between px-1 text-xs text-ink-900/40">
        <span>يتم تحديث الطلبات الجديدة تلقائيًا.</span>
        <span>{filtered.length} من {requests.length}</span>
      </div>
    </div>
  )
}
