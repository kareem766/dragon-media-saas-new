import React, { useEffect, useState } from 'react'
import { Card, Badge, Button } from '../components/ui'
import { IconPlus } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'

interface DBPlan {
  id: string
  name: string
  tagline: string | null
  price: number
  yearly_price: number | null
  currency: string
  billing_cycle: string
  features: Record<string, boolean>
  limits: Record<string, number>
  trial_days: number
  status: string
  sort_order: number
  is_popular: boolean
}

const featureKeys = [
  { key: 'crm', label: 'إدارة العملاء (CRM)' },
  { key: 'ryan', label: 'RYAN AI' },
  { key: 'campaigns', label: 'الحملات التسويقية' },
  { key: 'automations', label: 'الأتمتة' },
  { key: 'advanced_reports', label: 'تقارير متقدمة' },
]

const limitKeys = [
  { key: 'users', label: 'حد المستخدمين' },
  { key: 'customers', label: 'حد العملاء' },
  { key: 'ai_messages', label: 'حد رسائل الذكاء الاصطناعي' },
]

const createEmptyPlan = () => ({
  name: '',
  tagline: '',
  price: '0',
  yearlyPrice: '',
  currency: 'EGP',
  trial_days: '7',
  isPopular: false,
  features: Object.fromEntries(
    featureKeys.map((feature) => [feature.key, false])
  ) as Record<string, boolean>,
  limits: Object.fromEntries(
    limitKeys.map((limit) => [limit.key, '0'])
  ) as Record<string, string>,
})

type PlanForm = ReturnType<typeof createEmptyPlan>

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-ink-900/8 bg-white p-5">
      <div className="h-5 w-28 rounded bg-ink-900/8" />
      <div className="mt-4 h-8 w-36 rounded bg-ink-900/6" />
      <div className="mt-5 space-y-2">
        <div className="h-3 w-full rounded bg-ink-900/5" />
        <div className="h-3 w-4/5 rounded bg-ink-900/5" />
        <div className="h-3 w-3/5 rounded bg-ink-900/5" />
      </div>
      <div className="mt-6 h-10 w-full rounded-xl bg-ink-900/6" />
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  min,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  min?: string
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-ink-950">
        {label}
      </label>

      <input
        type={type}
        value={value}
        min={min}
        placeholder={placeholder}
        dir={type === 'number' ? 'ltr' : 'rtl'}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-xl border border-sand-200 bg-white px-3.5 py-2.5 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/25 focus:border-ink-700 focus:ring-2 focus:ring-ink-950/5"
      />
    </div>
  )
}

