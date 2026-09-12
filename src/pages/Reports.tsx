import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '../components/ui'
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

function formatCurrency(value: number) {
  return `${value.toLocaleString('ar-EG')} ج.م`
}

function formatNumber(value: number) {
  return value.toLocaleString('ar-EG')
}

function percentage(value: number, total: number) {
  if (!total) return 0
  return Math.min(100, Math.round((value / total) * 100))
}

function ReportIcon({
  type,
}: {
  type: 'sales' | 'customers' | 'leads' | 'tasks' | 'campaigns'
}) {
  if (type === 'sales') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 19V5M4 19h16"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m7 15 3-4 3 2 5-7"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 6h3v3"
        />
      </svg>
    )
  }

  if (type === 'customers') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="9" cy="8" r="3" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.5 19c.7-3.2 2.5-4.8 5.5-4.8s4.8 1.6 5.5 4.8"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 5.5a3 3 0 0 1 0 5.8M16 14.2c2.5.3 4 1.9 4.5 4.8"
        />
      </svg>
    )
  }

  if (type === 'leads') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="12" cy="8" r="3.2" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5.5 19c.8-3.5 2.9-5.2 6.5-5.2s5.7 1.7 6.5 5.2"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18 4v3M16.5 5.5h3"
        />
      </svg>
    )
  }

  if (type === 'tasks') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="4" y="3.5" width="16" height="17" rx="3" />
        <path strokeLinecap="round" d="M8 8h8M8 12h8M8 16h4" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m14.5 15.5 1.2 1.2 2.3-2.7"
        />
      </svg>
    )
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path strokeLinecap="round" d="M7.5 3v4M16.5 3v4M3.5 9.5h17" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m8 15 2.3 2.2L16 11.5"
      />
    </svg>
  )
}

