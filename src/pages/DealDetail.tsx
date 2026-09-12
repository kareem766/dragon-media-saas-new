import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, Badge, Button, Skeleton } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface Stage {
  id: string
  name: string
  order_index: number
}

interface Customer {
  id: string
  name: string
  company?: string | null
}

interface DBDeal {
  id: string
  organization_id: string
  title: string
  value: number | null
  stage_id: string | null
  customer_id: string | null
  created_at: string
  updated_at: string
  customers: Customer | null
}

const STAGE_STYLE: Record<
  string,
  {
    dot: string
    bg: string
    text: string
    border: string
  }
> = {
  جديد: {
    dot: 'bg-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-100',
  },
  'تم التواصل': {
    dot: 'bg-indigo-500',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-100',
  },
  مهتم: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-100',
  },
  'عرض سعر': {
    dot: 'bg-purple-500',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-100',
  },
  تفاوض: {
    dot: 'bg-orange-500',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-100',
  },
  'تم التعاقد': {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-100',
  },
  خسرنا: {
    dot: 'bg-red-500',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-100',
  },
}

const DEFAULT_STAGE_STYLE = {
  dot: 'bg-ink-500',
  bg: 'bg-sand-100',
  text: 'text-ink-900',
  border: 'border-sand-200',
}

const IconArrow = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M19 12H5M11 18l-6-6 6-6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const IconUser = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="8" r="3.5" />
    <path
      d="M5 20c.8-3.5 3.1-5.3 7-5.3s6.2 1.8 7 5.3"
      strokeLinecap="round"
    />
  </svg>
)

const IconCalendar = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    className={className}
    aria-hidden="true"
  >
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M8 3v4M16 3v4M4 9h16" strokeLinecap="round" />
  </svg>
)

const IconRefresh = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const formatMoney = (value: number | null | undefined) =>
  `${Number(value || 0).toLocaleString('ar-EG')} ج.م`

const formatDate = (
  value: string | null | undefined,
  withTime = false
) => {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
  }).format(date)
}

