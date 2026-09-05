import React, { useEffect, useState } from 'react'
import { Card, StatCard } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface Counts {
  leads: number
  customers: number
  activeCustomers: number
  dealsValue: number
  dealsCount: number
  avgDeal: number
  tasksDone: number
  tasksTotal: number
  campaignsCount: number
}

export default function Reports() {
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization()
  const [counts, setCounts] = useState<Counts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId || !supabase) return
    const load = async () => {
      setLoading(true)
      const [leadsRes, customersRes, dealsRes, tasksRes, campaignsRes] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
        supabase.from('customers').select('status').eq('organization_id', organizationId),
        supabase.from('deals').select('value').eq('organization_id', organizationId),
        supabase.from('tasks').select('status').eq('organization_id', organizationId),
        supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
      ])

      const customers = customersRes.data ?? []
      const deals = dealsRes.data ?? []
      const tasks = tasksRes.data ?? []
      const dealsValue = deals.reduce((s: number, d: { value: number }) => s + Number(d.value ?? 0), 0)

      setCounts({
        leads: leadsRes.count ?? 0,
        customers: customers.length,
        activeCustomers: customers.filter((c: { status: string }) => c.status === 'نشط').length,
        dealsValue,
        dealsCount: deals.length,
        avgDeal: deals.length ? Math.round(dealsValue / deals.length) : 0,
        tasksDone: tasks.filter((t: { status: string }) => t.status === 'مكتملة').length,
        tasksTotal: tasks.length,
        campaignsCount: campaignsRes.count ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [organizationId])

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (orgError || !organizationId) {
    return (
      <div className="text-center py-20 text-sm text-red-600">
        {orgError ?? 'تعذر تحديد المؤسسة الخاصة بحسابك'}
      </div>
    )
  }

  if (loading || !counts) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="قيمة مسار المبيعات" value={`${counts.dealsValue.toLocaleString('ar-EG')} ج.م`} sub={`${counts.dealsCount} صفقة`} accent="gold" />
        <StatCard label="متوسط قيمة الصفقة" value={`${counts.avgDeal.toLocaleString('ar-EG')} ج.م`} />
        <StatCard label="عملاء نشطون" value={String(counts.activeCustomers)} sub={`من إجمالي ${counts.customers}`} accent="clay" />
        <StatCard label="عملاء محتملون" value={String(counts.leads)} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="مهام مكتملة" value={`${counts.tasksDone} / ${counts.tasksTotal}`} />
        <StatCard label="عدد الحملات" value={String(counts.campaignsCount)} />
      </div>

      <Card className="p-5">
        <h3 className="font-bold text-ink-950 mb-2">ملاحظة</h3>
        <p className="text-sm text-ink-900/55">
          الأرقام أعلاه محسوبة مباشرة من بياناتك الحقيقية في قاعدة البيانات، وبتتحدّث تلقائيًا كل ما تضيف أو تعدّل بيانات في المنصة.
        </p>
      </Card>
    </div>
  )
}
