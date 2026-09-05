import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, StatCard, Badge, statusTone } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface DashboardData {
  leadsCount: number
  hotLeadsCount: number
  customersCount: number
  openDealsValue: number
  openDealsCount: number
  wonDealsValue: number
  pendingTasksCount: number
  todayAppointmentsCount: number
  activeCampaignsCount: number
}

interface TaskRow {
  id: string
  title: string
  due_date: string | null
  priority: string
  status: string
}

interface AppointmentRow {
  id: string
  appointment_time: string | null
  status: string
  customers: { name: string } | null
  services: { name: string } | null
}

export default function Dashboard() {
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization()
  const [data, setData] = useState<DashboardData | null>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId || !supabase) return
    const sb = supabase
    const orgId = organizationId
    const today = new Date().toISOString().slice(0, 10)

    const load = async () => {
      setLoading(true)
      const [
        leadsRes,
        hotLeadsRes,
        customersRes,
        dealsRes,
        tasksRes,
        pendingTasksRes,
        appointmentsTodayRes,
        campaignsRes,
      ] = await Promise.all([
        sb.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        sb.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'مهتم'),
        sb.from('customers').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        sb.from('deals').select('value, pipeline_stages(name)').eq('organization_id', orgId),
        sb.from('tasks').select('id, title, due_date, priority, status').eq('organization_id', orgId).neq('status', 'مكتملة').order('due_date', { ascending: true }).limit(4),
        sb.from('tasks').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).neq('status', 'مكتملة'),
        sb.from('appointments').select('id, appointment_time, status, customers(name), services(name)').eq('organization_id', orgId).eq('appointment_date', today),
        sb.from('campaigns').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).in('status', ['مجدولة', 'قيد التنفيذ']),
      ])

      const deals = (dealsRes.data ?? []) as unknown as { value: number; pipeline_stages: { name: string } | null }[]
      const wonDeals = deals.filter(d => d.pipeline_stages?.name === 'تم التعاقد')
      const lostDeals = deals.filter(d => d.pipeline_stages?.name === 'مغلق - خسرنا')
      const openDeals = deals.filter(d => d.pipeline_stages?.name !== 'تم التعاقد' && d.pipeline_stages?.name !== 'مغلق - خسرنا')

      setData({
        leadsCount: leadsRes.count ?? 0,
        hotLeadsCount: hotLeadsRes.count ?? 0,
        customersCount: customersRes.count ?? 0,
        openDealsValue: openDeals.reduce((s, d) => s + Number(d.value ?? 0), 0),
        openDealsCount: openDeals.length,
        wonDealsValue: wonDeals.reduce((s, d) => s + Number(d.value ?? 0), 0),
        pendingTasksCount: pendingTasksRes.count ?? 0,
        todayAppointmentsCount: appointmentsTodayRes.data?.length ?? 0,
        activeCampaignsCount: campaignsRes.count ?? 0,
      })
      setTasks((tasksRes.data ?? []) as TaskRow[])
      setAppointments((appointmentsTodayRes.data ?? []) as unknown as AppointmentRow[])
      setLoading(false)
      void lostDeals
    }
    load()
  }, [organizationId])

  if (orgLoading || loading || !data) {
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="عملاء محتملون" value={String(data.leadsCount)} sub={`${data.hotLeadsCount} مهتم فعليًا`} accent="gold" />
        <StatCard label="صفقات مفتوحة" value={String(data.openDealsCount)} sub={`${data.openDealsValue.toLocaleString('ar-EG')} ج.م`} />
        <StatCard label="إيرادات محققة" value={`${data.wonDealsValue.toLocaleString('ar-EG')} ج.م`} sub="من صفقات مغلقة" accent="clay" />
        <StatCard label="عملاء" value={String(data.customersCount)} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="مهام تحتاج متابعة" value={String(data.pendingTasksCount)} />
        <StatCard label="مواعيد اليوم" value={String(data.todayAppointmentsCount)} />
        <StatCard label="حملات نشطة" value={String(data.activeCampaignsCount)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-ink-950">مهام تحتاج متابعة</h2>
            <Link to="/tasks" className="text-xs text-ink-900/45 hover:underline">عرض الكل</Link>
          </div>
          {tasks.length === 0 ? (
            <div className="text-sm text-ink-900/40 text-center py-8">لا توجد مهام معلّقة 🎉</div>
          ) : (
            <div className="space-y-3">
              {tasks.map(t => (
                <div key={t.id} className="flex items-center justify-between border-b border-sand-100 last:border-0 pb-3 last:pb-0">
                  <div>
                    <div className="font-semibold text-sm text-ink-950">{t.title}</div>
                    <div className="text-xs text-ink-900/45 mt-1">{t.due_date ?? 'بدون تاريخ'}</div>
                  </div>
                  <Badge tone={t.priority === 'عالية' ? 'danger' : t.priority === 'متوسطة' ? 'warning' : 'default'}>{t.priority}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-ink-950">مواعيد اليوم</h2>
            <Link to="/appointments" className="text-xs text-ink-900/45 hover:underline">عرض الكل</Link>
          </div>
          {appointments.length === 0 ? (
            <div className="text-sm text-ink-900/40 text-center py-8">لا توجد مواعيد اليوم</div>
          ) : (
            <div className="space-y-3">
              {appointments.map(a => (
                <div key={a.id} className="flex items-center justify-between border-b border-sand-100 last:border-0 pb-3 last:pb-0">
                  <div>
                    <div className="font-semibold text-sm text-ink-950">{a.customers?.name ?? 'عميل'}</div>
                    <div className="text-xs text-ink-900/45 mt-1">{a.services?.name ?? '—'} · {a.appointment_time ?? '—'}</div>
                  </div>
                  <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