export default function DealDetail() {
  const { id } = useParams<{ id: string }>()

  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization()

  const [deal, setDeal] = useState<DBDeal | null>(null)
  const [stages, setStages] = useState<Stage[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [selectedStage, setSelectedStage] = useState('')
  const [saved, setSaved] = useState(false)

  const load = async () => {
    if (!supabase || !organizationId || !id) return

    setLoading(true)
    setLoadError(null)

    try {
      const [dealRes, stagesRes] = await Promise.all([
        supabase
          .from('deals')
          .select(
            `
              id,
              organization_id,
              title,
              value,
              stage_id,
              customer_id,
              created_at,
              updated_at,
              customers (
                id,
                name,
                company
              )
            `
          )
          .eq('id', id)
          .eq('organization_id', organizationId)
          .single(),

        supabase
          .from('pipeline_stages')
          .select('id,name,order_index')
          .eq('organization_id', organizationId)
          .order('order_index', {
            ascending: true,
          }),
      ])

      if (dealRes.error) {
        throw dealRes.error
      }

      if (stagesRes.error) {
        throw stagesRes.error
      }

      const nextDeal = dealRes.data as unknown as DBDeal

      setDeal(nextDeal)
      setSelectedStage(nextDeal.stage_id || '')
      setStages((stagesRes.data || []) as Stage[])
    } catch (err) {
      console.error('Deal detail load error:', err)

      setDeal(null)

      setLoadError(
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء تحميل بيانات الصفقة'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id, organizationId])

  const currentStage = useMemo(
    () => stages.find((stage) => stage.id === deal?.stage_id),
    [stages, deal?.stage_id]
  )

  const selectedStageData = useMemo(
    () => stages.find((stage) => stage.id === selectedStage),
    [stages, selectedStage]
  )

  const currentStageIndex = useMemo(() => {
    if (!currentStage) return -1

    return stages.findIndex(
      (stage) => stage.id === currentStage.id
    )
  }, [stages, currentStage])

  const progress =
    currentStageIndex >= 0 && stages.length > 1
      ? Math.round(
          (currentStageIndex / (stages.length - 1)) * 100
        )
      : 0

  const handleStageChange = async () => {
    if (
      !supabase ||
      !organizationId ||
      !id ||
      !selectedStage ||
      selectedStage === deal?.stage_id
    ) {
      return
    }

    setSaving(true)
    setSaved(false)
    setSaveError(null)

    try {
      const { error } = await supabase
        .from('deals')
        .update({
          stage_id: selectedStage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('organization_id', organizationId)

      if (error) {
        throw error
      }

      setDeal((current) =>
        current
          ? {
              ...current,
              stage_id: selectedStage,
              updated_at: new Date().toISOString(),
            }
          : current
      )

      setSaved(true)

      window.setTimeout(() => {
        setSaved(false)
      }, 2500)
    } catch (err) {
      console.error('Deal stage update error:', err)

      setSaveError(
        err instanceof Error
          ? err.message
          : 'تعذر تحديث مرحلة الصفقة'
      )
    } finally {
      setSaving(false)
    }
  }

  if (!supabase) {
    return (
      <div dir="rtl" className="py-10">
        <Card className="border-red-100 bg-red-50/60 p-8 text-center">
          <h2 className="text-lg font-extrabold text-red-800">
            قاعدة البيانات غير متصلة
          </h2>

          <p className="mt-2 text-sm leading-6 text-red-700/70">
            تأكد من إعداد اتصال Supabase في بيئة التشغيل.
          </p>
        </Card>
      </div>
    )
  }

  if (orgLoading || loading) {
    return (
      <div dir="rtl" className="space-y-6 pb-8">
        <Skeleton className="h-5 w-40" />

        <Card className="overflow-hidden p-0">
          <div className="border-b border-sand-100 p-6">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-4 h-9 w-72 max-w-full" />
            <Skeleton className="mt-3 h-5 w-40" />
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item}>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-5 w-32" />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-5 h-12 w-full" />
        </Card>
      </div>
    )
  }

  if (orgError || !organizationId) {
    return (
      <div dir="rtl" className="py-16">
        <Card className="mx-auto max-w-lg border-red-100 bg-red-50/60 p-8 text-center">
          <h2 className="text-lg font-extrabold text-red-800">
            تعذر تحديد المؤسسة
          </h2>

          <p className="mt-2 text-sm leading-6 text-red-700/70">
            {orgError || 'تعذر تحديد المؤسسة الخاصة بحسابك.'}
          </p>
        </Card>
      </div>
    )
  }

  if (loadError) {
    return (
      <div dir="rtl" className="space-y-6 pb-8">
        <Link
          to="/pipeline"
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900/55 transition hover:text-ink-950"
        >
          <IconArrow className="h-4 w-4 rotate-180" />
          العودة إلى Pipeline
        </Link>

        <Card className="border-red-100 bg-red-50/60 p-8 text-center sm:p-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white font-bold text-red-600 shadow-sm">
            !
          </div>

          <h2 className="mt-4 text-lg font-extrabold text-red-800">
            تعذر تحميل الصفقة
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-red-700/70">
            {loadError}
          </p>

          <Button
            type="button"
            variant="secondary"
            onClick={load}
            className="mt-5"
          >
            <span className="inline-flex items-center gap-2">
              <IconRefresh className="h-4 w-4" />
              إعادة المحاولة
            </span>
          </Button>
        </Card>
      </div>
    )
  }

  if (!deal) {
    return (
      <div dir="rtl" className="space-y-6 pb-8">
        <Link
          to="/pipeline"
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900/55 transition hover:text-ink-950"
        >
          <IconArrow className="h-4 w-4 rotate-180" />
          العودة إلى Pipeline
        </Link>

        <Card className="p-10 text-center sm:p-14">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sand-100 text-ink-900/60">
            —
          </div>

          <h2 className="mt-4 text-lg font-extrabold text-ink-950">
            الصفقة غير موجودة
          </h2>

          <p className="mt-2 text-sm leading-6 text-ink-900/45">
            قد تكون الصفقة حُذفت أو لم تعد متاحة لحسابك.
          </p>

          <Link
            to="/pipeline"
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-ink-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-ink-800"
          >
            العودة إلى Pipeline
          </Link>
        </Card>
      </div>
    )
  }

  const stageStyle =
    STAGE_STYLE[currentStage?.name || ''] ||
    DEFAULT_STAGE_STYLE

  return (
    <div dir="rtl" className="space-y-6 pb-8">
      {/* Breadcrumb */}
      <Link
        to="/pipeline"
        className="group inline-flex items-center gap-2 text-sm font-semibold text-ink-900/50 transition hover:text-ink-950"
      >
        <IconArrow className="h-4 w-4 rotate-180 transition group-hover:-translate-x-0.5" />
        العودة إلى Pipeline
      </Link>

      {/* Hero */}
      <Card className="relative overflow-hidden border-sand-200/80 p-0 shadow-sm">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-gold-400/10 blur-3xl" />

        <div className="relative border-b border-sand-100 p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sand-100 px-2.5 py-1 text-[10px] font-bold text-ink-900/55">
                  تفاصيل الصفقة
                </span>

                {currentStage && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${stageStyle.bg} ${stageStyle.text} ${stageStyle.border}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${stageStyle.dot}`}
                    />
                    {currentStage.name}
                  </span>
                )}
              </div>

              <h1 className="mt-4 break-words text-2xl font-extrabold tracking-tight text-ink-950 sm:text-3xl">
                {deal.title}
              </h1>

              {deal.customers ? (
                <Link
                  to={`/crm/customer/${deal.customers.id}`}
                  className="mt-2 inline-flex max-w-full items-center gap-2 text-sm font-semibold text-ink-900/50 transition hover:text-ink-950"
                >
                  <IconUser className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {deal.customers.name}
                  </span>

                  {deal.customers.company && (
                    <span className="hidden text-ink-900/25 sm:inline">
                      · {deal.customers.company}
                    </span>
                  )}
                </Link>
              ) : (
                <div className="mt-2 text-sm text-ink-900/35">
                  لا يوجد عميل مرتبط
                </div>
              )}
            </div>

            <div className="shrink-0 rounded-2xl border border-gold-100 bg-gold-50/70 px-5 py-4 text-right">
              <div className="text-[11px] font-semibold text-gold-700/60">
                قيمة الصفقة
              </div>

              <div className="mt-1 text-2xl font-extrabold text-gold-700 sm:text-3xl">
                {formatMoney(deal.value)}
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        {stages.length > 1 && (
          <div className="border-b border-sand-100 px-5 py-5 sm:px-7">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-ink-900/55">
                تقدم الصفقة
              </span>

              <span className="text-xs font-extrabold text-ink-900/45">
                {progress}%
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-sand-100">
              <div
                className="h-full rounded-full bg-gradient-to-l from-gold-500 to-gold-400 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {stages.map((stage, index) => {
                const active = stage.id === deal.stage_id
                const completed =
                  currentStageIndex >= 0 &&
                  index <= currentStageIndex

                return (
                  <div
                    key={stage.id}
                    className={`flex min-w-max items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold transition ${
                      active
                        ? 'bg-ink-950 text-white'
                        : completed
                          ? 'bg-gold-50 text-gold-700'
                          : 'bg-sand-50 text-ink-900/35'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        active
                          ? 'bg-gold-400'
                          : completed
                            ? 'bg-gold-500'
                            : 'bg-ink-900/15'
                      }`}
                    />

                    {stage.name}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="grid gap-px bg-sand-100 sm:grid-cols-3">
          <div className="bg-white p-5 sm:p-6">
            <div className="text-xs font-medium text-ink-900/40">
              المرحلة الحالية
            </div>

            <div className="mt-2 text-sm font-extrabold text-ink-950">
              {currentStage?.name || '—'}
            </div>
          </div>

          <div className="bg-white p-5 sm:p-6">
            <div className="text-xs font-medium text-ink-900/40">
              تاريخ الإنشاء
            </div>

            <div className="mt-2 text-sm font-extrabold text-ink-950">
              {formatDate(deal.created_at)}
            </div>
          </div>

          <div className="bg-white p-5 sm:p-6">
            <div className="text-xs font-medium text-ink-900/40">
              آخر تحديث
            </div>

            <div className="mt-2 text-sm font-extrabold text-ink-950">
              {formatDate(deal.updated_at, true)}
            </div>
          </div>
        </div>
      </Card>

      {/* Stage editor */}
      <Card className="border-sand-200/80 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-bold text-gold-600">
              إدارة الصفقة
            </div>

            <h2 className="mt-1 text-lg font-extrabold text-ink-950">
              تغيير مرحلة الصفقة
            </h2>

            <p className="mt-1 max-w-xl text-sm leading-6 text-ink-900/45">
              حدّث المرحلة الحالية من هنا وسيظهر التغيير مباشرة في الـPipeline.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <select
              value={selectedStage}
              onChange={(event) => {
                setSelectedStage(event.target.value)
                setSaveError(null)
                setSaved(false)
              }}
              disabled={saving}
              aria-label="مرحلة الصفقة"
              className="min-w-0 flex-1 rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm font-medium text-ink-950 outline-none transition focus:border-ink-700 focus:ring-4 focus:ring-ink-900/5 disabled:cursor-not-allowed disabled:bg-sand-50 sm:min-w-[220px]"
            >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>

            <Button
              onClick={handleStageChange}
              disabled={
                saving ||
                !selectedStage ||
                selectedStage === deal.stage_id
              }
              aria-busy={saving}
              className="shrink-0"
            >
              {saving ? 'جاري التحديث...' : 'تحديث المرحلة'}
            </Button>
          </div>
        </div>

        {selectedStageData &&
          selectedStageData.id !== deal.stage_id && (
            <div className="mt-4 rounded-xl border border-gold-100 bg-gold-50/60 px-4 py-3 text-xs leading-6 text-gold-800">
              سيتم نقل الصفقة من{' '}
              <strong>{currentStage?.name || '—'}</strong>{' '}
              إلى{' '}
              <strong>{selectedStageData.name}</strong>.
            </div>
          )}

        {saveError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
          >
            {saveError}
          </div>
        )}

        {saved && (
          <div
            role="status"
            className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">
              ✓
            </span>

            تم تحديث مرحلة الصفقة بنجاح.
          </div>
        )}
      </Card>

      {/* Customer */}
      {deal.customers && (
        <Card className="border-sand-200/80 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink-950 text-sm font-extrabold text-white">
                {deal.customers.name.trim().charAt(0)}
              </div>

              <div className="min-w-0">
                <div className="text-xs font-medium text-ink-900/40">
                  العميل المرتبط
                </div>

                <div className="mt-1 truncate font-extrabold text-ink-950">
                  {deal.customers.name}
                </div>

                {deal.customers.company && (
                  <div className="mt-0.5 truncate text-xs text-ink-900/40">
                    {deal.customers.company}
                  </div>
                )}
              </div>
            </div>

            <Link
              to={`/crm/customer/${deal.customers.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm font-bold text-ink-900 transition hover:border-ink-900/20 hover:bg-sand-50"
            >
              عرض ملف العميل
              <IconArrow className="h-4 w-4 rotate-180" />
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}
