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
    bg: 'bg-blue-50/50',
    border: 'border-blue-100',
    badge: 'bg-blue-50 text-blue-700',
  },
  'تم التواصل': {
    dot: 'bg-indigo-500',
    bg: 'bg-indigo-50/40',
    border: 'border-indigo-100',
    badge: 'bg-indigo-50 text-indigo-700',
  },
  مهتم: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-50/50',
    border: 'border-amber-100',
    badge: 'bg-amber-50 text-amber-700',
  },
  'عرض سعر': {
    dot: 'bg-purple-500',
    bg: 'bg-purple-50/40',
    border: 'border-purple-100',
    badge: 'bg-purple-50 text-purple-700',
  },
  تفاوض: {
    dot: 'bg-orange-500',
    bg: 'bg-orange-50/40',
    border: 'border-orange-100',
    badge: 'bg-orange-50 text-orange-700',
  },
  'تم التعاقد': {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50/50',
    border: 'border-emerald-100',
    badge: 'bg-emerald-50 text-emerald-700',
  },
  خسرنا: {
    dot: 'bg-red-500',
    bg: 'bg-red-50/50',
    border: 'border-red-100',
    badge: 'bg-red-50 text-red-700',
  },
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
            deal.id === editingDeal.id
              ? normalizedDeal
              : deal
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

        setDeals((current) => [
          normalizedDeal,
          ...current,
        ])

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
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-red-700">
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
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-28" />
          ))}
        </div>

        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton
              key={item}
              className="h-[520px] w-72 shrink-0"
            />
          ))}
        </div>
      </div>
    )
  }

  if (orgError || !organizationId) {
    return (
      <div className="py-20 text-center text-sm text-red-600">
        {orgError || 'تعذر تحديد المؤسسة الخاصة بحسابك'}
      </div>
    )
  }

  return (
    <div dir="rtl" className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-ink-900/45">
            <span>CRM</span>
            <span>•</span>
            <span>المبيعات</span>
          </div>

          <h1 className="mt-1 text-2xl font-bold text-ink-950 sm:text-3xl">
            Pipeline المبيعات
          </h1>

          <p className="mt-1 text-sm text-ink-900/50">
            تابع الصفقات وحركها بين مراحل البيع بسهولة.
          </p>
        </div>

        <Button onClick={openCreateForm}>
          <span className="inline-flex items-center gap-2">
            <IconPlus className="h-4 w-4" />
            إضافة صفقة
          </span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4 sm:p-5">
          <div className="text-xs text-ink-900/45">
            إجمالي الصفقات
          </div>
          <div className="mt-2 text-2xl font-bold text-ink-950">
            {pipelineStats.count.toLocaleString('ar-EG')}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="text-xs text-ink-900/45">
            إجمالي قيمة الـ Pipeline
          </div>
          <div className="mt-2 text-xl font-bold text-gold-600 sm:text-2xl">
            {formatMoney(pipelineStats.totalValue)}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="text-xs text-ink-900/45">
            الصفقات المفتوحة
          </div>
          <div className="mt-2 text-xl font-bold text-blue-700 sm:text-2xl">
            {formatMoney(pipelineStats.activeValue)}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="text-xs text-ink-900/45">
            تم التعاقد
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-600 sm:text-2xl">
            {formatMoney(pipelineStats.wonValue)}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
          <div className="relative">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث باسم الصفقة أو العميل أو الشركة..."
              className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ink-700"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-900/40 hover:text-ink-900"
              >
                مسح
              </button>
            )}
          </div>

          <select
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
            className="rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm outline-none focus:border-ink-700"
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
            className="rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm outline-none focus:border-ink-700"
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
          >
            إعادة ضبط
          </Button>
        </div>
      </Card>

      {error && !showForm && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Pipeline */}
      {stages.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sand-100 text-2xl">
            +
          </div>

          <h3 className="mt-4 font-bold text-ink-950">
            لا توجد مراحل مبيعات
          </h3>

          <p className="mt-1 text-sm text-ink-900/45">
            أضف مراحل المبيعات من إعدادات المؤسسة أولًا.
          </p>
        </Card>
      ) : filteredDeals.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-4xl">⌁</div>

          <h3 className="mt-4 font-bold text-ink-950">
            لا توجد صفقات مطابقة
          </h3>

          <p className="mt-1 text-sm text-ink-900/45">
            جرّب تغيير البحث أو الفلاتر، أو أضف صفقة جديدة.
          </p>

          <div className="mt-5">
            <Button onClick={openCreateForm}>
              إضافة أول صفقة
            </Button>
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
                STAGE_STYLE[stage.name] || {
                  dot: 'bg-ink-500',
                  bg: 'bg-sand-50',
                  border: 'border-sand-200',
                  badge: 'bg-sand-100 text-ink-900',
                }

              const isDropTarget =
                dragOverStageId === stage.id

              return (
                <div
                  key={stage.id}
                  className="w-[310px] shrink-0"
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
                    className={`rounded-2xl border ${style.border} ${style.bg} p-3 transition ${
                      isDropTarget
                        ? 'ring-2 ring-ink-900/15'
                        : ''
                    }`}
                  >
                    {/* Stage header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${style.dot}`}
                        />

                        <h3 className="font-bold text-sm text-ink-950">
                          {stage.name}
                        </h3>
                      </div>

                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink-900/50 shadow-sm">
                        {stageDeals.length}
                      </span>
                    </div>

                    <div className="mt-2 text-xs font-medium text-ink-900/45">
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
                          className={`group cursor-grab rounded-2xl border border-sand-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-ink-900/20 hover:shadow-md active:cursor-grabbing ${
                            draggedDealId === deal.id
                              ? 'opacity-50'
                              : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <Link
                              to={`/pipeline/deal/${deal.id}`}
                              className="min-w-0 flex-1"
                            >
                              <h4 className="truncate text-sm font-bold text-ink-950">
                                {deal.title}
                              </h4>

                              <div className="mt-1 truncate text-xs text-ink-900/50">
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
                              className="rounded-lg p-1.5 text-ink-900/35 opacity-0 transition hover:bg-sand-100 hover:text-ink-900 group-hover:opacity-100"
                              title="تعديل"
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

                                <span className="truncate text-[11px] text-ink-900/50">
                                  {deal.users?.full_name ||
                                    'غير معين'}
                                </span>
                              </div>

                              {deal.follow_up_at && (
                                <span className="shrink-0 text-[10px] text-ink-900/45">
                                  {formatDate(
                                    deal.follow_up_at
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {stageDeals.length === 0 && (
                        <div className="rounded-xl border border-dashed border-sand-300 bg-white/50 px-4 py-10 text-center text-xs text-ink-900/30">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-sand-200 px-5 py-4 sm:px-6">
              <div>
                <h2 className="font-bold text-lg text-ink-950">
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
                className="rounded-xl px-3 py-2 text-sm text-ink-900/45 hover:bg-sand-100 hover:text-ink-900"
              >
                إغلاق
              </button>
            </div>

            <form
              onSubmit={saveDeal}
              className="max-h-[75vh] overflow-y-auto p-5 sm:p-6"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-ink-900/60">
                    عنوان الصفقة *
                  </span>

                  <input
                    required
                    value={form.title}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        title: event.target.value,
                      })
                    }
                    placeholder="مثال: إدارة صفحات شركة ABC"
                    className="w-full rounded-xl border border-sand-200 px-4 py-3 text-sm outline-none focus:border-ink-700"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-semibold text-ink-900/60">
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
                    className="w-full rounded-xl border border-sand-200 px-4 py-3 text-sm outline-none focus:border-ink-700"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-semibold text-ink-900/60">
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
                    className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm outline-none focus:border-ink-700"
                  >
                    <option value="">
                      بدون عميل
                    </option>

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
                  <span className="mb-1.5 block text-xs font-semibold text-ink-900/60">
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
                    className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm outline-none focus:border-ink-700"
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
                  <span className="mb-1.5 block text-xs font-semibold text-ink-900/60">
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
                    className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm outline-none focus:border-ink-700"
                  >
                    <option value="">
                      غير معين
                    </option>

                    {users
                      .filter(
                        (user) =>
                          user.active !== false
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
                  <span className="mb-1.5 block text-xs font-semibold text-ink-900/60">
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
                    className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm outline-none focus:border-ink-700"
                  >
                    <option value="">
                      اختر المصدر
                    </option>

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
                  <span className="mb-1.5 block text-xs font-semibold text-ink-900/60">
                    موعد المتابعة
                  </span>

                  <input
                    type="datetime-local"
                    value={form.followUpAt}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        followUpAt:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-sand-200 px-4 py-3 text-sm outline-none focus:border-ink-700"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-ink-900/60">
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
                    className="w-full resize-none rounded-xl border border-sand-200 px-4 py-3 text-sm outline-none focus:border-ink-700"
                  />
                </label>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-start">
                <Button
                  type="submit"
                  disabled={saving}
                  className="min-w-[130px]"
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
