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

interface DBCampaign {
  id: string
  name: string
  channel: string
  audience: string | null
  status: string
  scheduled_at: string | null
  message_body: string | null
  audience_filter: {
    status?: string
    tag?: string
  } | null
  total_recipients: number
  queued_count: number
  sent_count: number
  delivered_count: number
  failed_count: number
  last_run_at: string | null
}

interface CampaignMessage {
  campaign_id: string
  status: string
}

const channelLabels: Record<string, string> = {
  whatsapp: 'واتساب',
  messenger: 'ماسنجر',
  instagram: 'إنستجرام',
  email: 'بريد إلكتروني',
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

  const [campaigns, setCampaigns] =
    useState<DBCampaign[]>([])

  const [messages, setMessages] =
    useState<CampaignMessage[]>([])

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [preparingId, setPreparingId] =
    useState<string | null>(null)

  const [showForm, setShowForm] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [success, setSuccess] =
    useState<string | null>(null)

  const [form, setForm] =
    useState({
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

    const sb = supabase

    const [
      campaignsRes,
      messagesRes,
    ] = await Promise.all([
      sb
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
          last_run_at
        `)
        .eq(
          'organization_id',
          organizationId
        )
        .order(
          'created_at',
          {
            ascending: false,
          }
        ),

      sb
        .from('campaign_messages')
        .select(
          'campaign_id, status'
        ),
    ])

    if (campaignsRes.error) {
      setError(
        campaignsRes.error.message
      )
    } else {
      setCampaigns(
        (campaignsRes.data ??
          []) as DBCampaign[]
      )
    }

    if (!messagesRes.error) {
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

  const messageStats =
    useMemo(() => {
      const map: Record<
        string,
        {
          total: number
          ready: number
          sent: number
          delivered: number
          failed: number
        }
      > = {}

      for (const message of messages) {
        if (!map[message.campaign_id]) {
          map[message.campaign_id] = {
            total: 0,
            ready: 0,
            sent: 0,
            delivered: 0,
            failed: 0,
          }
        }

        const item =
          map[message.campaign_id]

        item.total++

        if (
          message.status ===
            'جاهزة' ||
          message.status ===
            'قيد الإرسال'
        ) {
          item.ready++
        }

        if (
          message.status ===
          'تم الإرسال'
        ) {
          item.sent++
        }

        if (
          message.status ===
          'تم التسليم'
        ) {
          item.delivered++
        }

        if (
          message.status ===
          'فشلت'
        ) {
          item.failed++
        }
      }

      return map
    }, [messages])

  const handleAdd = async (
    e: React.FormEvent
  ) => {
    e.preventDefault()

    if (
      !supabase ||
      !organizationId
    ) {
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    const {
      data: authData,
    } =
      await supabase.auth.getUser()

    const userId =
      authData.user?.id

    const {
      error: insertError,
    } = await supabase
      .from('campaigns')
      .insert({
        organization_id:
          organizationId,

        name:
          form.name.trim(),

        channel:
          form.channel,

        audience:
          form.audienceStatus ===
          'all'
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
          form.messageBody.trim(),

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
      'تم إنشاء الحملة كحملة حقيقية في قاعدة البيانات.'
    )

    await loadData()
  }

  const prepareCampaign = async (
    campaign: DBCampaign
  ) => {
    if (!supabase) {
      return
    }

    setPreparingId(campaign.id)
    setError(null)
    setSuccess(null)

    try {
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

            body: JSON.stringify({
              campaignId:
                campaign.id,

              audienceFilter:
                campaign.audience_filter ??
                {
                  status:
                    'نشط',
                  optedInOnly:
                    true,
                },
            }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ??
            'تعذر تجهيز الحملة.'
        )
      }

      setSuccess(
        result.message
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-950">
            الحملات التسويقية
          </h1>

          <p className="text-sm text-ink-900/50 mt-1">
            أنشئ جمهورًا حقيقيًا من العملاء المشتركين وجهّز رسائل الحملات للإرسال.
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

      {showForm && (
        <Card className="p-5">

          <div className="mb-5">
            <h2 className="font-bold text-ink-950">
              إنشاء حملة
            </h2>

            <p className="text-xs text-ink-900/45 mt-1">
              لن يتم إرسال أي رسالة خارجية من هذه المرحلة قبل تفعيل موصل القناة.
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
                موعد الحملة اختياري
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
              'الرسائل',
              'الإجراء',
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

                const ready =
                  stats?.ready ??
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

                return (
                  <tr
                    key={
                      campaign.id
                    }
                    className="hover:bg-sand-50"
                  >
                    <td className="py-4 px-3 min-w-[180px]">
                      <div className="font-semibold text-ink-950">
                        {campaign.name}
                      </div>

                      {campaign.message_body && (
                        <div className="text-xs text-ink-900/40 mt-1 line-clamp-1">
                          {campaign.message_body}
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-3 whitespace-nowrap">
                      {channelLabels[
                        campaign.channel
                      ] ??
                        campaign.channel}
                    </td>

                    <td className="py-4 px-3 whitespace-nowrap">
                      {campaign.audience ??
                        '—'}
                    </td>

                    <td className="py-4 px-3">
                      <Badge
                        tone={statusTone(
                          campaign.status
                        )}
                      >
                        {campaign.status}
                      </Badge>
                    </td>

                    <td className="py-4 px-3 min-w-[150px]">
                      <div className="text-xs text-ink-900/55 space-y-1">
                        <div>
                          الإجمالي: {total}
                        </div>

                        <div>
                          جاهزة: {ready}
                        </div>

                        <div>
                          أُرسلت: {sent}
                        </div>

                        <div>
                          تم التسليم: {delivered}
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-3">
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
                    </td>
                  </tr>
                )
              }
            )}
          </Table>
        )}
      </Card>

      <Card className="p-5 bg-sand-50/50">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-ink-900 text-sand-50 flex items-center justify-center text-sm font-bold">
            4
          </div>

          <div>
            <h3 className="font-bold text-ink-950">
              Campaign Engine
            </h3>

            <p className="text-sm text-ink-900/55 mt-1 leading-6">
              الحملات أصبحت مرتبطة بجمهور حقيقي يعتمد على
              Marketing Opt-in، ويتم إنشاء Queue حقيقي للرسائل.
              مرحلة الإرسال الخارجي نفسها مؤجلة عمدًا لمرحلة Meta والتكاملات.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
