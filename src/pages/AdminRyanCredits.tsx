import React, { useEffect, useState } from 'react'
import { Card, Badge, Button } from '../components/ui'
import { IconPlus } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'

interface RyanCreditPackage {
  id: string
  name: string
  message_count: number
  price: number
  currency: string
  description: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

interface PackageForm {
  name: string
  message_count: string
  price: string
  currency: string
  description: string
  active: boolean
  sort_order: string
}

const emptyForm: PackageForm = {
  name: '',
  message_count: '500',
  price: '150',
  currency: 'EGP',
  description: '',
  active: true,
  sort_order: '10',
}

export default function AdminRyanCredits() {
  const [packages, setPackages] = useState<RyanCreditPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] =
    useState<string | null>(null)

  const [creating, setCreating] =
    useState(false)

  const [form, setForm] =
    useState<PackageForm>({
      ...emptyForm,
    })

  const [error, setError] =
    useState<string | null>(null)

  const [success, setSuccess] =
    useState<string | null>(null)

  const loadPackages = async () => {
    if (!supabase) return

    setLoading(true)
    setError(null)

    const {
      data,
      error: loadError,
    } = await supabase
      .from('ryan_credit_packages')
      .select('*')
      .order('sort_order', {
        ascending: true,
      })
      .order('created_at', {
        ascending: true,
      })

    if (loadError) {
      setError(
        loadError.message ||
          'تعذر تحميل باقات Ryan.'
      )
    } else {
      setPackages(
        (data || []) as RyanCreditPackage[]
      )
    }

    setLoading(false)
  }

  useEffect(() => {
    loadPackages()
  }, [])

  const startCreate = () => {
    setCreating(true)
    setEditingId(null)
    setForm({
      ...emptyForm,
      sort_order: String(
        packages.reduce(
          (max, item) =>
            Math.max(
              max,
              Number(
                item.sort_order || 0
              )
            ),
          0
        ) + 10
      ),
    })
    setError(null)
    setSuccess(null)
  }

  const startEdit = (
    item: RyanCreditPackage
  ) => {
    setCreating(false)
    setEditingId(item.id)

    setForm({
      name: item.name,
      message_count: String(
        item.message_count
      ),
      price: String(item.price),
      currency:
        item.currency || 'EGP',
      description:
        item.description || '',
      active: item.active,
      sort_order: String(
        item.sort_order || 0
      ),
    })

    setError(null)
    setSuccess(null)
  }

  const cancelEdit = () => {
    setCreating(false)
    setEditingId(null)
    setForm({
      ...emptyForm,
    })
    setError(null)
  }

  const updateForm = (
    key: keyof PackageForm,
    value: string | boolean
  ) => {
    setForm(current => ({
      ...current,
      [key]: value,
    }))
  }

  const validate = () => {
    if (!form.name.trim()) {
      return 'اكتب اسم الباقة.'
    }

    const messages =
      Number(form.message_count)

    if (
      !Number.isInteger(messages) ||
      messages <= 0
    ) {
      return 'عدد الرسائل يجب أن يكون رقمًا صحيحًا أكبر من صفر.'
    }

    const price =
      Number(form.price)

    if (
      Number.isNaN(price) ||
      price < 0
    ) {
      return 'السعر غير صحيح.'
    }

    const sortOrder =
      Number(form.sort_order)

    if (
      Number.isNaN(sortOrder) ||
      sortOrder < 0
    ) {
      return 'ترتيب الباقة غير صحيح.'
    }

    if (!form.currency.trim()) {
      return 'حدد العملة.'
    }

    return null
  }

  const savePackage = async () => {
    if (!supabase) return

    setError(null)
    setSuccess(null)

    const validationError =
      validate()

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)

    const payload = {
      name: form.name.trim(),
      message_count:
        Number(form.message_count),
      price: Number(form.price),
      currency:
        form.currency
          .trim()
          .toUpperCase(),
      description:
        form.description.trim() ||
        null,
      active: form.active,
      sort_order:
        Number(form.sort_order),
      updated_at:
        new Date().toISOString(),
    }

