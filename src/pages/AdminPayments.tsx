import React, { useEffect, useState } from 'react'
import { Card, Badge, Button } from '../components/ui'
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

function formatCurrency(
  amount: number,
  currency = 'EGP'
) {
  return `${Number(amount || 0).toLocaleString('ar-EG')} ${
    currency === 'EGP' ? 'ج.م' : currency
  }`
}

function getCycleLabel(
  cycle: PaymentRequestRow['billing_cycle']
) {
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

function getSnapshotEntries(
  snapshot: Record<string, any> | null
) {
  if (!snapshot) return []

  return Object.entries(snapshot).filter(
    ([, value]) =>
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ''
  )
}

export default function AdminPayments() {
  const [requests, setRequests] = useState<
    PaymentRequestRow[]
  >([])
  const [methods, setMethods] = useState<
    PaymentMethod[]
  >([])

  const [loading, setLoading] = useState(true)
  const [methodsLoading, setMethodsLoading] =
    useState(true)

  const [error, setError] = useState<string | null>(null)
  const [methodsError, setMethodsError] =
    useState<string | null>(null)

  const [actingId, setActingId] = useState<string | null>(
    null
  )

  const [showMethodForm, setShowMethodForm] =
    useState(false)
  const [editingMethodId, setEditingMethodId] =
    useState<string | null>(null)
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

      const { data: sessionData } =
        await supabase.auth.getSession()

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
        setError(
          json.error || 'تعذر تحميل طلبات الدفع.'
        )
        return
      }

      setRequests(json.requests ?? [])
    } catch {
      setError(
        'حدث خطأ أثناء تحميل طلبات الدفع.'
      )
    } finally {
      setLoading(false)
    }
  }

  const loadMethods = async () => {
    if (!supabase) {
      setMethodsLoading(false)
      setMethodsError(
        'قاعدة البيانات غير متاحة حاليًا.'
      )
      return
    }

    try {
      setMethodsLoading(true)
      setMethodsError(null)

      const { data, error: queryError } =
        await supabase
          .from('payment_methods')
          .select(
            'id, method_key, name, details, enabled, display_order'
          )
          .order('display_order', {
            ascending: true,
          })

      if (queryError) {
        setMethodsError('تعذر تحميل طرق الدفع.')
        return
      }

      setMethods(
        (data ?? []) as PaymentMethod[]
      )
    } catch {
      setMethodsError(
        'حدث خطأ أثناء تحميل طرق الدفع.'
      )
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
        window
          .prompt('اكتب سبب رفض طلب الدفع:')
          ?.trim() || 'غير محدد'
    }

    setActingId(requestId)

    try {
      const { data: sessionData } =
        await supabase.auth.getSession()

      const token =
        sessionData.session?.access_token

      if (!token) {
        window.alert(
          'انتهت جلسة تسجيل الدخول.'
        )
        return
      }

      const res = await fetch(
        '/api/admin/payments',
        {
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
        }
      )

      const json = await res.json()

      if (!res.ok) {
        window.alert(
          json.error || 'تعذر تنفيذ العملية.'
        )
        return
      }

      await loadRequests()
    } catch {
      window.alert(
        'حدث خطأ أثناء تنفيذ العملية.'
      )
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

  const openEditMethod = (
    method: PaymentMethod
  ) => {
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

    const methodKey =
      methodForm.method_key.trim()

    const name = methodForm.name.trim()

    if (!methodKey) {
      window.alert(
        'برجاء إدخال مفتاح طريقة الدفع.'
      )
      return
    }

    if (!name) {
      window.alert(
        'برجاء إدخال اسم طريقة الدفع.'
      )
      return
    }

    setSavingMethod(true)

    try {
      if (editingMethodId) {
        const { error: updateError } =
          await supabase
            .from('payment_methods')
            .update({
              method_key: methodKey,
              name,
              details:
                methodForm.details ?? {},
              enabled: methodForm.enabled,
              display_order:
                Number(
                  methodForm.display_order
                ) || 0,
              updated_at:
                new Date().toISOString(),
            })
            .eq('id', editingMethodId)

        if (updateError) {
          window.alert(
            updateError.message ||
              'تعذر تحديث طريقة الدفع.'
          )
          return
        }
      } else {
        const { error: insertError } =
          await supabase
            .from('payment_methods')
            .insert({
              method_key: methodKey,
              name,
              details:
                methodForm.details ?? {},
              enabled: methodForm.enabled,
              display_order:
                Number(
                  methodForm.display_order
                ) || 0,
            })

        if (insertError) {
          window.alert(
            insertError.message ||
              'تعذر إضافة طريقة الدفع.'
          )
          return
        }
      }

      closeMethodForm()
      await loadMethods()
    } catch {
      window.alert(
        'حدث خطأ أثناء حفظ طريقة الدفع.'
      )
    } finally {
      setSavingMethod(false)
    }
  }

  const toggleMethod = async (
    method: PaymentMethod
  ) => {
    if (!supabase) return

    const { error: updateError } =
      await supabase
        .from('payment_methods')
        .update({
          enabled: !method.enabled,
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', method.id)

    if (updateError) {
      window.alert(
        updateError.message ||
          'تعذر تغيير حالة طريقة الدفع.'
      )
      return
    }

    await loadMethods()
  }

  const deleteMethod = async (
    method: PaymentMethod
  ) => {
    if (!supabase) return

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف طريقة الدفع "${method.name}"؟`
    )

    if (!confirmed) return

    const { error: deleteError } =
      await supabase
        .from('payment_methods')
        .delete()
        .eq('id', method.id)

    if (deleteError) {
      window.alert(
        deleteError.message ||
          'تعذر حذف طريقة الدفع.'
      )
      return
    }

    await loadMethods()
  }

  if (loading && methodsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  const pending = requests.filter(
    (r) => r.status === 'pending_review'
  )

  const reviewed = requests.filter(
    (r) => r.status !== 'pending_review'
  )

  return (
    <div className="space-y-8">
      {/* Payment Methods */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-ink-950">
              طرق الدفع
            </h2>

            <p className="text-sm text-ink-900/50 mt-1">
              إدارة طرق الدفع التي تظهر للعملاء أثناء الاشتراك.
            </p>
          </div>

          <Button onClick={openCreateMethod}>
            إضافة طريقة دفع
          </Button>
        </div>

        {methodsError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            {methodsError}
          </div>
        )}

        {methodsLoading ? (
          <div className="text-sm text-ink-900/50 py-6 text-center">
            جاري تحميل طرق الدفع...
          </div>
        ) : methods.length === 0 ? (
          <Card className="p-6 text-center">
            <div className="font-semibold text-ink-950">
              لا توجد طرق دفع مضافة
            </div>

            <div className="text-sm text-ink-900/45 mt-1">
              أضف أول طريقة دفع ليتمكن العملاء من استخدامها.
            </div>

            <Button
              className="mt-4"
              onClick={openCreateMethod}
            >
              إضافة طريقة دفع
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {methods.map((method) => (
              <Card
                key={method.id}
                className="p-4"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-ink-950">
                        {method.name}
                      </h3>

                      <Badge
                        tone={
                          method.enabled
                            ? 'success'
                            : 'danger'
                        }
                      >
                        {method.enabled
                          ? 'مفعّلة'
                          : 'معطّلة'}
                      </Badge>
                    </div>

                    <div className="text-xs text-ink-900/40 mt-1">
                      المفتاح: {method.method_key}
                      {' · '}
                      الترتيب: {method.display_order}
                    </div>

                    {method.details &&
                      Object.keys(
                        method.details
                      ).length > 0 && (
                        <div className="mt-3 space-y-1">
                          {Object.entries(
                            method.details
                          ).map(
                            ([key, value]) => (
                              <div
                                key={key}
                                className="text-sm text-ink-900/65"
                              >
                                <span className="font-semibold text-ink-950">
                                  {detailLabels[
                                    key
                                  ] ?? key}
                                  :
                                </span>{' '}
                                {value}
                              </div>
                            )
                          )}
                        </div>
                      )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        toggleMethod(method)
                      }
                    >
                      {method.enabled
                        ? 'تعطيل'
                        : 'تفعيل'}
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() =>
                        openEditMethod(
                          method
                        )
                      }
                    >
                      تعديل
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() =>
                        deleteMethod(
                          method
                        )
                      }
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
        <Card className="p-5 border-2 border-ink-900/10">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h3 className="font-bold text-ink-950">
              {editingMethodId
                ? 'تعديل طريقة الدفع'
                : 'إضافة طريقة دفع'}
            </h3>

            <button
              type="button"
              onClick={closeMethodForm}
              className="text-sm text-ink-900/45 hover:text-ink-950"
            >
              إغلاق
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-ink-900/50">
                اسم طريقة الدفع
              </label>

              <input
                value={methodForm.name}
                onChange={(e) =>
                  setMethodForm(
                    (current) => ({
                      ...current,
                      name: e.target.value,
                    })
                  )
                }
                placeholder="مثال: فودافون كاش"
                className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700"
              />
            </div>

            <div>
              <label className="text-xs text-ink-900/50">
                مفتاح طريقة الدفع
              </label>

              <input
                value={methodForm.method_key}
                onChange={(e) =>
                  setMethodForm(
                    (current) => ({
                      ...current,
                      method_key:
                        e.target.value
                          .toLowerCase()
                          .replace(
                            /\s+/g,
                            '_'
                          ),
                    })
                  )
                }
                placeholder="مثال: vodafone_cash"
                className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700"
                disabled={!!editingMethodId}
              />
            </div>

            <div>
              <label className="text-xs text-ink-900/50">
                ترتيب الظهور
              </label>

              <input
                type="number"
                min="0"
                value={
                  methodForm.display_order
                }
                onChange={(e) =>
                  setMethodForm(
                    (current) => ({
                      ...current,
                      display_order:
                        Number(
                          e.target.value
                        ),
                    })
                  )
                }
                className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-ink-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    methodForm.enabled
                  }
                  onChange={(e) =>
                    setMethodForm(
                      (current) => ({
                        ...current,
                        enabled:
                          e.target.checked,
                      })
                    )
                  }
                />
                طريقة الدفع مفعّلة
              </label>
            </div>
          </div>

          <div className="mt-6">
            <div className="font-semibold text-sm text-ink-950 mb-3">
              بيانات طريقة الدفع
            </div>

            {Object.entries(
              methodForm.details ?? {}
            ).length > 0 && (
              <div className="space-y-2 mb-4">
                {Object.entries(
                  methodForm.details ?? {}
                ).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 bg-sand-50 border border-sand-200 rounded-lg px-3 py-2"
                  >
                    <div className="text-sm min-w-0">
                      <span className="font-semibold text-ink-950">
                        {detailLabels[key] ??
                          key}
                        :
                      </span>{' '}
                      <span className="text-ink-900/65">
                        {value}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeDetail(key)
                      }
                      className="text-xs text-red-600 shrink-0"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2">
              <input
                value={detailKey}
                onChange={(e) =>
                  setDetailKey(
                    e.target.value
                  )
                }
                placeholder="اسم الحقل"
                className="border border-sand-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-ink-700"
              />

              <input
                value={detailValue}
                onChange={(e) =>
                  setDetailValue(
                    e.target.value
                  )
                }
                placeholder="القيمة"
                className="border border-sand-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-ink-700"
              />

              <Button
                variant="secondary"
                onClick={addDetail}
              >
                إضافة
              </Button>
            </div>

            <div className="text-xs text-ink-900/40 mt-2">
              أمثلة: number، account_name، account_number،
              IBAN، bank_name، instructions
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button
              onClick={saveMethod}
              disabled={savingMethod}
            >
              {savingMethod
                ? 'جاري الحفظ...'
                : 'حفظ طريقة الدفع'}
            </Button>

            <Button
              variant="secondary"
              onClick={closeMethodForm}
              disabled={savingMethod}
            >
              إلغاء
            </Button>
          </div>
        </Card>
      )}

      {/* Payment Requests */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-ink-950">
            مراجعة طلبات الدفع
          </h2>

          <p className="text-sm text-ink-900/50 mt-1">
            مراجعة تفاصيل الدفع والمرفقات قبل تفعيل الاشتراك.
          </p>
        </div>

        {error && (
          <div className="text-center py-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
            {error}
          </div>
        )}

        {pending.length === 0 ? (
          <div className="text-sm text-ink-900/40 text-center py-10">
            لا توجد طلبات بانتظار المراجعة
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((r) => {
              const snapshotEntries =
                getSnapshotEntries(
                  r.payment_method_snapshot
                )

              return (
                <Card
                  key={r.id}
                  className="p-5"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-bold text-ink-950">
                        {r.organizations?.name ||
                          'شركة غير محددة'}
                      </div>

                      <div className="text-sm text-ink-900/65 mt-1">
                        الخطة:{' '}
                        <span className="font-semibold text-ink-950">
                          {r.plans?.name ||
                            'غير محددة'}
                        </span>
                      </div>
                    </div>

                    <Badge tone="warning">
                      {getStatusLabel(
                        r.status
                      )}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
                    <div className="bg-sand-50 border border-sand-200 rounded-lg p-3">
                      <div className="text-xs text-ink-900/45">
                        المبلغ
                      </div>

                      <div className="font-bold text-ink-950 mt-1">
                        {formatCurrency(
                          r.amount,
                          r.plans
                            ?.currency ||
                            'EGP'
                        )}
                      </div>
                    </div>

                    <div className="bg-sand-50 border border-sand-200 rounded-lg p-3">
                      <div className="text-xs text-ink-900/45">
                        دورة الاشتراك
                      </div>

                      <div className="font-bold text-ink-950 mt-1">
                        {getCycleLabel(
                          r.billing_cycle
                        )}
                      </div>
                    </div>

                    <div className="bg-sand-50 border border-sand-200 rounded-lg p-3">
                      <div className="text-xs text-ink-900/45">
                        تاريخ الدفع
                      </div>

                      <div className="font-bold text-ink-950 mt-1">
                        {r.payment_date ||
                          'غير محدد'}
                      </div>
                    </div>

                    <div className="bg-sand-50 border border-sand-200 rounded-lg p-3">
                      <div className="text-xs text-ink-900/45">
                        رقم المرجع
                      </div>

                      <div className="font-bold text-ink-950 mt-1 break-all">
                        {r.reference ||
                          'غير محدد'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <div className="border border-sand-200 rounded-lg p-4">
                      <div className="font-semibold text-sm text-ink-950 mb-3">
                        طريقة الدفع المستخدمة
                      </div>

                      <div className="text-sm text-ink-900/65">
                        <span className="font-semibold text-ink-950">
                          الطريقة:
                        </span>{' '}
                        {r.payment_method_snapshot
                          ?.name ||
                          r.method ||
                          'غير محددة'}
                      </div>

                      {snapshotEntries.length >
                        0 && (
                        <div className="mt-3 space-y-2">
                          {snapshotEntries.map(
                            ([key, value]) => {
                              if (
                                key === 'name'
                              ) {
                                return null
                              }

                              return (
                                <div
                                  key={key}
                                  className="text-sm text-ink-900/65"
                                >
                                  <span className="font-semibold text-ink-950">
                                    {snapshotLabels[
                                      key
                                    ] ?? key}
                                    :
                                  </span>{' '}
                                  {String(
                                    value
                                  )}
                                </div>
                              )
                            }
                          )}
                        </div>
                      )}
                    </div>

                    <div className="border border-sand-200 rounded-lg p-4">
                      <div className="font-semibold text-sm text-ink-950 mb-3">
                        الإيصال والملاحظات
                      </div>

                      {r.receipt_signed_url ? (
                        <a
                          href={
                            r.receipt_signed_url
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-lg border border-ink-900/15 bg-white px-3 py-2 text-sm font-semibold text-ink-950 hover:bg-sand-50 transition"
                        >
                          عرض إيصال الدفع
                        </a>
                      ) : (
                        <div className="text-sm text-ink-900/45">
                          لا يوجد إيصال مرفق
                        </div>
                      )}

                      {r.note && (
                        <div className="mt-4">
                          <div className="text-xs text-ink-900/45 mb-1">
                            ملاحظات العميل
                          </div>

                          <div className="text-sm text-ink-900/70 bg-sand-50 border border-sand-200 rounded-lg p-3 whitespace-pre-wrap">
                            {r.note}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {r.item_snapshot &&
                    getSnapshotEntries(
                      r.item_snapshot
                    ).length > 0 && (
                      <div className="border border-sand-200 rounded-lg p-4 mt-4">
                        <div className="font-semibold text-sm text-ink-950 mb-3">
                          تفاصيل الطلب المحفوظة
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {getSnapshotEntries(
                            r.item_snapshot
                          ).map(
                            ([key, value]) => (
                              <div
                                key={key}
                                className="text-sm text-ink-900/65"
                              >
                                <span className="font-semibold text-ink-950">
                                  {key}:
                                </span>{' '}
                                {String(
                                  value
                                )}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  <div className="flex gap-2 flex-wrap justify-end mt-5 pt-4 border-t border-sand-200">
                    <Button
                      onClick={() =>
                        act(
                          r.id,
                          'approve'
                        )
                      }
                      disabled={
                        actingId === r.id
                      }
                    >
                      {actingId === r.id
                        ? 'جاري التنفيذ...'
                        : 'موافقة وتفعيل'}
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() =>
                        act(
                          r.id,
                          'reject'
                        )
                      }
                      disabled={
                        actingId === r.id
                      }
                    >
                      رفض الطلب
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {reviewed.length > 0 && (
          <div className="pt-4">
            <h3 className="font-bold text-ink-950 mb-3">
              طلبات تمت مراجعتها
            </h3>

            <div className="space-y-3">
              {reviewed.map((r) => (
                <Card
                  key={r.id}
                  className="p-4"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink-950">
                        {r.organizations?.name ||
                          'شركة غير محددة'}
                        {' — '}
                        {r.plans?.name ||
                          'خطة غير محددة'}
                      </div>

                      <div className="text-xs text-ink-900/45 mt-1">
                        {getCycleLabel(
                          r.billing_cycle
                        )}
                        {' · '}
                        {r.payment_date ||
                          'بدون تاريخ'}
                        {' · '}
                        {formatCurrency(
                          r.amount,
                          r.plans
                            ?.currency ||
                            'EGP'
                        )}
                      </div>

                      {r.reference && (
                        <div className="text-xs text-ink-900/45 mt-1">
                          المرجع:{' '}
                          {r.reference}
                        </div>
                      )}

                      {r.receipt_signed_url && (
                        <a
                          href={
                            r.receipt_signed_url
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-xs font-semibold text-ink-950 underline mt-2"
                        >
                          عرض الإيصال
                        </a>
                      )}
                    </div>

                    <Badge
                      tone={getStatusTone(
                        r.status
                      )}
                    >
                      {r.status ===
                      'approved'
                        ? 'تمت الموافقة'
                        : r.status ===
                          'rejected'
                        ? `مرفوض: ${
                            r.rejection_reason ||
                            'غير محدد'
                          }`
                        : getStatusLabel(
                            r.status
                          )}
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
