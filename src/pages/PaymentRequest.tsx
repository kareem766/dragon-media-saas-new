import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Button } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useSubscription } from '../lib/useSubscription'

type PaymentMethod = {
  id: string
  method_key: string
  name: string
  details: Record<string, unknown> | null
  enabled: boolean
  display_order: number
}

type SelectedPlan = {
  id: string
  name: string
  price: number
  yearly_price: number | null
  currency: string
}

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024

const RECEIPT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

function renderPaymentDetails(method: PaymentMethod) {
  const details = method.details ?? {}

  const entries = Object.entries(details).filter(
    ([, value]) =>
      typeof value === 'string' &&
      value.trim().length > 0
  )

  if (entries.length === 0) {
    return (
      <div className="text-sm text-ink-900/50">
        لم يتم إعداد بيانات طريقة الدفع بعد.
      </div>
    )
  }

  const labels: Record<string, string> = {
    number: 'الرقم',
    account: 'الحساب',
    account_address: 'الحساب / العنوان',
    beneficiary: 'اسم المستفيد',
    beneficiary_name: 'اسم المستفيد',
    bank_name: 'اسم البنك',
    account_name: 'اسم الحساب',
    account_number: 'رقم الحساب',
    iban: 'IBAN',
    swift: 'SWIFT',
    instructions: 'تعليمات الدفع',
    additional_details: 'تفاصيل إضافية',
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="text-sm text-ink-900/70"
        >
          <span className="font-semibold text-ink-950">
            {labels[key] ?? key}:
          </span>{' '}
          {String(value)}
        </div>
      ))}
    </div>
  )
}

function getFileExtension(file: File) {
  const name = file.name.toLowerCase()
  const dotIndex = name.lastIndexOf('.')

  if (dotIndex !== -1) {
    return name.slice(dotIndex + 1)
  }

  if (file.type === 'application/pdf') return 'pdf'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'

  return 'jpg'
}

