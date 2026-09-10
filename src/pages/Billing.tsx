import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Badge, Button } from '../components/ui'
import { useSubscription } from '../lib/useSubscription'
import { supabase } from '../lib/supabase'

type Tone = 'success' | 'warning' | 'danger' | 'default'

type PaymentRequest = {
  id: string
  plan_id: string | null
  amount: number
  method: string
  reference: string
  payment_date: string
  note: string | null
  status: string
  rejection_reason: string | null
  reviewed_at: string | null
  created_at: string | null
  plan?: {
    name: string
  } | null
}

type Invoice = {
  id: string
  subscription_id: string | null
  amount: number
  status: string | null
  due_date: string | null
}

type Payment = {
  id: string
  invoice_id: string | null
  amount: number
  method: string | null
  paid_at: string | null
}

const statusLabels: Record<string, { label: string; tone: Tone }> = {
  trialing: { label: 'فترة تجريبية', tone: 'success' },
  pending_payment: { label: 'بانتظار الدفع', tone: 'warning' },
  pending_review: { label: 'قيد المراجعة', tone: 'warning' },
  active: { label: 'نشط', tone: 'success' },
  past_due: { label: 'متأخر السداد', tone: 'danger' },
  expired: { label: 'منتهي', tone: 'danger' },
  cancelled: { label: 'ملغي', tone: 'default' },
  suspended: { label: 'موقوف', tone: 'danger' },
  no_subscription: { label: 'بدون اشتراك', tone: 'default' },
}

const paymentRequestLabels: Record<string, { label: string; tone: Tone }> = {
  pending_review: { label: 'قيد المراجعة', tone: 'warning' },
  approved: { label: 'تمت الموافقة', tone: 'success' },
  rejected: { label: 'مرفوض', tone: 'danger' },
  cancelled: { label: 'ملغي', tone: 'default' },
}

const invoiceStatusLabels: Record<string, { label: string; tone: Tone }> = {
  paid: { label: 'مدفوعة', tone: 'success' },
  pending: { label: 'قيد الانتظار', tone: 'warning' },
  overdue: { label: 'متأخرة', tone: 'danger' },
  cancelled: { label: 'ملغاة', tone: 'default' },
}

function formatMoney(value: number | null | undefined) {
  return `${Number(value ?? 0).toLocaleString('ar-EG')} ج.م`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getPaymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    vodafone_cash: 'فودافون كاش',
    instapay: 'InstaPay',
    bank_transfer: 'تحويل بنكي',
    paymob: 'Paymob',
  }

  return labels[method] ?? method
}

