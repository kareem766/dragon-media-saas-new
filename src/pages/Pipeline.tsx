import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Button, Skeleton } from '../components/ui'
import { IconPlus } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'
import { useToast } from '../lib/ToastContext'

interface Stage {
  id: string
  name: string
  order_index: number
}

interface Customer {
  id: string
  name: string
  company: string | null
}

interface UserOption {
  id: string
  full_name: string
  active: boolean | null
}

interface Deal {
  id: string
  organization_id: string
  title: string
  value: number | null
  stage_id: string | null
  customer_id: string | null
  owner_id: string | null
  source: string | null
  notes: string | null
  follow_up_at: string | null
  created_at: string | null
  updated_at: string | null
  customers: Customer | null
  users: UserOption | null
}

const SOURCES = [
  'فيسبوك',
  'إنستجرام',
  'واتساب',
  'موقع إلكتروني',
  'إعلان',
  'إحالة',
  'أخرى',
]

const STAGE_STYLE: Record<
  string,
  {
    dot: string
    bg: string
    border: string
    badge: string
  }
> = {
  جديد: {
    dot: 'bg-blue-500',
    bg: 'bg-blue-50/60',
    border: 'border-blue-100',
    badge: 'bg-blue-50 text-blue-700',
  },
  'تم التواصل': {
    dot: 'bg-indigo-500',
    bg: 'bg-indigo-50/60',
    border: 'border-indigo-100',
    badge: 'bg-indigo-50 text-indigo-700',
  },
  مهتم: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-50/70',
    border: 'border-amber-100',
    badge: 'bg-amber-50 text-amber-700',
  },
  'عرض سعر': {
    dot: 'bg-purple-500',
    bg: 'bg-purple-50/60',
    border: 'border-purple-100',
    badge: 'bg-purple-50 text-purple-700',
  },
  تفاوض: {
    dot: 'bg-orange-500',
    bg: 'bg-orange-50/60',
    border: 'border-orange-100',
    badge: 'bg-orange-50 text-orange-700',
  },
  'تم التعاقد': {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50/70',
    border: 'border-emerald-100',
    badge: 'bg-emerald-50 text-emerald-700',
  },
  خسرنا: {
    dot: 'bg-red-500',
    bg: 'bg-red-50/60',
    border: 'border-red-100',
    badge: 'bg-red-50 text-red-700',
  },
}

const DEFAULT_STAGE_STYLE = {
  dot: 'bg-ink-500',
  bg: 'bg-sand-50/80',
  border: 'border-sand-200',
  badge: 'bg-sand-100 text-ink-900',
}

const formatMoney = (value: number | null | undefined) =>
  `${Number(value || 0).toLocaleString('ar-EG')} ج.م`

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'بدون متابعة'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'بدون متابعة'

  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const toLocalDateTimeValue = (value: string | null | undefined) => {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)

  return local.toISOString().slice(0, 16)
}

const normalize = (value: string) => {
  const trimmed = value.trim()
  return trimmed || null
}

const normalizeDeal = (raw: any): Deal => ({
  ...raw,
  customers: Array.isArray(raw?.customers)
    ? raw.customers[0] ?? null
    : raw?.customers ?? null,
  users: Array.isArray(raw?.users)
    ? raw.users[0] ?? null
    : raw?.users ?? null,
})

const IconSearch = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" strokeLinecap="round" />
  </svg>
)

const IconFilter = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M4 6h16M7 12h10M10 18h4"
      strokeLinecap="round"
    />
  </svg>
)

const IconClose = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
    aria-hidden="true"
  >
    <path d="m7 7 10 10M17 7 7 17" strokeLinecap="round" />
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

const IconGrip = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <circle cx="8" cy="7" r="1.2" />
    <circle cx="16" cy="7" r="1.2" />
    <circle cx="8" cy="12" r="1.2" />
    <circle cx="16" cy="12" r="1.2" />
    <circle cx="8" cy="17" r="1.2" />
    <circle cx="16" cy="17" r="1.2" />
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

