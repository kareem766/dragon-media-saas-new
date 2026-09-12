import React, { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Badge,
  Button,
  Table,
  statusTone,
} from '../components/ui'
import { IconPlus } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'
import { useSubscription } from '../lib/useSubscription'
import FeatureLocked from '../components/FeatureLocked'

interface AudienceFilter {
  status?: string
  tag?: string | null
  optedInOnly?: boolean
}

interface DBCampaign {
  id: string
  name: string
  channel: string
  audience: string | null
  status: string
  scheduled_at: string | null
  message_body: string | null
  audience_filter: AudienceFilter | null
  total_recipients: number
  queued_count: number
  sent_count: number
  delivered_count: number
  failed_count: number
  skipped_count?: number
  last_run_at: string | null
}

interface CampaignMessage {
  campaign_id: string
  status: string
}

interface QueueStats {
  total: number
  queued: number
  sent: number
  delivered: number
  failed: number
  skipped: number
}

interface CampaignApiResult {
  success?: boolean
  message?: string
  error?: string
  campaign?: DBCampaign
  stats?: {
    total?: number
    queued?: number
    sent?: number
    delivered?: number
    failed?: number
    skipped?: number
  }
}

const channelLabels: Record<string, string> = {
  whatsapp: 'واتساب',
  messenger: 'ماسنجر',
  instagram: 'إنستجرام',
  email: 'بريد إلكتروني',
}

function percentage(value: number, total: number) {
  if (!total) return 0

  return Math.min(
    100,
    Math.round((value / total) * 100)
  )
}