function KpiCard({
  label,
  value,
  sub,
  type,
  progress,
}: {
  label: string
  value: string
  sub?: string
  type: 'sales' | 'customers' | 'leads' | 'tasks' | 'campaigns'
  progress?: number
}) {
  return (
    <Card className="relative overflow-hidden border-sand-200/80 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.035)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-900/45">
            {label}
          </p>

          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
            {value}
          </p>

          {sub && (
            <p className="mt-1.5 text-xs text-ink-900/45">
              {sub}
            </p>
          )}
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sand-100 text-ink-900">
          <ReportIcon type={type} />
        </div>
      </div>

      {typeof progress === 'number' && (
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="text-ink-900/40">النسبة</span>
            <span className="font-semibold text-ink-900/60">
              {progress}%
            </span>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-sand-100">
            <div
              className="h-full rounded-full bg-ink-900 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  )
}

function SkeletonCard() {
  return (
    <Card className="animate-pulse border-sand-200/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="h-3 w-28 rounded bg-sand-100" />
          <div className="h-8 w-32 rounded bg-sand-100" />
          <div className="h-3 w-24 rounded bg-sand-100" />
        </div>

        <div className="h-11 w-11 rounded-2xl bg-sand-100" />
      </div>
    </Card>
  )
}

export default function Reports() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization()

  const [counts, setCounts] = useState<Counts | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadReports = useCallback(async () => {
    if (!supabase || !organizationId) {
      setCounts(null)
      setLoading(false)
      return
    }

    setError(null)

    const isInitialLoad = !counts

    if (isInitialLoad) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      const [
        leadsRes,
        customersRes,
        dealsRes,
        tasksRes,
        campaignsRes,
      ] = await Promise.all([
        supabase
          .from('leads')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('organization_id', organizationId),

        supabase
          .from('customers')
          .select('status')
          .eq('organization_id', organizationId),

        supabase
          .from('deals')
          .select('value')
          .eq('organization_id', organizationId),

        supabase
          .from('tasks')
          .select('status')
          .eq('organization_id', organizationId),

        supabase
          .from('campaigns')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('organization_id', organizationId),
      ])

      const firstError =
        leadsRes.error ??
        customersRes.error ??
        dealsRes.error ??
        tasksRes.error ??
        campaignsRes.error

      if (firstError) {
        throw firstError
      }

      const customers = customersRes.data ?? []
      const deals = dealsRes.data ?? []
      const tasks = tasksRes.data ?? []

      const dealsValue = deals.reduce(
        (sum: number, deal: { value: number | null }) =>
          sum + Number(deal.value ?? 0),
        0
      )

      const activeCustomers = customers.filter(
        (customer: { status: string | null }) =>
          customer.status === 'نشط'
      ).length

      const tasksDone = tasks.filter(
        (task: { status: string | null }) =>
          task.status === 'مكتملة'
      ).length

      setCounts({
        leads: leadsRes.count ?? 0,
        customers: customers.length,
        activeCustomers,
        dealsValue,
        dealsCount: deals.length,
        avgDeal:
          deals.length > 0
            ? Math.round(dealsValue / deals.length)
            : 0,
        tasksDone,
        tasksTotal: tasks.length,
        campaignsCount: campaignsRes.count ?? 0,
      })

      setLastUpdated(new Date())
    } catch (loadError) {
      console.error('Reports load error:', loadError)

      setError(
        'حدث خطأ أثناء تحميل التقارير. حاول تحديث البيانات مرة أخرى.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [organizationId, counts])

  useEffect(() => {
    if (!orgLoading && organizationId) {
      loadReports()
    }

    if (!orgLoading && !organizationId) {
      setLoading(false)
    }
  }, [organizationId, orgLoading])

  const metrics = useMemo(() => {
    if (!counts) {
      return {
        customerRate: 0,
        taskRate: 0,
      }
    }

    return {
      customerRate: percentage(
        counts.activeCustomers,
        counts.customers
      ),
      taskRate: percentage(
        counts.tasksDone,
        counts.tasksTotal
      ),
    }
  }, [counts])

  if (orgLoading) {
    return (
      <div
        dir="rtl"
        className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8"
      >
        <div className="animate-pulse">
          <div className="h-8 w-36 rounded-lg bg-sand-100" />
          <div className="mt-2 h-4 w-72 max-w-full rounded bg-sand-100" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (orgError || !organizationId) {
    return (
      <div
        dir="rtl"
        className="mx-auto flex min-h-[50vh] w-full max-w-3xl items-center justify-center px-4 py-12"
      >
        <Card className="w-full border-red-100 bg-red-50/60 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4m0 4h.01M10.3 3.8 2.9 17a2 2 0 0 0 1.74 3h14.72a2 2 0 0 0 1.74-3L13.7 3.8a2 2 0 0 0-3.4 0Z"
              />
            </svg>
          </div>

          <h2 className="mt-4 text-base font-bold text-red-900">
            تعذر تحميل التقارير
          </h2>

          <p className="mt-2 text-sm leading-6 text-red-700/80">
            {orgError ?? 'تعذر تحديد المؤسسة الخاصة بحسابك'}
          </p>
        </Card>
      </div>
    )
  }

  if (loading || !counts) {
    return (
      <div
        dir="rtl"
        className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8"
      >
        <div className="animate-pulse">
          <div className="h-8 w-36 rounded-lg bg-sand-100" />
          <div className="mt-2 h-4 w-72 max-w-full rounded bg-sand-100" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>

        <Card className="h-48 animate-pulse border-sand-200/70" />
      </div>
    )
  }

  return (
    <div
      dir="rtl"
      className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8"
    >
      <section className="overflow-hidden rounded-3xl border border-sand-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-950 text-white shadow-sm">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 19V5M4 19h16"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m7 15 3-4 3 2 5-7"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 6h3v3"
                  />
                </svg>
              </div>

              <div className="min-w-0">
                <div className="mb-2 inline-flex rounded-full border border-sand-200 bg-sand-50 px-2.5 py-1 text-[11px] font-semibold text-ink-900/60">
                  نظرة عامة على الأداء
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
                  التقارير
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-900/55">
                  تابع أداء المبيعات والعملاء والمهام والحملات من مكان واحد.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadReports}
              disabled={refreshing}
              className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-sand-200 bg-white px-4 text-sm font-semibold text-ink-950 transition hover:bg-sand-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 11a8 8 0 0 0-14.8-4.2L4 9"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h5"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 13a8 8 0 0 0 14.8 4.2L20 15"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 20v-5h-5"
                />
              </svg>

              {refreshing ? 'جاري التحديث...' : 'تحديث البيانات'}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <Card className="border-red-100 bg-red-50/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 8v4m0 4h.01"
                  />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </div>

              <div>
                <p className="text-sm font-semibold text-red-900">
                  تعذر تحديث بعض البيانات
                </p>

                <p className="mt-1 text-xs leading-5 text-red-700/80">
                  {error}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadReports}
              className="text-xs font-bold text-red-700 underline underline-offset-4"
            >
              إعادة المحاولة
            </button>
          </div>
        </Card>
      )}

      <section
        aria-label="مؤشرات الأداء الرئيسية"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard
          label="قيمة مسار المبيعات"
          value={formatCurrency(counts.dealsValue)}
          sub={`${formatNumber(counts.dealsCount)} صفقة`}
          type="sales"
        />

        <KpiCard
          label="متوسط قيمة الصفقة"
          value={formatCurrency(counts.avgDeal)}
          sub="متوسط الصفقات الحالية"
          type="sales"
        />

        <KpiCard
          label="العملاء النشطون"
          value={formatNumber(counts.activeCustomers)}
          sub={`من إجمالي ${formatNumber(counts.customers)} عميل`}
          type="customers"
          progress={metrics.customerRate}
        />

        <KpiCard
          label="العملاء المحتملون"
          value={formatNumber(counts.leads)}
          sub="إجمالي العملاء المحتملين"
          type="leads"
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <Card className="border-sand-200/80 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.035)] lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-ink-950">
                ملخص النشاط
              </h2>

              <p className="mt-1 text-xs leading-5 text-ink-900/45">
                صورة سريعة عن أهم أنشطة مساحة العمل.
              </p>
            </div>

            <div className="rounded-xl bg-sand-50 px-3 py-2 text-xs font-semibold text-ink-900/55">
              مباشر من قاعدة البيانات
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sand-100 text-ink-900">
                    <ReportIcon type="customers" />
                  </span>

                  <span className="text-sm font-semibold text-ink-950">
                    العملاء النشطون
                  </span>
                </div>

                <span className="text-xs font-bold text-ink-900/60">
                  {formatNumber(counts.activeCustomers)} /{' '}
                  {formatNumber(counts.customers)}
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-sand-100">
                <div
                  className="h-full rounded-full bg-ink-900 transition-all duration-500"
                  style={{
                    width: `${metrics.customerRate}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sand-100 text-ink-900">
                    <ReportIcon type="tasks" />
                  </span>

                  <span className="text-sm font-semibold text-ink-950">
                    إنجاز المهام
                  </span>
                </div>

                <span className="text-xs font-bold text-ink-900/60">
                  {formatNumber(counts.tasksDone)} /{' '}
                  {formatNumber(counts.tasksTotal)}
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-sand-100">
                <div
                  className="h-full rounded-full bg-ink-900 transition-all duration-500"
                  style={{
                    width: `${metrics.taskRate}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sand-100 text-ink-900">
                    <ReportIcon type="campaigns" />
                  </span>

                  <span className="text-sm font-semibold text-ink-950">
                    الحملات
                  </span>
                </div>

                <span className="text-xs font-bold text-ink-900/60">
                  {formatNumber(counts.campaignsCount)}
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-sand-100">
                <div
                  className="h-full min-w-[8px] rounded-full bg-ink-900 transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      counts.campaignsCount * 10
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-sand-200/80 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.035)]">
          <div>
            <h2 className="text-base font-bold text-ink-950">
              حالة المهام
            </h2>

            <p className="mt-1 text-xs leading-5 text-ink-900/45">
              نسبة المهام التي تم إنجازها من إجمالي المهام.
            </p>
          </div>

          <div className="mt-7 flex flex-col items-center">
            <div
              className="relative flex h-36 w-36 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(#171717 ${metrics.taskRate}%, #f2eee8 ${metrics.taskRate}% 100%)`,
              }}
            >
              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white">
                <span className="text-3xl font-bold tracking-tight text-ink-950">
                  {metrics.taskRate}%
                </span>

                <span className="mt-1 text-[11px] text-ink-900/40">
                  مكتملة
                </span>
              </div>
            </div>

            <div className="mt-5 grid w-full grid-cols-2 gap-2">
              <div className="rounded-xl bg-sand-50 p-3 text-center">
                <p className="text-[11px] text-ink-900/40">
                  مكتملة
                </p>

                <p className="mt-1 text-lg font-bold text-ink-950">
                  {formatNumber(counts.tasksDone)}
                </p>
              </div>

              <div className="rounded-xl bg-sand-50 p-3 text-center">
                <p className="text-[11px] text-ink-900/40">
                  الإجمالي
                </p>

                <p className="mt-1 text-lg font-bold text-ink-950">
                  {formatNumber(counts.tasksTotal)}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-sand-200/80 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand-100 text-ink-900">
              <ReportIcon type="leads" />
            </div>

            <div>
              <p className="text-[11px] text-ink-900/40">
                العملاء المحتملون
              </p>

              <p className="mt-0.5 text-lg font-bold text-ink-950">
                {formatNumber(counts.leads)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-sand-200/80 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand-100 text-ink-900">
              <ReportIcon type="customers" />
            </div>

            <div>
              <p className="text-[11px] text-ink-900/40">
                إجمالي العملاء
              </p>

              <p className="mt-0.5 text-lg font-bold text-ink-950">
                {formatNumber(counts.customers)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-sand-200/80 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand-100 text-ink-900">
              <ReportIcon type="sales" />
            </div>

            <div>
              <p className="text-[11px] text-ink-900/40">
                عدد الصفقات
              </p>

              <p className="mt-0.5 text-lg font-bold text-ink-950">
                {formatNumber(counts.dealsCount)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-sand-200/80 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand-100 text-ink-900">
              <ReportIcon type="campaigns" />
            </div>

            <div>
              <p className="text-[11px] text-ink-900/40">
                الحملات
              </p>

              <p className="mt-0.5 text-lg font-bold text-ink-950">
                {formatNumber(counts.campaignsCount)}
              </p>
            </div>
          </div>
        </Card>
      </section>

      <Card className="border-sand-200/80 bg-sand-50/40 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-ink-900 shadow-sm">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="12" r="8.5" />
              <path
                strokeLinecap="round"
                d="M12 10v5M12 7.5h.01"
              />
            </svg>
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-bold text-ink-950">
              عن هذه التقارير
            </h3>

            <p className="mt-1 text-xs leading-6 text-ink-900/50">
              يتم احتساب المؤشرات مباشرة من بيانات مساحة العمل الحالية في
              Supabase. استخدم زر تحديث البيانات للحصول على أحدث أرقام بعد
              إضافة أو تعديل البيانات.
            </p>

            {lastUpdated && (
              <p className="mt-2 text-[11px] font-medium text-ink-900/35">
                آخر تحديث:{' '}
                {lastUpdated.toLocaleTimeString('ar-EG', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
