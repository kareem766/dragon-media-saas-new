import React, { useEffect, useMemo, useState } from 'react'
import { Card, StatCard, Badge, Button } from '../components/ui'
import { supabase } from '../lib/supabaseClient'

interface OrgRow {
  id: string
  name: string
  business_type: string | null
  plan: string
  created_at: string
  usersCount: number
  leadsCount: number
  customersCount: number
  dealsValue: number
  suspended?: boolean
}

interface Overview {
  totals: {
    organizations: number
    users: number
    leads: number
    customers: number
    dealsValue: number
  }
  organizations: OrgRow[]
}

interface FinancialSummary {
  totalRevenue: number
  transactionCount: number
  averageTransaction: number
  monthRevenue: number
  previousMonthRevenue: number
  yearRevenue: number
  currentMonthCount: number
  previousMonthCount: number
  revenueChangePercent: number
}

interface FinancialMethod {
  method: string
  count: number
  revenue: number
}

interface FinancialPlan {
  plan_id: string | null
  plan_name: string
  count: number
  revenue: number
}

interface FinancialLifecycle {
  activeSubscriptions: number
  expiringSubscriptions: number
  expiredSubscriptions: number
  invoices: {
    total: number
    paid: number
    pending: number
  }
}

interface FinancialTransaction {
  payment_id: string
  amount: number
  method: string
  paid_at: string
  invoice_id: string
  organization_id: string
  subscription_id: string
  organization_name: string
  invoice_status?: string
  plan_id?: string | null
  plan_name?: string
}

interface FinancialData {
  summary: FinancialSummary
  lifecycle: FinancialLifecycle
  byMethod: FinancialMethod[]
  byPlan: FinancialPlan[]
  transactions: FinancialTransaction[]
}

const methodLabels: Record<string, string> = {
  vodafone_cash: 'فودافون كاش',
  instapay: 'InstaPay',
  bank_transfer: 'تحويل بنكي',
}

const formatMoney = (value: number) =>
  `${Number(value || 0).toLocaleString('ar-EG')} ج.م`