export default function Billing() {
  const navigate = useNavigate()
  const { subscription, loading: subscriptionLoading } = useSubscription()

  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState('')

  const loadBillingData = useCallback(async () => {
    setDataLoading(true)
    setError('')

    try {
      const [requestsResult, invoicesResult] = await Promise.all([
        supabase
          .from('payment_requests')
          .select(`
            id,
            plan_id,
            amount,
            method,
            reference,
            payment_date,
            note,
            status,
            rejection_reason,
            reviewed_at,
            created_at,
            plan:plans(name)
          `)
          .order('created_at', { ascending: false }),

        supabase
          .from('invoices')
          .select(`
            id,
            subscription_id,
            amount,
            status,
            due_date
          `)
          .order('due_date', { ascending: false }),
      ])

      if (requestsResult.error) {
        throw requestsResult.error
      }

      if (invoicesResult.error) {
        throw invoicesResult.error
      }

      const loadedInvoices = (invoicesResult.data ?? []) as Invoice[]

      setPaymentRequests((requestsResult.data ?? []) as unknown as PaymentRequest[])
      setInvoices(loadedInvoices)

      if (loadedInvoices.length > 0) {
        const invoiceIds = loadedInvoices.map((invoice) => invoice.id)

        const paymentsResult = await supabase
          .from('payments')
          .select(`
            id,
            invoice_id,
            amount,
            method,
            paid_at
          `)
          .in('invoice_id', invoiceIds)
          .order('paid_at', { ascending: false })

        if (paymentsResult.error) {
          throw paymentsResult.error
        }

        setPayments((paymentsResult.data ?? []) as Payment[])
      } else {
        setPayments([])
      }
    } catch (err) {
      console.error('Billing data error:', err)
      setError('تعذر تحميل بيانات الفوترة حاليًا. حاول مرة أخرى.')
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBillingData()
  }, [loadBillingData])

  const loading = subscriptionLoading || dataLoading

  const status = subscription?.status ?? 'no_subscription'
  const info = statusLabels[status] ?? statusLabels.no_subscription

  const isActive =
    status === 'active' ||
    status === 'trialing'

  const pendingRequest = useMemo(
    () => paymentRequests.find((request) => request.status === 'pending_review'),
    [paymentRequests]
  )

  const approvedRequests = useMemo(
    () => paymentRequests.filter((request) => request.status === 'approved'),
    [paymentRequests]
  )

  const totalPaid = useMemo(
    () => payments.reduce((total, payment) => total + Number(payment.amount || 0), 0),
    [payments]
  )

  const daysRemaining = useMemo(() => {
    if (!subscription?.renewal_date) return null

    const renewal = new Date(`${subscription.renewal_date}T00:00:00Z`)
    const today = new Date()

    const todayUtc = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate()
      )
    )

    const diff = Math.ceil(
      (renewal.getTime() - todayUtc.getTime()) / 86400000
    )

    return Math.max(diff, 0)
  }, [subscription?.renewal_date])

  const accessMessage = useMemo(() => {
    if (!subscription) {
      return 'لا يوجد اشتراك حالي. اختر إحدى الباقات للبدء.'
    }

    if (status === 'pending_payment') {
      return 'تم اختيار الباقة، ونحتاج بيانات الدفع لإرسال الطلب للمراجعة.'
    }

    if (status === 'pending_review') {
      return 'تم استلام بيانات الدفع، والطلب حاليًا قيد المراجعة من الإدارة.'
    }

    if (status === 'expired') {
      return 'انتهى اشتراكك. اختر باقة وأرسل بيانات الدفع لإعادة التفعيل.'
    }

    if (status === 'cancelled') {
      return 'الاشتراك ملغي حاليًا. يمكنك اختيار باقة جديدة.'
    }

    if (status === 'suspended') {
      return 'الاشتراك موقوف حاليًا. تواصل مع الإدارة لمعرفة التفاصيل.'
    }

    if (daysRemaining === 0) {
      return 'اشتراكك ينتهي اليوم. يُرجى التجديد للحفاظ على الوصول للمنصة.'
    }

    if (daysRemaining !== null && daysRemaining <= 7) {
      return `متبقي ${daysRemaining} ${daysRemaining === 1 ? 'يوم' : 'أيام'} على التجديد.`
    }

    return 'اشتراكك فعال ويمكنك استخدام المنصة بشكل طبيعي.'
  }, [subscription, status, daysRemaining])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink-950">
          الفوترة والاشتراك
        </h1>

        <p className="text-sm text-ink-900/55 mt-1">
          إدارة باقتك، مدفوعاتك وفواتير Dragon Media
        </p>
      </div>

      {error && (
        <Card className="p-4 border border-red-200 bg-red-50">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-red-700">
              {error}
            </div>

            <Button
              variant="secondary"
              onClick={() => void loadBillingData()}
            >
              إعادة المحاولة
            </Button>
          </div>
        </Card>
      )}

      {/* Current subscription */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
          <div>
            <div className="text-xs text-ink-900/45">
              الباقة الحالية
            </div>

            <div className="text-2xl font-bold text-ink-950 mt-1">
              {subscription?.plan?.name ?? 'لا توجد باقة'}
            </div>

            {subscription?.plan && (
              <div className="text-sm text-ink-900/60 mt-2">
                {formatMoney(subscription.plan.price)}
                {' / '}
                {subscription.plan.billing_cycle === 'yearly'
                  ? 'سنويًا'
                  : 'شهريًا'}
              </div>
            )}
          </div>

          <Badge tone={info.tone}>
            {info.label}
          </Badge>
        </div>

        {subscription?.renewal_date && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            <div className="rounded-xl border border-ink-900/10 p-4">
              <div className="text-xs text-ink-900/45">
                التجديد القادم
              </div>

              <div className="font-semibold text-ink-950 mt-1">
                {formatDate(subscription.renewal_date)}
              </div>
            </div>

            <div className="rounded-xl border border-ink-900/10 p-4">
              <div className="text-xs text-ink-900/45">
                المتبقي
              </div>

              <div className="font-semibold text-ink-950 mt-1">
                {daysRemaining === 0
                  ? 'اليوم'
                  : daysRemaining === 1
                    ? 'يوم واحد'
                    : `${daysRemaining} أيام`}
              </div>
            </div>

            <div className="rounded-xl border border-ink-900/10 p-4">
              <div className="text-xs text-ink-900/45">
                حالة الوصول
              </div>

              <div className="font-semibold text-ink-950 mt-1">
                {isActive ? 'الوصول متاح' : 'الوصول محدود'}
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 rounded-xl bg-ink-900/5 p-4">
          <div className="text-sm text-ink-900/70">
            {accessMessage}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          <Button
            onClick={() => navigate('/plans')}
            variant={isActive ? 'secondary' : 'primary'}
          >
            {isActive ? 'تغيير الباقة' : 'اختيار باقة'}
          </Button>

          {(status === 'pending_payment' ||
            status === 'expired' ||
            status === 'no_subscription') && (
            <Button onClick={() => navigate('/billing/pay')}>
              إرسال بيانات الدفع
            </Button>
          )}

          {pendingRequest && (
            <Button
              variant="secondary"
              onClick={() => {
                document
                  .getElementById('payment-requests')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              متابعة طلب الدفع
            </Button>
          )}
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-xs text-ink-900/45">
            طلبات الدفع
          </div>

          <div className="text-2xl font-bold text-ink-950 mt-2">
            {paymentRequests.length.toLocaleString('ar-EG')}
          </div>

          <div className="text-xs text-ink-900/45 mt-1">
            إجمالي الطلبات
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-ink-900/45">
            الفواتير
          </div>

          <div className="text-2xl font-bold text-ink-950 mt-2">
            {invoices.length.toLocaleString('ar-EG')}
          </div>

          <div className="text-xs text-ink-900/45 mt-1">
            إجمالي الفواتير
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-ink-900/45">
            إجمالي المدفوع
          </div>

          <div className="text-2xl font-bold text-ink-950 mt-2">
            {formatMoney(totalPaid)}
          </div>

          <div className="text-xs text-ink-900/45 mt-1">
            المدفوعات المسجلة
          </div>
        </Card>
      </div>

      {/* Payment requests */}
      <Card className="p-6" id="payment-requests">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold text-ink-950">
              طلبات الدفع
            </h2>

            <p className="text-xs text-ink-900/45 mt-1">
              آخر الطلبات التي أرسلتها للإدارة
            </p>
          </div>
        </div>

        {paymentRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-900/15 p-8 text-center">
            <div className="text-sm font-medium text-ink-950">
              لا توجد طلبات دفع
            </div>

            <div className="text-xs text-ink-900/45 mt-1">
              عند إرسال بيانات تحويل جديدة ستظهر هنا.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {paymentRequests.map((request) => {
              const requestStatus =
                paymentRequestLabels[request.status] ??
                paymentRequestLabels.pending_review

              return (
                <div
                  key={request.id}
                  className="rounded-xl border border-ink-900/10 p-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink-950">
                          {request.plan?.name ?? 'باقة'}
                        </span>

                        <Badge tone={requestStatus.tone}>
                          {requestStatus.label}
                        </Badge>
                      </div>

                      <div className="text-sm text-ink-900/60 mt-2">
                        {formatMoney(request.amount)}
                        {' • '}
                        {getPaymentMethodLabel(request.method)}
                      </div>

                      <div className="text-xs text-ink-900/40 mt-1">
                        رقم العملية: {request.reference}
                      </div>

                      <div className="text-xs text-ink-900/40 mt-1">
                        تاريخ التحويل: {formatDate(request.payment_date)}
                      </div>
                    </div>

                    <div className="text-xs text-ink-900/45">
                      تم الإرسال:{' '}
                      {formatDateTime(request.created_at)}
                    </div>
                  </div>

                  {request.status === 'rejected' &&
                    request.rejection_reason && (
                      <div className="mt-4 rounded-lg bg-red-50 border border-red-100 p-3">
                        <div className="text-xs font-semibold text-red-700">
                          سبب الرفض
                        </div>

                        <div className="text-sm text-red-700/80 mt-1">
                          {request.rejection_reason}
                        </div>
                      </div>
                    )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Invoices */}
      <Card className="p-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-ink-950">
            الفواتير
          </h2>

          <p className="text-xs text-ink-900/45 mt-1">
            سجل الفواتير الخاصة باشتراكك
          </p>
        </div>

        {invoices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-900/15 p-8 text-center">
            <div className="text-sm font-medium text-ink-950">
              لا توجد فواتير حتى الآن
            </div>

            <div className="text-xs text-ink-900/45 mt-1">
              ستظهر الفواتير هنا بعد تسجيل المدفوعات.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => {
              const invoiceStatus =
                invoiceStatusLabels[invoice.status ?? 'pending'] ??
                invoiceStatusLabels.pending

              return (
                <div
                  key={invoice.id}
                  className="rounded-xl border border-ink-900/10 p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="font-semibold text-ink-950">
                        فاتورة #{invoice.id.slice(0, 8)}
                      </div>

                      <div className="text-xs text-ink-900/45 mt-1">
                        تاريخ الاستحقاق:{' '}
                        {formatDate(invoice.due_date)}
                      </div>
                    </div>

                    <div className="sm:text-left">
                      <div className="font-bold text-ink-950">
                        {formatMoney(invoice.amount)}
                      </div>

                      <div className="mt-1">
                        <Badge tone={invoiceStatus.tone}>
                          {invoiceStatus.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Payments */}
      <Card className="p-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-ink-950">
            المدفوعات
          </h2>

          <p className="text-xs text-ink-900/45 mt-1">
            المدفوعات التي تم تسجيلها واعتمادها
          </p>
        </div>

        {payments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-900/15 p-8 text-center">
            <div className="text-sm font-medium text-ink-950">
              لا توجد مدفوعات مسجلة
            </div>

            <div className="text-xs text-ink-900/45 mt-1">
              ستظهر المدفوعات المعتمدة هنا.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="rounded-xl border border-ink-900/10 p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="font-semibold text-ink-950">
                      {formatMoney(payment.amount)}
                    </div>

                    <div className="text-xs text-ink-900/45 mt-1">
                      طريقة الدفع:{' '}
                      {payment.method
                        ? getPaymentMethodLabel(payment.method)
                        : '—'}
                    </div>

                    <div className="text-xs text-ink-900/45 mt-1">
                      تاريخ الدفع:{' '}
                      {formatDate(payment.paid_at)}
                    </div>
                  </div>

                  <Badge tone="success">
                    مدفوع
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* CTA */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="font-bold text-ink-950">
              تحتاج إلى تغيير الباقة؟
            </div>

            <div className="text-sm text-ink-900/50 mt-1">
              استعرض الباقات المتاحة واختر الأنسب لنشاطك.
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={() => navigate('/plans')}
          >
            عرض الباقات
          </Button>
        </div>
      </Card>
    </div>
  )
}