function formatDate(value: string | null) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function LoadingSkeleton() {
  return (
    <div
      className="space-y-5 animate-pulse"
      aria-label="جاري تحميل الحملات"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-sand-200" />
          <div className="h-4 w-72 max-w-full rounded bg-sand-200" />
        </div>

        <div className="h-11 w-32 rounded-xl bg-sand-200" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-sand-200 bg-white p-4"
          >
            <div className="h-3 w-20 rounded bg-sand-200" />
            <div className="h-8 w-14 rounded bg-sand-200 mt-3" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-sand-200 bg-white p-5">
        <div className="h-5 w-40 rounded bg-sand-200" />
        <div className="h-4 w-64 rounded bg-sand-200 mt-3" />

        <div className="space-y-3 mt-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-14 rounded-xl bg-sand-100"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function EmptyState({
  onCreate,
}: {
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-5">
      <div className="w-14 h-14 rounded-2xl bg-sand-100 border border-sand-200 flex items-center justify-center mb-4">
        <svg
          viewBox="0 0 24 24"
          className="w-6 h-6 text-ink-900/50"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path
            d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"
            strokeLinecap="round"
          />
          <path
            d="m7 9 5 4 5-4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h3 className="text-sm font-bold text-ink-950">
        لا توجد حملات حتى الآن
      </h3>

      <p className="text-xs sm:text-sm text-ink-900/45 mt-2 max-w-md leading-6">
        أنشئ أول حملة وحدد القناة والجمهور والرسالة، ثم تابع
        حالة الإرسال والإحصائيات من نفس الصفحة.
      </p>

      <Button
        type="button"
        onClick={onCreate}
        className="mt-5"
      >
        <span className="inline-flex items-center gap-2">
          <IconPlus className="w-4 h-4" />
          إنشاء أول حملة
        </span>
      </Button>
    </div>
  )
}

export default function Campaigns() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization()

  const {
    hasFeature,
    loading: subLoading,
  } = useSubscription()

  const [campaigns, setCampaigns] = useState<DBCampaign[]>([])
  const [messages, setMessages] = useState<CampaignMessage[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [preparingId, setPreparingId] =
    useState<string | null>(null)

  const [actionId, setActionId] =
    useState<string | null>(null)

  const [actionType, setActionType] =
    useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [success, setSuccess] =
    useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    channel: 'whatsapp',
    messageBody: '',
    audienceStatus: 'نشط',
    tag: '',
    scheduledAt: '',
  })

  const loadData = async () => {
    if (!supabase || !organizationId) {
      return
    }

    setLoading(true)
    setError(null)

    const client = supabase

    const [campaignsRes, messagesRes] =
      await Promise.all([
        client
          .from('campaigns')
          .select(`
            id,
            name,
            channel,
            audience,
            status,
            scheduled_at,
            message_body,
            audience_filter,
            total_recipients,
            queued_count,
            sent_count,
            delivered_count,
            failed_count,
            skipped_count,
            last_run_at
          `)
          .eq(
            'organization_id',
            organizationId
          )
          .order('created_at', {
            ascending: false,
          }),

        client
          .from('campaign_messages')
          .select(
            'campaign_id, status'
          )
          .eq(
            'organization_id',
            organizationId
          ),
      ])

    if (campaignsRes.error) {
      setError(
        campaignsRes.error.message
      )
    } else {
      setCampaigns(
        (campaignsRes.data ?? []) as DBCampaign[]
      )
    }

    if (messagesRes.error) {
      setMessages([])
    } else {
      setMessages(
        (messagesRes.data ?? []) as CampaignMessage[]
      )
    }

    setLoading(false)
  }

  useEffect(() => {
    if (organizationId) {
      loadData()
    }
  }, [organizationId])

  const messageStats = useMemo(() => {
    const map: Record<string, QueueStats> = {}

    for (const message of messages) {
      if (!map[message.campaign_id]) {
        map[message.campaign_id] = {
          total: 0,
          queued: 0,
          sent: 0,
          delivered: 0,
          failed: 0,
          skipped: 0,
        }
      }

      const item = map[message.campaign_id]

      item.total++

      if (
        message.status === 'جاهزة' ||
        message.status === 'قيد الإرسال'
      ) {
        item.queued++
      }

      if (message.status === 'تم الإرسال') {
        item.sent++
      }

      if (message.status === 'تم التسليم') {
        item.delivered++
      }

      if (message.status === 'فشلت') {
        item.failed++
      }

      if (message.status === 'تم التخطي') {
        item.skipped++
      }
    }

    return map
  }, [messages])

  const totals = useMemo(() => {
    return campaigns.reduce(
      (acc, campaign) => {
        const stats =
          messageStats[campaign.id]

        acc.total +=
          stats?.total ??
          campaign.total_recipients ??
          0

        acc.queued +=
          stats?.queued ??
          campaign.queued_count ??
          0

        acc.sent +=
          stats?.sent ??
          campaign.sent_count ??
          0

        acc.delivered +=
          stats?.delivered ??
          campaign.delivered_count ??
          0

        acc.failed +=
          stats?.failed ??
          campaign.failed_count ??
          0

        return acc
      },
      {
        total: 0,
        queued: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
      }
    )
  }, [campaigns, messageStats])

  const handleAdd = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault()

    if (!supabase || !organizationId) {
      return
    }

    const trimmedName =
      form.name.trim()

    const trimmedMessage =
      form.messageBody.trim()

    if (!trimmedName) {
      setError('برجاء إدخال اسم الحملة.')
      return
    }

    if (!trimmedMessage) {
      setError('برجاء إدخال نص الرسالة.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    const client = supabase

    const { data: authData } =
      await client.auth.getUser()

    const userId =
      authData.user?.id

    const {
      error: insertError,
    } = await client
      .from('campaigns')
      .insert({
        organization_id:
          organizationId,

        name:
          trimmedName,

        channel:
          form.channel,

        audience:
          form.audienceStatus === 'all'
            ? 'كل العملاء المشتركين'
            : form.audienceStatus,

        status:
          form.scheduledAt
            ? 'مجدولة'
            : 'مسودة',

        scheduled_at:
          form.scheduledAt
            ? new Date(
                form.scheduledAt
              ).toISOString()
            : null,

        message_body:
          trimmedMessage,

        audience_filter: {
          status:
            form.audienceStatus,

          tag:
            form.tag.trim() ||
            null,

          optedInOnly:
            true,
        },

        created_by:
          userId ?? null,
      })

    setSaving(false)

    if (insertError) {
      setError(
        insertError.message
      )
      return
    }

    setForm({
      name: '',
      channel: 'whatsapp',
      messageBody: '',
      audienceStatus: 'نشط',
      tag: '',
      scheduledAt: '',
    })

    setShowForm(false)

    setSuccess(
      'تم إنشاء الحملة بنجاح.'
    )

    await loadData()
  }

  const callCampaignApi = async (
    campaignId: string,
    action: string,
    audienceFilter?: AudienceFilter | null
  ): Promise<CampaignApiResult> => {
    if (!supabase) {
      throw new Error(
        'خدمة قاعدة البيانات غير متاحة.'
      )
    }

    const {
      data: sessionData,
    } = await supabase.auth.getSession()

    const accessToken =
      sessionData.session?.access_token

    if (!accessToken) {
      throw new Error(
        'انتهت جلسة الدخول، برجاء تسجيل الدخول مرة أخرى.'
      )
    }

    const body: {
      campaignId: string
      action: string
      audienceFilter?: AudienceFilter
    } = {
      campaignId,
      action,
    }

    if (audienceFilter) {
      body.audienceFilter =
        audienceFilter
    }

    const response =
      await fetch(
        '/api/campaign-run',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            Authorization:
              `Bearer ${accessToken}`,
          },

          body: JSON.stringify(body),
        }
      )

    let result: CampaignApiResult = {}

    try {
      result =
        await response.json()
    } catch {
      result = {}
    }

    if (!response.ok) {
      throw new Error(
        result.error ??
          'تعذر تنفيذ العملية.'
      )
    }

    return result
  }

  const prepareCampaign = async (
    campaign: DBCampaign
  ) => {
    setPreparingId(campaign.id)
    setError(null)
    setSuccess(null)

    try {
      const result =
        await callCampaignApi(
          campaign.id,
          'prepare',
          campaign.audience_filter ?? {
            status: 'نشط',
            optedInOnly: true,
          }
        )

      setSuccess(
        result.message ??
          'تم تجهيز جمهور الحملة بنجاح.'
      )

      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر تجهيز الحملة.'
      )
    } finally {
      setPreparingId(null)
    }
  }

  const refreshStats = async (
    campaignId: string
  ) => {
    setActionId(campaignId)
    setActionType('refresh')
    setError(null)
    setSuccess(null)

    try {
      const result =
        await callCampaignApi(
          campaignId,
          'refresh'
        )

      setSuccess(
        result.message ??
          'تم تحديث إحصائيات الحملة.'
      )

      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر تحديث الإحصائيات.'
      )
    } finally {
      setActionId(null)
      setActionType(null)
    }
  }

  const retryFailed = async (
    campaignId: string
  ) => {
    setActionId(campaignId)
    setActionType('retry')
    setError(null)
    setSuccess(null)

    try {
      const result =
        await callCampaignApi(
          campaignId,
          'retry_failed'
        )

      setSuccess(
        result.message ??
          'تمت إعادة تجهيز الرسائل الفاشلة.'
      )

      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر إعادة محاولة الرسائل.'
      )
    } finally {
      setActionId(null)
      setActionType(null)
    }
  }

  const cancelCampaign = async (
    campaignId: string
  ) => {
    const confirmed =
      window.confirm(
        'هل أنت متأكد من إلغاء هذه الحملة؟ سيتم تخطي الرسائل التي لم يتم إرسالها.'
      )

    if (!confirmed) {
      return
    }

    setActionId(campaignId)
    setActionType('cancel')
    setError(null)
    setSuccess(null)

    try {
      const result =
        await callCampaignApi(
          campaignId,
          'cancel'
        )

      setSuccess(
        result.message ??
          'تم إلغاء الحملة.'
      )

      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر إلغاء الحملة.'
      )
    } finally {
      setActionId(null)
      setActionType(null)
    }
  }

  if (
    !subLoading &&
    !hasFeature('campaigns')
  ) {
    return (
      <FeatureLocked
        featureName="الحملات التسويقية"
      />
    )
  }

  if (orgLoading) {
    return (
      <LoadingSkeleton />
    )
  }

  if (
    orgError ||
    !organizationId
  ) {
    return (
      <div
        className="rounded-2xl border border-red-100 bg-red-50 px-5 py-8 text-center"
        role="alert"
      >
        <div className="mx-auto w-11 h-11 rounded-xl bg-white border border-red-100 flex items-center justify-center text-red-600">
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path
              d="M12 8v5"
              strokeLinecap="round"
            />
            <path
              d="M12 16.5h.01"
              strokeLinecap="round"
            />
            <path
              d="M10.3 4.6 3.2 17a2 2 0 0 0 1.7 3h14.2a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0Z"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className="text-sm font-semibold text-red-800 mt-3">
          تعذر تحميل مساحة العمل
        </p>

        <p className="text-xs text-red-700/70 mt-1">
          {orgError ??
            'تعذر تحديد المؤسسة الخاصة بحسابك'}
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <LoadingSkeleton />
    )
  }

  return (
    <div className="space-y-5 pb-6">

      {/* Header */}

      <section className="relative overflow-hidden rounded-2xl border border-sand-200 bg-white px-4 py-5 sm:px-6 sm:py-6 shadow-sm">
        <div className="absolute -top-16 -left-16 w-36 h-36 rounded-full bg-amber-100/40 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-1 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              التسويق والحملات
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-950">
              الحملات التسويقية
            </h1>

            <p className="text-sm text-ink-900/50 mt-1.5 max-w-2xl leading-6">
              أنشئ حملات مستهدفة، جهّز جمهورك، وتابع Queue والإحصائيات
              من مكان واحد.
            </p>
          </div>

          <Button
            onClick={() => {
              setError(null)
              setSuccess(null)
              setShowForm(value => !value)
            }}
            className="w-full sm:w-auto"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <IconPlus className="w-4 h-4" />
              {showForm
                ? 'إغلاق النموذج'
                : 'حملة جديدة'}
            </span>
          </Button>

        </div>
      </section>

      {/* Alerts */}

      {success && (
        <div
          className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3.5 text-emerald-800"
          role="status"
          aria-live="polite"
        >
          <div className="w-8 h-8 shrink-0 rounded-xl bg-white border border-emerald-100 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 text-emerald-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                d="m5 12 4 4L19 6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="text-sm leading-6 pt-0.5">
            {success}
          </div>
        </div>
      )}

      {error && (
        <div
          className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3.5 text-red-800"
          role="alert"
        >
          <div className="w-8 h-8 shrink-0 rounded-xl bg-white border border-red-100 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 text-red-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                d="M12 8v5"
                strokeLinecap="round"
              />
              <path
                d="M12 16.5h.01"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="flex-1 min-w-0 text-sm leading-6 pt-0.5">
            {error}
          </div>
        </div>
      )}

      {/* Summary */}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">

        <Card className="p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-ink-900/45">
              إجمالي المستهدفين
            </span>

            <span className="w-8 h-8 rounded-xl bg-sand-100 flex items-center justify-center text-ink-900/55">
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path
                  d="M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20"
                  strokeLinecap="round"
                />
                <circle cx="10" cy="8" r="3" />
                <path
                  d="M16 11a3 3 0 1 0 0-6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </div>

          <div className="text-2xl font-bold text-ink-950 mt-3">
            {totals.total}
          </div>
        </Card>

        <Card className="p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-ink-900/45">
              في Queue
            </span>

            <span className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path
                  d="M7 4h10M7 20h10M8 4c0 4 8 4 8 8s-8 4-8 8"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </div>

          <div className="text-2xl font-bold text-ink-950 mt-3">
            {totals.queued}
          </div>
        </Card>

        <Card className="p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-ink-900/45">
              تم الإرسال
            </span>

            <span className="w-8 h-8 rounded-xl bg-sand-100 flex items-center justify-center text-ink-900/55">
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path
                  d="m4 12 15-8-5 16-3-6-7-2Z"
                  strokeLinejoin="round"
                />
                <path
                  d="m11 14 8-10"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </div>

          <div className="text-2xl font-bold text-ink-950 mt-3">
            {totals.sent}
          </div>
        </Card>

        <Card className="p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-ink-900/45">
              تم التسليم
            </span>

            <span className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                aria-hidden="true"
              >
                <path
                  d="m5 12 4 4L19 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>

          <div className="text-2xl font-bold text-emerald-600 mt-3">
            {totals.delivered}
          </div>
        </Card>

        <Card className="p-4 sm:p-5 rounded-2xl col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-ink-900/45">
              فشل
            </span>

            <span className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path
                  d="M7 7l10 10M17 7 7 17"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </div>

          <div className="text-2xl font-bold text-red-600 mt-3">
            {totals.failed}
          </div>
        </Card>

      </div>

      {/* Create Campaign */}

      {showForm && (
        <Card className="overflow-hidden rounded-2xl border-sand-200">

          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-sand-100 bg-sand-50/50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-ink-950 text-sand-50 flex items-center justify-center">
                <IconPlus className="w-5 h-5" />
              </div>

              <div>
                <h2 className="font-bold text-ink-950">
                  إنشاء حملة جديدة
                </h2>

                <p className="text-xs sm:text-sm text-ink-900/45 mt-1 leading-5">
                  حدد القناة والجمهور والرسالة. سيتم استهداف العملاء
                  الذين لديهم Marketing Opt-in فقط.
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleAdd}
            className="p-4 sm:p-6 grid sm:grid-cols-2 gap-4"
          >

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-ink-900/60">
                اسم الحملة
              </label>

              <input
                required
                value={form.name}
                onChange={e =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
                placeholder="مثال: عرض سبتمبر للعملاء الحاليين"
                className="w-full mt-1.5 border border-sand-200 bg-white rounded-xl px-3.5 py-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-900/60">
                القناة
              </label>

              <select
                value={form.channel}
                onChange={e =>
                  setForm({
                    ...form,
                    channel: e.target.value,
                  })
                }
                className="w-full mt-1.5 border border-sand-200 rounded-xl px-3.5 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-white"
              >
                <option value="whatsapp">
                  واتساب
                </option>

                <option value="messenger">
                  ماسنجر
                </option>

                <option value="instagram">
                  إنستجرام
                </option>

                <option value="email">
                  بريد إلكتروني
                </option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-900/60">
                الجمهور
              </label>

              <select
                value={form.audienceStatus}
                onChange={e =>
                  setForm({
                    ...form,
                    audienceStatus:
                      e.target.value,
                  })
                }
                className="w-full mt-1.5 border border-sand-200 rounded-xl px-3.5 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-white"
              >
                <option value="نشط">
                  العملاء النشطون المشتركين
                </option>

                <option value="غير نشط">
                  العملاء غير النشطين المشتركين
                </option>

                <option value="all">
                  كل العملاء المشتركين
                </option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-900/60">
                Tag اختياري
              </label>

              <input
                value={form.tag}
                onChange={e =>
                  setForm({
                    ...form,
                    tag: e.target.value,
                  })
                }
                placeholder="مثال: VIP"
                className="w-full mt-1.5 border border-sand-200 bg-white rounded-xl px-3.5 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-900/60">
                الموعد اختياري
              </label>

              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={e =>
                  setForm({
                    ...form,
                    scheduledAt:
                      e.target.value,
                  })
                }
                className="w-full mt-1.5 border border-sand-200 rounded-xl px-3.5 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-ink-900/60">
                نص الرسالة
              </label>

              <textarea
                required
                rows={5}
                value={form.messageBody}
                onChange={e =>
                  setForm({
                    ...form,
                    messageBody:
                      e.target.value,
                  })
                }
                placeholder="اكتب الرسالة هنا... يمكنك استخدام {name} و {company}"
                className="w-full mt-1.5 border border-sand-200 bg-white rounded-xl px-3.5 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-y min-h-[130px]"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                <span className="text-xs text-ink-900/40">
                  المتغيرات المتاحة: {'{name}'} و {'{company}'}
                </span>

                <span className="text-[11px] text-ink-900/35">
                  Opt-in فقط
                </span>
              </div>
            </div>

            <div className="sm:col-span-2 flex flex-col-reverse sm:flex-row gap-2 sm:justify-start pt-1">
              <Button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto"
              >
                {saving
                  ? 'جاري الحفظ...'
                  : 'إنشاء الحملة'}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowForm(false)
                  setError(null)
                }}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                إلغاء
              </Button>
            </div>

          </form>
        </Card>
      )}

      {/* Campaigns */}

      <Card className="overflow-hidden rounded-2xl border-sand-200">

        <div className="px-4 sm:px-5 py-4 border-b border-sand-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="font-bold text-ink-950">
              الحملات
            </h2>

            <p className="text-xs text-ink-900/40 mt-1">
              {campaigns.length === 0
                ? 'لم يتم إنشاء أي حملة بعد'
                : `${campaigns.length} حملة`}
            </p>
          </div>

          {campaigns.length > 0 && (
            <span className="text-xs text-ink-900/40">
              يتم عرض أحدث الحملات أولًا
            </span>
          )}
        </div>

        {campaigns.length === 0 ? (
          <EmptyState
            onCreate={() => {
              setError(null)
              setSuccess(null)
              setShowForm(true)
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table
              head={[
                'الحملة',
                'القناة',
                'الجمهور',
                'الحالة',
                'التقدم',
                'الإجراءات',
              ]}
            >
              {campaigns.map(
                campaign => {
                  const stats =
                    messageStats[
                      campaign.id
                    ]

                  const total =
                    stats?.total ??
                    campaign.total_recipients ??
                    0

                  const queued =
                    stats?.queued ??
                    campaign.queued_count ??
                    0

                  const sent =
                    stats?.sent ??
                    campaign.sent_count ??
                    0

                  const delivered =
                    stats?.delivered ??
                    campaign.delivered_count ??
                    0

                  const failed =
                    stats?.failed ??
                    campaign.failed_count ??
                    0

                  const skipped =
                    stats?.skipped ??
                    campaign.skipped_count ??
                    0

                  const completed =
                    delivered +
                    failed +
                    skipped

                  const progress =
                    percentage(
                      completed,
                      total
                    )

                  const isBusy =
                    actionId ===
                    campaign.id

                  const canPrepare =
                    [
                      'مسودة',
                      'مجدولة',
                      'قيد التجهيز',
                      'جارٍ التحضير',
                      'جاهزة',
                    ].includes(
                      campaign.status
                    )

                  const isTerminal =
                    [
                      'مكتملة',
                      'ملغاة',
                    ].includes(
                      campaign.status
                    )

                  return (
                    <tr
                      key={campaign.id}
                      className="align-top transition-colors hover:bg-sand-50/70"
                    >
                      <td className="py-4 px-3 min-w-[250px]">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 shrink-0 rounded-xl bg-ink-950 text-sand-50 flex items-center justify-center">
                            <svg
                              viewBox="0 0 24 24"
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              aria-hidden="true"
                            >
                              <path
                                d="M5 5h14v14H5z"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M8 9h8M8 12h6M8 15h4"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>

                          <div className="min-w-0">
                            <div className="font-semibold text-ink-950 break-words">
                              {campaign.name}
                            </div>

                            {campaign.message_body && (
                              <div className="text-xs text-ink-900/40 mt-1.5 line-clamp-2 leading-5">
                                {campaign.message_body}
                              </div>
                            )}

                            {campaign.last_run_at && (
                              <div className="text-[11px] text-ink-900/35 mt-2">
                                آخر تحديث:{' '}
                                {formatDate(
                                  campaign.last_run_at
                                )}
                              </div>
                            )}

                            {campaign.scheduled_at && (
                              <div className="text-[11px] text-amber-700/70 mt-1">
                                مجدولة:{' '}
                                {formatDate(
                                  campaign.scheduled_at
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-full bg-sand-100 border border-sand-200 px-2.5 py-1 text-xs font-medium text-ink-900/65">
                          {channelLabels[
                            campaign.channel
                          ] ??
                            campaign.channel}
                        </span>
                      </td>

                      <td className="py-4 px-3 min-w-[180px]">
                        <div className="text-sm text-ink-900/75">
                          {campaign.audience ??
                            '—'}
                        </div>

                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {campaign.audience_filter?.tag && (
                            <Badge tone="gold">
                              #{campaign.audience_filter.tag}
                            </Badge>
                          )}

                          <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            Opt-in فقط
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-3 whitespace-nowrap">
                        <Badge
                          tone={statusTone(
                            campaign.status
                          )}
                        >
                          {campaign.status}
                        </Badge>
                      </td>

                      <td className="py-4 px-3 min-w-[245px]">
                        <div className="flex items-center justify-between gap-3 text-xs mb-2">
                          <span className="text-ink-900/50">
                            {progress}% مكتمل
                          </span>

                          <span className="font-semibold text-ink-900">
                            {completed}/{total}
                          </span>
                        </div>

                        <div
                          className="h-2 bg-sand-200 rounded-full overflow-hidden"
                          aria-label={`تقدم الحملة ${progress}%`}
                        >
                          <div
                            className="h-full bg-ink-950 rounded-full transition-all duration-500"
                            style={{
                              width:
                                `${progress}%`,
                            }}
                          />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-1.5 mt-2.5 text-[10px] text-ink-900/45">
                          <span>
                            Queue {queued}
                          </span>

                          <span>
                            إرسال {sent}
                          </span>

                          <span>
                            تسليم {delivered}
                          </span>

                          <span>
                            فشل {failed}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-3 min-w-[290px]">
                        <div className="flex flex-wrap gap-2">

                          {canPrepare && (
                            <Button
                              variant="secondary"
                              disabled={
                                preparingId ===
                                campaign.id
                              }
                              onClick={() =>
                                prepareCampaign(
                                  campaign
                                )
                              }
                            >
                              {preparingId ===
                              campaign.id
                                ? 'جاري التجهيز...'
                                : 'تجهيز الجمهور'}
                            </Button>
                          )}

                          <Button
                            variant="secondary"
                            disabled={
                              isBusy ||
                              preparingId ===
                                campaign.id
                            }
                            onClick={() =>
                              refreshStats(
                                campaign.id
                              )
                            }
                          >
                            {isBusy &&
                            actionType ===
                              'refresh'
                              ? 'جاري التحديث...'
                              : 'تحديث'}
                          </Button>

                          {failed > 0 && (
                            <Button
                              variant="secondary"
                              disabled={
                                isBusy
                              }
                              onClick={() =>
                                retryFailed(
                                  campaign.id
                                )
                              }
                            >
                              {isBusy &&
                              actionType ===
                                'retry'
                                ? 'جاري التجهيز...'
                                : `إعادة الفاشل (${failed})`}
                            </Button>
                          )}

                          {!isTerminal && (
                            <Button
                              variant="ghost"
                              disabled={
                                isBusy
                              }
                              onClick={() =>
                                cancelCampaign(
                                  campaign.id
                                )
                              }
                              className="text-red-600 hover:bg-red-50"
                            >
                              {isBusy &&
                              actionType ===
                                'cancel'
                                ? 'جاري الإلغاء...'
                                : 'إلغاء الحملة'}
                            </Button>
                          )}

                        </div>
                      </td>
                    </tr>
                  )
                }
              )}
            </Table>
          </div>
        )}

      </Card>

      {/* Queue Information */}

      <Card className="p-4 sm:p-5 rounded-2xl bg-sand-50/60 border-sand-200">

        <div className="flex items-start gap-3">

          <div className="w-10 h-10 shrink-0 rounded-xl bg-ink-950 text-sand-50 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path
                d="M12 6v6l4 2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="8" />
            </svg>
          </div>

          <div className="min-w-0">
            <h3 className="font-bold text-ink-950">
              Campaign Queue
            </h3>

            <p className="text-xs sm:text-sm text-ink-900/50 mt-1.5 leading-6">
              الحملة لديها Queue حقيقي للرسائل وإحصائيات قابلة
              للتحديث وإعادة المحاولة والإلغاء. الإرسال الخارجي
              نفسه لن يتم ادعاؤه قبل تفعيل التكاملات الفعلية.
            </p>
          </div>

        </div>

      </Card>

    </div>
  )
}
