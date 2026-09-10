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
    if (!supabase) return

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

    const json = await overviewRes.json()

    if (!overviewRes.ok) {
      setError(json.error || 'حدث خطأ')
      setLoading(false)
      return
    }

    const suspendedMap = new Map(
      (orgsRes.data ?? []).map((o: any) => [
        o.id,
        o.suspended,
      ])
    )

    json.organizations =
      json.organizations.map((o: OrgRow) => ({
        ...o,
        suspended: suspendedMap.get(o.id),
      }))

    setData(json)
    setLoading(false)
  }

  const loadFinancial = async () => {
    if (!supabase) return

    setFinancialLoading(true)
    setFinancialError(null)

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

    const json = await response.json()

    if (!response.ok) {
      setFinancialError(
        json.error || 'تعذر تحميل البيانات المالية'
      )
      setFinancialLoading(false)
      return
    }

    setFinancial(json)
    setFinancialLoading(false)
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

    setActingId(null)

    if (!res.ok) {
      setToast(
        'حدث خطأ أثناء تنفيذ العملية'
      )
      return
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
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center py-20 text-sm text-red-600">
        {error || 'تعذر تحميل لوحة التحكم'}
      </div>
    )
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-sand-50 p-4 sm:p-6 space-y-6 relative"
    >
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-ink-950 text-sand-50 text-sm px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-950">
            لوحة تحكم Dragon Media — إدارة المنصة
          </h1>

          <p className="text-sm text-ink-900/50 mt-1">
            نظرة شاملة على أداء المنصة والإيرادات والاشتراكات
          </p>
        </div>

        <div className="flex gap-4 flex-wrap">
          <a
            href="#/admin/payments"
            className="text-sm font-semibold text-gold-600 hover:underline"
          >
            مراجعة طلبات الدفع ←
          </a>

          <a
            href="#/admin/audit-logs"
            className="text-sm font-semibold text-gold-600 hover:underline"
          >
            سجل النشاط ←
          </a>

          <a
            href="#/admin/settings"
            className="text-sm font-semibold text-gold-600 hover:underline"
          >
            إعدادات المنصة ←
          </a>

          <a
            href="#/admin/branding"
            className="text-sm font-semibold text-gold-600 hover:underline"
          >
            هوية المنصة ←
          </a>

          <a
            href="#/admin/plans"
            className="text-sm font-semibold text-gold-600 hover:underline"
          >
            إدارة الباقات ←
          </a>

          <a
            href="#/admin/roles"
            className="text-sm font-semibold text-gold-600 hover:underline"
          >
            الأدوار والصلاحيات ←
          </a>

          <a
            href="#/admin/tickets"
            className="text-sm font-semibold text-gold-600 hover:underline"
          >
            تذاكر الدعم ←
          </a>
        </div>
      </div>

      {/* Existing platform statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
          label="إجمالي العملاء المحتملين"
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
          label="إجمالي قيمة الصفقات"
          value={`${data.totals.dealsValue.toLocaleString(
            'ar-EG'
          )} ج.م`}
        />
      </div>

      {/* Financial Dashboard */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold text-ink-950">
              لوحة الإيرادات والمدفوعات
            </h2>

            <p className="text-sm text-ink-900/55 mt-1">
              الإيرادات الفعلية الناتجة عن المدفوعات المعتمدة
            </p>
          </div>

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

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <div>
            <label className="block text-xs font-semibold text-ink-900/60 mb-1">
              من تاريخ
            </label>

            <input
              type="date"
              value={fromDate}
              onChange={e =>
                setFromDate(e.target.value)
              }
              className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-900/60 mb-1">
              إلى تاريخ
            </label>

            <input
              type="date"
              value={toDate}
              onChange={e =>
                setToDate(e.target.value)
              }
              className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-900/60 mb-1">
              طريقة الدفع
            </label>

            <select
              value={paymentMethod}
              onChange={e =>
                setPaymentMethod(e.target.value)
              }
              className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold-500/20"
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

        {financialError && (
          <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm mb-5">
            {financialError}
          </div>
        )}

        {financialLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
          </div>
        ) : financial ? (
          <>
            {/* Main financial stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                label="نمو الإيرادات عن الشهر السابق"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard
                label="إيرادات الشهر السابق"
                value={formatMoney(
                  financial.summary.previousMonthRevenue
                )}
              />

              <StatCard
                label="عدد معاملات الشهر الحالي"
                value={String(
                  financial.summary.currentMonthCount
                )}
              />

              <StatCard
                label="عدد معاملات الشهر السابق"
                value={String(
                  financial.summary.previousMonthCount
                )}
              />

              <StatCard
                label="متوسط قيمة المعاملة"
                value={formatMoney(
                  financial.summary.averageTransaction
                )}
              />
            </div>

            {/* Subscription lifecycle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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

            {/* Invoice lifecycle */}
            <div className="mb-6">
              <div className="font-bold text-ink-950 mb-3">
                ملخص الفواتير
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="text-xs text-ink-900/50 mb-2">
                    إجمالي الفواتير
                  </div>

                  <div className="text-xl font-bold text-ink-950">
                    {formatMoney(
                      financial.lifecycle.invoices.total
                    )}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-xs text-ink-900/50 mb-2">
                    الفواتير المدفوعة
                  </div>

                  <div className="text-xl font-bold text-ink-950">
                    {formatMoney(
                      financial.lifecycle.invoices.paid
                    )}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-xs text-ink-900/50 mb-2">
                    الفواتير المعلقة
                  </div>

                  <div className="text-xl font-bold text-ink-950">
                    {formatMoney(
                      financial.lifecycle.invoices.pending
                    )}
                  </div>
                </Card>
              </div>
            </div>

            {/* Revenue analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Payment method breakdown */}
              <Card className="p-4">
                <div className="font-bold text-ink-950 mb-4">
                  توزيع الإيرادات حسب طريقة الدفع
                </div>

                {financial.byMethod.length === 0 ? (
                  <div className="py-8 text-center text-sm text-ink-900/50">
                    لا توجد معاملات ضمن الفلاتر الحالية
                  </div>
                ) : (
                  <div className="space-y-4">
                    {financial.byMethod.map(item => {
                      const percentage =
                        totalDisplayedRevenue > 0
                          ? (Number(item.revenue || 0) /
                              totalDisplayedRevenue) *
                            100
                          : 0

                      const barWidth =
                        (Number(item.revenue || 0) /
                          maxMethodRevenue) *
                        100

                      return (
                        <div
                          key={item.method}
                          className="space-y-2"
                        >
                          <div className="flex items-center justify-between text-sm gap-3">
                            <span className="font-semibold text-ink-950">
                              {methodLabels[
                                item.method
                              ] ||
                                item.method}
                            </span>

                            <span className="text-ink-900/60 whitespace-nowrap">
                              {formatMoney(
                                item.revenue
                              )}
                            </span>
                          </div>

                          <div className="h-2 rounded-full bg-sand-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gold-500 transition-all"
                              style={{
                                width: `${Math.min(
                                  100,
                                  barWidth
                                )}%`,
                              }}
                            />
                          </div>

                          <div className="flex justify-between text-xs text-ink-900/45">
                            <span>
                              {item.count} معاملة
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
                    })}
                  </div>
                )}
              </Card>

              {/* Revenue by plan */}
              <Card className="p-4">
                <div className="font-bold text-ink-950 mb-4">
                  الإيرادات حسب الباقة
                </div>

                {financial.byPlan.length === 0 ? (
                  <div className="py-8 text-center text-sm text-ink-900/50">
                    لا توجد بيانات باقات ضمن الفلاتر الحالية
                  </div>
                ) : (
                  <div className="space-y-4">
                    {financial.byPlan.map(item => {
                      const percentage =
                        totalDisplayedRevenue > 0
                          ? (Number(item.revenue || 0) /
                              totalDisplayedRevenue) *
                            100
                          : 0

                      const barWidth =
                        (Number(item.revenue || 0) /
                          maxPlanRevenue) *
                        100

                      return (
                        <div
                          key={
                            item.plan_id ??
                            item.plan_name
                          }
                          className="space-y-2"
                        >
                          <div className="flex items-center justify-between text-sm gap-3">
                            <span className="font-semibold text-ink-950">
                              {item.plan_name}
                            </span>

                            <span className="text-ink-900/60 whitespace-nowrap">
                              {formatMoney(
                                item.revenue
                              )}
                            </span>
                          </div>

                          <div className="h-2 rounded-full bg-sand-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-ink-950 transition-all"
                              style={{
                                width: `${Math.min(
                                  100,
                                  barWidth
                                )}%`,
                              }}
                            />
                          </div>

                          <div className="flex justify-between text-xs text-ink-900/45">
                            <span>
                              {item.count} معاملة
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
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Latest transactions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
              <Card className="p-4">
                <div className="font-bold text-ink-950 mb-4">
                  أحدث المعاملات
                </div>

                {financial.transactions.length ===
                0 ? (
                  <div className="py-8 text-center text-sm text-ink-900/50">
                    لا توجد معاملات
                  </div>
                ) : (
                  <div className="space-y-3">
                    {financial.transactions
                      .slice(0, 5)
                      .map(transaction => (
                        <div
                          key={
                            transaction.payment_id
                          }
                          className="flex items-center justify-between gap-3 rounded-xl border border-sand-100 p-3"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-ink-950 truncate">
                              {
                                transaction.organization_name
                              }
                            </div>

                            <div className="text-xs text-ink-900/45 mt-1">
                              {
                                transaction.plan_name
                              }{' '}
                              •{' '}
                              {methodLabels[
                                transaction.method
                              ] ||
                                transaction.method}{' '}
                              •{' '}
                              {formatDate(
                                transaction.paid_at
                              )}
                            </div>
                          </div>

                          <div className="font-bold text-sm text-ink-950 whitespace-nowrap">
                            {formatMoney(
                              transaction.amount
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </Card>

              {/* Quick financial summary */}
              <Card className="p-4">
                <div className="font-bold text-ink-950 mb-4">
                  ملخص الأداء المالي
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 border-b border-sand-100 pb-3">
                    <span className="text-sm text-ink-900/60">
                      إجمالي المعاملات
                    </span>

                    <span className="font-bold text-ink-950">
                      {financial.summary.transactionCount}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-b border-sand-100 pb-3">
                    <span className="text-sm text-ink-900/60">
                      الإيرادات الشهرية
                    </span>

                    <span className="font-bold text-ink-950">
                      {formatMoney(
                        financial.summary.monthRevenue
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-b border-sand-100 pb-3">
                    <span className="text-sm text-ink-900/60">
                      الإيرادات السنوية
                    </span>

                    <span className="font-bold text-ink-950">
                      {formatMoney(
                        financial.summary.yearRevenue
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-ink-900/60">
                      متوسط المعاملة
                    </span>

                    <span className="font-bold text-ink-950">
                      {formatMoney(
                        financial.summary.averageTransaction
                      )}
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Full transactions table */}
            <div className="mt-6">
              <div className="font-bold text-ink-950 mb-3">
                سجل المعاملات
              </div>

              <div className="overflow-x-auto border border-sand-100 rounded-xl">
                <table className="w-full text-sm min-w-[950px]">
                  <thead>
                    <tr className="text-ink-900/45 bg-sand-50 border-b border-sand-100">
                      <th className="text-right font-medium py-3 px-3">
                        الشركة
                      </th>

                      <th className="text-right font-medium py-3 px-3">
                        الباقة
                      </th>

                      <th className="text-right font-medium py-3 px-3">
                        المبلغ
                      </th>

                      <th className="text-right font-medium py-3 px-3">
                        طريقة الدفع
                      </th>

                      <th className="text-right font-medium py-3 px-3">
                        تاريخ الدفع
                      </th>

                      <th className="text-right font-medium py-3 px-3">
                        Payment ID
                      </th>

                      <th className="text-right font-medium py-3 px-3">
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
                          className="hover:bg-sand-50"
                        >
                          <td className="py-3 px-3 font-semibold text-ink-950 whitespace-nowrap">
                            {
                              transaction.organization_name
                            }
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            <Badge tone="gold">
                              {transaction.plan_name ||
                                'غير محددة'}
                            </Badge>
                          </td>

                          <td className="py-3 px-3 font-bold text-ink-950 whitespace-nowrap">
                            {formatMoney(
                              transaction.amount
                            )}
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            <Badge tone="gold">
                              {methodLabels[
                                transaction.method
                              ] ||
                                transaction.method}
                            </Badge>
                          </td>

                          <td className="py-3 px-3 text-ink-900/65 whitespace-nowrap">
                            {formatDateTime(
                              transaction.paid_at
                            )}
                          </td>

                          <td className="py-3 px-3 text-xs text-ink-900/50 font-mono">
                            {transaction.payment_id.slice(
                              0,
                              8
                            )}
                            ...
                          </td>

                          <td className="py-3 px-3">
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
            </div>
          </>
        ) : null}
      </Card>

      {/* Organizations */}
      <Card className="p-2 sm:p-4">
        <div className="p-3 font-bold text-ink-950">
          الشركات المسجلة على المنصة
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[850px]">
            <thead>
              <tr className="text-ink-900/45 border-b border-sand-200">
                <th className="text-right font-medium py-3 px-3">
                  الشركة
                </th>

                <th className="text-right font-medium py-3 px-3">
                  النشاط
                </th>

                <th className="text-right font-medium py-3 px-3">
                  الباقة
                </th>

                <th className="text-right font-medium py-3 px-3">
                  المستخدمين
                </th>

                <th className="text-right font-medium py-3 px-3">
                  العملاء
                </th>

                <th className="text-right font-medium py-3 px-3">
                  قيمة الصفقات
                </th>

                <th className="text-right font-medium py-3 px-3">
                  الحالة
                </th>

                <th className="text-right font-medium py-3 px-3"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-sand-100">
              {data.organizations.map(o => (
                <tr
                  key={o.id}
                  className="hover:bg-sand-50"
                >
                  <td className="py-3 px-3 font-semibold text-ink-950 whitespace-nowrap">
                    {o.name}
                  </td>

                  <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">
                    {o.business_type ?? '—'}
                  </td>

                  <td className="py-3 px-3">
                    <Badge tone="gold">
                      {o.plan}
                    </Badge>
                  </td>

                  <td className="py-3 px-3 text-ink-900/70">
                    {o.usersCount}
                  </td>

                  <td className="py-3 px-3 text-ink-900/70">
                    {o.customersCount}
                  </td>

                  <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">
                    {o.dealsValue.toLocaleString(
                      'ar-EG'
                    )}{' '}
                    ج.م
                  </td>

                  <td className="py-3 px-3">
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

                  <td className="py-3 px-3">
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
                        ? '...'
                        : o.suspended
                        ? 'تفعيل'
                        : 'تعليق'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
