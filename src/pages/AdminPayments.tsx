import React, { useEffect, useState } from 'react'
import { Card, Badge, Button, Skeleton } from '../components/ui'
import { supabase } from '../lib/supabaseClient'

interface PaymentRequestRow {
  id: string
  amount: number
  method: string
  reference: string
  payment_date: string
  note: string | null
  status: string
  rejection_reason: string | null
  billing_cycle: 'monthly' | 'yearly' | null
  receipt_signed_url: string | null
  payment_method_snapshot: Record<string, any> | null
  item_snapshot: Record<string, any> | null
  request_type: string | null
  organizations: { name: string } | null
  plans: {
    id: string
    name: string
    price: number
    yearly_price: number | null
    currency: string | null
  } | null
}

interface PaymentMethod {
  id: string
  method_key: string
  name: string
  details: Record<string, string> | null
  enabled: boolean
  display_order: number
}

const detailLabels: Record<string, string> = {
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

const snapshotLabels: Record<string, string> = {
  method_key: 'المفتاح',
  name: 'اسم الطريقة',
  number: 'الرقم',
  account: 'الحساب',
  account_address: 'الحساب / العنوان',
  beneficiary: 'المستفيد',
  beneficiary_name: 'اسم المستفيد',
  bank_name: 'البنك',
  account_name: 'اسم الحساب',
  account_number: 'رقم الحساب',
  iban: 'IBAN',
  swift: 'SWIFT',
  instructions: 'التعليمات',
  additional_details: 'تفاصيل إضافية',
}

const emptyMethod: Omit<PaymentMethod, 'id'> = {
  method_key: '',
  name: '',
  details: {},
  enabled: true,
  display_order: 0,
}

function formatCurrency(amount: number, currency = 'EGP') {
  return `${Number(amount || 0).toLocaleString('ar-EG')} ${
    currency === 'EGP' ? 'ج.م' : currency
  }`
}

function getCycleLabel(cycle: PaymentRequestRow['billing_cycle']) {
  if (cycle === 'yearly') return 'سنوي'
  if (cycle === 'monthly') return 'شهري'
  return 'غير محدد'
}

function getStatusLabel(status: string) {
  if (status === 'pending_review') return 'بانتظار المراجعة'
  if (status === 'approved') return 'تمت الموافقة'
  if (status === 'rejected') return 'مرفوض'
  return status
}

function getStatusTone(
  status: string
): 'success' | 'danger' | 'warning' {
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'danger'
  return 'warning'
}

function getSnapshotEntries(snapshot: Record<string, any> | null) {
  if (!snapshot) return []

  return Object.entries(snapshot).filter(
    ([, value]) =>
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ''
  )
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-ink-950 sm:text-xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-900/50">
            {description}
          </p>
        )}
      </div>

      {action}
    </div>
  )
}

function ErrorBox({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{message}</span>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-200 bg-white px-4 font-semibold text-red-700 transition hover:bg-red-100"
          >
            إعادة المحاولة
          </button>
        )}
      </div>
    </div>
  )
}

