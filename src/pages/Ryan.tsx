import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Ryan() {
  const [state, setState] = useState({ loading: true, active: false, memory: 0, runs: 0, model: '—', error: '' })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const client = supabase
        if (!client) throw new Error('تعذر الاتصال بقاعدة البيانات')
        const { data: auth } = await client.auth.getUser()
        if (!auth.user) throw new Error('يجب تسجيل الدخول')
        const { data: user, error: userError } = await client.from('users').select('organization_id').eq('id', auth.user.id).maybeSingle()
        if (userError) throw userError
        if (!user?.organization_id) throw new Error('الحساب غير مرتبط بشركة')
        const { data: agent, error: agentError } = await client.from('ai_agents').select('id,active,settings').eq('organization_id', user.organization_id).eq('name', 'Ryan').maybeSingle()
        if (agentError) throw agentError
        const [{ count: memory }, { count: runs }] = await Promise.all([
          agent?.id ? client.from('ai_agent_memory').select('id', { count: 'exact', head: true }).eq('agent_id', agent.id) : Promise.resolve({ count: 0 }),
          agent?.id ? client.from('ai_agent_runs').select('id', { count: 'exact', head: true }).eq('agent_id', agent.id) : Promise.resolve({ count: 0 }),
        ])
        if (mounted) setState({ loading: false, active: Boolean(agent?.active), memory: memory || 0, runs: runs || 0, model: String((agent as any)?.settings?.model || 'gemini-3.1-flash-lite'), error: '' })
      } catch (error: any) {
        if (mounted) setState((s) => ({ ...s, loading: false, error: error?.message || 'تعذر تحميل حالة Ryan' }))
      }
    })()
    return () => { mounted = false }
  }, [])

  if (state.loading) return <div className="rounded-2xl border border-ink-900/10 bg-white p-6 text-sm text-ink-900/55">جاري تحميل حالة Ryan…</div>
  if (state.error) return <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">{state.error}</div>

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-ink-900/10 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-ink-950">Ryan AI Agent</h2>
            <p className="mt-1 text-sm text-ink-900/50">محرك محادثة جديد يفهم السياق، يحفظ الذاكرة، وينفذ إجراءات CRM عند الحاجة.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${state.active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{state.active ? 'نشط' : 'متوقف'}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink-900/10 bg-white p-5"><div className="text-xs text-ink-900/45">الذاكرة المحفوظة</div><div className="mt-1 text-2xl font-bold">{state.memory}</div></div>
        <div className="rounded-2xl border border-ink-900/10 bg-white p-5"><div className="text-xs text-ink-900/45">تشغيلات الوكيل</div><div className="mt-1 text-2xl font-bold">{state.runs}</div></div>
        <div className="rounded-2xl border border-ink-900/10 bg-white p-5"><div className="text-xs text-ink-900/45">الموديل</div><div className="mt-1 text-lg font-bold">{state.model}</div></div>
      </div>
    </div>
  )
}
