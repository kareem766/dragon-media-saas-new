import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

function getDetail(method: PaymentMethod, key: string) {
  const value = method.details?.[key]

  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

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
        <div key={key} className="text-sm text-ink-900/70">
          <span className="font-semibold text-ink-950">
            {labels[key] ?? key}:
          </span>{' '}
          {String(value)}
        </div>
      ))}
    </div>
  )
}

export default function PaymentRequest() {
  const navigate = useNavigate()

  const {
    subscription,
    loading: subLoading,
  } = useSubscription()

  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [methodsLoading, setMethodsLoading] = useState(true)
  const [methodsError, setMethodsError] = useState<string | null>(null)

  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadMethods = async () => {
      if (!supabase) {
        setMethodsLoading(false)
        setMethodsError('قاعدة البيانات غير متاحة حاليًا.')
        return
      }

      setMethodsLoading(true)
      setMethodsError(null)

      const { data, error } = await supabase
        .from('payment_methods')
        .select(
          'id, method_key, name, details, enabled, display_order'
        )
        .eq('enabled', true)
        .order('display_order', { ascending: true })

      if (cancelled) return

      if (error) {
        setMethods([])
        setMethodsError('تعذر تحميل طرق الدفع حاليًا.')
        setMethodsLoading(false)
        return
      }

      const activeMethods = (data ?? []) as PaymentMethod[]

      setMethods(activeMethods)

      if (activeMethods.length > 0) {
        setMethod((current) =>
          activeMethods.some((item) => item.method_key === current)
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

  const selectedMethod = methods.find(
    (item) => item.method_key === method
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!supabase || !subscription?.plan || !selectedMethod) {
      return
    }

    if (!reference.trim()) {
      setError('برجاء إدخال رقم العملية أو المرجع.')
      return
    }

    if (!date) {
      setError('برجاء اختيار تاريخ التحويل.')
      return
    }

    setSaving(true)
    setError(null)

    const { error: submitError } = await supabase.rpc(
      'submit_payment_request',
      {
        p_plan_id: subscription.plan.id,
        p_amount: subscription.plan.price,
        p_method: selectedMethod.method_key,
        p_reference: reference.trim(),
        p_date: date,
        p_note: note.trim() || null,
      }
    )

    setSaving(false)

    if (submitError) {
      setError(submitError.message)
      return
    }

    navigate('/billing')
  }

  if (subLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (!subscription?.plan) {
    return (
      <Card className="p-6">
        <p className="text-sm text-ink-900/60">
          لازم تختار باقة الأول.
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

  return (
    <div className="max-w-lg space-y-6">
      <Card className="p-5 bg-ink-950 text-sand-100 border-0">
        <div className="text-sm text-sand-100/60">
          الباقة المختارة
        </div>

        <div className="text-xl font-bold mt-1">
          {subscription.plan.name} —{' '}
          {subscription.plan.price.toLocaleString('ar-EG')} ج.م
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

            {renderPaymentDetails(selectedMethod)}
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
              onChange={(e) => setMethod(e.target.value)}
              disabled={methodsLoading || methods.length === 0}
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
              onChange={(e) => setReference(e.target.value)}
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
              onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700"
            />
          </div>

          <div>
            <label className="text-xs text-ink-900/50">
              ملاحظات (اختياري)
            </label>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
              !selectedMethod
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