const formatDate = (value: string) => {
  if (!value) return '—'

  return new Date(value).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatDateTime = (value: string) => {
  if (!value) return '—'

  return new Date(value).toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatPercent = (value: number) => {
  const number = Number(value || 0)

  return `${number >= 0 ? '+' : ''}${number.toFixed(1)}%`
}

function DashboardSkeleton() {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-sand-50 p-4 sm:p-6"
    >
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="space-y-3">
          <div className="h-8 w-72 max-w-full animate-pulse rounded-xl bg-sand-200" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded-lg bg-sand-100" />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-sand-200 bg-white p-5"
            >
              <div className="animate-pulse space-y-3">
                <div className="h-3 w-24 rounded bg-sand-100" />
                <div className="h-7 w-20 rounded-lg bg-sand-200" />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-sand-200 bg-white p-5">
          <div className="animate-pulse space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="h-5 w-52 rounded-lg bg-sand-200" />
                <div className="h-3 w-72 max-w-full rounded bg-sand-100" />
              </div>

              <div className="h-10 w-32 rounded-xl bg-sand-100" />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="h-11 rounded-xl bg-sand-100" />
              <div className="h-11 rounded-xl bg-sand-100" />
              <div className="h-11 rounded-xl bg-sand-100" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 rounded-2xl bg-sand-100"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-sand-200 bg-white p-5">
          <div className="animate-pulse space-y-4">
            <div className="h-5 w-64 rounded-lg bg-sand-200" />

            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-14 rounded-xl bg-sand-100"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div
      dir="rtl"
      className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center"
      role="alert"
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-lg font-bold text-red-700">
        !
      </div>

      <h2 className="text-base font-bold text-red-950">
        تعذر تحميل لوحة التحكم
      </h2>

      <p className="mt-2 text-sm leading-6 text-red-700">
        {message}
      </p>

      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-xl bg-ink-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-800 focus:outline-none focus:ring-2 focus:ring-ink-950/20"
      >
        إعادة المحاولة
      </button>
    </div>
  )
}

function SectionTitle({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div>
      <h2 className="text-base font-bold text-ink-950 sm:text-lg">
        {title}
      </h2>

      {description && (
        <p className="mt-1 text-xs leading-5 text-ink-900/50 sm:text-sm">
          {description}
        </p>
      )}
    </div>
  )
}

export default function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null)

  const [financial, setFinancial] =
    useState<FinancialData | null>(null)

  const [error, setError] = useState<string | null>(null)

  const [financialError, setFinancialError] =
    useState<string | null>(null)

  const [loading, setLoading] = useState(true)

  const [financialLoading, setFinancialLoading] =
    useState(true)

  const [actingId, setActingId] =
    useState<string | null>(null)

  const [toast, setToast] = useState<string | null>(null)

  const [paymentMethod, setPaymentMethod] =
    useState('all')

  const [fromDate, setFromDate] = useState('')

  const [toDate, setToDate] = useState('')

  const loadOverview = async () => {
    if (!supabase) {
      setError('تعذر الاتصال بخدمة البيانات.')
      setLoading(false)
      return
    }

    setError(null)

    try {
      const { data: sessionData } =
        await supabase.auth.getSession()

      const token =
        sessionData.session?.access_token

      const [overviewRes, orgsRes] =
        await Promise.all([
          fetch('/api/admin/overview', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),

          supabase
            .from('organizations')
            .select('id, suspended'),
        ])

      const json = await overviewRes.json().catch(() => ({}))

      if (!overviewRes.ok) {
        throw new Error(
          json.error || 'تعذر تحميل بيانات لوحة الإدارة.'
        )
      }

      const organizations = Array.isArray(
        json.organizations
      )
        ? json.organizations
        : []

      const suspendedMap = new Map(
        (orgsRes.data ?? []).map((o: any) => [
          o.id,
          o.suspended,
        ])
      )

      json.organizations = organizations.map(
        (o: OrgRow) => ({
          ...o,
          suspended: suspendedMap.get(o.id),
        })
      )

      setData(json)
    } catch (err: any) {
      setError(
        err?.message ||
          'حدث خطأ أثناء تحميل لوحة الإدارة.'
      )
    } finally {
      setLoading(false)
    }
  }

  const loadFinancial = async () => {
    if (!supabase) {
      setFinancialError(
        'تعذر الاتصال بخدمة البيانات.'
      )
      setFinancialLoading(false)
      return
    }

    setFinancialLoading(true)
    setFinancialError(null)

    try {
      const { data: sessionData } =
        await supabase.auth.getSession()

      const token =
        sessionData.session?.access_token

      const params = new URLSearchParams()

      if (paymentMethod !== 'all') {
        params.set('method', paymentMethod)
      }

      if (fromDate) {
        params.set('from', fromDate)
      }

      if (toDate) {
        params.set('to', toDate)
      }

      const queryString = params.toString()

      const response = await fetch(
        `/api/admin/financial${
          queryString ? `?${queryString}` : ''
        }`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const json = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          json.error ||
            'تعذر تحميل البيانات المالية.'
        )
      }

      setFinancial(json)
    } catch (err: any) {
      setFinancialError(
        err?.message ||
          'حدث خطأ أثناء تحميل البيانات المالية.'
      )
    } finally {
      setFinancialLoading(false)
    }
  }

  useEffect(() => {
    loadOverview()
  }, [])

  useEffect(() => {
    loadFinancial()
  }, [paymentMethod, fromDate, toDate])

  useEffect(() => {
    if (!toast) return

    const timer = setTimeout(
      () => setToast(null),
      3000
    )

    return () => clearTimeout(timer)
  }, [toast])

  const handleAction = async (org: OrgRow) => {
    const willSuspend = !org.suspended

    const confirmed = window.confirm(
      willSuspend
        ? 'هل أنت متأكد من تعليق هذه الشركة؟'
        : 'هل أنت متأكد من تفعيل هذه الشركة؟'
    )

    if (!confirmed) return

    if (!supabase) return

    setActingId(org.id)

    try {
      const { data: sessionData } =
        await supabase.auth.getSession()

      const token =
        sessionData.session?.access_token

      const res = await fetch(
        '/api/admin/organizations',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: willSuspend
              ? 'suspend'
              : 'activate',
            organizationId: org.id,
          }),
        }
      )

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(
          json.error ||
            'حدث خطأ أثناء تنفيذ العملية.'
        )
      }

      setData(prev =>
        prev
          ? {
              ...prev,
              organizations:
                prev.organizations.map(o =>
                  o.id === org.id
                    ? {
                        ...o,
                        suspended: willSuspend,
                      }
                    : o
                ),
            }
          : prev
      )

      setToast(
        willSuspend
          ? `تم تعليق شركة "${org.name}" بنجاح`
          : `تم تفعيل شركة "${org.name}" بنجاح`
      )
    } catch (err: any) {
      setToast(
        err?.message ||
          'حدث خطأ أثناء تنفيذ العملية.'
      )
    } finally {
      setActingId(null)
    }
  }

  const maxPlanRevenue = useMemo(
    () =>
      Math.max(
        ...(financial?.byPlan ?? []).map(item =>
          Number(item.revenue || 0)
        ),
        1
      ),
    [financial]
  )

  const maxMethodRevenue = useMemo(
    () =>
      Math.max(
        ...(financial?.byMethod ?? []).map(item =>
          Number(item.revenue || 0)
        ),
        1
      ),
    [financial]
  )

  const revenueChange = financial
    ? Number(
        financial.summary.revenueChangePercent || 0
      )
    : 0

  const totalDisplayedRevenue =
    financial?.summary.totalRevenue ?? 0

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error || !data) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-sand-50 p-4 sm:p-6"
      >
        <div className="mx-auto max-w-[1600px] py-10 sm:py-16">
          <ErrorState
            message={
              error ||
              'تعذر تحميل بيانات لوحة الإدارة.'
            }
            onRetry={() => {
              setLoading(true)
              loadOverview()
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-sand-50 p-4 sm:p-6"
    >
      <div className="mx-auto max-w-[1600px] space-y-6">
        {toast && (
          <div
            className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-2xl border border-ink-800 bg-ink-950 px-4 py-3 text-center text-sm font-medium text-white shadow-xl sm:left-1/2 sm:right-auto sm:w-auto sm:-translate-x-1/2"
            role="status"
            aria-live="polite"
          >
            {toast}
          </div>
        )}

        {/* Header */}
        <header className="rounded-2xl border border-sand-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center rounded-full border border-gold-500/20 bg-gold-500/10 px-3 py-1 text-[11px] font-bold text-gold-700">
                إدارة المنصة
              </div>

              <h1 className="break-words text-xl font-bold tracking-tight text-ink-950 sm:text-2xl lg:text-3xl">
                لوحة تحكم Dragon Media
              </h1>

              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-900/50">
                نظرة شاملة على أداء المنصة والإيرادات
                والاشتراكات والشركات.
              </p>
            </div>

            <nav
              aria-label="روابط الإدارة"
              className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:flex xl:max-w-4xl xl:flex-wrap xl:justify-end"
            >
              {[
                ['#/admin/payments', 'طلبات الدفع'],
                ['#/admin/audit-logs', 'سجل النشاط'],
                ['#/admin/settings', 'إعدادات المنصة'],
                ['#/admin/branding', 'هوية المنصة'],
                ['#/admin/plans', 'إدارة الباقات'],
                ['#/admin/roles', 'الأدوار والصلاحيات'],
                ['#/admin/tickets', 'تذاكر الدعم'],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5 text-center text-xs font-semibold text-ink-900 transition hover:border-gold-400 hover:bg-gold-50 hover:text-ink-950 focus:outline-none focus:ring-2 focus:ring-gold-500/20 sm:text-sm"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </header>

        {/* Platform statistics */}
        <section aria-label="إحصائيات المنصة">
          <div className="mb-3">
            <SectionTitle
              title="نظرة عامة"
              description="المؤشرات الأساسية للمنصة."
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard
              label="عدد الشركات"
              value={String(
                data.totals.organizations
              )}
              accent="gold"
            />

            <StatCard
              label="إجمالي المستخدمين"
              value={String(data.totals.users)}
            />

            <StatCard
              label="العملاء المحتملون"
              value={String(data.totals.leads)}
            />

            <StatCard
              label="إجمالي العملاء"
              value={String(
                data.totals.customers
              )}
              accent="clay"
            />

            <StatCard
              label="قيمة الصفقات"
              value={`${Number(
                data.totals.dealsValue || 0
              ).toLocaleString('ar-EG')} ج.م`}
            />
          </div>
        </section>

        {/* Financial dashboard */}
        <section>
          <Card className="overflow-hidden">
            <div className="border-b border-sand-200 bg-white p-4 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <SectionTitle
                  title="لوحة الإيرادات والمدفوعات"
                  description="الإيرادات الفعلية الناتجة عن المدفوعات المعتمدة."
                />

                <Button
                  variant="secondary"
                  onClick={loadFinancial}
                  disabled={financialLoading}
                >
                  {financialLoading
                    ? 'جاري التحديث...'
                    : 'تحديث البيانات'}
                </Button>
              </div>
            </div>

            <div className="bg-sand-50/40 p-4 sm:p-6">
              {/* Filters */}
              <div className="mb-6 rounded-2xl border border-sand-200 bg-white p-4">
                <div className="mb-3 text-xs font-bold text-ink-950">
                  فلاتر التقارير
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">
                      من تاريخ
                    </label>

                    <input
                      type="date"
                      value={fromDate}
                      onChange={e =>
                        setFromDate(e.target.value)
                      }
                      className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2.5 text-sm text-ink-950 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/10"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">
                      إلى تاريخ
                    </label>

                    <input
                      type="date"
                      value={toDate}
                      onChange={e =>
                        setToDate(e.target.value)
                      }
                      className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2.5 text-sm text-ink-950 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/10"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">
                      طريقة الدفع
                    </label>

                    <select
                      value={paymentMethod}
                      onChange={e =>
                        setPaymentMethod(
                          e.target.value
                        )
                      }
                      className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2.5 text-sm text-ink-950 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/10"
                    >
                      <option value="all">
                        كل طرق الدفع
                      </option>

                      <option value="vodafone_cash">
                        فودافون كاش
                      </option>

                      <option value="instapay">
                        InstaPay
                      </option>

                      <option value="bank_transfer">
                        تحويل بنكي
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {financialError && (
                <div
                  className="mb-6 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  role="alert"
                >
                  <div>
                    <div className="text-sm font-bold text-red-950">
                      تعذر تحميل البيانات المالية
                    </div>

                    <div className="mt-1 text-xs leading-5 text-red-700">
                      {financialError}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={loadFinancial}
                    className="shrink-0 rounded-xl bg-ink-950 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-ink-800"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              )}

              {financialLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map(
                    (_, index) => (
                      <div
                        key={index}
                        className="animate-pulse rounded-2xl border border-sand-200 bg-white p-5"
                      >
                        <div className="h-3 w-28 rounded bg-sand-100" />
                        <div className="mt-4 h-7 w-32 rounded-lg bg-sand-200" />
                      </div>
                    )
                  )}
                </div>
              ) : financial ? (
                <>
                  {/* Main financial stats */}
                  <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                      label="إجمالي الإيرادات"
                      value={formatMoney(
                        financial.summary.totalRevenue
                      )}
                      accent="gold"
                    />

                    <StatCard
                      label="إيرادات الشهر الحالي"
                      value={formatMoney(
                        financial.summary.monthRevenue
                      )}
                    />

                    <StatCard
                      label="إيرادات السنة الحالية"
                      value={formatMoney(
                        financial.summary.yearRevenue
                      )}
                    />

                    <StatCard
                      label="النمو عن الشهر السابق"
                      value={formatPercent(
                        revenueChange
                      )}
                      accent={
                        revenueChange >= 0
                          ? 'gold'
                          : 'clay'
                      }
                    />
                  </div>

                  {/* Secondary financial stats */}
                  <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                      label="إيرادات الشهر السابق"
                      value={formatMoney(
                        financial.summary
                          .previousMonthRevenue
                      )}
                    />

                    <StatCard
                      label="معاملات الشهر الحالي"
                      value={String(
                        financial.summary
                          .currentMonthCount
                      )}
                    />

                    <StatCard
                      label="معاملات الشهر السابق"
                      value={String(
                        financial.summary
                          .previousMonthCount
                      )}
                    />

                    <StatCard
                      label="متوسط قيمة المعاملة"
                      value={formatMoney(
                        financial.summary
                          .averageTransaction
                      )}
                    />
                  </div>

                  {/* Subscription lifecycle */}
                  <div className="mb-6">
                    <div className="mb-3">
                      <SectionTitle title="دورة الاشتراكات" />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <StatCard
                        label="الاشتراكات النشطة"
                        value={String(
                          financial.lifecycle
                            .activeSubscriptions
                        )}
                        accent="gold"
                      />

                      <StatCard
                        label="تنتهي خلال 3 أيام"
                        value={String(
                          financial.lifecycle
                            .expiringSubscriptions
                        )}
                      />

                      <StatCard
                        label="الاشتراكات المنتهية"
                        value={String(
                          financial.lifecycle
                            .expiredSubscriptions
                        )}
                        accent="clay"
                      />
                    </div>
                  </div>

                  {/* Invoice lifecycle */}
                  <div className="mb-6">
                    <div className="mb-3">
                      <SectionTitle title="ملخص الفواتير" />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Card className="border-sand-200 p-4">
                        <div className="text-xs text-ink-900/50">
                          إجمالي الفواتير
                        </div>

                        <div className="mt-2 text-xl font-bold text-ink-950">
                          {formatMoney(
                            financial.lifecycle
                              .invoices.total
                          )}
                        </div>
                      </Card>

                      <Card className="border-sand-200 p-4">
                        <div className="text-xs text-ink-900/50">
                          الفواتير المدفوعة
                        </div>

                        <div className="mt-2 text-xl font-bold text-ink-950">
                          {formatMoney(
                            financial.lifecycle
                              .invoices.paid
                          )}
                        </div>
                      </Card>

                      <Card className="border-sand-200 p-4">
                        <div className="text-xs text-ink-900/50">
                          الفواتير المعلقة
                        </div>

                        <div className="mt-2 text-xl font-bold text-ink-950">
                          {formatMoney(
                            financial.lifecycle
                              .invoices.pending
                          )}
                        </div>
                      </Card>
                    </div>
                  </div>

                  {/* Revenue analysis */}
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {/* Payment methods */}
                    <Card className="border-sand-200 p-4 sm:p-5">
                      <SectionTitle
                        title="الإيرادات حسب طريقة الدفع"
                        description="توزيع الإيرادات ضمن الفلاتر الحالية."
                      />

                      <div className="mt-5">
                        {financial.byMethod.length ===
                        0 ? (
                          <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50 px-4 py-10 text-center">
                            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink-900/40 shadow-sm">
                              —
                            </div>

                            <p className="text-sm font-semibold text-ink-950">
                              لا توجد معاملات
                            </p>

                            <p className="mt-1 text-xs text-ink-900/45">
                              لا توجد معاملات ضمن
                              الفلاتر الحالية.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-5">
                            {financial.byMethod.map(
                              item => {
                                const percentage =
                                  totalDisplayedRevenue >
                                  0
                                    ? (Number(
                                        item.revenue ||
                                          0
                                      ) /
                                        totalDisplayedRevenue) *
                                      100
                                    : 0

                                const barWidth =
                                  (Number(
                                    item.revenue || 0
                                  ) /
                                    maxMethodRevenue) *
                                  100

                                return (
                                  <div
                                    key={item.method}
                                    className="space-y-2.5"
                                  >
                                    <div className="flex items-center justify-between gap-3 text-sm">
                                      <span className="min-w-0 truncate font-semibold text-ink-950">
                                        {methodLabels[
                                          item.method
                                        ] ||
                                          item.method}
                                      </span>

                                      <span className="shrink-0 font-semibold text-ink-900/65">
                                        {formatMoney(
                                          item.revenue
                                        )}
                                      </span>
                                    </div>

                                    <div className="h-2 overflow-hidden rounded-full bg-sand-100">
                                      <div
                                        className="h-full rounded-full bg-gold-500 transition-all duration-500"
                                        style={{
                                          width: `${Math.min(
                                            100,
                                            barWidth
                                          )}%`,
                                        }}
                                      />
                                    </div>

                                    <div className="flex justify-between text-[11px] text-ink-900/45">
                                      <span>
                                        {item.count}{' '}
                                        معاملة
                                      </span>

                                      <span>
                                        {percentage.toFixed(
                                          1
                                        )}
                                        %
                                      </span>
                                    </div>
                                  </div>
                                )
                              }
                            )}
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* Plans */}
                    <Card className="border-sand-200 p-4 sm:p-5">
                      <SectionTitle
                        title="الإيرادات حسب الباقة"
                        description="أداء الباقات بناءً على المدفوعات الفعلية."
                      />

                      <div className="mt-5">
                        {financial.byPlan.length ===
                        0 ? (
                          <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50 px-4 py-10 text-center">
                            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink-900/40 shadow-sm">
                              —
                            </div>

                            <p className="text-sm font-semibold text-ink-950">
                              لا توجد بيانات باقات
                            </p>

                            <p className="mt-1 text-xs text-ink-900/45">
                              لا توجد بيانات ضمن
                              الفلاتر الحالية.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-5">
                            {financial.byPlan.map(
                              item => {
                                const percentage =
                                  totalDisplayedRevenue >
                                  0
                                    ? (Number(
                                        item.revenue ||
                                          0
                                      ) /
                                        totalDisplayedRevenue) *
                                      100
                                    : 0

                                const barWidth =
                                  (Number(
                                    item.revenue || 0
                                  ) /
                                    maxPlanRevenue) *
                                  100

                                return (
                                  <div
                                    key={
                                      item.plan_id ??
                                      item.plan_name
                                    }
                                    className="space-y-2.5"
                                  >
                                    <div className="flex items-center justify-between gap-3 text-sm">
                                      <span className="min-w-0 truncate font-semibold text-ink-950">
                                        {item.plan_name}
                                      </span>

                                      <span className="shrink-0 font-semibold text-ink-900/65">
                                        {formatMoney(
                                          item.revenue
                                        )}
                                      </span>
                                    </div>

                                    <div className="h-2 overflow-hidden rounded-full bg-sand-100">
                                      <div
                                        className="h-full rounded-full bg-ink-950 transition-all duration-500"
                                        style={{
                                          width: `${Math.min(
                                            100,
                                            barWidth
                                          )}%`,
                                        }}
                                      />
                                    </div>

                                    <div className="flex justify-between text-[11px] text-ink-900/45">
                                      <span>
                                        {item.count}{' '}
                                        معاملة
                                      </span>

                                      <span>
                                        {percentage.toFixed(
                                          1
                                        )}
                                        %
                                      </span>
                                    </div>
                                  </div>
                                )
                              }
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>

                  {/* Latest transactions */}
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Card className="border-sand-200 p-4 sm:p-5">
                      <SectionTitle title="أحدث المعاملات" />

                      <div className="mt-5">
                        {financial.transactions.length ===
                        0 ? (
                          <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50 px-4 py-10 text-center">
                            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink-900/40 shadow-sm">
                              —
                            </div>

                            <p className="text-sm font-semibold text-ink-950">
                              لا توجد معاملات
                            </p>

                            <p className="mt-1 text-xs text-ink-900/45">
                              ستظهر المعاملات هنا عند
                              اعتماد المدفوعات.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {financial.transactions
                              .slice(0, 5)
                              .map(transaction => (
                                <div
                                  key={
                                    transaction.payment_id
                                  }
                                  className="flex items-center justify-between gap-3 rounded-2xl border border-sand-100 bg-sand-50/50 p-3 transition hover:border-sand-200 hover:bg-sand-50"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-bold text-ink-950">
                                      {
                                        transaction.organization_name
                                      }
                                    </div>

                                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-900/45">
                                      <span>
                                        {transaction.plan_name ||
                                          'باقة غير محددة'}
                                      </span>

                                      <span>
                                        •
                                      </span>

                                      <span>
                                        {methodLabels[
                                          transaction.method
                                        ] ||
                                          transaction.method}
                                      </span>

                                      <span>
                                        •
                                      </span>

                                      <span>
                                        {formatDate(
                                          transaction.paid_at
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="shrink-0 text-sm font-bold text-ink-950">
                                    {formatMoney(
                                      transaction.amount
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* Quick summary */}
                    <Card className="border-sand-200 p-4 sm:p-5">
                      <SectionTitle title="ملخص الأداء المالي" />

                      <div className="mt-5 divide-y divide-sand-100">
                        <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
                          <span className="text-sm text-ink-900/60">
                            إجمالي المعاملات
                          </span>

                          <span className="font-bold text-ink-950">
                            {
                              financial.summary
                                .transactionCount
                            }
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-4 py-3">
                          <span className="text-sm text-ink-900/60">
                            الإيرادات الشهرية
                          </span>

                          <span className="font-bold text-ink-950">
                            {formatMoney(
                              financial.summary
                                .monthRevenue
                            )}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-4 py-3">
                          <span className="text-sm text-ink-900/60">
                            الإيرادات السنوية
                          </span>

                          <span className="font-bold text-ink-950">
                            {formatMoney(
                              financial.summary
                                .yearRevenue
                            )}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
                          <span className="text-sm text-ink-900/60">
                            متوسط المعاملة
                          </span>

                          <span className="font-bold text-ink-950">
                            {formatMoney(
                              financial.summary
                                .averageTransaction
                            )}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Full transactions */}
                  <div className="mt-6">
                    <div className="mb-3">
                      <SectionTitle
                        title="سجل المعاملات"
                        description="جميع المعاملات التي أعادها التقرير الحالي."
                      />
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[950px] text-sm">
                          <thead>
                            <tr className="border-b border-sand-200 bg-sand-50 text-ink-900/50">
                              <th className="px-4 py-3 text-right font-semibold">
                                الشركة
                              </th>

                              <th className="px-4 py-3 text-right font-semibold">
                                الباقة
                              </th>

                              <th className="px-4 py-3 text-right font-semibold">
                                المبلغ
                              </th>

                              <th className="px-4 py-3 text-right font-semibold">
                                طريقة الدفع
                              </th>

                              <th className="px-4 py-3 text-right font-semibold">
                                تاريخ الدفع
                              </th>

                              <th className="px-4 py-3 text-right font-semibold">
                                Payment ID
                              </th>

                              <th className="px-4 py-3 text-right font-semibold">
                                الحالة
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-sand-100">
                            {financial.transactions.map(
                              transaction => (
                                <tr
                                  key={
                                    transaction.payment_id
                                  }
                                  className="transition hover:bg-sand-50/70"
                                >
                                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink-950">
                                    {
                                      transaction.organization_name
                                    }
                                  </td>

                                  <td className="px-4 py-3">
                                    <Badge tone="gold">
                                      {transaction.plan_name ||
                                        'غير محددة'}
                                    </Badge>
                                  </td>

                                  <td className="whitespace-nowrap px-4 py-3 font-bold text-ink-950">
                                    {formatMoney(
                                      transaction.amount
                                    )}
                                  </td>

                                  <td className="px-4 py-3">
                                    <Badge tone="gold">
                                      {methodLabels[
                                        transaction.method
                                      ] ||
                                        transaction.method}
                                    </Badge>
                                  </td>

                                  <td className="whitespace-nowrap px-4 py-3 text-ink-900/65">
                                    {formatDateTime(
                                      transaction.paid_at
                                    )}
                                  </td>

                                  <td className="px-4 py-3 font-mono text-xs text-ink-900/50">
                                    {transaction.payment_id.slice(
                                      0,
                                      8
                                    )}
                                    ...
                                  </td>

                                  <td className="px-4 py-3">
                                    <Badge tone="success">
                                      مدفوعة
                                    </Badge>
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>

                      {financial.transactions.length ===
                        0 && (
                        <div className="px-5 py-12 text-center text-sm text-ink-900/50">
                          لا توجد معاملات ضمن الفلاتر الحالية.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </Card>
        </section>

        {/* Organizations */}
        <section>
          <Card className="overflow-hidden">
            <div className="border-b border-sand-200 bg-white p-4 sm:p-5">
              <SectionTitle
                title="الشركات المسجلة على المنصة"
                description="متابعة الشركات وحالة حساباتها وإحصاءاتها الأساسية."
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-sand-200 bg-sand-50 text-ink-900/50">
                    <th className="px-4 py-3 text-right font-semibold">
                      الشركة
                    </th>

                    <th className="px-4 py-3 text-right font-semibold">
                      النشاط
                    </th>

                    <th className="px-4 py-3 text-right font-semibold">
                      الباقة
                    </th>

                    <th className="px-4 py-3 text-right font-semibold">
                      المستخدمون
                    </th>

                    <th className="px-4 py-3 text-right font-semibold">
                      العملاء
                    </th>

                    <th className="px-4 py-3 text-right font-semibold">
                      قيمة الصفقات
                    </th>

                    <th className="px-4 py-3 text-right font-semibold">
                      الحالة
                    </th>

                    <th className="px-4 py-3 text-right font-semibold">
                      الإجراء
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-sand-100">
                  {data.organizations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-14 text-center"
                      >
                        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-sand-100 text-ink-900/40">
                          —
                        </div>

                        <div className="text-sm font-semibold text-ink-950">
                          لا توجد شركات مسجلة
                        </div>

                        <div className="mt-1 text-xs text-ink-900/45">
                          ستظهر الشركات هنا عند تسجيلها
                          على المنصة.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.organizations.map(o => (
                      <tr
                        key={o.id}
                        className="transition hover:bg-sand-50/70"
                      >
                        <td className="px-4 py-3 font-semibold text-ink-950">
                          {o.name}
                        </td>

                        <td className="px-4 py-3 text-ink-900/70">
                          {o.business_type ?? '—'}
                        </td>

                        <td className="px-4 py-3">
                          <Badge tone="gold">
                            {o.plan}
                          </Badge>
                        </td>

                        <td className="px-4 py-3 text-ink-900/70">
                          {o.usersCount}
                        </td>

                        <td className="px-4 py-3 text-ink-900/70">
                          {o.customersCount}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-ink-900/70">
                          {Number(
                            o.dealsValue || 0
                          ).toLocaleString('ar-EG')}{' '}
                          ج.م
                        </td>

                        <td className="px-4 py-3">
                          <Badge
                            tone={
                              o.suspended
                                ? 'danger'
                                : 'success'
                            }
                          >
                            {o.suspended
                              ? 'موقوفة'
                              : 'نشطة'}
                          </Badge>
                        </td>

                        <td className="px-4 py-3">
                          <Button
                            variant="secondary"
                            onClick={() =>
                              handleAction(o)
                            }
                            disabled={
                              actingId === o.id
                            }
                          >
                            {actingId === o.id
                              ? 'جاري التنفيذ...'
                              : o.suspended
                              ? 'تفعيل'
                              : 'تعليق'}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>
    </div>
  )
}