    try {
      if (editingId) {
        const {
          error: updateError,
        } = await supabase
          .from('ryan_credit_packages')
          .update(payload)
          .eq('id', editingId)

        if (updateError) {
          throw new Error(
            updateError.message
          )
        }

        setSuccess(
          'تم تحديث باقة Ryan بنجاح.'
        )
      } else {
        const {
          error: insertError,
        } = await supabase
          .from('ryan_credit_packages')
          .insert(payload)

        if (insertError) {
          throw new Error(
            insertError.message
          )
        }

        setSuccess(
          'تم إنشاء باقة Ryan بنجاح.'
        )
      }

      setCreating(false)
      setEditingId(null)
      setForm({
        ...emptyForm,
      })

      await loadPackages()
    } catch (
      saveError: any
    ) {
      setError(
        saveError?.message ||
          'تعذر حفظ الباقة.'
      )
    } finally {
      setSaving(false)
    }
  }

  const togglePackage = async (
    item: RyanCreditPackage
  ) => {
    if (!supabase) return

    setError(null)
    setSuccess(null)

    const {
      error: updateError,
    } = await supabase
      .from('ryan_credit_packages')
      .update({
        active: !item.active,
        updated_at:
          new Date().toISOString(),
      })
      .eq('id', item.id)

    if (updateError) {
      setError(
        updateError.message ||
          'تعذر تغيير حالة الباقة.'
      )
      return
    }

    setSuccess(
      item.active
        ? 'تم تعطيل الباقة.'
        : 'تم تفعيل الباقة.'
    )

    await loadPackages()
  }

  const deletePackage = async (
    item: RyanCreditPackage
  ) => {
    if (!supabase) return

    setError(null)
    setSuccess(null)

    const confirmed =
      window.confirm(
        `هل أنت متأكد من حذف "${item.name}"؟\n\nطلبات الشراء القديمة لن تتأثر لأن بيانات الباقة محفوظة داخل الطلب نفسه.`
      )

    if (!confirmed) {
      return
    }

    const {
      error: deleteError,
    } = await supabase
      .from('ryan_credit_packages')
      .delete()
      .eq('id', item.id)

    if (deleteError) {
      setError(
        deleteError.message ||
          'تعذر حذف الباقة.'
      )
      return
    }

    setSuccess(
      'تم حذف الباقة.'
    )

    await loadPackages()
  }

  const activeCount =
    packages.filter(
      item => item.active
    ).length

  const totalCredits =
    packages.reduce(
      (sum, item) =>
        sum +
        Number(
          item.message_count || 0
        ),
      0
    )

  if (loading) {
    return (
      <div className="space-y-6">

        <div>
          <h2 className="text-xl font-bold text-ink-950">
            إدارة باقات RYAN
          </h2>

          <p className="text-sm text-ink-900/45 mt-1">
            إدارة أسعار وحدود الرسائل الإضافية.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">

          {[1, 2, 3].map(
            item => (
              <div
                key={item}
                className="h-28 rounded-2xl bg-sand-50 animate-pulse"
              />
            )
          )}

        </div>

        <Card className="p-6">

          <div className="h-5 w-40 rounded bg-sand-100 animate-pulse" />

          <div className="mt-5 space-y-3">

            {[1, 2, 3].map(
              item => (
                <div
                  key={item}
                  className="h-16 rounded-xl bg-sand-50 animate-pulse"
                />
              )
            )}

          </div>

        </Card>

      </div>
    )
  }

  const isEditing =
    creating || editingId !== null

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

        <div>

          <h2 className="text-xl font-bold text-ink-950">
            إدارة باقات RYAN
          </h2>

          <p className="text-sm text-ink-900/45 mt-1">
            تحكم كامل في أسعار وعدد الرسائل الإضافية التي يمكن للعملاء شراؤها.
          </p>

        </div>

        {!isEditing && (
          <Button
            onClick={startCreate}
          >
            <span className="inline-flex items-center gap-2">
              <IconPlus className="w-4 h-4" />
              باقة جديدة
            </span>
          </Button>
        )}

      </div>

      {/* FEEDBACK */}

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* SUMMARY */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <Card className="p-5">

          <div className="text-xs text-ink-900/45">
            إجمالي الباقات
          </div>

          <div className="text-2xl font-bold text-ink-950 mt-1">
            {packages.length.toLocaleString(
              'ar-EG'
            )}
          </div>

        </Card>

        <Card className="p-5">

          <div className="text-xs text-ink-900/45">
            الباقات المفعّلة
          </div>

          <div className="text-2xl font-bold text-ink-950 mt-1">
            {activeCount.toLocaleString(
              'ar-EG'
            )}
          </div>

        </Card>

        <Card className="p-5">

          <div className="text-xs text-ink-900/45">
            إجمالي الرسائل المعرفة بالباقات
          </div>

          <div className="text-2xl font-bold text-ink-950 mt-1">
            {totalCredits.toLocaleString(
              'ar-EG'
            )}
          </div>

        </Card>

      </div>

      {/* EDITOR */}

      {isEditing && (
        <Card className="p-6">

          <div className="flex items-center justify-between gap-3 mb-5">

            <div>

              <h3 className="font-bold text-ink-950">
                {editingId
                  ? 'تعديل باقة Ryan'
                  : 'إنشاء باقة Ryan جديدة'}
              </h3>

              <p className="text-xs text-ink-900/45 mt-1">
                التعديلات هنا تؤثر على الباقات الجديدة المتاحة للشراء فقط.
              </p>

            </div>

            <Badge
              tone={
                form.active
                  ? 'success'
                  : 'default'
              }
            >
              {form.active
                ? 'مفعّلة'
                : 'معطّلة'}
            </Badge>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div>

              <label className="text-xs text-ink-900/50">
                اسم الباقة
              </label>

              <input
                value={form.name}
                onChange={event =>
                  updateForm(
                    'name',
                    event.target.value
                  )
                }
                placeholder="مثال: Ryan 1000 رسالة"
                className="w-full mt-1 border border-sand-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-ink-700"
              />

            </div>

            <div>

              <label className="text-xs text-ink-900/50">
                عدد الرسائل
              </label>

              <input
                type="number"
                min="1"
                value={
                  form.message_count
                }
                onChange={event =>
                  updateForm(
                    'message_count',
                    event.target.value
                  )
                }
                className="w-full mt-1 border border-sand-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-ink-700"
              />

            </div>

            <div>

              <label className="text-xs text-ink-900/50">
                السعر
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={event =>
                  updateForm(
                    'price',
                    event.target.value
                  )
                }
                className="w-full mt-1 border border-sand-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-ink-700"
              />

            </div>

            <div>

              <label className="text-xs text-ink-900/50">
                العملة
              </label>

              <input
                value={form.currency}
                onChange={event =>
                  updateForm(
                    'currency',
                    event.target.value
                  )
                }
                placeholder="EGP"
                className="w-full mt-1 border border-sand-200 rounded-xl px-4 py-3 text-sm uppercase outline-none focus:border-ink-700"
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
                  form.sort_order
                }
                onChange={event =>
                  updateForm(
                    'sort_order',
                    event.target.value
                  )
                }
                className="w-full mt-1 border border-sand-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-ink-700"
              />

            </div>

            <label className="flex items-center gap-3 border border-sand-200 rounded-xl px-4 py-3 mt-5 md:mt-0 cursor-pointer">

              <input
                type="checkbox"
                checked={
                  form.active
                }
                onChange={event =>
                  updateForm(
                    'active',
                    event.target.checked
                  )
                }
                className="w-4 h-4 accent-ink-900"
              />

              <span className="text-sm text-ink-900">
                الباقة متاحة للعملاء
              </span>

            </label>

          </div>

          <div className="mt-4">

            <label className="text-xs text-ink-900/50">
              وصف الباقة
            </label>

            <textarea
              rows={3}
              value={
                form.description
              }
              onChange={event =>
                updateForm(
                  'description',
                  event.target.value
                )
              }
              placeholder="وصف مختصر يظهر للعميل عند شراء الباقة."
              className="w-full mt-1 border border-sand-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-ink-700 resize-none"
            />

          </div>

          <div className="flex gap-2 mt-6">

            <Button
              onClick={savePackage}
              disabled={saving}
            >
              {saving
                ? 'جاري الحفظ...'
                : 'حفظ الباقة'}
            </Button>

            <Button
              variant="secondary"
              onClick={cancelEdit}
              disabled={saving}
            >
              إلغاء
            </Button>

          </div>

        </Card>
      )}

      {/* PACKAGES */}

      {!isEditing && (
        <Card className="overflow-hidden">

          <div className="p-5 border-b border-sand-100">

            <h3 className="font-bold text-ink-950">
              الباقات الحالية
            </h3>

            <p className="text-xs text-ink-900/45 mt-1">
              الباقات المعطلة لا تظهر للعملاء، لكن بيانات الطلبات القديمة تظل محفوظة.
            </p>

          </div>

          {packages.length === 0 ? (

            <div className="p-10 text-center">

              <div className="text-sm text-ink-900/50">
                لا توجد باقات Ryan حاليًا.
              </div>

              <Button
                className="mt-4"
                onClick={startCreate}
              >
                إنشاء أول باقة
              </Button>

            </div>

          ) : (

            <div className="divide-y divide-sand-100">

              {packages.map(
                item => (
                  <div
                    key={item.id}
                    className="p-5 hover:bg-sand-50/50 transition"
                  >

                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

                      <div className="min-w-0">

                        <div className="flex items-center gap-2 flex-wrap">

                          <h4 className="font-bold text-ink-950">
                            {item.name}
                          </h4>

                          <Badge
                            tone={
                              item.active
                                ? 'success'
                                : 'default'
                            }
                          >
                            {item.active
                              ? 'مفعّلة'
                              : 'معطّلة'}
                          </Badge>

                        </div>

                        {item.description && (
                          <p className="text-sm text-ink-900/45 mt-1">
                            {item.description}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-xs text-ink-900/55">

                          <span>
                            الرسائل:{' '}
                            <strong className="text-ink-950">
                              {Number(
                                item.message_count
                              ).toLocaleString(
                                'ar-EG'
                              )}
                            </strong>
                          </span>

                          <span>
                            السعر:{' '}
                            <strong className="text-ink-950">
                              {Number(
                                item.price
                              ).toLocaleString(
                                'ar-EG'
                              )}{' '}
                              {item.currency}
                            </strong>
                          </span>

                          <span>
                            الترتيب:{' '}
                            <strong className="text-ink-950">
                              {Number(
                                item.sort_order
                              ).toLocaleString(
                                'ar-EG'
                              )}
                            </strong>
                          </span>

                        </div>

                      </div>

                      <div className="flex gap-2 shrink-0">

                        <Button
                          variant="secondary"
                          onClick={() =>
                            startEdit(
                              item
                            )
                          }
                        >
                          تعديل
                        </Button>

                        <Button
                          variant="secondary"
                          onClick={() =>
                            togglePackage(
                              item
                            )
                          }
                        >
                          {item.active
                            ? 'تعطيل'
                            : 'تفعيل'}
                        </Button>

                        <Button
                          variant="secondary"
                          onClick={() =>
                            deletePackage(
                              item
                            )
                          }
                        >
                          حذف
                        </Button>

                      </div>

                    </div>

                  </div>
                )
              )}

            </div>

          )}

        </Card>
      )}

    </div>
  )
}
