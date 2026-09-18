import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Badge, Button } from '../components/ui'
import { useSubscription } from '../lib/useSubscription'
import { supabase } from '../lib/supabaseClient'

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

type RyanPaymentMethod = {
  id: string
  method_key: string
  name: string
  details: Record<string, unknown> | null
  enabled: boolean
  display_order: number
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
  'مدفوعة': { label: 'مدفوعة', tone: 'success' },

  pending: { label: 'قيد الانتظار', tone: 'warning' },
  'قيد الانتظار': { label: 'قيد الانتظار', tone: 'warning' },

  overdue: { label: 'متأخرة', tone: 'danger' },

  cancelled: { label: 'ملغاة', tone: 'default' },
  'ملغاة': { label: 'ملغاة', tone: 'default' },
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

function getBillingCycleLabel(cycle: string | null | undefined) {
  if (cycle === 'yearly') {
    return 'سنويًا'
  }

  if (cycle === 'monthly') {
    return 'شهريًا'
  }

  return '—'
}

export default function Billing() {
  const navigate = useNavigate()

  const {
    subscription,
    loading: subscriptionLoading,
    isActive: subscriptionIsActive,
    isExpired,
    daysRemaining,
    billingCycle,
    startedAt,
    expiresAt,
  } = useSubscription()

  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState('')
  const [ryanMethods, setRyanMethods] = useState<RyanPaymentMethod[]>([])
  const [ryanMethod, setRyanMethod] = useState('')
  const [ryanMessages, setRyanMessages] = useState('')
  const [ryanAmount, setRyanAmount] = useState('')
  const [ryanReference, setRyanReference] = useState('')
  const [ryanPaymentDate, setRyanPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [ryanNote, setRyanNote] = useState('')
  const [ryanSaving, setRyanSaving] = useState(false)
  const [ryanSuccess, setRyanSuccess] = useState('')
  const [ryanError, setRyanError] = useState('')

  const supabaseClient = supabase

  const loadBillingData = useCallback(async () => {
    if (!supabaseClient) {
      setError('تعذر الاتصال بقاعدة البيانات حاليًا.')
      setDataLoading(false)
      return
    }

    setDataLoading(true)
    setError('')

    try {
      const [requestsResult, invoicesResult, ryanMethodsResult] = await Promise.all([
        supabaseClient
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

        supabaseClient
          .from('invoices')
          .select(`
            id,
            subscription_id,
            amount,
            status,
            due_date
          `)
          .order('due_date', { ascending: false }),

        supabaseClient
          .from('payment_methods')
          .select('id, method_key, name, details, enabled, display_order')
          .eq('enabled', true)
          .order('display_order', { ascending: true }),
      ])

      if (requestsResult.error) {
        throw requestsResult.error
      }

      if (invoicesResult.error) {
        throw invoicesResult.error
      }

      const loadedInvoices = (invoicesResult.data ?? []) as Invoice[]
      const loadedRyanMethods = (ryanMethodsResult.data ?? []) as RyanPaymentMethod[]

      if (ryanMethodsResult.error) {
        console.warn('Ryan payment methods error:', ryanMethodsResult.error)
      } else {
        setRyanMethods(loadedRyanMethods)
        setRyanMethod((current) =>
          loadedRyanMethods.some((item) => item.method_key === current)
            ? current
            : loadedRyanMethods[0]?.method_key ?? ''
        )
      }

      setPaymentRequests(
        (requestsResult.data ?? []) as unknown as PaymentRequest[]
      )

      setInvoices(loadedInvoices)

      if (loadedInvoices.length > 0) {
        const invoiceIds = loadedInvoices.map((invoice) => invoice.id)

        const paymentsResult = await supabaseClient
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
  }, [supabaseClient])

  useEffect(() => {
    void loadBillingData()
  }, [loadBillingData])

  const loading = subscriptionLoading || dataLoading

  const rawStatus = subscription?.status ?? 'no_subscription'

  /*
   * حالة الاشتراك المعروضة تعتمد على الحالة الحقيقية
   * بالإضافة إلى تاريخ الانتهاء الفعلي.
   */
  const status =
    isExpired &&
    (rawStatus === 'active' || rawStatus === 'trialing')
      ? 'expired'
      : rawStatus

  const info =
    statusLabels[status] ?? statusLabels.no_subscription

  const isActive = subscriptionIsActive

  /*
   * expires_at هو المصدر الأساسي.
   * renewal_date يبقى fallback للبيانات القديمة.
   */
  const effectiveExpiryDate =
    expiresAt ??
    subscription?.renewal_date ??
    null

  const effectiveBillingCycle =
    billingCycle ??
    subscription?.plan?.billing_cycle ??
    null

  /*
   * السعر المعروض يعتمد على دورة الاشتراك الفعلية.
   */
  const currentPlanPrice = useMemo(() => {
    if (!subscription?.plan) {
      return null
    }

    if (
      effectiveBillingCycle === 'yearly' &&
      Number(subscription.plan.yearly_price ?? 0) > 0
    ) {
      return Number(subscription.plan.yearly_price)
    }

    return Number(subscription.plan.price ?? 0)
  }, [
    subscription?.plan,
    effectiveBillingCycle,
  ])

  const pendingRequest = useMemo(
    () =>
      paymentRequests.find(
        (request) => request.status === 'pending_review'
      ),
    [paymentRequests]
  )

  const submitRyanPurchase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabaseClient) return

    const messages = Number(ryanMessages)
    const amount = Number(ryanAmount)

    setRyanSuccess('')
    setRyanError('')

    if (!Number.isInteger(messages) || messages <= 0) {
      setRyanError('أدخل عدد رسائل صحيحًا أكبر من صفر.')
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setRyanError('أدخل قيمة الدفع الصحيحة.')
      return
    }

    if (!ryanMethod) {
      setRyanError('اختر طريقة الدفع.')
      return
    }

    if (!ryanReference.trim()) {
      setRyanError('أدخل رقم العملية أو المرجع.')
      return
    }

    if (!ryanPaymentDate) {
      setRyanError('اختر تاريخ التحويل.')
      return
    }

    setRyanSaving(true)
    try {
      const selectedMethod = ryanMethods.find((item) => item.method_key === ryanMethod)
      const { error: rpcError } = await supabaseClient.rpc('create_ryan_credit_purchase', {
        p_messages: messages,
        p_amount: amount,
        p_method: ryanMethod,
        p_reference: ryanReference.trim(),
        p_payment_date: ryanPaymentDate,
        p_note: ryanNote.trim() || null,
        p_payment_method_snapshot: selectedMethod
          ? { method_key: selectedMethod.method_key, name: selectedMethod.name, details: selectedMethod.details ?? {} }
          : {},
      })

      if (rpcError) throw rpcError

      setRyanSuccess('تم إرسال طلب شراء رسائل Ryan بنجاح، وسيظهر للإدارة للمراجعة.')
      setRyanMessages('')
      setRyanAmount('')
      setRyanReference('')
      setRyanNote('')
      await loadBillingData()
    } catch (err) {
      console.error('Ryan purchase error:', err)
      setRyanError(err instanceof Error ? err.message : 'تعذر إرسال طلب شراء رسائل Ryan.')
    } finally {
      setRyanSaving(false)
    }
  }

  const totalPaid = useMemo(
    () =>
      payments.reduce(
        (total, payment) =>
          total + Number(payment.amount || 0),
        0
      ),
    [payments]
  )

  const accessMessage = useMemo(() => {
    if (
      status === 'no_subscription' ||
      !subscription?.plan_id
    ) {
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

    if (daysRemaining === 0 && isActive) {
      return 'اشتراكك ينتهي اليوم. يُرجى التجديد للحفاظ على الوصول للمنصة.'
    }

    if (
      daysRemaining !== null &&
      daysRemaining <= 7 &&
      isActive
    ) {
      return `متبقي ${daysRemaining} ${
        daysRemaining === 1 ? 'يوم' : 'أيام'
      } على التجديد.`
    }

    return 'اشتراكك فعال ويمكنك استخدام المنصة بشكل طبيعي.'
  }, [
    subscription,
    status,
    daysRemaining,
    isActive,
  ])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div
      className="space-y-6 max-w-5xl mx-auto pb-10"
      dir="rtl"
    >
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
                {formatMoney(currentPlanPrice)}
                {' / '}
                {getBillingCycleLabel(effectiveBillingCycle)}
              </div>
            )}
          </div>

          <Badge tone={info.tone}>
            {info.label}
          </Badge>
        </div>

        {subscription && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <div className="rounded-xl border border-ink-900/10 p-4">
              <div className="text-xs text-ink-900/45">
                دورة الاشتراك
              </div>

              <div className="font-semibold text-ink-950 mt-1">
                {getBillingCycleLabel(effectiveBillingCycle)}
              </div>
            </div>

            <div className="rounded-xl border border-ink-900/10 p-4">
              <div className="text-xs text-ink-900/45">
                تاريخ البداية
              </div>

              <div className="font-semibold text-ink-950 mt-1">
                {formatDate(startedAt)}
              </div>
            </div>

            <div className="rounded-xl border border-ink-900/10 p-4">
              <div className="text-xs text-ink-900/45">
                تاريخ الانتهاء
              </div>

              <div className="font-semibold text-ink-950 mt-1">
                {formatDate(effectiveExpiryDate)}
              </div>
            </div>

            <div className="rounded-xl border border-ink-900/10 p-4">
              <div className="text-xs text-ink-900/45">
                المتبقي
              </div>

              <div className="font-semibold text-ink-950 mt-1">
                {!isActive && status === 'expired'
                  ? 'منتهي'
                  : daysRemaining === null
                    ? '—'
                    : daysRemaining === 0
                      ? 'اليوم'
                      : daysRemaining === 1
                        ? 'يوم واحد'
                        : `${daysRemaining} أيام`}
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
            {isActive
              ? 'تغيير الباقة'
              : 'اختيار باقة'}
          </Button>

          {(status === 'pending_payment' ||
            status === 'expired' ||
            status === 'no_subscription') && (
            <Button
              onClick={() => navigate('/billing/pay')}
            >
              إرسال بيانات الدفع
            </Button>
          )}

          {pendingRequest && (
            <Button
              variant="secondary"
              onClick={() => {
                document
                  .getElementById('payment-requests')
                  ?.scrollIntoView({
                    behavior: 'smooth',
                  })
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
      <div id="payment-requests">
        <Card className="p-6">
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
                          تاريخ التحويل:{' '}
                          {formatDate(request.payment_date)}
                        </div>
                      </div>

                      <div className="text-xs text-ink-900/45">
                        تم الإرسال:{' '}
                        {formatDateTime(request.created_at)}
                      </div>
                    </div>

                    {request.note && (
                      <div className="mt-3 rounded-lg bg-ink-900/5 p-3">
                        <div className="text-xs font-semibold text-ink-900/60">
                          ملاحظتك
                        </div>

                        <div className="text-sm text-ink-900/70 mt-1">
                          {request.note}
                        </div>
                      </div>
                    )}

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

                    {request.reviewed_at && (
                      <div className="text-xs text-ink-900/40 mt-3">
                        تمت المراجعة:{' '}
                        {formatDateTime(request.reviewed_at)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Ryan credits */}
      <Card className="p-6 border border-amber-200/70 bg-gradient-to-br from-white to-amber-50/40">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
          <div>
            <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              RYAN AI
            </div>
            <h2 className="text-lg font-bold text-ink-950 mt-2">شراء رسائل Ryan إضافية</h2>
            <p className="text-xs text-ink-900/50 mt-1">
              اختر عدد الرسائل وقيمة التحويل ثم أرسل الطلب للمراجعة. لن تتم إضافة الرصيد إلا بعد اعتماد الإدارة.
            </p>
          </div>
          <div className="rounded-xl bg-ink-950 px-4 py-3 text-xs text-white/70">
            الرصيد المشتَرى لا ينتهي مع التجديد الشهري
          </div>
        </div>

        <form onSubmit={submitRyanPurchase} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-ink-900/50">عدد رسائل Ryan</label>
            <input
              required
              type="number"
              min="1"
              step="1"
              value={ryanMessages}
              onChange={(e) => setRyanMessages(e.target.value)}
              placeholder="مثال: 1000"
              className="w-full mt-1 border border-amber-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-amber-500 bg-white"
            />
          </div>

          <div>
            <label className="text-xs text-ink-900/50">قيمة التحويل</label>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={ryanAmount}
              onChange={(e) => setRyanAmount(e.target.value)}
              placeholder="بالجنيه المصري"
              className="w-full mt-1 border border-amber-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-amber-500 bg-white"
            />
          </div>

          <div>
            <label className="text-xs text-ink-900/50">طريقة الدفع</label>
            <select
              required
              value={ryanMethod}
              onChange={(e) => setRyanMethod(e.target.value)}
              disabled={ryanMethods.length === 0}
              className="w-full mt-1 border border-amber-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-amber-500 bg-white disabled:bg-ink-900/5"
            >
              {ryanMethods.length === 0 ? (
                <option value="">لا توجد طرق دفع متاحة</option>
              ) : (
                ryanMethods.map((item) => (
                  <option key={item.id} value={item.method_key}>{item.name}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="text-xs text-ink-900/50">رقم العملية / المرجع</label>
            <input
              required
              value={ryanReference}
              onChange={(e) => setRyanReference(e.target.value)}
              placeholder="رقم العملية"
              className="w-full mt-1 border border-amber-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-amber-500 bg-white"
            />
          </div>

          <div>
            <label className="text-xs text-ink-900/50">تاريخ التحويل</label>
            <input
              required
              type="date"
              value={ryanPaymentDate}
              onChange={(e) => setRyanPaymentDate(e.target.value)}
              className="w-full mt-1 border border-amber-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-amber-500 bg-white"
            />
          </div>

          <div>
            <label className="text-xs text-ink-900/50">ملاحظات (اختياري)</label>
            <input
              value={ryanNote}
              onChange={(e) => setRyanNote(e.target.value)}
              placeholder="أي ملاحظة للإدارة"
              className="w-full mt-1 border border-amber-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-amber-500 bg-white"
            />
          </div>

          <div className="md:col-span-2 rounded-xl bg-amber-100/70 border border-amber-200 p-3 text-xs leading-6 text-amber-900">
            سيتم إنشاء طلب دفع مستقل لرسائل Ryan، وإشعار إدارة المنصة للمراجعة. بعد الموافقة فقط يتم اعتماد الرصيد.
          </div>

          {ryanError && (
            <div className="md:col-span-2 rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {ryanError}
            </div>
          )}

          {ryanSuccess && (
            <div className="md:col-span-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
              {ryanSuccess}
            </div>
          )}

          <div className="md:col-span-2">
            <Button type="submit" disabled={ryanSaving || ryanMethods.length === 0} className="w-full md:w-auto">
              {ryanSaving ? 'جاري إرسال الطلب...' : 'إرسال طلب شراء رسائل Ryan'}
            </Button>
          </div>
        </form>
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
                invoiceStatusLabels[
                  invoice.status ?? 'pending'
                ] ?? invoiceStatusLabels.pending

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
                        ? getPaymentMethodLabel(
                            payment.method
                          )
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
