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
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-8">
      <div className="text-center">
        <div className="text-xs font-semibold text-ink-900/45">
          إتمام الاشتراك
        </div>
        <h1 className="mt-1 text-2xl font-black text-ink-950">
          إتمام الدفع بأمان
        </h1>
        <p className="mt-1 text-sm text-ink-900/55">
          راجع الفاتورة، حوّل المبلغ، ثم أرسل بيانات العملية للمراجعة.
        </p>
      </div>

      <Card className="overflow-hidden border border-ink-900/10 bg-white p-0 shadow-[0_18px_50px_rgba(15,47,107,0.08)]">
        <div className="bg-ink-950 px-6 py-5 text-sand-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-sand-100/55">فاتورة مبدئية</div>
              <div className="mt-1 text-lg font-bold">
                {selectedPlan.name}
              </div>
              <div className="mt-1 text-xs text-sand-100/55">
                {billingCycle === 'yearly' ? 'اشتراك سنوي' : 'اشتراك شهري'}
              </div>
            </div>
            <div className="text-left">
              <div className="text-xs text-sand-100/55">الإجمالي</div>
              <div className="mt-1 text-2xl font-black">
                {amount?.toLocaleString('ar-EG')} {currency}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl bg-sand-50 p-3.5">
              <div className="text-xs text-ink-900/45">الباقة</div>
              <div className="mt-1 font-bold text-ink-950">{selectedPlan.name}</div>
            </div>
            <div className="rounded-xl bg-sand-50 p-3.5">
              <div className="text-xs text-ink-900/45">دورة الفوترة</div>
              <div className="mt-1 font-bold text-ink-950">
                {billingCycle === 'yearly' ? 'سنوية' : 'شهرية'}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-ink-900/10 pt-4">
            <span className="font-bold text-ink-950">المبلغ المطلوب دفعه</span>
            <span className="text-xl font-black text-ink-950">
              {amount?.toLocaleString('ar-EG')} {currency}
            </span>
          </div>

          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs leading-6 text-blue-900/75">
            الفاتورة الحالية مبدئية. سيتم تفعيل الباقة وإصدار الفاتورة النهائية بعد مراجعة واعتماد طلب الدفع.
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4">
          <div className="text-xs font-semibold text-ink-900/45">الخطوة 1</div>
          <h2 className="mt-1 text-lg font-black text-ink-950">اختر طريقة الدفع</h2>
          <p className="mt-1 text-xs text-ink-900/45">
            اختر الطريقة التي استخدمتها في التحويل لتظهر بياناتها.
          </p>
        </div>

        {methodsLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-900/50">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink-900/15 border-t-ink-900" />
            جاري تحميل طرق الدفع...
          </div>
        ) : methodsError ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {methodsError}
          </div>
        ) : methods.length === 0 ? (
          <div className="rounded-xl border border-sand-200 bg-sand-50 px-4 py-4 text-sm text-ink-900/55">
            لم يتم إعداد أي طريقة دفع متاحة حاليًا.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {methods.map((item) => {
                const active = item.method_key === method
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMethod(item.method_key)}
                    className={`rounded-xl border px-4 py-4 text-right transition-all ${
                      active
                        ? 'border-ink-900 bg-ink-950 text-sand-100 shadow-md'
                        : 'border-sand-200 bg-white text-ink-950 hover:border-ink-900/30 hover:bg-sand-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold">{item.name}</span>
                      <span className={`h-4 w-4 rounded-full border-2 ${
                        active ? 'border-sand-100 bg-sand-100' : 'border-ink-900/20'
                      }`} />
                    </div>
                  </button>
                )
              })}
            </div>

            {selectedMethod && (
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                <div className="mb-2 text-sm font-bold text-ink-950">
                  بيانات التحويل — {selectedMethod.name}
                </div>
                {renderPaymentDetails(selectedMethod)}
              </div>
            )}
          </>
        )}
      </Card>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="text-xs font-semibold text-ink-900/45">الخطوة 2</div>
            <h2 className="mt-1 text-lg font-black text-ink-950">
              تأكيد عملية التحويل
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-ink-900/55">رقم العملية / المرجع</label>
              <input
                required
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="مثال: 123456789"
                className="mt-1.5 w-full rounded-xl border border-sand-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-ink-700 focus:ring-2 focus:ring-ink-900/5"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-900/55">تاريخ التحويل</label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-sand-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-ink-700 focus:ring-2 focus:ring-ink-900/5"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-900/55">إيصال الدفع</label>
            <div className="mt-1.5 rounded-xl border border-dashed border-ink-900/20 bg-sand-50 p-4">
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleReceiptChange}
                className="w-full text-sm text-ink-900/70 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-950 file:px-3 file:py-2 file:font-semibold file:text-sand-100"
              />
              <p className="mt-2 text-xs text-ink-900/40">
                اختياري — JPG أو PNG أو WEBP أو PDF، بحد أقصى 5 ميجابايت.
              </p>
              {receipt && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-sand-200 bg-white px-3 py-2">
                  <span className="truncate text-xs text-ink-900/70">{receipt.name}</span>
                  <button
                    type="button"
                    onClick={() => setReceipt(null)}
                    className="shrink-0 text-xs font-semibold text-red-600"
                  >
                    إزالة
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-900/55">ملاحظات (اختياري)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="أي ملاحظات إضافية..."
              className="mt-1.5 w-full rounded-xl border border-sand-200 px-3.5 py-3 text-sm outline-none focus:border-ink-700"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="border-t border-ink-900/10 pt-5">
            <div className="mb-3 flex items-center justify-between gap-4 text-sm">
              <span className="text-ink-900/55">إجمالي الطلب</span>
              <span className="font-black text-ink-950">
                {amount?.toLocaleString('ar-EG')} {currency}
              </span>
            </div>
            <Button
              type="submit"
              disabled={saving || methodsLoading || methods.length === 0 || !selectedMethod || !amount}
              className="w-full py-3 text-base font-bold"
            >
              {saving ? 'جاري إرسال الطلب...' : 'تأكيد وإرسال طلب الدفع'}
            </Button>
            <div className="mt-3 text-center text-xs text-ink-900/40">
              سيتم مراجعة التحويل وتفعيل الباقة بعد الاعتماد من إدارة Dragon Media.
            </div>
          </div>
        </form>
      </Card>

      <div className="text-center text-xs text-ink-900/40">
        🔒 بيانات الدفع والإيصال تُستخدم فقط لمراجعة طلب الاشتراك.
      </div>
    </div>
  )
}