export default function AdminPlans() {
  const [plans, setPlans] = useState<DBPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<PlanForm>(createEmptyPlan())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = async () => {
    if (!supabase) {
      setError('تعذر الاتصال بقاعدة البيانات.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: loadError } = await supabase
        .from('plans')
        .select('*')
        .order('sort_order', { ascending: true })

      if (loadError) {
        throw loadError
      }

      setPlans((data ?? []) as DBPlan[])
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر تحميل الباقات.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const startEdit = (plan: DBPlan) => {
    setError(null)
    setSuccess(null)
    setEditingId(plan.id)
    setCreating(false)

    setForm({
      name: plan.name,
      tagline: plan.tagline || '',
      price: String(plan.price),
      yearlyPrice:
        plan.yearly_price !== null && plan.yearly_price !== undefined
          ? String(plan.yearly_price)
          : '',
      currency: plan.currency,
      trial_days: String(plan.trial_days),
      isPopular: plan.is_popular,
      features: {
        ...Object.fromEntries(
          featureKeys.map((feature) => [feature.key, false])
        ),
        ...(plan.features || {}),
      },
      limits: Object.fromEntries(
        limitKeys.map((limit) => [
          limit.key,
          String(plan.limits?.[limit.key] ?? 0),
        ])
      ),
    })
  }

  const startCreate = () => {
    setError(null)
    setSuccess(null)
    setCreating(true)
    setEditingId(null)
    setForm(createEmptyPlan())
  }

  const cancel = () => {
    setEditingId(null)
    setCreating(false)
    setForm(createEmptyPlan())
  }

  const buildPayload = () => ({
    name: form.name.trim(),
    tagline: form.tagline.trim() || null,
    price: Number(form.price),
    yearly_price: form.yearlyPrice.trim()
      ? Number(form.yearlyPrice)
      : null,
    currency: form.currency.trim() || 'EGP',
    billing_cycle: 'monthly',
    trial_days: Number(form.trial_days),
    is_popular: form.isPopular,
    features: form.features,
    limits: Object.fromEntries(
      limitKeys.map((limit) => [
        limit.key,
        Number(form.limits[limit.key]),
      ])
    ),
  })

  const validateForm = () => {
    if (!form.name.trim()) {
      return 'اسم الباقة مطلوب.'
    }

    if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0) {
      return 'السعر الشهري يجب أن يكون رقمًا صحيحًا أو صفرًا.'
    }

    if (
      form.yearlyPrice.trim() &&
      (!Number.isFinite(Number(form.yearlyPrice)) ||
        Number(form.yearlyPrice) < 0)
    ) {
      return 'السعر السنوي يجب أن يكون رقمًا صحيحًا أو صفرًا.'
    }

    if (
      !Number.isFinite(Number(form.trial_days)) ||
      Number(form.trial_days) < 0
    ) {
      return 'أيام التجربة يجب أن تكون رقمًا صحيحًا أو صفرًا.'
    }

    for (const limit of limitKeys) {
      const value = Number(form.limits[limit.key])

      if (!Number.isFinite(value) || value < 0) {
        return `${limit.label} يجب أن يكون صفرًا أو رقمًا موجبًا.`
      }
    }

    return null
  }

  const handleSave = async () => {
    if (!supabase || saving) return

    setError(null)
    setSuccess(null)

    const validationError = validateForm()

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)

    try {
      const payload = buildPayload()

      if (editingId) {
        const { error: updateError } = await supabase
          .from('plans')
          .update(payload)
          .eq('id', editingId)

        if (updateError) {
          throw updateError
        }

        setSuccess('تم تحديث الباقة بنجاح.')
      } else {
        const maxOrder = plans.reduce(
          (max, plan) => Math.max(max, plan.sort_order),
          0
        )

        const { error: insertError } = await supabase
          .from('plans')
          .insert({
            ...payload,
            status: 'active',
            sort_order: maxOrder + 1,
          })

        if (insertError) {
          throw insertError
        }

        setSuccess('تم إنشاء الباقة بنجاح.')
      }

      cancel()
      await load()
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء حفظ الباقة.'
      )
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (plan: DBPlan) => {
    if (!supabase) return

    setError(null)
    setSuccess(null)

    try {
      const nextStatus =
        plan.status === 'active' ? 'disabled' : 'active'

      const { error: updateError } = await supabase
        .from('plans')
        .update({ status: nextStatus })
        .eq('id', plan.id)

      if (updateError) {
        throw updateError
      }

      setSuccess(
        nextStatus === 'active'
          ? `تم تفعيل باقة ${plan.name}.`
          : `تم إيقاف باقة ${plan.name}.`
      )

      await load()
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'تعذر تغيير حالة الباقة.'
      )
    }
  }

  const isEditing = editingId !== null || creating

  if (loading) {
    return (
      <div
        dir="rtl"
        className="space-y-6 p-1 sm:p-2"
        aria-busy="true"
      >
        <div className="animate-pulse space-y-2">
          <div className="h-7 w-36 rounded-lg bg-ink-900/8" />
          <div className="h-4 w-72 max-w-full rounded-lg bg-ink-900/6" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="space-y-6 p-1 sm:p-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink-950 sm:text-2xl">
            إدارة الباقات
          </h2>

          <p className="mt-1 text-sm leading-6 text-ink-900/50">
            إدارة الأسعار والمميزات والحدود التي تعتمد عليها اشتراكات العملاء.
          </p>
        </div>

        {!isEditing && (
          <Button onClick={startCreate}>
            <span className="inline-flex items-center gap-2">
              <IconPlus className="h-4 w-4" />
              باقة جديدة
            </span>
          </Button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/15 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => void load()}
              className="w-fit font-semibold underline underline-offset-4"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-500/15 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
        >
          {success}
        </div>
      )}

      {isEditing && (
        <Card className="overflow-hidden border border-ink-900/8 p-0 shadow-sm">
          <div className="border-b border-ink-900/8 bg-white px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold text-ink-950">
                {editingId ? 'تعديل الباقة' : 'إنشاء باقة جديدة'}
              </h3>

              <p className="text-sm text-ink-900/50">
                أدخل بيانات الباقة وحدد المميزات والحدود المسموحة لها.
              </p>
            </div>
          </div>

          <div className="space-y-7 bg-sand-50/40 p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="اسم الباقة"
                value={form.name}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    name: value,
                  }))
                }
                placeholder="مثال: Professional"
              />

              <Field
                label="وصف مختصر"
                value={form.tagline}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    tagline: value,
                  }))
                }
                placeholder="الأنسب للشركات الصغيرة والمتوسطة"
              />

              <Field
                label="السعر الشهري (ج.م)"
                value={form.price}
                type="number"
                min="0"
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    price: value,
                  }))
                }
              />

              <Field
                label="السعر السنوي الإجمالي (ج.م) - اختياري"
                value={form.yearlyPrice}
                type="number"
                min="0"
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    yearlyPrice: value,
                  }))
                }
                placeholder="مثال: 9600"
              />

              <Field
                label="أيام التجربة المجانية"
                value={form.trial_days}
                type="number"
                min="0"
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    trial_days: value,
                  }))
                }
              />

              <div className="flex items-end">
                <label className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-xl border border-sand-200 bg-white px-4 py-2.5 transition hover:border-ink-900/20">
                  <span className="text-sm font-semibold text-ink-900">
                    الباقة الأكثر شعبية
                  </span>

                  <input
                    type="checkbox"
                    checked={form.isPopular}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        isPopular: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-ink-950"
                  />
                </label>
              </div>
            </div>

            <div>
              <div className="mb-3">
                <h4 className="text-sm font-bold text-ink-950">
                  المميزات المتاحة
                </h4>

                <p className="mt-1 text-xs text-ink-900/45">
                  حدد المميزات التي سيحصل عليها العميل ضمن هذه الباقة.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {featureKeys.map((feature) => (
                  <label
                    key={feature.key}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-sand-200 bg-white px-4 py-3 transition hover:border-ink-900/15"
                  >
                    <span className="text-sm text-ink-900">
                      {feature.label}
                    </span>

                    <input
                      type="checkbox"
                      checked={Boolean(form.features[feature.key])}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          features: {
                            ...current.features,
                            [feature.key]: event.target.checked,
                          },
                        }))
                      }
                      className="h-4 w-4 accent-ink-950"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3">
                <h4 className="text-sm font-bold text-ink-950">
                  الحدود
                </h4>

                <p className="mt-1 text-xs text-ink-900/45">
                  حدد الحد الأقصى لكل مورد داخل الباقة.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {limitKeys.map((limit) => (
                  <Field
                    key={limit.key}
                    label={limit.label}
                    value={form.limits[limit.key]}
                    type="number"
                    min="0"
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        limits: {
                          ...current.limits,
                          [limit.key]: value,
                        },
                      }))
                    }
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-ink-900/8 pt-5 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                onClick={cancel}
                disabled={saving}
              >
                إلغاء
              </Button>

              <Button
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? 'جاري الحفظ...' : 'حفظ الباقة'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {!isEditing && plans.length === 0 && (
        <Card className="border border-dashed border-ink-900/15 p-8 text-center sm:p-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sand-100 text-ink-900/55">
            <IconPlus className="h-5 w-5" />
          </div>

          <h3 className="mt-4 text-base font-bold text-ink-950">
            لا توجد باقات بعد
          </h3>

          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-ink-900/50">
            أنشئ أول باقة لتحديد الأسعار والمميزات والحدود الخاصة بالاشتراكات.
          </p>

          <div className="mt-5">
            <Button onClick={startCreate}>
              إنشاء أول باقة
            </Button>
          </div>
        </Card>
      )}

      {!isEditing && plans.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className="flex flex-col overflow-hidden border border-ink-900/8 p-0 transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="border-b border-ink-900/8 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-ink-950">
                      {plan.name}
                    </h3>

                    {plan.tagline && (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-900/50">
                        {plan.tagline}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {plan.is_popular && (
                      <Badge tone="gold">مميزة</Badge>
                    )}

                    <Badge
                      tone={
                        plan.status === 'active'
                          ? 'success'
                          : 'default'
                      }
                    >
                      {plan.status === 'active'
                        ? 'مفعّلة'
                        : 'موقوفة'}
                    </Badge>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold tracking-tight text-ink-950">
                      {Number(plan.price).toLocaleString('ar-EG')}
                    </span>

                    <span className="text-xs font-medium text-ink-900/50">
                      {plan.currency} / شهريًا
                    </span>
                  </div>

                  {plan.yearly_price !== null &&
                    plan.yearly_price !== undefined && (
                      <p className="mt-1 text-xs text-ink-900/45">
                        سنويًا:{' '}
                        {Number(plan.yearly_price).toLocaleString(
                          'ar-EG'
                        )}{' '}
                        {plan.currency}
                      </p>
                    )}
                </div>
              </div>

              <div className="flex flex-1 flex-col bg-sand-50/40 p-5">
                <div>
                  <h4 className="text-xs font-bold text-ink-900/55">
                    المميزات
                  </h4>

                  <ul className="mt-3 space-y-2">
                    {Object.entries(plan.features || {})
                      .filter(([, enabled]) => Boolean(enabled))
                      .map(([key]) => (
                        <li
                          key={key}
                          className="flex items-start gap-2 text-xs leading-5 text-ink-900/65"
                        >
                          <span className="mt-0.5 font-bold text-emerald-600">
                            ✓
                          </span>

                          <span>
                            {featureKeys.find(
                              (feature) => feature.key === key
                            )?.label ?? key}
                          </span>
                        </li>
                      ))}

                    {!Object.values(plan.features || {}).some(
                      Boolean
                    ) && (
                      <li className="text-xs text-ink-900/40">
                        لا توجد مميزات محددة
                      </li>
                    )}
                  </ul>
                </div>

                <div className="mt-5 border-t border-ink-900/8 pt-4">
                  <h4 className="text-xs font-bold text-ink-900/55">
                    الحدود
                  </h4>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {limitKeys.map((limit) => (
                      <div
                        key={limit.key}
                        className="rounded-xl border border-ink-900/6 bg-white px-3 py-2"
                      >
                        <div className="truncate text-[10px] text-ink-900/45">
                          {limit.label}
                        </div>

                        <div className="mt-0.5 text-sm font-bold text-ink-950">
                          {Number(
                            plan.limits?.[limit.key] ?? 0
                          ).toLocaleString('ar-EG')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => startEdit(plan)}
                  >
                    تعديل
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => void toggleStatus(plan)}
                  >
                    {plan.status === 'active'
                      ? 'إيقاف'
                      : 'تفعيل'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