export default function AdminPayments() {
  const [requests, setRequests] = useState<PaymentRequestRow[]>([])
  const [methods, setMethods] = useState<PaymentMethod[]>([])

  const [loading, setLoading] = useState(true)
  const [methodsLoading, setMethodsLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)
  const [methodsError, setMethodsError] = useState<string | null>(null)

  const [actingId, setActingId] = useState<string | null>(null)

  const [showMethodForm, setShowMethodForm] = useState(false)
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null)
  const [savingMethod, setSavingMethod] = useState(false)

  const [methodForm, setMethodForm] = useState(emptyMethod)
  const [detailKey, setDetailKey] = useState('')
  const [detailValue, setDetailValue] = useState('')

  const loadRequests = async () => {
    if (!supabase) {
      setLoading(false)
      setError('قاعدة البيانات غير متاحة حاليًا.')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        setError('انتهت جلسة تسجيل الدخول.')
        return
      }

      const res = await fetch('/api/admin/payments', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'تعذر تحميل طلبات الدفع.')
        return
      }

      setRequests(json.requests ?? [])
    } catch {
      setError('حدث خطأ أثناء تحميل طلبات الدفع.')
    } finally {
      setLoading(false)
    }
  }

  const loadMethods = async () => {
    if (!supabase) {
      setMethodsLoading(false)
      setMethodsError('قاعدة البيانات غير متاحة حاليًا.')
      return
    }

    try {
      setMethodsLoading(true)
      setMethodsError(null)

      const { data, error: queryError } = await supabase
        .from('payment_methods')
        .select(
          'id, method_key, name, details, enabled, display_order'
        )
        .order('display_order', { ascending: true })

      if (queryError) {
        setMethodsError('تعذر تحميل طرق الدفع.')
        return
      }

      setMethods((data ?? []) as PaymentMethod[])
    } catch {
      setMethodsError('حدث خطأ أثناء تحميل طرق الدفع.')
    } finally {
      setMethodsLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
    loadMethods()
  }, [])

  const act = async (
    requestId: string,
    action: 'approve' | 'reject'
  ) => {
    if (!supabase) return

    let reason: string | undefined

    if (action === 'reject') {
      reason =
        window.prompt('اكتب سبب رفض طلب الدفع:')?.trim() ||
        'غير محدد'
    }

    setActingId(requestId)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        window.alert('انتهت جلسة تسجيل الدخول.')
        return
      }

      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          requestId,
          reason,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        window.alert(json.error || 'تعذر تنفيذ العملية.')
        return
      }

      await loadRequests()
    } catch {
      window.alert('حدث خطأ أثناء تنفيذ العملية.')
    } finally {
      setActingId(null)
    }
  }

  const openCreateMethod = () => {
    setEditingMethodId(null)

    setMethodForm({
      ...emptyMethod,
      display_order: methods.length,
    })

    setDetailKey('')
    setDetailValue('')
    setShowMethodForm(true)
  }

  const openEditMethod = (method: PaymentMethod) => {
    setEditingMethodId(method.id)

    setMethodForm({
      method_key: method.method_key,
      name: method.name,
      details: method.details ?? {},
      enabled: method.enabled,
      display_order: method.display_order,
    })

    setDetailKey('')
    setDetailValue('')
    setShowMethodForm(true)
  }

  const closeMethodForm = () => {
    if (savingMethod) return

    setShowMethodForm(false)
    setEditingMethodId(null)
    setMethodForm(emptyMethod)
    setDetailKey('')
    setDetailValue('')
  }

  const addDetail = () => {
    const key = detailKey.trim()
    const value = detailValue.trim()

    if (!key || !value) return

    setMethodForm((current) => ({
      ...current,
      details: {
        ...(current.details ?? {}),
        [key]: value,
      },
    }))

    setDetailKey('')
    setDetailValue('')
  }

  const removeDetail = (key: string) => {
    setMethodForm((current) => {
      const details = {
        ...(current.details ?? {}),
      }

      delete details[key]

      return {
        ...current,
        details,
      }
    })
  }

  const saveMethod = async () => {
    if (!supabase) return

    const methodKey = methodForm.method_key.trim()
    const name = methodForm.name.trim()

    if (!methodKey) {
      window.alert('برجاء إدخال مفتاح طريقة الدفع.')
      return
    }

    if (!name) {
      window.alert('برجاء إدخال اسم طريقة الدفع.')
      return
    }

    setSavingMethod(true)

    try {
      if (editingMethodId) {
        const { error: updateError } = await supabase
          .from('payment_methods')
          .update({
            method_key: methodKey,
            name,
            details: methodForm.details ?? {},
            enabled: methodForm.enabled,
            display_order: Number(methodForm.display_order) || 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingMethodId)

        if (updateError) {
          window.alert(
            updateError.message || 'تعذر تحديث طريقة الدفع.'
          )
          return
        }
      } else {
        const { error: insertError } = await supabase
          .from('payment_methods')
          .insert({
            method_key: methodKey,
            name,
            details: methodForm.details ?? {},
            enabled: methodForm.enabled,
            display_order: Number(methodForm.display_order) || 0,
          })

        if (insertError) {
          window.alert(
            insertError.message || 'تعذر إضافة طريقة الدفع.'
          )
          return
        }
      }

      closeMethodForm()
      await loadMethods()
    } catch {
      window.alert('حدث خطأ أثناء حفظ طريقة الدفع.')
    } finally {
      setSavingMethod(false)
    }
  }

  const toggleMethod = async (method: PaymentMethod) => {
    if (!supabase) return

    const { error: updateError } = await supabase
      .from('payment_methods')
      .update({
        enabled: !method.enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', method.id)

    if (updateError) {
      window.alert(
        updateError.message || 'تعذر تغيير حالة طريقة الدفع.'
      )
      return
    }

    await loadMethods()
  }

  const deleteMethod = async (method: PaymentMethod) => {
    if (!supabase) return

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف طريقة الدفع "${method.name}"؟`
    )

    if (!confirmed) return

    const { error: deleteError } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', method.id)

    if (deleteError) {
      window.alert(
        deleteError.message || 'تعذر حذف طريقة الدفع.'
      )
      return
    }

    await loadMethods()
  }

  const pending = requests.filter(
    (r) => r.status === 'pending_review'
  )

  const reviewed = requests.filter(
    (r) => r.status !== 'pending_review'
  )

  const activeMethods = methods.filter((method) => method.enabled)

  if (loading && methodsLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>

        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-52 rounded-2xl" />
      </div>
    )
  }

  return (
    <div dir="rtl" className="space-y-8 pb-8">
      {/* Summary */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-sand-200 bg-white p-4">
          <div className="text-xs font-medium text-ink-900/45">
            طلبات بانتظار المراجعة
          </div>
          <div className="mt-2 text-2xl font-bold text-ink-950">
            {pending.length.toLocaleString('ar-EG')}
          </div>
          <div className="mt-1 text-xs text-ink-900/40">
            تحتاج إلى مراجعة قبل التفعيل
          </div>
        </Card>

        <Card className="border-sand-200 bg-white p-4">
          <div className="text-xs font-medium text-ink-900/45">
            طلبات تمت مراجعتها
          </div>
          <div className="mt-2 text-2xl font-bold text-ink-950">
            {reviewed.length.toLocaleString('ar-EG')}
          </div>
          <div className="mt-1 text-xs text-ink-900/40">
            موافقات وطلبات مرفوضة
          </div>
        </Card>

        <Card className="border-sand-200 bg-white p-4">
          <div className="text-xs font-medium text-ink-900/45">
            طرق الدفع المفعّلة
          </div>
          <div className="mt-2 text-2xl font-bold text-ink-950">
            {activeMethods.length.toLocaleString('ar-EG')}
          </div>
          <div className="mt-1 text-xs text-ink-900/40">
            من أصل {methods.length.toLocaleString('ar-EG')} طريقة
          </div>
        </Card>
      </section>

      {/* Payment Methods */}
      <section className="space-y-4">
        <SectionHeader
          title="طرق الدفع"
          description="إدارة طرق الدفع التي تظهر للعملاء أثناء الاشتراك."
          action={
            <Button
              onClick={openCreateMethod}
              className="min-h-11 w-full rounded-xl sm:w-auto"
            >
              إضافة طريقة دفع
            </Button>
          }
        />

        {methodsError && (
          <ErrorBox message={methodsError} onRetry={loadMethods} />
        )}

        {methodsLoading ? (
          <div className="grid gap-3">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        ) : methods.length === 0 ? (
          <Card className="border-dashed border-sand-300 bg-white p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sand-100 text-ink-900/45">
              $
            </div>

            <div className="mt-4 font-semibold text-ink-950">
              لا توجد طرق دفع مضافة
            </div>

            <div className="mx-auto mt-1 max-w-md text-sm leading-6 text-ink-900/45">
              أضف أول طريقة دفع ليتمكن العملاء من استخدامها أثناء
              الاشتراك.
            </div>

            <Button className="mt-5 rounded-xl" onClick={openCreateMethod}>
              إضافة طريقة دفع
            </Button>
          </Card>
        ) : (
          <div className="grid gap-3">
            {methods.map((method) => (
              <Card
                key={method.id}
                className="border-sand-200 bg-white p-4 transition-shadow hover:shadow-[0_10px_35px_rgba(0,0,0,0.05)] sm:p-5"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-ink-950">
                        {method.name}
                      </h3>

                      <Badge
                        tone={method.enabled ? 'success' : 'danger'}
                      >
                        {method.enabled ? 'مفعّلة' : 'معطّلة'}
                      </Badge>
                    </div>

                    <div className="mt-1.5 text-xs text-ink-900/40">
                      المفتاح: {method.method_key}
                      <span className="mx-1.5">·</span>
                      الترتيب: {method.display_order}
                    </div>

                    {method.details &&
                      Object.keys(method.details).length > 0 && (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {Object.entries(method.details).map(
                            ([key, value]) => (
                              <div
                                key={key}
                                className="rounded-xl border border-sand-200 bg-sand-50/70 px-3 py-2.5 text-sm"
                              >
                                <span className="font-semibold text-ink-950">
                                  {detailLabels[key] ?? key}:
                                </span>{' '}
                                <span className="break-words text-ink-900/65">
                                  {value}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:min-w-[300px]">
                    <Button
                      variant="secondary"
                      onClick={() => toggleMethod(method)}
                      className="min-h-10 rounded-xl"
                    >
                      {method.enabled ? 'تعطيل' : 'تفعيل'}
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => openEditMethod(method)}
                      className="min-h-10 rounded-xl"
                    >
                      تعديل
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => deleteMethod(method)}
                      className="min-h-10 rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                    >
                      حذف
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Method Form */}
      {showMethodForm && (
        <Card className="border-2 border-ink-900/10 bg-white p-4 shadow-[0_16px_50px_rgba(0,0,0,0.07)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-ink-950">
                {editingMethodId
                  ? 'تعديل طريقة الدفع'
                  : 'إضافة طريقة دفع'}
              </h3>

              <p className="mt-1 text-xs leading-5 text-ink-900/45">
                بيانات هذه الطريقة هي التي يمكن استخدامها في شاشة الدفع
                للعملاء.
              </p>
            </div>

            <button
              type="button"
              onClick={closeMethodForm}
              disabled={savingMethod}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg text-ink-900/45 transition hover:bg-sand-100 hover:text-ink-950 disabled:opacity-40"
              aria-label="إغلاق"
            >
              ×
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-ink-900/55">
                اسم طريقة الدفع
              </label>

              <input
                value={methodForm.name}
                onChange={(e) =>
                  setMethodForm((current) => ({
                    ...current,
                    name: e.target.value,
                  }))
                }
                placeholder="مثال: فودافون كاش"
                className="mt-1.5 min-h-11 w-full rounded-xl border border-sand-200 bg-white px-3.5 text-sm outline-none transition focus:border-ink-700 focus:ring-2 focus:ring-ink-900/5"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink-900/55">
                مفتاح طريقة الدفع
              </label>

              <input
                value={methodForm.method_key}
                onChange={(e) =>
                  setMethodForm((current) => ({
                    ...current,
                    method_key: e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, '_'),
                  }))
                }
                placeholder="مثال: vodafone_cash"
                disabled={!!editingMethodId}
                dir="ltr"
                className="mt-1.5 min-h-11 w-full rounded-xl border border-sand-200 bg-white px-3.5 text-left text-sm outline-none transition focus:border-ink-700 focus:ring-2 focus:ring-ink-900/5 disabled:bg-sand-50 disabled:text-ink-900/40"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink-900/55">
                ترتيب الظهور
              </label>

              <input
                type="number"
                min="0"
                value={methodForm.display_order}
                onChange={(e) =>
                  setMethodForm((current) => ({
                    ...current,
                    display_order: Number(e.target.value),
                  }))
                }
                className="mt-1.5 min-h-11 w-full rounded-xl border border-sand-200 bg-white px-3.5 text-sm outline-none transition focus:border-ink-700 focus:ring-2 focus:ring-ink-900/5"
              />
            </div>

            <div className="flex items-end">
              <label className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl border border-sand-200 bg-sand-50/60 px-3.5 text-sm text-ink-900">
                <input
                  type="checkbox"
                  checked={methodForm.enabled}
                  onChange={(e) =>
                    setMethodForm((current) => ({
                      ...current,
                      enabled: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-ink-900"
                />
                <span>طريقة الدفع مفعّلة</span>
              </label>
            </div>
          </div>

          <div className="mt-7 border-t border-sand-200 pt-6">
            <div className="font-semibold text-sm text-ink-950">
              بيانات طريقة الدفع
            </div>

            <p className="mt-1 text-xs leading-5 text-ink-900/40">
              أضف البيانات التي يحتاجها العميل لإتمام التحويل يدويًا.
            </p>

            {Object.entries(methodForm.details ?? {}).length > 0 && (
              <div className="mt-4 space-y-2">
                {Object.entries(methodForm.details ?? {}).map(
                  ([key, value]) => (
                    <div
                      key={key}
                      className="flex flex-col gap-2 rounded-xl border border-sand-200 bg-sand-50/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 text-sm">
                        <span className="font-semibold text-ink-950">
                          {detailLabels[key] ?? key}:
                        </span>{' '}
                        <span className="break-words text-ink-900/65">
                          {value}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeDetail(key)}
                        className="self-start text-xs font-semibold text-red-600 hover:underline sm:self-auto"
                      >
                        حذف
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr_auto]">
              <input
                value={detailKey}
                onChange={(e) => setDetailKey(e.target.value)}
                placeholder="اسم الحقل"
                className="min-h-11 rounded-xl border border-sand-200 px-3 text-sm outline-none transition focus:border-ink-700"
              />

              <input
                value={detailValue}
                onChange={(e) => setDetailValue(e.target.value)}
                placeholder="القيمة"
                className="min-h-11 rounded-xl border border-sand-200 px-3 text-sm outline-none transition focus:border-ink-700"
              />

              <Button
                variant="secondary"
                onClick={addDetail}
                className="min-h-11 rounded-xl"
              >
                إضافة
              </Button>
            </div>

            <div className="mt-2 text-xs leading-5 text-ink-900/40">
              أمثلة: number، account_name، account_number، IBAN،
              bank_name، instructions
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 border-t border-sand-200 pt-5 sm:flex-row">
            <Button
              onClick={saveMethod}
              disabled={savingMethod}
              className="min-h-11 rounded-xl"
            >
              {savingMethod ? 'جاري الحفظ...' : 'حفظ طريقة الدفع'}
            </Button>

            <Button
              variant="secondary"
              onClick={closeMethodForm}
              disabled={savingMethod}
              className="min-h-11 rounded-xl"
            >
              إلغاء
            </Button>
          </div>
        </Card>
      )}

      {/* Payment Requests */}
      <section className="space-y-4">
        <SectionHeader
          title="مراجعة طلبات الدفع"
          description="مراجعة تفاصيل الدفع والمرفقات قبل تفعيل الاشتراك."
        />

        {error && (
          <ErrorBox message={error} onRetry={loadRequests} />
        )}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        ) : pending.length === 0 ? (
          <Card className="border-dashed border-sand-300 bg-white p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              ✓
            </div>

            <div className="mt-4 font-semibold text-ink-950">
              لا توجد طلبات بانتظار المراجعة
            </div>

            <div className="mx-auto mt-1 max-w-md text-sm leading-6 text-ink-900/45">
              جميع طلبات الدفع الحالية تمت مراجعتها.
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {pending.map((r) => {
              const snapshotEntries = getSnapshotEntries(
                r.payment_method_snapshot
              )

              return (
                <Card
                  key={r.id}
                  className="overflow-hidden border-sand-200 bg-white p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-ink-950">
                          {r.organizations?.name || 'شركة غير محددة'}
                        </h3>

                        <Badge tone="warning">
                          {getStatusLabel(r.status)}
                        </Badge>
                      </div>

                      <div className="mt-1.5 text-sm text-ink-900/60">
                        الخطة:{' '}
                        <span className="font-semibold text-ink-950">
                          {r.plans?.name || 'غير محددة'}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl bg-sand-50 px-3 py-2 text-xs text-ink-900/50">
                      {r.request_type || 'اشتراك'}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-sand-200 bg-sand-50/70 p-3">
                      <div className="text-xs text-ink-900/45">
                        المبلغ
                      </div>
                      <div className="mt-1 break-words font-bold text-ink-950">
                        {formatCurrency(
                          r.amount,
                          r.plans?.currency || 'EGP'
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-sand-200 bg-sand-50/70 p-3">
                      <div className="text-xs text-ink-900/45">
                        دورة الاشتراك
                      </div>
                      <div className="mt-1 font-bold text-ink-950">
                        {getCycleLabel(r.billing_cycle)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-sand-200 bg-sand-50/70 p-3">
                      <div className="text-xs text-ink-900/45">
                        تاريخ الدفع
                      </div>
                      <div className="mt-1 break-words font-bold text-ink-950">
                        {r.payment_date || 'غير محدد'}
                      </div>
                    </div>

                    <div className="rounded-xl border border-sand-200 bg-sand-50/70 p-3">
                      <div className="text-xs text-ink-900/45">
                        رقم المرجع
                      </div>
                      <div className="mt-1 break-all font-bold text-ink-950">
                        {r.reference || 'غير محدد'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-sand-200 p-4">
                      <div className="font-semibold text-sm text-ink-950">
                        طريقة الدفع المستخدمة
                      </div>

                      <div className="mt-3 text-sm text-ink-900/65">
                        <span className="font-semibold text-ink-950">
                          الطريقة:
                        </span>{' '}
                        {r.payment_method_snapshot?.name ||
                          r.method ||
                          'غير محددة'}
                      </div>

                      {snapshotEntries.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {snapshotEntries.map(([key, value]) => {
                            if (key === 'name') return null

                            return (
                              <div
                                key={key}
                                className="rounded-xl bg-sand-50 px-3 py-2 text-sm text-ink-900/65"
                              >
                                <span className="font-semibold text-ink-950">
                                  {snapshotLabels[key] ?? key}:
                                </span>{' '}
                                {String(value)}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-sand-200 p-4">
                      <div className="font-semibold text-sm text-ink-950">
                        الإيصال والملاحظات
                      </div>

                      <div className="mt-3">
                        {r.receipt_signed_url ? (
                          <a
                            href={r.receipt_signed_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink-900/15 bg-white px-4 text-sm font-semibold text-ink-950 transition hover:bg-sand-50"
                          >
                            عرض إيصال الدفع
                          </a>
                        ) : (
                          <div className="rounded-xl bg-sand-50 px-3 py-3 text-sm text-ink-900/45">
                            لا يوجد إيصال مرفق
                          </div>
                        )}
                      </div>

                      {r.note && (
                        <div className="mt-4">
                          <div className="mb-1.5 text-xs text-ink-900/45">
                            ملاحظات العميل
                          </div>

                          <div className="whitespace-pre-wrap break-words rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm leading-6 text-ink-900/70">
                            {r.note}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {r.item_snapshot &&
                    getSnapshotEntries(r.item_snapshot).length > 0 && (
                      <div className="mt-4 rounded-2xl border border-sand-200 p-4">
                        <div className="font-semibold text-sm text-ink-950">
                          تفاصيل الطلب المحفوظة
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {getSnapshotEntries(r.item_snapshot).map(
                            ([key, value]) => (
                              <div
                                key={key}
                                className="rounded-xl bg-sand-50 px-3 py-2 text-sm text-ink-900/65"
                              >
                                <span className="font-semibold text-ink-950">
                                  {key}:
                                </span>{' '}
                                {String(value)}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  <div className="mt-5 flex flex-col gap-2 border-t border-sand-200 pt-4 sm:flex-row sm:justify-end">
                    <Button
                      onClick={() => act(r.id, 'approve')}
                      disabled={actingId === r.id}
                      className="min-h-11 rounded-xl"
                    >
                      {actingId === r.id
                        ? 'جاري التنفيذ...'
                        : 'موافقة وتفعيل'}
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => act(r.id, 'reject')}
                      disabled={actingId === r.id}
                      className="min-h-11 rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                    >
                      رفض الطلب
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* Reviewed Requests */}
        {!loading && reviewed.length > 0 && (
          <div className="border-t border-sand-200 pt-7">
            <SectionHeader
              title="طلبات تمت مراجعتها"
              description="السجل السابق لطلبات الدفع التي تم اتخاذ إجراء بشأنها."
            />

            <div className="mt-4 space-y-3">
              {reviewed.map((r) => (
                <Card
                  key={r.id}
                  className="border-sand-200 bg-white p-4 transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1 text-sm font-semibold text-ink-950">
                        <span>
                          {r.organizations?.name || 'شركة غير محددة'}
                        </span>
                        <span className="text-ink-900/30">—</span>
                        <span>
                          {r.plans?.name || 'خطة غير محددة'}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-ink-900/45">
                        <span>{getCycleLabel(r.billing_cycle)}</span>
                        <span>·</span>
                        <span>{r.payment_date || 'بدون تاريخ'}</span>
                        <span>·</span>
                        <span>
                          {formatCurrency(
                            r.amount,
                            r.plans?.currency || 'EGP'
                          )}
                        </span>
                      </div>

                      {r.reference && (
                        <div className="mt-1.5 break-all text-xs text-ink-900/45">
                          المرجع: {r.reference}
                        </div>
                      )}

                      {r.receipt_signed_url && (
                        <a
                          href={r.receipt_signed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex text-xs font-semibold text-ink-950 underline underline-offset-2"
                        >
                          عرض الإيصال
                        </a>
                      )}
                    </div>

                    <Badge tone={getStatusTone(r.status)}>
                      {r.status === 'approved'
                        ? 'تمت الموافقة'
                        : r.status === 'rejected'
                        ? `مرفوض: ${
                            r.rejection_reason || 'غير محدد'
                          }`
                        : getStatusLabel(r.status)}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
