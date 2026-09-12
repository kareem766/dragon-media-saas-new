import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Card,
  StatCard,
  Badge,
  statusTone,
  Skeleton,
} from '../components/ui'
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

function SectionIcon({
  type,
}: {
  type: 'tasks' | 'appointments' | 'plus'
}) {
  if (type === 'tasks') {
    return (
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M9 11L12 14L20 6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 12V19C20 20.1 19.1 21 18 21H6C4.9 21 4 20.1 4 19V5C4 3.9 4.9 3 6 3H14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (type === 'appointments') {
    return (
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect
          x="3"
          y="5"
          width="18"
          height="16"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M8 3V7M16 3V7M3 10H21"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 5V19M5 12H19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function EmptyState({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-9 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sand-100 text-sand-500">
        <svg
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M7 3H17C18.1 3 19 3.9 19 5V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V5C5 3.9 5.9 3 7 3Z"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M8.5 8H15.5M8.5 12H15.5M8.5 16H12.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <p className="text-sm font-semibold text-ink-700">
        {title}
      </p>

      {description && (
        <p className="mt-1 max-w-xs text-xs leading-5 text-ink-400">
          {description}
        </p>
      )}
    </div>
  )
}

export default function Dashboard() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization()

  const [data, setData] =
    useState<DashboardData | null>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [appointments, setAppointments] =
    useState<AppointmentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId || !supabase) {
      return
    }

    const sb = supabase
    const orgId = organizationId
    const today = new Date()
      .toISOString()
      .slice(0, 10)

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
        sb
          .from('leads')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('organization_id', orgId),

        sb
          .from('leads')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('organization_id', orgId)
          .eq('status', 'مهتم'),

        sb
          .from('customers')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('organization_id', orgId),

        sb
          .from('deals')
          .select(
            'value, pipeline_stages(name)'
          )
          .eq('organization_id', orgId),

        sb
          .from('tasks')
          .select(
            'id, title, due_date, priority, status'
          )
          .eq('organization_id', orgId)
          .neq('status', 'مكتملة')
          .order('due_date', {
            ascending: true,
          })
          .limit(4),

        sb
          .from('tasks')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('organization_id', orgId)
          .neq('status', 'مكتملة'),

        sb
          .from('appointments')
          .select(
            'id, appointment_time, status, customers(name), services(name)'
          )
          .eq('organization_id', orgId)
          .eq('appointment_date', today),

        sb
          .from('campaigns')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('organization_id', orgId)
          .in('status', [
            'مجدولة',
            'قيد التنفيذ',
          ]),
      ])

      const deals =
        (dealsRes.data ?? []) as unknown as {
          value: number
          pipeline_stages: {
            name: string
          } | null
        }[]

      const wonDeals = deals.filter(
        (deal) =>
          deal.pipeline_stages?.name ===
          'تم التعاقد'
      )

      const openDeals = deals.filter(
        (deal) =>
          deal.pipeline_stages?.name !==
            'تم التعاقد' &&
          deal.pipeline_stages?.name !==
            'مغلق - خسرنا'
      )

      setData({
        leadsCount: leadsRes.count ?? 0,
        hotLeadsCount: hotLeadsRes.count ?? 0,
        customersCount: customersRes.count ?? 0,
        openDealsValue: openDeals.reduce(
          (sum, deal) =>
            sum + Number(deal.value ?? 0),
          0
        ),
        openDealsCount: openDeals.length,
        wonDealsValue: wonDeals.reduce(
          (sum, deal) =>
            sum + Number(deal.value ?? 0),
          0
        ),
        pendingTasksCount:
          pendingTasksRes.count ?? 0,
        todayAppointmentsCount:
          appointmentsTodayRes.data?.length ?? 0,
        activeCampaignsCount:
          campaignsRes.count ?? 0,
      })

      setTasks(
        (tasksRes.data ?? []) as TaskRow[]
      )

      setAppointments(
        (appointmentsTodayRes.data ??
          []) as unknown as AppointmentRow[]
      )

      setLoading(false)
    }

    load()
  }, [organizationId])

  if (
    orgLoading ||
    loading ||
    !data
  ) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton
              key={item}
              className="h-28 rounded-2xl"
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton
              key={item}
              className="h-24 rounded-2xl"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (
    orgError ||
    !organizationId
  ) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M12 8V12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M12 16H12.01"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M10.3 3.9L2.7 17C1.93 18.33 2.89 20 4.43 20H19.57C21.11 20 22.07 18.33 21.3 17L13.7 3.9C12.93 2.57 11.07 2.57 10.3 3.9Z"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          </div>

          <p className="text-sm font-semibold text-red-700">
            {orgError ??
              'تعذر تحديد المؤسسة الخاصة بحسابك'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* Page intro */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gold-600">
            لوحة التحكم
          </p>

          <h2 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
            نظرة عامة على أعمالك
          </h2>

          <p className="mt-1.5 text-sm leading-6 text-ink-500">
            تابع العملاء والمبيعات والمهام والمواعيد
            من مكان واحد.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/crm"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-ink-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <SectionIcon type="plus" />
            عميل جديد
          </Link>

          <Link
            to="/tasks"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-ink-100 bg-white px-4 py-2 text-sm font-semibold text-ink-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-ink-50 hover:shadow-md"
          >
            عرض المهام
          </Link>
        </div>
      </div>

      {/* Main KPIs */}
      <section aria-label="المؤشرات الرئيسية">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink-800">
            مؤشرات الأداء
          </h3>

          <span className="text-xs text-ink-400">
            ملخص النشاط الحالي
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="transition-transform duration-200 hover:-translate-y-0.5">
            <StatCard
              label="عملاء محتملون"
              value={String(data.leadsCount)}
              sub={`${data.hotLeadsCount} مهتم فعليًا`}
              accent="gold"
            />
          </div>

          <div className="transition-transform duration-200 hover:-translate-y-0.5">
            <StatCard
              label="صفقات مفتوحة"
              value={String(data.openDealsCount)}
              sub={`${data.openDealsValue.toLocaleString(
                'ar-EG'
              )} ج.م`}
            />
          </div>

          <div className="transition-transform duration-200 hover:-translate-y-0.5">
            <StatCard
              label="إيرادات محققة"
              value={`${data.wonDealsValue.toLocaleString(
                'ar-EG'
              )} ج.م`}
              sub="من صفقات مغلقة"
              accent="clay"
            />
          </div>

          <div className="transition-transform duration-200 hover:-translate-y-0.5">
            <StatCard
              label="عملاء"
              value={String(data.customersCount)}
            />
          </div>
        </div>
      </section>

      {/* Secondary KPIs */}
      <section aria-label="النشاط اليومي">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink-800">
            النشاط والمتابعة
          </h3>

          <span className="text-xs text-ink-400">
            اليوم
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <div className="transition-transform duration-200 hover:-translate-y-0.5">
            <StatCard
              label="مهام تحتاج متابعة"
              value={String(
                data.pendingTasksCount
              )}
            />
          </div>

          <div className="transition-transform duration-200 hover:-translate-y-0.5">
            <StatCard
              label="مواعيد اليوم"
              value={String(
                data.todayAppointmentsCount
              )}
            />
          </div>

          <div className="col-span-2 transition-transform duration-200 hover:-translate-y-0.5 sm:col-span-1">
            <StatCard
              label="حملات نشطة"
              value={String(
                data.activeCampaignsCount
              )}
            />
          </div>
        </div>
      </section>

      {/* Tasks + Appointments */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden p-0 transition-shadow duration-200 hover:shadow-md">
          <div className="flex items-center justify-between gap-3 border-b border-sand-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-50 text-gold-700">
                <SectionIcon type="tasks" />
              </div>

              <div>
                <h2 className="font-bold text-ink-950">
                  مهام تحتاج متابعة
                </h2>

                <p className="mt-0.5 text-[11px] text-ink-400">
                  أقرب المهام المستحقة
                </p>
              </div>
            </div>

            <Link
              to="/tasks"
              className="rounded-lg px-2 py-1.5 text-xs font-semibold text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800"
            >
              عرض الكل
            </Link>
          </div>

          {tasks.length === 0 ? (
            <EmptyState
              title="لا توجد مهام معلّقة"
              description="كل المهام الحالية مكتملة أو لا توجد مهام مستحقة."
            />
          ) : (
            <div className="px-5">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-4 border-b border-sand-100 py-4 last:border-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink-950">
                      {task.title}
                    </div>

                    <div className="mt-1 text-xs text-ink-400">
                      {task.due_date ??
                        'بدون تاريخ'}
                    </div>
                  </div>

                  <Badge
                    tone={
                      task.priority === 'عالية'
                        ? 'danger'
                        : task.priority ===
                            'متوسطة'
                          ? 'warning'
                          : 'default'
                    }
                  >
                    {task.priority}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden p-0 transition-shadow duration-200 hover:shadow-md">
          <div className="flex items-center justify-between gap-3 border-b border-sand-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-50 text-ink-700">
                <SectionIcon type="appointments" />
              </div>

              <div>
                <h2 className="font-bold text-ink-950">
                  مواعيد اليوم
                </h2>

                <p className="mt-0.5 text-[11px] text-ink-400">
                  جدول مواعيد العملاء اليوم
                </p>
              </div>
            </div>

            <Link
              to="/appointments"
              className="rounded-lg px-2 py-1.5 text-xs font-semibold text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800"
            >
              عرض الكل
            </Link>
          </div>

          {appointments.length === 0 ? (
            <EmptyState
              title="لا توجد مواعيد اليوم"
              description="لم يتم تسجيل أي موعد لليوم حتى الآن."
            />
          ) : (
            <div className="px-5">
              {appointments.map(
                (appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between gap-4 border-b border-sand-100 py-4 last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink-950">
                        {appointment.customers
                          ?.name ?? 'عميل'}
                      </div>

                      <div className="mt-1 truncate text-xs text-ink-400">
                        {appointment.services
                          ?.name ?? '—'}{' '}
                        <span className="px-1">
                          ·
                        </span>
                        {appointment.appointment_time ??
                          '—'}
                      </div>
                    </div>

                    <Badge
                      tone={statusTone(
                        appointment.status
                      )}
                    >
                      {appointment.status}
                    </Badge>
                  </div>
                )
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
