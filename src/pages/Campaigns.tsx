import React, {
  useEffect,
  useMemo,
  useState,
} from 'react'

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
    tag?: string | null
    optedInOnly?: boolean
  } | null
  total_recipients: number
  queued_count: number
  sent_count: number
  delivered_count: number
  failed_count: number
  skipped_count: number
  last_run_at: string | null
}

const channelLabels: Record<string, string> = {
  whatsapp: 'واتساب',
  messenger: 'ماسنجر',
  instagram: 'إنستجرام',
  email: 'بريد إلكتروني',
}

const audienceStatusOptions = [
  {
    value: 'all',
    label: 'كل العملاء',
  },
  {
    value: 'نشط',
    label: 'العملاء النشطون',
  },
  {
    value: 'غير نشط',
    label: 'العملاء غير النشطين',
  },
]

function formatDate(value: string | null) {
  if (!value) return '—'

  try {
    return new Intl.DateTimeFormat(
      'ar-EG',
      {
        dateStyle: 'medium',
        timeStyle: 'short',
      }
    ).format(new Date(value))
  } catch {
    return value
  }
}

export default function Campaigns() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization()

  const [campaigns, setCampaigns] =
    useState<DBCampaign[]>([])

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [actionId, setActionId] =
    useState<string | null>(null)

  const [showForm, setShowForm] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [success, setSuccess] =
    useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    channel: 'whatsapp',
    messageBody: '',
    audienceStatus: 'all',
    tag: '',
    scheduledAt: '',
  })

  const loadData = async () => {
    if (!supabase || !organizationId) {
      return
    }

    setLoading(true)
    setError(null)

    const {
      data,
      error: loadError,
    } = await supabase
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
      })

    if (loadError) {
      setError(loadError.message)
    } else {
      setCampaigns(
        (data || []) as DBCampaign[]
      )
    }

    setLoading(false)
  }

  useEffect(() => {
    if (organizationId) {
      loadData()
    }
  }, [organizationId])

  const totals = useMemo(() => {
    return campaigns.reduce(
      (acc, campaign) => {
        acc.total +=
          campaign.total_recipients || 0

        acc.queued +=
          campaign.queued_count || 0

        acc.sent +=
          campaign.sent_count || 0

        acc.delivered +=
          campaign.delivered_count || 0

        acc.failed +=
          campaign.failed_count || 0

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
  }, [campaigns])

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

    if (!form.name.trim()) {
      setError('اكتب اسم الحملة.')
      return
    }

    if (!form.messageBody.trim()) {
      setError('اكتب محتوى الرسالة.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    const {
      data: authData,
    } = await supabase.auth.getUser()

    const userId =
      authData.user?.id || null

    const audienceLabel =
      form.audienceStatus === 'all'
        ? 'كل العملاء'
        : form.audienceStatus

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
          audienceLabel,

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
            form.tag.trim() || null,

          optedInOnly: true,
        },

        created_by:
          userId,
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
      audienceStatus: 'all',
      tag: '',
      scheduledAt: '',
    })

    setShowForm(false)

    setSuccess(
      'تم إنشاء الحملة بنجاح.'
    )

    await loadData()
  }

  const callApi = async (
    campaignId: string,
    action:
      | 'prepare'
      | 'cancel'
      | 'retry_failed'
      | 'refresh'
  ) => {
    if (!supabase) {
      throw new Error(
        'خدمة قاعدة البيانات غير متاحة.'
      )
    }

    const {
      data: sessionData,
    } =
      await supabase.auth.getSession()

    const token =
      sessionData.session
        ?.access_token

    if (!token) {
      throw new Error(
        'انتهت جلسة الدخول. سجل الدخول مرة أخرى.'
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
              `Bearer ${token}`,
          },

          body: JSON.stringify({
            campaignId,
            action,
          }),
        }
      )

    const result =
      await response.json()

    if (!response.ok) {
      throw new Error(
        result.error ||
        'تعذر تنفيذ العملية.'
      )
    }

    return result
  }

  const prepareCampaign =
    async (
      campaign: DBCampaign
    ) => {
      setActionId(campaign.id)
      setError(null)
      setSuccess(null)

      try {
        const result =
          await callApi(
            campaign.id,
            'prepare'
          )

        setSuccess(
          result.message ||
          'تم تجهيز الحملة.'
        )

        await loadData()
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'تعذر تجهيز الحملة.'
        )
      } finally {
        setActionId(null)
      }
    }

  const refreshCampaign =
    async (
      campaign: DBCampaign
    ) => {
      setActionId(campaign.id)
      setError(null)

      try {
        await callApi(
          campaign.id,
          'refresh'
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
      }
    }

  const retryCampaign =
    async (
      campaign: DBCampaign
    ) => {
      setActionId(campaign.id)
      setError(null)
      setSuccess(null)

      try {
        const result =
          await callApi(
            campaign.id,
            'retry_failed'
          )

        setSuccess(
          result.message ||
          'تمت إعادة تجهيز الرسائل الفاشلة.'
        )

        await loadData()
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'تعذر إعادة المحاولة.'
        )
      } finally {
        setActionId(null)
      }
    }

  const cancelCampaign =
    async (
      campaign: DBCampaign
    ) => {
      const confirmed =
        window.confirm(
          'هل أنت متأكد من إلغاء الحملة؟ سيتم تخطي الرسائل التي لم يتم إرسالها.'
        )

      if (!confirmed) return

      setActionId(campaign.id)
      setError(null)
      setSuccess(null)

      try {
        const result =
          await callApi(
            campaign.id,
            'cancel'
          )

        setSuccess(
          result.message ||
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
      }
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
        {orgError ||
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
    <div
      dir="rtl"
      className="space-y-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-950">
            الحملات التسويقية
          </h1>

          <p className="text-sm text-ink-900/50 mt-1">
            أنشئ واستهدف وتابع حملات العملاء من مكان واحد.
          </p>
        </div>

        <Button
          onClick={() =>
            setShowForm(v => !v)
          }
        >
          <span className="inline-flex items-center gap-2">
            <IconPlus className="w-4 h-4" />
            إنشاء حملة
          </span>
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {success && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          {success}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="text-xs text-ink-900/50">
            الحملات
          </div>
          <div className="text-2xl font-bold mt-1">
            {campaigns.length}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-ink-900/50">
            المستهدفون
          </div>
          <div className="text-2xl font-bold mt-1">
            {totals.total}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-ink-900/50">
            جاهزة
          </div>
          <div className="text-2xl font-bold mt-1">
            {totals.queued}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-ink-900/50">
            تم الإرسال
          </div>
          <div className="text-2xl font-bold mt-1">
            {totals.sent}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-ink-900/50">
            فشلت
          </div>
          <div className="text-2xl font-bold mt-1">
            {totals.failed}
          </div>
        </Card>
      </div>

      {showForm && (
        <Card className="p-5">
          <form
            onSubmit={handleAdd}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-semibold mb-1.5">
                اسم الحملة
              </label>

              <input
                required
                value={form.name}
                onChange={e =>
                  setForm({
                    ...form,
                    name:
                      e.target.value,
                  })
                }
                placeholder="مثال: عرض سبتمبر"
                className="w-full border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  القناة
                </label>

                <select
                  value={form.channel}
                  onChange={e =>
                    setForm({
                      ...form,
                      channel:
                        e.target.value,
                    })
                  }
                  className="w-full border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm bg-white"
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
                <label className="block text-sm font-semibold mb-1.5">
                  حالة الجمهور
                </label>

                <select
                  value={
                    form.audienceStatus
                  }
                  onChange={e =>
                    setForm({
                      ...form,
                      audienceStatus:
                        e.target.value,
                    })
                  }
                  className="w-full border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm bg-white"
                >
                  {audienceStatusOptions.map(
                    option => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">
                Tag الجمهور
              </label>

              <input
                value={form.tag}
                onChange={e =>
                  setForm({
                    ...form,
                    tag:
                      e.target.value,
                  })
                }
                placeholder="اختياري — مثال: VIP"
                className="w-full border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700"
              />

              <p className="text-xs text-ink-900/40 mt-1.5">
                اتركه فارغًا لاستهداف كل العملاء المطابقين للحالة.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">
                محتوى الرسالة
              </label>

              <textarea
                required
                rows={5}
                value={
                  form.messageBody
                }
                onChange={e =>
                  setForm({
                    ...form,
                    messageBody:
                      e.target.value,
                  })
                }
                placeholder="اكتب محتوى الحملة..."
                className="w-full border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">
                جدولة الإرسال
              </label>

              <input
                type="datetime-local"
                value={
                  form.scheduledAt
                }
                onChange={e =>
                  setForm({
                    ...form,
                    scheduledAt:
                      e.target.value,
                  })
                }
                className="w-full border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700"
              />

              <p className="text-xs text-ink-900/40 mt-1.5">
                ترك الحقل فارغًا ينشئ الحملة كمسودة.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={saving}
              >
                {saving
                  ? 'جاري الحفظ...'
                  : 'حفظ الحملة'}
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
          <div className="text-center py-14 text-sm text-ink-900/40">
            لا توجد حملات بعد
          </div>
        ) : (
          <Table
            head={[
              'اسم الحملة',
              'القناة',
              'الجمهور',
              'الحالة',
              'المستهدفون',
              'الإحصائيات',
              'الإجراءات',
            ]}
          >
            {campaigns.map(
              campaign => (
                <tr
                  key={
                    campaign.id
                  }
                  className="hover:bg-sand-50"
                >
                  <td className="py-3 px-3 font-semibold text-ink-950 min-w-[180px]">
                    {campaign.name}

                    {campaign.message_body && (
                      <div className="text-xs text-ink-900/40 font-normal mt-1 line-clamp-2">
                        {
                          campaign.message_body
                        }
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-3 text-sm whitespace-nowrap">
                    {
                      channelLabels[
                        campaign.channel
                      ] ||
                      campaign.channel
                    }
                  </td>

                  <td className="py-3 px-3 text-sm text-ink-900/60">
                    {campaign.audience ||
                      'كل العملاء'}
                  </td>

                  <td className="py-3 px-3">
                    <Badge
                      tone={statusTone(
                        campaign.status
                      )}
                    >
                      {
                        campaign.status
                      }
                    </Badge>
                  </td>

                  <td className="py-3 px-3 text-sm">
                    {
                      campaign.total_recipients ||
                      0
                    }
                  </td>

                  <td className="py-3 px-3 text-xs text-ink-900/60 whitespace-nowrap">
                    جاهزة:{' '}
                    {
                      campaign.queued_count
                    }
                    <br />
                    إرسال:{' '}
                    {
                      campaign.sent_count
                    }
                    <br />
                    تسليم:{' '}
                    {
                      campaign.delivered_count
                    }
                    <br />
                    فشل:{' '}
                    {
                      campaign.failed_count
                    }
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-2">
                      {(campaign.status ===
                        'مسودة' ||
                        campaign.status ===
                          'مجدولة') && (
                        <Button
                          variant="secondary"
                          disabled={
                            actionId ===
                            campaign.id
                          }
                          onClick={() =>
                            prepareCampaign(
                              campaign
                            )
                          }
                        >
                          {actionId ===
                          campaign.id
                            ? 'جاري التجهيز...'
                            : 'تجهيز الجمهور'}
                        </Button>
                      )}

                      {campaign.failed_count >
                        0 && (
                        <Button
                          variant="secondary"
                          disabled={
                            actionId ===
                            campaign.id
                          }
                          onClick={() =>
                            retryCampaign(
                              campaign
                            )
                          }
                        >
                          إعادة المحاولة
                        </Button>
                      )}

                      {campaign.status !==
                        'ملغاة' && (
                        <Button
                          variant="secondary"
                          disabled={
                            actionId ===
                            campaign.id
                          }
                          onClick={() =>
                            refreshCampaign(
                              campaign
                            )
                          }
                        >
                          تحديث
                        </Button>
                      )}

                      {campaign.status !==
                        'ملغاة' &&
                        campaign.status !==
                          'مكتملة' && (
                          <Button
                            variant="secondary"
                            disabled={
                              actionId ===
                              campaign.id
                            }
                            onClick={() =>
                              cancelCampaign(
                                campaign
                              )
                            }
                          >
                            إلغاء
                          </Button>
                        )}
                    </div>

                    {campaign.last_run_at && (
                      <div className="text-[11px] text-ink-900/35 mt-2">
                        آخر تحديث:{' '}
                        {formatDate(
                          campaign.last_run_at
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            )}
          </Table>
        )}
      </Card>
    </div>
  )
}