export default function Pipeline() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization()

  const { showToast } = useToast()

  const [stages, setStages] = useState<Stage[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [users, setUsers] = useState<UserOption[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('الكل')
  const [ownerFilter, setOwnerFilter] = useState('الكل')

  const [showForm, setShowForm] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)

  const [draggedDealId, setDraggedDealId] = useState<string | null>(null)
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    value: '',
    customerId: '',
    stageId: '',
    ownerId: '',
    source: '',
    followUpAt: '',
    notes: '',
  })

  const loadData = async () => {
    if (!supabase || !organizationId) return

    setLoading(true)
    setError(null)

    try {
      const [stagesResult, dealsResult, customersResult, usersResult] =
        await Promise.all([
          supabase
            .from('pipeline_stages')
            .select('id,name,order_index')
            .eq('organization_id', organizationId)
            .order('order_index', { ascending: true }),

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
                owner_id,
                source,
                notes,
                follow_up_at,
                created_at,
                updated_at,
                customers (
                  id,
                  name,
                  company
                ),
                users:owner_id (
                  id,
                  full_name,
                  active
                )
              `
            )
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false }),

          supabase
            .from('customers')
            .select('id,name,company')
            .eq('organization_id', organizationId)
            .order('name', { ascending: true }),

          supabase
            .from('users')
            .select('id,full_name,active')
            .eq('organization_id', organizationId)
            .order('full_name', { ascending: true }),
        ])

      if (stagesResult.error) throw stagesResult.error
      if (dealsResult.error) throw dealsResult.error
      if (customersResult.error) throw customersResult.error
      if (usersResult.error) throw usersResult.error

      setStages((stagesResult.data || []) as Stage[])
      setDeals((dealsResult.data || []).map(normalizeDeal))
      setCustomers((customersResult.data || []) as Customer[])
      setUsers((usersResult.data || []) as UserOption[])
    } catch (err) {
      console.error('Pipeline load error:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء تحميل الـ Pipeline'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (organizationId) {
      loadData()
    } else if (!orgLoading) {
      setLoading(false)
    }
  }, [organizationId, orgLoading])

  const filteredDeals = useMemo(() => {
    const query = search.trim().toLowerCase()

    return deals.filter((deal) => {
      const matchesStage =
        stageFilter === 'الكل' || deal.stage_id === stageFilter

      const matchesOwner =
        ownerFilter === 'الكل' || deal.owner_id === ownerFilter

      if (!matchesStage || !matchesOwner) return false

      if (!query) return true

      return [
        deal.title,
        deal.customers?.name,
        deal.customers?.company,
        deal.source,
        deal.notes,
        deal.users?.full_name,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        )
    })
  }, [deals, search, stageFilter, ownerFilter])

  const pipelineStats = useMemo(() => {
    const totalValue = filteredDeals.reduce(
      (sum, deal) => sum + Number(deal.value || 0),
      0
    )

    const wonStage = stages.find((stage) => stage.name === 'تم التعاقد')

    const wonValue = filteredDeals
      .filter((deal) => deal.stage_id === wonStage?.id)
      .reduce((sum, deal) => sum + Number(deal.value || 0), 0)

    const activeValue = filteredDeals
      .filter((deal) => deal.stage_id !== wonStage?.id)
      .reduce((sum, deal) => sum + Number(deal.value || 0), 0)

    return {
      count: filteredDeals.length,
      totalValue,
      activeValue,
      wonValue,
    }
  }, [filteredDeals, stages])

  const resetForm = () => {
    setForm({
      title: '',
      value: '',
      customerId: '',
      stageId: '',
      ownerId: '',
      source: '',
      followUpAt: '',
      notes: '',
    })

    setEditingDeal(null)
    setShowForm(false)
    setError(null)
  }

  const openCreateForm = () => {
    setEditingDeal(null)

    setForm({
      title: '',
      value: '',
      customerId: '',
      stageId: stages[0]?.id || '',
      ownerId: '',
      source: '',
      followUpAt: '',
      notes: '',
    })

    setError(null)
    setShowForm(true)
  }

  const openEditForm = (deal: Deal) => {
    setEditingDeal(deal)

    setForm({
      title: deal.title || '',
      value:
        deal.value === null || deal.value === undefined
          ? ''
          : String(deal.value),
      customerId: deal.customer_id || '',
      stageId: deal.stage_id || stages[0]?.id || '',
      ownerId: deal.owner_id || '',
      source: deal.source || '',
      followUpAt: toLocalDateTimeValue(deal.follow_up_at),
      notes: deal.notes || '',
    })

    setError(null)
    setShowForm(true)
  }

  const recordActivity = async (
    dealId: string,
    title: string,
    description: string,
    activityType = 'deal_updated',
    metadata: Record<string, unknown> = {}
  ) => {
    if (!supabase || !organizationId) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { error: activityError } = await supabase
      .from('crm_activities')
      .insert({
        organization_id: organizationId,
        entity_type: 'deal',
        entity_id: dealId,
        activity_type: activityType,
        title,
        description,
        actor_id: user.id,
        metadata,
      })

    if (activityError) {
      console.error('CRM activity error:', activityError)
    }
  }

  const saveDeal = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!supabase || !organizationId) return

    const title = normalize(form.title)

    if (!title) {
      setError('عنوان الصفقة مطلوب')
      return
    }

    const numericValue =
      form.value.trim() === '' ? 0 : Number(form.value)

    if (!Number.isFinite(numericValue) || numericValue < 0) {
      setError('قيمة الصفقة يجب أن تكون رقمًا صحيحًا وغير سالبة')
      return
    }

    if (!form.stageId) {
      setError('اختر مرحلة للصفقة')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const followUpAt = form.followUpAt
        ? new Date(form.followUpAt).toISOString()
        : null

      const payload = {
        organization_id: organizationId,
        title,
        value: numericValue,
        customer_id: form.customerId || null,
        stage_id: form.stageId,
        owner_id: form.ownerId || null,
        source: normalize(form.source),
        follow_up_at: followUpAt,
        notes: normalize(form.notes),
      }

      if (editingDeal) {
        const previousStage = stages.find(
          (stage) => stage.id === editingDeal.stage_id
        )

        const newStage = stages.find(
          (stage) => stage.id === form.stageId
        )

        const { data, error: updateError } = await supabase
          .from('deals')
          .update({
            title: payload.title,
            value: payload.value,
            customer_id: payload.customer_id,
            stage_id: payload.stage_id,
            owner_id: payload.owner_id,
            source: payload.source,
            follow_up_at: payload.follow_up_at,
            notes: payload.notes,
          })
          .eq('id', editingDeal.id)
          .eq('organization_id', organizationId)
          .select(
            `
              id,
              organization_id,
              title,
              value,
              stage_id,
              customer_id,
              owner_id,
              source,
              notes,
              follow_up_at,
              created_at,
              updated_at,
              customers (
                id,
                name,
                company
              ),
              users:owner_id (
                id,
                full_name,
                active
              )
            `
          )
          .single()

        if (updateError) throw updateError

        const normalizedDeal = normalizeDeal(data)

        setDeals((current) =>
          current.map((deal) =>
            deal.id === editingDeal.id ? normalizedDeal : deal
          )
        )

        if (
          previousStage?.id !== newStage?.id &&
          previousStage &&
          newStage
        ) {
          await recordActivity(
            editingDeal.id,
            `نقل الصفقة من ${previousStage.name} إلى ${newStage.name}`,
            `تم تغيير مرحلة الصفقة "${title}" من "${previousStage.name}" إلى "${newStage.name}".`,
            'deal_stage_changed',
            {
              from_stage_id: previousStage.id,
              from_stage: previousStage.name,
              to_stage_id: newStage.id,
              to_stage: newStage.name,
            }
          )
        } else {
          await recordActivity(
            editingDeal.id,
            'تحديث بيانات الصفقة',
            `تم تحديث بيانات الصفقة "${title}".`,
            'deal_updated'
          )
        }

        showToast('تم تحديث الصفقة بنجاح')
      } else {
        const { data, error: insertError } = await supabase
          .from('deals')
          .insert(payload)
          .select(
            `
              id,
              organization_id,
              title,
              value,
              stage_id,
              customer_id,
              owner_id,
              source,
              notes,
              follow_up_at,
              created_at,
              updated_at,
              customers (
                id,
                name,
                company
              ),
              users:owner_id (
                id,
                full_name,
                active
              )
            `
          )
          .single()

        if (insertError) throw insertError

        const normalizedDeal = normalizeDeal(data)

        setDeals((current) => [normalizedDeal, ...current])

        await recordActivity(
          normalizedDeal.id,
          'إنشاء صفقة جديدة',
          `تم إنشاء الصفقة "${title}".`,
          'deal_created'
        )

        showToast('تم إضافة الصفقة بنجاح')
      }

      resetForm()
    } catch (err) {
      console.error('Save deal error:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء حفظ الصفقة'
      )
    } finally {
      setSaving(false)
    }
  }

  const moveDeal = async (
    deal: Deal,
    targetStageId: string
  ) => {
    if (
      !supabase ||
      !organizationId ||
      !deal.stage_id ||
      deal.stage_id === targetStageId
    ) {
      return
    }

    const oldStage = stages.find(
      (stage) => stage.id === deal.stage_id
    )

    const newStage = stages.find(
      (stage) => stage.id === targetStageId
    )

    if (!oldStage || !newStage) return

    const previousDeals = deals

    setDeals((current) =>
      current.map((item) =>
        item.id === deal.id
          ? {
              ...item,
              stage_id: targetStageId,
            }
          : item
      )
    )

    try {
      const { error: updateError } = await supabase
        .from('deals')
        .update({
          stage_id: targetStageId,
        })
        .eq('id', deal.id)
        .eq('organization_id', organizationId)

      if (updateError) throw updateError

      await recordActivity(
        deal.id,
        `نقل الصفقة من ${oldStage.name} إلى ${newStage.name}`,
        `تم نقل الصفقة "${deal.title}" من مرحلة "${oldStage.name}" إلى "${newStage.name}".`,
        'deal_stage_changed',
        {
          from_stage_id: oldStage.id,
          from_stage: oldStage.name,
          to_stage_id: newStage.id,
          to_stage: newStage.name,
        }
      )

      showToast(`تم نقل الصفقة إلى ${newStage.name}`)
    } catch (err) {
      console.error('Move deal error:', err)

      setDeals(previousDeals)

      showToast('تعذر نقل الصفقة')
    } finally {
      setDraggedDealId(null)
      setDragOverStageId(null)
    }
  }

  const handleDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    stageId: string
  ) => {
    event.preventDefault()

    const dealId =
      event.dataTransfer.getData('text/plain') ||
      draggedDealId

    if (!dealId) return

    const deal = deals.find((item) => item.id === dealId)

    if (!deal) return

    await moveDeal(deal, stageId)
  }

  if (!supabase) {
    return (
      <div
        dir="rtl"
        className="rounded-2xl border border-red-200 bg-red-50 p-8 text-red-700"
      >
        <h2 className="text-xl font-bold">
          قاعدة البيانات غير متصلة
        </h2>

        <p className="mt-2 text-sm">
          تأكد من إعداد متغيرات Supabase في بيئة التشغيل.
        </p>
      </div>
    )
  }

  if (orgLoading || loading) {
    return (
      <div dir="rtl" className="space-y-6 pb-8">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Card key={item} className="p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-28" />
            </Card>
          ))}
        </div>

        <Card className="p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </Card>

        <div className="overflow-hidden">
          <div className="flex min-w-max gap-4">
            {[1, 2, 3, 4].map((item) => (
              <Skeleton
                key={item}
                className="h-[520px] w-[310px] shrink-0 rounded-2xl"
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (orgError || !organizationId) {
    return (
      <div dir="rtl" className="py-20">
        <Card className="mx-auto max-w-lg border-red-100 bg-red-50/60 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-red-600 shadow-sm">
            !
          </div>

          <h2 className="mt-4 font-bold text-red-800">
            تعذر تحميل بيانات المؤسسة
          </h2>

          <p className="mt-2 text-sm leading-6 text-red-700/70">
            {orgError || 'تعذر تحديد المؤسسة الخاصة بحسابك'}
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div dir="rtl" className="space-y-6 pb-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-sand-200 bg-gradient-to-br from-white via-white to-sand-50 p-5 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-gold-400/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-ink-900/40">
              <span>CRM</span>
              <span aria-hidden="true">/</span>
              <span>المبيعات</span>
              <span aria-hidden="true">/</span>
              <span className="text-ink-900/60">
                Pipeline
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-950 sm:text-3xl">
              Pipeline المبيعات
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-900/50">
              تابع الصفقات، قيمتها، المسؤول عنها، وحركها بين مراحل البيع بسهولة.
            </p>
          </div>

          <Button
            onClick={openCreateForm}
            className="w-full shrink-0 sm:w-auto"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <IconPlus className="h-4 w-4" />
              إضافة صفقة
            </span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="group relative overflow-hidden p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-ink-900/10" />

          <div className="text-xs font-medium text-ink-900/45">
            إجمالي الصفقات
          </div>

          <div className="mt-2 text-2xl font-extrabold text-ink-950">
            {pipelineStats.count.toLocaleString('ar-EG')}
          </div>

          <div className="mt-1 text-[11px] text-ink-900/35">
            بعد تطبيق الفلاتر
          </div>
        </Card>

        <Card className="group relative overflow-hidden p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gold-500/60" />

          <div className="text-xs font-medium text-ink-900/45">
            إجمالي قيمة الـ Pipeline
          </div>

          <div className="mt-2 truncate text-lg font-extrabold text-gold-600 sm:text-2xl">
            {formatMoney(pipelineStats.totalValue)}
          </div>

          <div className="mt-1 text-[11px] text-ink-900/35">
            القيمة الإجمالية
          </div>
        </Card>

        <Card className="group relative overflow-hidden p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-500/50" />

          <div className="text-xs font-medium text-ink-900/45">
            الصفقات المفتوحة
          </div>

          <div className="mt-2 truncate text-lg font-extrabold text-blue-700 sm:text-2xl">
            {formatMoney(pipelineStats.activeValue)}
          </div>

          <div className="mt-1 text-[11px] text-ink-900/35">
            فرص البيع الحالية
          </div>
        </Card>

        <Card className="group relative overflow-hidden p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-emerald-500/50" />

          <div className="text-xs font-medium text-ink-900/45">
            تم التعاقد
          </div>

          <div className="mt-2 truncate text-lg font-extrabold text-emerald-600 sm:text-2xl">
            {formatMoney(pipelineStats.wonValue)}
          </div>

          <div className="mt-1 text-[11px] text-ink-900/35">
            صفقات مكتملة
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-sand-200/80 p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold text-ink-900/55">
          <IconFilter className="h-4 w-4" />
          تصفية الصفقات
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-900/30" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث باسم الصفقة أو العميل أو الشركة..."
              aria-label="البحث في الصفقات"
              className="w-full rounded-xl border border-sand-200 bg-sand-50/30 py-3 pe-11 ps-10 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/30 focus:border-ink-700 focus:bg-white focus:ring-4 focus:ring-ink-900/5"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="مسح البحث"
                className="absolute left-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-ink-900/35 transition hover:bg-sand-100 hover:text-ink-900"
              >
                <IconClose className="h-4 w-4" />
              </button>
            )}
          </div>

          <select
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
            aria-label="تصفية حسب المرحلة"
            className="rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:ring-4 focus:ring-ink-900/5"
          >
            <option value="الكل">كل المراحل</option>

            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>

          <select
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
            aria-label="تصفية حسب المسؤول"
            className="rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:ring-4 focus:ring-ink-900/5"
          >
            <option value="الكل">كل المسؤولين</option>

            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
              </option>
            ))}
          </select>

          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setSearch('')
              setStageFilter('الكل')
              setOwnerFilter('الكل')
            }}
            className="w-full lg:w-auto"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <IconRefresh className="h-4 w-4" />
              إعادة ضبط
            </span>
          </Button>
        </div>
      </Card>

      {error && !showForm && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{error}</span>

          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-700 shadow-sm transition hover:bg-red-100"
          >
            <IconRefresh className="h-4 w-4" />
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Pipeline */}
      {stages.length === 0 ? (
        <Card className="p-10 text-center sm:p-14">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sand-100 text-ink-900">
            <IconFilter className="h-6 w-6" />
          </div>

          <h3 className="mt-4 font-bold text-ink-950">
            لا توجد مراحل مبيعات
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-900/45">
            أضف مراحل المبيعات من إعدادات المؤسسة أولًا.
          </p>
        </Card>
      ) : filteredDeals.length === 0 ? (
        <Card className="p-10 text-center sm:p-14">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sand-100 text-ink-900">
            <IconSearch className="h-6 w-6" />
          </div>

          <h3 className="mt-4 font-bold text-ink-950">
            لا توجد صفقات مطابقة
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-900/45">
            جرّب تغيير البحث أو الفلاتر، أو أضف صفقة جديدة.
          </p>

          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={openCreateForm}>
              إضافة صفقة
            </Button>

            {(search ||
              stageFilter !== 'الكل' ||
              ownerFilter !== 'الكل') && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('')
                  setStageFilter('الكل')
                  setOwnerFilter('الكل')
                }}
              >
                مسح الفلاتر
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex min-w-max items-start gap-4">
            {stages.map((stage) => {
              const stageDeals = filteredDeals.filter(
                (deal) => deal.stage_id === stage.id
              )

              const total = stageDeals.reduce(
                (sum, deal) => sum + Number(deal.value || 0),
                0
              )

              const style =
                STAGE_STYLE[stage.name] || DEFAULT_STAGE_STYLE

              const isDropTarget =
                dragOverStageId === stage.id

              return (
                <div
                  key={stage.id}
                  className="w-[290px] shrink-0 sm:w-[310px]"
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragOverStageId(stage.id)
                  }}
                  onDragLeave={() => {
                    if (dragOverStageId === stage.id) {
                      setDragOverStageId(null)
                    }
                  }}
                  onDrop={(event) =>
                    handleDrop(event, stage.id)
                  }
                >
                  <div
                    className={`rounded-2xl border ${style.border} ${style.bg} p-3 shadow-sm transition duration-200 ${
                      isDropTarget
                        ? 'scale-[1.01] ring-2 ring-gold-500/30'
                        : ''
                    }`}
                  >
                    {/* Stage header */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`}
                        />

                        <h3 className="truncate text-sm font-bold text-ink-950">
                          {stage.name}
                        </h3>
                      </div>

                      <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-ink-900/50 shadow-sm">
                        {stageDeals.length}
                      </span>
                    </div>

                    <div className="mt-2 text-xs font-semibold text-ink-900/40">
                      {formatMoney(total)}
                    </div>

                    {/* Cards */}
                    <div className="mt-3 space-y-3">
                      {stageDeals.map((deal) => (
                        <div
                          key={deal.id}
                          draggable
                          onDragStart={(event) => {
                            setDraggedDealId(deal.id)
                            event.dataTransfer.effectAllowed =
                              'move'
                            event.dataTransfer.setData(
                              'text/plain',
                              deal.id
                            )
                          }}
                          onDragEnd={() => {
                            setDraggedDealId(null)
                            setDragOverStageId(null)
                          }}
                          className={`group cursor-grab rounded-2xl border border-sand-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-ink-900/15 hover:shadow-lg active:cursor-grabbing ${
                            draggedDealId === deal.id
                              ? 'scale-[0.98] opacity-50'
                              : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sand-50 text-ink-900/30 transition group-hover:bg-sand-100 group-hover:text-ink-900/50">
                              <IconGrip className="h-4 w-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <Link
                                  to={`/pipeline/deal/${deal.id}`}
                                  className="min-w-0 flex-1"
                                >
                                  <h4 className="truncate text-sm font-bold text-ink-950 transition group-hover:text-ink-700">
                                    {deal.title}
                                  </h4>

                                  <div className="mt-1 truncate text-xs font-medium text-ink-900/50">
                                    {deal.customers?.name ||
                                      'بدون عميل'}
                                  </div>

                                  {deal.customers?.company && (
                                    <div className="mt-0.5 truncate text-[11px] text-ink-900/35">
                                      {deal.customers.company}
                                    </div>
                                  )}
                                </Link>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openEditForm(deal)
                                  }
                                  aria-label={`تعديل الصفقة ${deal.title}`}
                                  title="تعديل"
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm text-ink-900/30 opacity-100 transition hover:bg-sand-100 hover:text-ink-900 sm:opacity-0 sm:group-hover:opacity-100"
                                >
                                  ⋮
                                </button>
                              </div>

                              <div className="mt-4 flex items-center justify-between gap-2">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${style.badge}`}
                                >
                                  {formatMoney(deal.value)}
                                </span>

                                {deal.source && (
                                  <span className="max-w-[110px] truncate text-[11px] text-ink-900/40">
                                    {deal.source}
                                  </span>
                                )}
                              </div>

                              <div className="mt-3 border-t border-sand-100 pt-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[10px] font-bold text-white">
                                      {(
                                        deal.users?.full_name ||
                                        deal.customers?.name ||
                                        '?'
                                      )
                                        .trim()
                                        .charAt(0)}
                                    </div>

                                    <span className="truncate text-[11px] font-medium text-ink-900/50">
                                      {deal.users?.full_name ||
                                        'غير معين'}
                                    </span>
                                  </div>

                                  {deal.follow_up_at && (
                                    <span
                                      className="flex max-w-[120px] shrink-0 items-center gap-1 truncate text-[10px] font-medium text-ink-900/40"
                                      title={formatDate(
                                        deal.follow_up_at
                                      )}
                                    >
                                      <IconCalendar className="h-3 w-3" />
                                      <span className="truncate">
                                        {formatDate(
                                          deal.follow_up_at
                                        )}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {stageDeals.length === 0 && (
                        <div className="rounded-xl border border-dashed border-sand-300 bg-white/40 px-4 py-10 text-center text-xs font-medium text-ink-900/30">
                          اسحب صفقة هنا
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              resetForm()
            }
          }}
        >
          <div
            className="w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl"
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pipeline-deal-dialog-title"
          >
            <div className="flex items-center justify-between border-b border-sand-200 bg-white px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <div className="mb-1 inline-flex rounded-full bg-gold-50 px-2.5 py-1 text-[10px] font-bold text-gold-700">
                  {editingDeal ? 'تعديل' : 'صفقة جديدة'}
                </div>

                <h2
                  id="pipeline-deal-dialog-title"
                  className="truncate text-lg font-extrabold text-ink-950"
                >
                  {editingDeal
                    ? 'تعديل الصفقة'
                    : 'إضافة صفقة جديدة'}
                </h2>

                <p className="mt-0.5 text-xs text-ink-900/45">
                  أدخل بيانات الصفقة الأساسية.
                </p>
              </div>

              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                aria-label="إغلاق"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-900/40 transition hover:bg-sand-100 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={saveDeal}
              className="max-h-[78vh] overflow-y-auto p-5 sm:p-6"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-bold text-ink-900/60">
                    عنوان الصفقة *
                  </span>

                  <input
                    required
                    autoFocus
                    value={form.title}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        title: event.target.value,
                      })
                    }
                    placeholder="مثال: إدارة صفحات شركة ABC"
                    className="w-full rounded-xl border border-sand-200 bg-sand-50/20 px-4 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/25 focus:border-ink-700 focus:bg-white focus:ring-4 focus:ring-ink-900/5"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-bold text-ink-900/60">
                    قيمة الصفقة
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.value}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        value: event.target.value,
                      })
                    }
                    placeholder="0"
                    className="w-full rounded-xl border border-sand-200 bg-sand-50/20 px-4 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/25 focus:border-ink-700 focus:bg-white focus:ring-4 focus:ring-ink-900/5"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-bold text-ink-900/60">
                    العميل
                  </span>

                  <select
                    value={form.customerId}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        customerId: event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:ring-4 focus:ring-ink-900/5"
                  >
                    <option value="">بدون عميل</option>

                    {customers.map((customer) => (
                      <option
                        key={customer.id}
                        value={customer.id}
                      >
                        {customer.name}
                        {customer.company
                          ? ` — ${customer.company}`
                          : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-bold text-ink-900/60">
                    المرحلة
                  </span>

                  <select
                    value={form.stageId}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        stageId: event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:ring-4 focus:ring-ink-900/5"
                  >
                    {stages.map((stage) => (
                      <option
                        key={stage.id}
                        value={stage.id}
                      >
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-bold text-ink-900/60">
                    المسؤول
                  </span>

                  <select
                    value={form.ownerId}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        ownerId: event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:ring-4 focus:ring-ink-900/5"
                  >
                    <option value="">غير معين</option>

                    {users
                      .filter(
                        (user) => user.active !== false
                      )
                      .map((user) => (
                        <option
                          key={user.id}
                          value={user.id}
                        >
                          {user.full_name}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-bold text-ink-900/60">
                    مصدر الصفقة
                  </span>

                  <select
                    value={form.source}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        source: event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:ring-4 focus:ring-ink-900/5"
                  >
                    <option value="">اختر المصدر</option>

                    {SOURCES.map((source) => (
                      <option
                        key={source}
                        value={source}
                      >
                        {source}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-bold text-ink-900/60">
                    موعد المتابعة
                  </span>

                  <div className="relative">
                    <IconCalendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-900/30" />

                    <input
                      type="datetime-local"
                      value={form.followUpAt}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          followUpAt: event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-sand-200 bg-sand-50/20 py-3 pe-10 ps-4 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:bg-white focus:ring-4 focus:ring-ink-900/5"
                    />
                  </div>
                </label>

                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-bold text-ink-900/60">
                    ملاحظات
                  </span>

                  <textarea
                    rows={4}
                    value={form.notes}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        notes: event.target.value,
                      })
                    }
                    placeholder="أضف أي ملاحظات خاصة بالصفقة..."
                    className="w-full resize-none rounded-xl border border-sand-200 bg-sand-50/20 px-4 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/25 focus:border-ink-700 focus:bg-white focus:ring-4 focus:ring-ink-900/5"
                  />
                </label>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
                >
                  {error}
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-start">
                <Button
                  type="submit"
                  disabled={saving}
                  className="min-w-[140px]"
                  aria-busy={saving}
                >
                  {saving
                    ? 'جاري الحفظ...'
                    : editingDeal
                      ? 'حفظ التعديلات'
                      : 'إنشاء الصفقة'}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={resetForm}
                  disabled={saving}
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
