import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

interface UsageSummary {
  used_messages: number
  plan_messages: number
  purchased_messages: number
  total_limit: number
  remaining_messages: number
  usage_percent: number
  reset_at: string | null
}

const number = (v: number) => Number(v || 0).toLocaleString('ar-EG')
const date = (v: string | null) => v ? new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(v)) : '—'
const remainingTime = (v: string | null, now: number) => {
  if (!v) return '—'
  const diff = new Date(v).getTime() - now
  if (diff <= 0) return 'انتهت الفترة'
  const total = Math.floor(diff / 1000)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return `متبقي ${days} يوم و${hours} ساعة و${minutes} دقيقة`
}

export default function Ryan() {
  const [state, setState] = useState({ loading: true, active: false, memory: 0, runs: 0, error: '' })
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [renewal, setRenewal] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const client = supabase
        if (!client) throw new Error('تعذر الاتصال بقاعدة البيانات')
        const { data: auth } = await client.auth.getUser()
        if (!auth.user) throw new Error('يجب تسجيل الدخول')
        const { data: user, error: userError } = await client.from('users').select('organization_id').eq('id', auth.user.id).maybeSingle()
        if (userError) throw userError
        if (!user?.organization_id) throw new Error('الحساب غير مرتبط بشركة')
        const organizationId = String(user.organization_id)

        const [{ data: agent, error: agentError }, { data: usageRows, error: usageError }, { data: subscription, error: subscriptionError }] = await Promise.all([
          client.from('ai_agents').select('id,active').eq('organization_id', organizationId).eq('name', 'Ryan').maybeSingle(),
          client.rpc('get_ryan_ai_usage_summary', { p_organization_id: organizationId }),
          client.from('subscriptions').select('renewal_date,expires_at').eq('organization_id', organizationId).order('renewal_date', { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
        ])
        if (agentError) throw agentError
        if (usageError) throw usageError
        if (subscriptionError) throw subscriptionError

        const [{ count: memory }, { count: runs }] = await Promise.all([
          agent?.id ? client.from('ai_agent_memory').select('id', { count: 'exact', head: true }).eq('agent_id', agent.id) : Promise.resolve({ count: 0 }),
          agent?.id ? client.from('ai_agent_runs').select('id', { count: 'exact', head: true }).eq('agent_id', agent.id) : Promise.resolve({ count: 0 }),
        ])

        if (mounted) {
          setState({ loading: false, active: Boolean(agent?.active), memory: memory || 0, runs: runs || 0, error: '' })
          setUsage(Array.isArray(usageRows) && usageRows[0] ? usageRows[0] as UsageSummary : null)
          setRenewal(subscription?.renewal_date || subscription?.expires_at || null)
        }
      } catch (error: any) {
        if (mounted) setState(s => ({ ...s, loading: false, error: error?.message || 'تعذر تحميل حالة Ryan' }))
      }
    }
    void load()
    const refresh = window.setInterval(load, 30000)
    return () => { mounted = false; window.clearInterval(refresh) }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  if (state.loading) return <div dir="rtl" className="rounded-3xl border border-blue-100 bg-white p-6 text-sm text-ink-900/55">جاري تحميل حالة Ryan…</div>
  if (state.error) return <div dir="rtl" className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">{state.error}</div>

  const planRemaining = Math.max((usage?.plan_messages || 0) - Math.min(usage?.used_messages || 0, usage?.plan_messages || 0), 0)
  const extraRemaining = Math.max(usage?.purchased_messages || 0, 0)
  const usagePercent = Math.min(100, Math.max(0, Number(usage?.usage_percent || 0)))

  return (
    <div dir="rtl" className="space-y-5 pb-8">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-l from-blue-700 to-blue-900 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 text-xs font-bold text-blue-100">المساعد الذكي</div>
            <h1 className="text-2xl font-black">Ryan</h1>
            <p className="mt-2 text-sm text-blue-100">تابع استهلاك رسائلك وحالة اشتراكك من مكان واحد.</p>
          </div>
          <span className={`rounded-full px-4 py-2 text-xs font-bold ${state.active ? 'bg-white/15 text-white' : 'bg-red-400/20 text-red-100'}`}>
            {state.active ? 'نشط' : 'متوقف'}
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><span className="text-xs font-bold text-blue-800">الباقة الحالية</span><span className="rounded-xl bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white">رسائل</span></div>
          <div className="mt-4 text-3xl font-black text-blue-950">{number(planRemaining)}</div>
          <div className="mt-1 text-xs text-blue-900/55">متبقي من {number(usage?.plan_messages || 0)} رسالة</div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${usage?.plan_messages ? Math.min(100, ((usage?.used_messages || 0) / usage.plan_messages) * 100) : 0}%` }} /></div>
        </div>

        <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><span className="text-xs font-bold text-blue-800">الباقة الإضافية</span><span className="rounded-xl bg-blue-700 px-2.5 py-1 text-[10px] font-bold text-white">إضافي</span></div>
          <div className="mt-4 text-3xl font-black text-blue-950">{number(extraRemaining)}</div>
          <div className="mt-1 text-xs text-blue-900/55">رسالة إضافية متاحة للاستخدام</div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-500" style={{ width: extraRemaining > 0 ? '100%' : '0%' }} /></div>
        </div>

        <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><span className="text-xs font-bold text-blue-800">ميعاد التجديد</span><span className="rounded-xl bg-blue-800 px-2.5 py-1 text-[10px] font-bold text-white">الاشتراك</span></div>
          <div className="mt-4 text-lg font-black text-blue-950">{date(renewal)}</div>
          <div className="mt-2 text-xs text-blue-900/55">{remainingTime(renewal, now)}</div>
        </div>
      </section>

      <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div><h2 className="text-lg font-black text-ink-950">ملخص الاستخدام</h2><p className="mt-1 text-xs text-ink-900/45">يتم تحديث البيانات تلقائيًا كل 30 ثانية.</p></div>
          <div className="text-left"><div className="text-2xl font-black text-blue-800">{number(usage?.remaining_messages || 0)}</div><div className="text-[10px] text-ink-900/40">إجمالي الرسائل المتبقية</div></div>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-blue-50"><div className="h-full rounded-full bg-gradient-to-l from-blue-500 to-blue-800" style={{ width: `${usagePercent}%` }} /></div>
        <div className="mt-2 flex justify-between text-[10px] font-bold text-ink-900/40"><span>الاستخدام الحالي</span><span>{number(Math.round(usagePercent))}%</span></div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-sm"><div className="text-xs text-ink-900/45">الذاكرة المحفوظة</div><div className="mt-1 text-2xl font-black text-ink-950">{number(state.memory)}</div></div>
        <div className="rounded-2xl border border-ink-900/10 bg-white p-5 shadow-sm"><div className="text-xs text-ink-900/45">تشغيلات المساعد</div><div className="mt-1 text-2xl font-black text-ink-950">{number(state.runs)}</div></div>
      </section>
    </div>
  )
}
