import React, { useEffect, useState } from 'react'
import { Card, Badge, Button } from '../components/ui'
import { IconPlus } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'
import { useSubscription } from '../lib/useSubscription'
import FeatureLocked from '../components/FeatureLocked'

interface DBAutomation {
  id: string
  name: string
  trigger_event: string
  config: { hours?: number }
  action_type: string
  action_config: { title_template?: string; priority?: string }
  active: boolean
}

const emptyForm = {
  name: '',
  hours: '24',
  priority: 'عالية',
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-sand-200/70 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-11 w-11 shrink-0 rounded-xl bg-sand-100" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-40 max-w-full rounded bg-sand-100" />
            <div className="h-3 w-64 max-w-full rounded bg-sand-100" />
          </div>
        </div>
        <div className="h-7 w-20 rounded-full bg-sand-100" />
      </div>
    </div>
  )
}

function AutomationIcon() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-950 text-white shadow-sm"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v4m0 10v4M3 12h4m10 0h4M5.64 5.64l2.83 2.83m7.06 7.06 2.83 2.83m0-12.72-2.83 2.83m-7.06 7.06-2.83 2.83"
        />
        <circle cx="12" cy="12" r="3.25" />
      </svg>
    </span>
  )
}

export default function Automations() {
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization()
  const { hasFeature, loading: subLoading } = useSubscription()

  const [automations, setAutomations] = useState<DBAutomation[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const loadData = async () => {
    if (!supabase || !organizationId) return

    setLoading(true)

    const { data } = await supabase
      .from('automations')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (data) {
      setAutomations(data as DBAutomation[])
    }

    setLoading(false)
  }

  useEffect(() => {
    if (organizationId) {
      loadData()
    }
  }, [organizationId])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!supabase || !organizationId) return

    setSaving(true)

    await supabase.from('automations').insert({
      organization_id: organizationId,
      name: form.name,
      trigger_event: 'lead_stale',
      config: {
        hours: Number(form.hours),
      },
      action_type: 'create_task',
      action_config: {
        title_template: 'تابع مع {name} - عميل محتمل بدون رد',
        priority: form.priority,
      },
    })

    setSaving(false)
    setForm(emptyForm)
    setShowForm(false)
    loadData()
  }

  const toggleActive = async (automation: DBAutomation) => {
    if (!supabase) return

    await supabase
      .from('automations')
      .update({ active: !automation.active })
      .eq('id', automation.id)

    loadData()
  }

  if (!subLoading && !hasFeature('automations')) {
    return <FeatureLocked featureName="الأتمتة" />
  }

  if (orgLoading || loading) {
    return (
      <div
        dir="rtl"
        className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-8"
      >
        <div className="space-y-2">
          <div className="h-8 w-44 animate-pulse rounded-lg bg-sand-100" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-sand-100" />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="h-24 animate-pulse rounded-2xl border border-sand-200/70 bg-white" />
          <div className="h-24 animate-pulse rounded-2xl border border-sand-200/70 bg-white" />
          <div className="h-24 animate-pulse rounded-2xl border border-sand-200/70 bg-white" />
        </div>

        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (orgError || !organizationId) {
    return (
      <div
        dir="rtl"
        className="mx-auto flex min-h-[50vh] w-full max-w-3xl items-center justify-center px-4 py-12"
      >
        <Card className="w-full border-red-100 bg-red-50/60 p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4m0 4h.01M10.3 3.8 2.9 17a2 2 0 0 0 1.74 3h14.72a2 2 0 0 0 1.74-3L13.7 3.8a2 2 0 0 0-3.4 0Z"
              />
            </svg>
          </div>

          <h2 className="text-base font-bold text-red-900">
            تعذر تحميل بيانات المؤسسة
          </h2>

          <p className="mt-2 text-sm leading-6 text-red-700/80">
            {orgError ?? 'تعذر تحديد المؤسسة الحالية'}
          </p>
        </Card>
      </div>
    )
  }

  const activeCount = automations.filter((automation) => automation.active).length
  const pausedCount = automations.length - activeCount

  return (
    <div
      dir="rtl"
      className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8"
    >
      {/* Header */}
      <section className="overflow-hidden rounded-3xl border border-sand-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <div className="relative p-5 sm:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 -top-20 h-44 w-44 rounded-full bg-sand-100/70 blur-3xl"
          />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3.5">
              <AutomationIcon />

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-sand-200 bg-sand-50 px-2.5 py-1 text-[11px] font-semibold text-ink-900/60">
                    أتمتة المبيعات
                  </span>

                  {automations.length > 0 && (
                    <Badge tone={activeCount > 0 ? 'success' : 'default'}>
                      {activeCount > 0
                        ? `${activeCount} أتمتة مفعّلة`
                        : 'لا توجد أتمتة مفعّلة'}
                    </Badge>
                  )}
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
                  الأتمتة
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-900/55">
                  خلّي المتابعة اليومية تتم تلقائيًا، وقلّل فرص ضياع العملاء
                  المحتملين بسبب التأخير في التواصل.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setShowForm((value) => !value)}
              aria-expanded={showForm}
              className="w-full shrink-0 sm:w-auto"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <IconPlus className="h-4 w-4" />
                {showForm ? 'إخفاء النموذج' : 'أتمتة جديدة'}
              </span>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section
        aria-label="ملخص الأتمتة"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <Card className="border-sand-200/70 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-ink-900/45">
                إجمالي الأتمتة
              </p>
              <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink-950">
                {automations.length}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand-100 text-ink-900">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <path
                  strokeLinecap="round"
                  d="M8 9h8M8 13h5M8 17h3"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="border-sand-200/70 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-ink-900/45">
                الأتمتة المفعّلة
              </p>
              <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink-950">
                {activeCount}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m5 12 4 4L19 6"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="border-sand-200/70 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-ink-900/45">
                الأتمتة المتوقفة
              </p>
              <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink-950">
                {pausedCount}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand-100 text-ink-900/60">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <rect x="5" y="5" width="14" height="14" rx="3" />
                <path
                  strokeLinecap="round"
                  d="M10 9v6M14 9v6"
                />
              </svg>
            </div>
          </div>
        </Card>
      </section>

      {/* Create form */}
      {showForm && (
        <Card className="overflow-hidden border-sand-200/80 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
          <div className="border-b border-sand-200/70 bg-sand-50/45 px-5 py-4 sm:px-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-950 text-white">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v18M3 12h18"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-sm font-bold text-ink-950 sm:text-base">
                  إنشاء أتمتة جديدة
                </h2>
                <p className="mt-1 text-xs leading-5 text-ink-900/50">
                  أنشئ متابعة تلقائية للعملاء المحتملين الذين لم يتم التواصل
                  معهم في الوقت المحدد.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleAdd} className="p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="automation-name"
                  className="mb-1.5 block text-xs font-semibold text-ink-900/65"
                >
                  اسم الأتمتة
                </label>

                <input
                  id="automation-name"
                  required
                  autoFocus
                  placeholder="مثال: متابعة العملاء بدون رد"
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-sand-200 bg-white px-3.5 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/30 focus:border-ink-700 focus:ring-4 focus:ring-ink-950/5"
                />
              </div>

              <div>
                <label
                  htmlFor="automation-hours"
                  className="mb-1.5 block text-xs font-semibold text-ink-900/65"
                >
                  مدة الانتظار
                </label>

                <div className="relative">
                  <input
                    id="automation-hours"
                    type="number"
                    min="1"
                    required
                    value={form.hours}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        hours: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-3.5 py-3 pl-14 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:ring-4 focus:ring-ink-950/5"
                  />

                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-900/40">
                    ساعة
                  </span>
                </div>

                <p className="mt-1.5 text-[11px] leading-5 text-ink-900/40">
                  بعد بقاء العميل في حالة "جديد" لهذه المدة.
                </p>
              </div>

              <div>
                <label
                  htmlFor="automation-priority"
                  className="mb-1.5 block text-xs font-semibold text-ink-900/65"
                >
                  أولوية مهمة المتابعة
                </label>

                <select
                  id="automation-priority"
                  value={form.priority}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priority: e.target.value,
                    })
                  }
                  className="w-full appearance-none rounded-xl border border-sand-200 bg-white px-3.5 py-3 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:ring-4 focus:ring-ink-950/5"
                >
                  <option value="عالية">عالية</option>
                  <option value="متوسطة">متوسطة</option>
                  <option value="منخفضة">منخفضة</option>
                </select>

                <p className="mt-1.5 text-[11px] leading-5 text-ink-900/40">
                  سيتم استخدام هذه الأولوية عند إنشاء مهمة المتابعة.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 border-t border-sand-200/70 pt-5 sm:flex-row sm:justify-start">
              <Button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto"
              >
                {saving ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
                    />
                    جاري الحفظ...
                  </span>
                ) : (
                  'حفظ الأتمتة'
                )}
              </Button>

              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  setForm(emptyForm)
                  setShowForm(false)
                }}
                className="w-full sm:w-auto"
              >
                إلغاء
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Automation list */}
      <section aria-labelledby="automation-list-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2
              id="automation-list-title"
              className="text-base font-bold text-ink-950"
            >
              الأتمتة الحالية
            </h2>
            <p className="mt-1 text-xs text-ink-900/45">
              القواعد التي تعمل تلقائيًا داخل مساحة العمل الخاصة بك.
            </p>
          </div>
        </div>

        {automations.length === 0 ? (
          <Card className="border-dashed border-sand-300 bg-white p-8 sm:p-12">
            <div className="mx-auto max-w-md text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sand-100 text-ink-900">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v4m0 10v4M3 12h4m10 0h4M5.64 5.64l2.83 2.83m7.06 7.06 2.83 2.83m0-12.72-2.83 2.83m-7.06 7.06-2.83 2.83"
                  />
                  <circle cx="12" cy="12" r="3.25" />
                </svg>
              </div>

              <h3 className="mt-4 text-base font-bold text-ink-950">
                لا توجد أتمتة مضافة بعد
              </h3>

              <p className="mt-2 text-sm leading-6 text-ink-900/45">
                ابدأ بأول قاعدة متابعة تلقائية حتى لا تضيع عليك فرص متابعة
                العملاء المحتملين.
              </p>

              <div className="mt-5">
                <Button
                  type="button"
                  onClick={() => setShowForm(true)}
                >
                  <span className="inline-flex items-center gap-2">
                    <IconPlus className="h-4 w-4" />
                    إنشاء أول أتمتة
                  </span>
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {automations.map((automation) => (
              <Card
                key={automation.id}
                className="group overflow-hidden border-sand-200/80 p-0 transition duration-200 hover:-translate-y-0.5 hover:border-sand-300 hover:shadow-[0_12px_35px_rgba(15,23,42,0.06)]"
              >
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sand-100 text-ink-900 sm:flex">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      >
                        <circle cx="12" cy="12" r="3" />
                        <path
                          strokeLinecap="round"
                          d="M12 3v3M12 18v3M3 12h3M18 12h3M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M18.36 5.64l-2.12 2.12M7.76 16.24l-2.12 2.12"
                        />
                      </svg>
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-ink-950 sm:text-[15px]">
                          {automation.name}
                        </h3>

                        <Badge
                          tone={automation.active ? 'success' : 'default'}
                        >
                          {automation.active ? 'مفعّلة' : 'متوقفة'}
                        </Badge>
                      </div>

                      <p className="mt-1.5 text-xs leading-5 text-ink-900/50">
                        إذا ظل العميل المحتمل في حالة "جديد" أكثر من{' '}
                        <span className="font-semibold text-ink-900/70">
                          {automation.config?.hours ?? 24} ساعة
                        </span>
                        ، يتم إنشاء مهمة متابعة بأولوية{' '}
                        <span className="font-semibold text-ink-900/70">
                          {automation.action_config?.priority ?? 'عالية'}
                        </span>
                        .
                      </p>
                    </div>
                  </div>

                  <div className="flex w-full items-center justify-between gap-3 border-t border-sand-200/60 pt-3 sm:w-auto sm:justify-end sm:border-0 sm:pt-0">
                    <span className="text-[11px] text-ink-900/35">
                      متابعة تلقائية
                    </span>

                    <button
                      type="button"
                      onClick={() => toggleActive(automation)}
                      aria-label={
                        automation.active
                          ? `إيقاف أتمتة ${automation.name}`
                          : `تفعيل أتمتة ${automation.name}`
                      }
                      className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition focus:outline-none focus:ring-4 ${
                        automation.active
                          ? 'border-red-100 bg-red-50 text-red-600 hover:border-red-200 hover:bg-red-100 focus:ring-red-500/10'
                          : 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:border-emerald-200 hover:bg-emerald-100 focus:ring-emerald-500/10'
                      }`}
                    >
                      {automation.active ? 'إيقاف' : 'تفعيل'}
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