export default function PaymentRequest() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const {
    subscription,
    loading: subLoading,
  } = useSubscription()

  const selectedPlanId =
    searchParams.get('plan_id') ??
    subscription?.plan?.id ??
    null

  const billingCycle =
    searchParams.get('cycle') === 'yearly'
      ? 'yearly'
      : 'monthly'

  const [selectedPlan, setSelectedPlan] =
    useState<SelectedPlan | null>(null)

  const [planLoading, setPlanLoading] = useState(true)
  const [planError, setPlanError] = useState<string | null>(null)

  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [methodsLoading, setMethodsLoading] = useState(true)
  const [methodsError, setMethodsError] =
    useState<string | null>(null)

  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amount = useMemo(() => {
    if (!selectedPlan) return null

    if (billingCycle === 'yearly') {
      return selectedPlan.yearly_price ?? null
    }

    return selectedPlan.price
  }, [selectedPlan, billingCycle])

  useEffect(() => {
    let cancelled = false

    const loadSelectedPlan = async () => {
      if (!supabase) {
        setPlanLoading(false)
        setPlanError(
          'قاعدة البيانات غير متاحة حاليًا.'
        )
        return
      }

      if (!selectedPlanId) {
        setPlanLoading(false)
        setPlanError(
          'لم يتم تحديد الباقة المطلوبة.'
        )
        return
      }

      setPlanLoading(true)
      setPlanError(null)

      const { data, error: queryError } =
        await supabase
          .from('plans')
          .select(
            'id, name, price, yearly_price, currency'
          )
          .eq('id', selectedPlanId)
          .eq('status', 'active')
          .maybeSingle()

      if (cancelled) return

      if (queryError) {
        setSelectedPlan(null)
        setPlanError(
          'تعذر تحميل الباقة المختارة حاليًا.'
        )
        setPlanLoading(false)
        return
      }

      if (!data) {
        setSelectedPlan(null)
        setPlanError(
          'الباقة المختارة غير متاحة حاليًا.'
        )
        setPlanLoading(false)
        return
      }

      setSelectedPlan(data as SelectedPlan)
      setPlanLoading(false)
    }

    loadSelectedPlan()

    return () => {
      cancelled = true
    }
  }, [selectedPlanId])

  useEffect(() => {
    let cancelled = false

    const loadMethods = async () => {
      if (!supabase) {
        setMethodsLoading(false)
        setMethodsError(
          'قاعدة البيانات غير متاحة حاليًا.'
        )
        return
      }

      setMethodsLoading(true)
      setMethodsError(null)

      const { data, error: queryError } =
        await supabase
          .from('payment_methods')
          .select(
            'id, method_key, name, details, enabled, display_order'
          )
          .eq('enabled', true)
          .order('display_order', {
            ascending: true,
          })

      if (cancelled) return

      if (queryError) {
        setMethods([])
        setMethodsError(
          'تعذر تحميل طرق الدفع حاليًا.'
        )
        setMethodsLoading(false)
        return
      }

      const activeMethods =
        (data ?? []) as PaymentMethod[]

      setMethods(activeMethods)

      if (activeMethods.length > 0) {
        setMethod((current) =>
          activeMethods.some(
            (item) => item.method_key === current
          )
            ? current
            : activeMethods[0].method_key
        )
      } else {
        setMethod('')
      }

      setMethodsLoading(false)
    }

    loadMethods()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (
      !planLoading &&
      selectedPlan &&
      billingCycle === 'yearly' &&
      (!selectedPlan.yearly_price ||
        selectedPlan.yearly_price <= 0)
    ) {
      navigate('/plans', { replace: true })
    }
  }, [
    billingCycle,
    navigate,
    planLoading,
    selectedPlan,
  ])

  const selectedMethod = methods.find(
    (item) => item.method_key === method
  )

  const handleReceiptChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0] ?? null

    setError(null)

    if (!file) {
      setReceipt(null)
      return
    }

    if (!RECEIPT_TYPES.includes(file.type)) {
      setReceipt(null)
      e.target.value = ''
      setError(
        'صيغة الإيصال غير مدعومة. استخدم JPG أو PNG أو WEBP أو PDF.'
      )
      return
    }

    if (file.size > MAX_RECEIPT_SIZE) {
      setReceipt(null)
      e.target.value = ''
      setError(
        'حجم الإيصال يجب ألا يتجاوز 5 ميجابايت.'
      )
      return
    }

    setReceipt(file)
  }

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault()

    if (
      !supabase ||
      !selectedPlan ||
      !selectedMethod
    ) {
      return
    }

    if (!amount || amount <= 0) {
      setError(
        'سعر الباقة غير متاح لدورة الفوترة المختارة.'
      )
      return
    }

    if (!reference.trim()) {
      setError(
        'برجاء إدخال رقم العملية أو المرجع.'
      )
      return
    }

    if (!date) {
      setError(
        'برجاء اختيار تاريخ التحويل.'
      )
      return
    }

    if (
      receipt &&
      (!RECEIPT_TYPES.includes(receipt.type) ||
        receipt.size > MAX_RECEIPT_SIZE)
    ) {
      setError(
        'ملف الإيصال غير صالح أو حجمه أكبر من 5 ميجابايت.'
      )
      return
    }

    setSaving(true)
    setError(null)

    let receiptPath: string | null = null

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !authData.user) {
        throw new Error(
          'تعذر التحقق من المستخدم الحالي.'
        )
      }

      const {
        data: userRow,
        error: userError,
      } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', authData.user.id)
        .single()

      if (
        userError ||
        !userRow?.organization_id
      ) {
        throw new Error(
          'تعذر تحديد الشركة المرتبطة بالحساب.'
        )
      }

      if (receipt) {
        const extension =
          getFileExtension(receipt)

        receiptPath = `${userRow.organization_id}/${crypto.randomUUID()}.${extension}`

        const {
          error: uploadError,
        } = await supabase.storage
          .from('payment-receipts')
          .upload(
            receiptPath,
            receipt,
            {
              cacheControl: '3600',
              upsert: false,
              contentType: receipt.type,
            }
          )

        if (uploadError) {
          throw new Error(
            'تعذر رفع إيصال الدفع. حاول مرة أخرى.'
          )
        }
      }

      const {
        error: submitError,
      } = await supabase.rpc(
        'submit_payment_request',
        {
          p_plan_id: selectedPlan.id,
          p_amount: amount,
          p_method:
            selectedMethod.method_key,
          p_reference:
            reference.trim(),
          p_date: date,
          p_note:
            note.trim() || null,
          p_billing_cycle:
            billingCycle,
          p_receipt_url:
            receiptPath,
        }
      )

      if (submitError) {
        if (receiptPath) {
          await supabase.storage
            .from('payment-receipts')
            .remove([receiptPath])
        }

        throw new Error(
          submitError.message ||
            'تعذر إرسال طلب الدفع.'
        )
      }

      navigate('/billing')
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'حدث خطأ أثناء إرسال طلب الدفع.'
      )
    } finally {
      setSaving(false)
    }
  }

  if (subLoading || planLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (!selectedPlan) {
    return (
      <Card className="p-6">
        <p className="text-sm text-red-600">
          {planError ??
            'لم يتم تحديد الباقة المطلوبة.'}
        </p>

        <Button
          className="mt-3"
          onClick={() => navigate('/plans')}
        >
          اختيار باقة
        </Button>
      </Card>
    )
  }

  if (
    billingCycle === 'yearly' &&
    (!selectedPlan.yearly_price ||
      selectedPlan.yearly_price <= 0)
  ) {
    return null
  }

  const monthlyPrice =
    selectedPlan.price

  const currency =
    selectedPlan.currency || 'EGP'

  return (
    <div className="max-w-lg space-y-6">
      <Card className="p-5 bg-ink-950 text-sand-100 border-0">
        <div className="text-sm text-sand-100/60">
          الباقة المختارة
        </div>

        <div className="text-xl font-bold mt-1">
          {selectedPlan.name}
        </div>

        {subscription?.plan?.id ===
          selectedPlan.id &&
          (subscription.status === 'active' ||
            subscription.status ===
              'trialing') && (
            <div className="mt-2 text-xs text-sand-100/50">
              هذه هي باقتك الحالية
            </div>
          )}

        <div className="mt-2 text-sm text-sand-100/70">
          دورة الفوترة:{' '}
          {billingCycle === 'yearly'
            ? 'سنوية'
            : 'شهرية'}
        </div>

        <div className="mt-3">
          <span className="text-3xl font-bold">
            {amount?.toLocaleString(
              'ar-EG'
            )}
          </span>

          <span className="text-sm text-sand-100/60 mr-1">
            {currency}
          </span>

          {billingCycle === 'yearly' ? (
            <div className="text-xs text-sand-100/50 mt-1">
              {monthlyPrice.toLocaleString(
                'ar-EG'
              )}{' '}
              {currency} شهريًا عند الحساب الشهري
            </div>
          ) : (
            <div className="text-xs text-sand-100/50 mt-1">
              يتم التجديد كل 30 يومًا بعد التفعيل
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-ink-950 mb-1">
          بيانات التحويل
        </h3>

        <p className="text-xs text-ink-900/45 mb-4">
          اختر طريقة الدفع المناسبة لك وستظهر لك بيانات الدفع الحالية.
        </p>

        {methodsLoading ? (
          <div className="flex items-center gap-2 text-sm text-ink-900/50 py-4">
            <div className="w-4 h-4 border-2 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
            جاري تحميل طرق الدفع...
          </div>
        ) : methodsError ? (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
            {methodsError}
          </div>
        ) : methods.length === 0 ? (
          <div className="text-sm text-ink-900/50 bg-sand-50 border border-sand-200 rounded-lg px-3.5 py-3">
            لم يتم إعداد أي طريقة دفع متاحة حاليًا.

            <div className="mt-1 text-xs text-ink-900/40">
              برجاء التواصل مع إدارة المنصة لإتمام عملية الاشتراك.
            </div>
          </div>
        ) : selectedMethod ? (
          <div className="text-sm text-ink-900/70 space-y-3 bg-sand-50 rounded-lg p-4 border border-sand-200">
            <div className="font-bold text-ink-950">
              {selectedMethod.name}
            </div>

            {renderPaymentDetails(
              selectedMethod
            )}
          </div>
        ) : null}
      </Card>

      <Card className="p-5">
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label className="text-xs text-ink-900/50">
              طريقة الدفع
            </label>

            <select
              value={method}
              onChange={(e) =>
                setMethod(e.target.value)
              }
              disabled={
                methodsLoading ||
                methods.length === 0
              }
              className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white disabled:bg-sand-50 disabled:text-ink-900/40"
            >
              {methods.length === 0 ? (
                <option value="">
                  لا توجد طرق دفع متاحة
                </option>
              ) : (
                methods.map((item) => (
                  <option
                    key={item.id}
                    value={item.method_key}
                  >
                    {item.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="text-xs text-ink-900/50">
              رقم العملية / المرجع
            </label>

            <input
              required
              value={reference}
              onChange={(e) =>
                setReference(e.target.value)
              }
              placeholder="أدخل رقم العملية أو المرجع"
              className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700"
            />
          </div>

          <div>
            <label className="text-xs text-ink-900/50">
              تاريخ التحويل
            </label>

            <input
              required
              type="date"
              value={date}
              onChange={(e) =>
                setDate(e.target.value)
              }
              className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700"
            />
          </div>

          <div>
            <label className="text-xs text-ink-900/50">
              إيصال الدفع
            </label>

            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleReceiptChange}
              className="w-full mt-1 text-sm text-ink-900/70 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-sand-100 file:text-ink-900 file:font-semibold"
            />

            <p className="text-xs text-ink-900/40 mt-1">
              اختياري — JPG أو PNG أو WEBP أو PDF بحد أقصى 5 ميجابايت.
            </p>

            {receipt && (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-sand-200 bg-sand-50 px-3 py-2">
                <div className="text-xs text-ink-900/70 truncate">
                  {receipt.name}
                </div>

                <button
                  type="button"
                  onClick={() => setReceipt(null)}
                  className="text-xs text-red-600 shrink-0"
                >
                  إزالة
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-ink-900/50">
              ملاحظات (اختياري)
            </label>

            <textarea
              value={note}
              onChange={(e) =>
                setNote(e.target.value)
              }
              rows={2}
              placeholder="أي ملاحظات إضافية..."
              className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={
              saving ||
              methodsLoading ||
              methods.length === 0 ||
              !selectedMethod ||
              !amount
            }
            className="w-full"
          >
            {saving
              ? 'جاري الإرسال...'
              : 'إرسال طلب الدفع للمراجعة'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
