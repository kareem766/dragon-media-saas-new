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
      // الرسائل ليست شرطًا لعرض الحملات.
      // نعتمد على counters الموجودة في campaigns
      // إذا تعذر تحميلها.
      setMessages([])
    } else {
      setMessages(
        (messagesRes.data ??
          []) as CampaignMessage[]
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
    } =
      await supabase.auth.getSession()

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
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (
    orgError ||
    !organizationId
  ) {
    return (
      <div className="text-center py-20 text-sm text-red-600">
        {orgError ??
          'تعذر تحديد المؤسسة الخاصة بحسابك'}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Header */}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

        <div>
          <h1 className="text-xl font-bold text-ink-950">
            الحملات التسويقية
          </h1>

          <p className="text-sm text-ink-900/50 mt-1">
            أنشئ واستهدف جمهورك وتابع Queue الحملة وإحصائياتها من مكان واحد.
          </p>
        </div>

        <Button
          onClick={() =>
            setShowForm(v => !v)
          }
        >
          <span className="inline-flex items-center gap-2">
            <IconPlus className="w-4 h-4" />
            حملة جديدة
          </span>
        </Button>

      </div>

      {/* Alerts */}

      {success && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl px-4 py-3 text-sm">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Summary */}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">

        <Card className="p-4">
          <div className="text-xs text-ink-900/45">
            إجمالي المستهدفين
          </div>

          <div className="text-2xl font-bold text-ink-950 mt-1">
            {totals.total}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-ink-900/45">
            في Queue
          </div>

          <div className="text-2xl font-bold text-ink-950 mt-1">
            {totals.queued}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-ink-900/45">
            تم الإرسال
          </div>

          <div className="text-2xl font-bold text-ink-950 mt-1">
            {totals.sent}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-ink-900/45">
            تم التسليم
          </div>

          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {totals.delivered}
          </div>
        </Card>

        <Card className="p-4 col-span-2 lg:col-span-1">
          <div className="text-xs text-ink-900/45">
            فشل
          </div>

          <div className="text-2xl font-bold text-red-600 mt-1">
            {totals.failed}
          </div>
        </Card>

      </div>

      {/* Create Campaign */}

      {showForm && (
        <Card className="p-5">

          <div className="mb-5">

            <h2 className="font-bold text-ink-950">
              إنشاء حملة
            </h2>

            <p className="text-xs text-ink-900/45 mt-1">
              سيتم استهداف العملاء الذين لديهم Marketing Opt-in فقط.
            </p>

          </div>

          <form
            onSubmit={handleAdd}
            className="grid sm:grid-cols-2 gap-4"
          >

            <div className="sm:col-span-2">

              <label className="text-xs font-medium text-ink-900/60">
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
                className="w-full mt-1 border border-sand-200 rounded-xl px-3.5 py-3 text-sm outline-none focus:border-ink-700"
              />

            </div>

            <div>

              <label className="text-xs font-medium text-ink-900/60">
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
                className="w-full mt-1 border border-sand-200 rounded-xl px-3.5 py-3 text-sm outline-none focus:border-ink-700 bg-white"
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

              <label className="text-xs font-medium text-ink-900/60">
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
                className="w-full mt-1 border border-sand-200 rounded-xl px-3.5 py-3 text-sm outline-none focus:border-ink-700 bg-white"
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

              <label className="text-xs font-medium text-ink-900/60">
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
                className="w-full mt-1 border border-sand-200 rounded-xl px-3.5 py-3 text-sm outline-none focus:border-ink-700"
              />

            </div>

            <div>

              <label className="text-xs font-medium text-ink-900/60">
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
                className="w-full mt-1 border border-sand-200 rounded-xl px-3.5 py-3 text-sm outline-none focus:border-ink-700"
              />

            </div>

            <div className="sm:col-span-2">

              <label className="text-xs font-medium text-ink-900/60">
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
                className="w-full mt-1 border border-sand-200 rounded-xl px-3.5 py-3 text-sm outline-none focus:border-ink-700 resize-y"
              />

              <div className="text-xs text-ink-900/40 mt-1.5">
                المتغيرات المتاحة: {'{name}'} و {'{company}'}
              </div>

            </div>

            <div className="sm:col-span-2 flex gap-2">

              <Button
                type="submit"
                disabled={saving}
              >
                {saving
                  ? 'جاري الحفظ...'
                  : 'إنشاء الحملة'}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setShowForm(false)
                }
              >
                إلغاء
              </Button>

            </div>

          </form>

        </Card>
      )}

      {/* Campaigns */}

      <Card className="p-2 sm:p-4">

        {campaigns.length === 0 ? (
          <div className="text-center py-16">

            <div className="text-sm font-semibold text-ink-900/60">
              لا توجد حملات بعد
            </div>

            <div className="text-xs text-ink-900/40 mt-1">
              ابدأ بإنشاء أول حملة حقيقية.
            </div>

          </div>
        ) : (
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
                    key={
                      campaign.id
                    }
                    className="hover:bg-sand-50 align-top"
                  >

                    {/* Campaign */}

                    <td className="py-4 px-3 min-w-[220px]">

                      <div className="font-semibold text-ink-950">
                        {campaign.name}
                      </div>

                      {campaign.message_body && (
                        <div className="text-xs text-ink-900/40 mt-1 line-clamp-2">
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

                    </td>

                    {/* Channel */}

                    <td className="py-4 px-3 whitespace-nowrap">
                      {channelLabels[
                        campaign.channel
                      ] ??
                        campaign.channel}
                    </td>

                    {/* Audience */}

                    <td className="py-4 px-3 min-w-[170px]">

                      <div className="text-sm">
                        {campaign.audience ??
                          '—'}
                      </div>

                      {campaign.audience_filter?.tag && (
                        <div className="mt-1">
                          <Badge tone="gold">
                            #{campaign.audience_filter.tag}
                          </Badge>
                        </div>
                      )}

                      <div className="text-xs text-ink-900/40 mt-1">
                        Opt-in فقط
                      </div>

                    </td>

                    {/* Status */}

                    <td className="py-4 px-3">

                      <Badge
                        tone={statusTone(
                          campaign.status
                        )}
                      >
                        {campaign.status}
                      </Badge>

                    </td>

                    {/* Progress */}

                    <td className="py-4 px-3 min-w-[230px]">

                      <div className="flex items-center justify-between text-xs mb-1.5">

                        <span className="text-ink-900/50">
                          {progress}% مكتمل
                        </span>

                        <span className="font-semibold text-ink-900">
                          {completed}/{total}
                        </span>

                      </div>

                      <div className="h-2 bg-sand-200 rounded-full overflow-hidden">

                        <div
                          className="h-full bg-ink-900 rounded-full transition-all duration-500"
                          style={{
                            width:
                              `${progress}%`,
                          }}
                        />

                      </div>

                      <div className="grid grid-cols-4 gap-1 mt-2 text-[11px] text-ink-900/45">

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

                    {/* Actions */}

                    <td className="py-4 px-3 min-w-[260px]">

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
        )}

      </Card>

      {/* Information */}

      <Card className="p-5 bg-sand-50/50">

        <div className="flex items-start gap-3">

          <div className="w-9 h-9 shrink-0 rounded-xl bg-ink-900 text-sand-50 flex items-center justify-center text-sm font-bold">
            4
          </div>

          <div>

            <h3 className="font-bold text-ink-950">
              Campaign Queue
            </h3>

            <p className="text-sm text-ink-900/55 mt-1 leading-6">
              الحملة لديها Queue حقيقي للرسائل
              وإحصائيات قابلة للتحديث وإعادة المحاولة
              والإلغاء. الإرسال الخارجي نفسه لن يتم
              ادعاؤه قبل تفعيل التكاملات الفعلية.
            </p>

          </div>

        </div>

      </Card>

    </div>
  )
}
