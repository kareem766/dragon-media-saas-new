import React, { useEffect, useState } from 'react'
import { Card, Button, Badge } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

const tabs = [
  'بيانات الشركة',
  'الإشعارات',
  'التكاملات',
  'إعدادات واتساب',
  'إعدادات الذكاء الاصطناعي',
  'الفوترة',
]

interface OrgData {
  name: string
  manager_name: string
  phone: string
  email: string
  address: string
  timezone: string
  business_type: string
  logo_url: string
}

interface NotificationPreferences {
  new_lead: boolean
  new_message: boolean
  overdue_tasks: boolean
  weekly_report_email: boolean
}

interface Integration {
  id: string
  organization_id: string | null
  provider: string
  connected: boolean | null
  status: string
  config: Record<string, unknown> | null
  metadata: Record<string, unknown>
  connected_at: string | null
  last_verified_at: string | null
  error_message: string | null
  updated_at: string | null
}

const initialOrg: OrgData = {
  name: '',
  manager_name: '',
  phone: '',
  email: '',
  address: '',
  timezone: 'Africa/Cairo',
  business_type: '',
  logo_url: '',
}

const initialNotificationPreferences: NotificationPreferences = {
  new_lead: true,
  new_message: true,
  overdue_tasks: true,
  weekly_report_email: false,
}

const integrationProviders = [
  {
    provider: 'whatsapp',
    name: 'واتساب بيزنس',
    description: 'ربط WhatsApp Business واستقبال وإرسال الرسائل.',
  },
  {
    provider: 'facebook',
    name: 'فيسبوك ماسنجر',
    description: 'ربط صفحات Facebook وإدارة محادثات Messenger.',
  },
  {
    provider: 'instagram',
    name: 'إنستجرام',
    description: 'ربط حساب Instagram وإدارة الرسائل.',
  },
  {
    provider: 'telegram',
    name: 'تليجرام',
    description: 'ربط Telegram Bot وإدارة المحادثات.',
  },
  {
    provider: 'paymob',
    name: 'بوابة الدفع',
    description: 'ربط بوابة الدفع والعمليات المالية.',
  },
]

export default function Settings() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization()

  const [active, setActive] = useState(tabs[0])

  const [org, setOrg] = useState<OrgData>(initialOrg)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences>(initialNotificationPreferences)

  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsSaving, setNotificationsSaving] = useState(false)
  const [notificationsSaved, setNotificationsSaved] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')

  // Integrations
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [integrationsLoading, setIntegrationsLoading] = useState(false)
  const [integrationsError, setIntegrationsError] = useState('')

  const updateOrg = (field: keyof OrgData, value: string) => {
    setOrg(prev => ({
      ...prev,
      [field]: value,
    }))

    setSaved(false)
    setError('')
  }

  /*
   * Load organization
   */
  useEffect(() => {
    const loadOrganization = async () => {
      if (!organizationId || !supabase) return

      setLoading(true)
      setError('')

      try {
        const { data, error: fetchError } = await supabase
          .from('organizations')
          .select(
            'name, manager_name, phone, email, address, timezone, business_type, logo_url'
          )
          .eq('id', organizationId)
          .single()

        if (fetchError) {
          throw fetchError
        }

        if (data) {
          setOrg({
            name: data.name ?? '',
            manager_name: data.manager_name ?? '',
            phone: data.phone ?? '',
            email: data.email ?? '',
            address: data.address ?? '',
            timezone: data.timezone ?? 'Africa/Cairo',
            business_type: data.business_type ?? '',
            logo_url: data.logo_url ?? '',
          })
        }
      } catch (err: any) {
        setError(
          err?.message || 'تعذر تحميل بيانات الشركة.'
        )
      } finally {
        setLoading(false)
      }
    }

    loadOrganization()
  }, [organizationId])

  /*
   * Load notification preferences
   */
  useEffect(() => {
    const loadNotificationPreferences = async () => {
      if (!organizationId || !supabase) return

      setNotificationsLoading(true)
      setNotificationsError('')

      try {
        const {
          data: userData,
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          throw userError
        }

        const userId = userData.user?.id

        if (!userId) {
          throw new Error('تعذر تحديد المستخدم الحالي.')
        }

        const {
          data,
          error: fetchError,
        } = await supabase
          .from('notification_preferences')
          .select(
            'new_lead, new_message, overdue_tasks, weekly_report_email'
          )
          .eq('user_id', userId)
          .maybeSingle()

        if (fetchError) {
          throw fetchError
        }

        if (data) {
          setNotificationPreferences({
            new_lead: data.new_lead ?? true,
            new_message: data.new_message ?? true,
            overdue_tasks: data.overdue_tasks ?? true,
            weekly_report_email: data.weekly_report_email ?? false,
          })
        } else {
          const {
            data: createdData,
            error: createError,
          } = await supabase
            .from('notification_preferences')
            .insert({
              user_id: userId,
              organization_id: organizationId,
              ...initialNotificationPreferences,
            })
            .select(
              'new_lead, new_message, overdue_tasks, weekly_report_email'
            )
            .single()

          if (createError) {
            throw createError
          }

          if (createdData) {
            setNotificationPreferences({
              new_lead: createdData.new_lead ?? true,
              new_message: createdData.new_message ?? true,
              overdue_tasks: createdData.overdue_tasks ?? true,
              weekly_report_email:
                createdData.weekly_report_email ?? false,
            })
          }
        }
      } catch (err: any) {
        setNotificationsError(
          err?.message ||
            'تعذر تحميل إعدادات الإشعارات.'
        )
      } finally {
        setNotificationsLoading(false)
      }
    }

    loadNotificationPreferences()
  }, [organizationId])

  /*
   * Load integrations from Supabase
   */
  const loadIntegrations = async () => {
    if (!organizationId || !supabase) return

    setIntegrationsLoading(true)
    setIntegrationsError('')

    try {
      const {
        data,
        error: fetchError,
      } = await supabase
        .from('integrations')
        .select(
          `
.select(
  `
    id,
    organization_id,
    provider,
    connected,
    status,
    metadata,
    connected_at,
    last_verified_at,
    error_message,
    updated_at
  `
)
        .eq('organization_id', organizationId)
        .order('provider', {
          ascending: true,
        })

      if (fetchError) {
        throw fetchError
      }

      setIntegrations(data ?? [])
    } catch (err: any) {
      setIntegrationsError(
        err?.message ||
          'تعذر تحميل حالة التكاملات.'
      )
    } finally {
      setIntegrationsLoading(false)
    }
  }

  /*
   * Load integrations when organization is ready
   */
  useEffect(() => {
    if (!organizationId) return

    loadIntegrations()
  }, [organizationId])

  /*
   * Find integration by provider
   */
  const getIntegration = (provider: string) => {
    return integrations.find(
      integration =>
        integration.provider.toLowerCase() ===
        provider.toLowerCase()
    )
  }

  /*
   * Determine whether integration is connected
   */
  const isIntegrationConnected = (
    integration?: Integration
  ) => {
    if (!integration) return false

    return (
      integration.connected === true ||
      integration.status === 'connected' ||
      integration.status === 'active'
    )
  }

  /*
   * Human readable status
   */
  const getIntegrationStatus = (
    integration?: Integration
  ) => {
    if (!integration) {
      return {
        label: 'غير متصل',
        tone: undefined as
          | 'success'
          | 'warning'
          | undefined,
      }
    }

    if (isIntegrationConnected(integration)) {
      return {
        label: 'متصل',
        tone: 'success' as const,
      }
    }

    if (
      integration.status === 'pending' ||
      integration.status === 'connecting'
    ) {
      return {
        label: 'جاري الربط',
        tone: 'warning' as const,
      }
    }

    if (
      integration.status === 'error' ||
      integration.error_message
    ) {
      return {
        label: 'يوجد خطأ',
        tone: 'warning' as const,
      }
    }

    return {
      label: 'غير متصل',
      tone: undefined as
        | 'success'
        | 'warning'
        | undefined,
    }
  }

  /*
   * Validate organization
   */
  const validate = () => {
    if (!org.name.trim()) {
      return 'اسم الشركة مطلوب.'
    }

    if (org.email.trim()) {
      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/

      if (!emailRegex.test(org.email.trim())) {
        return 'يرجى إدخال بريد إلكتروني صحيح.'
      }
    }

    if (org.phone.trim()) {
      const phoneDigits =
        org.phone.replace(/\D/g, '')

      if (
        phoneDigits.length < 8 ||
        phoneDigits.length > 15
      ) {
        return 'يرجى إدخال رقم هاتف صحيح.'
      }
    }

    return null
  }

  /*
   * Save organization
   */
  const handleSave = async () => {
    if (!supabase || !organizationId) return

    setSaved(false)
    setError('')

    const validationError = validate()

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)

    try {
      const {
        error: updateError,
      } = await supabase
        .from('organizations')
        .update({
          name: org.name.trim(),
          manager_name:
            org.manager_name.trim() || null,
          phone: org.phone.trim() || null,
          email: org.email.trim() || null,
          address: org.address.trim() || null,
          timezone:
            org.timezone || 'Africa/Cairo',
          business_type:
            org.business_type || null,
          logo_url:
            org.logo_url.trim() || null,
        })
        .eq('id', organizationId)

      if (updateError) {
        throw updateError
      }

      setSaved(true)

      window.setTimeout(() => {
        setSaved(false)
      }, 2500)
    } catch (err: any) {
      setError(
        err?.message ||
          'تعذر حفظ بيانات الشركة. حاول مرة أخرى.'
      )
    } finally {
      setSaving(false)
    }
  }

  /*
   * Notification preference update
   */
  const updateNotificationPreference = (
    field: keyof NotificationPreferences,
    value: boolean
  ) => {
    setNotificationPreferences(prev => ({
      ...prev,
      [field]: value,
    }))

    setNotificationsSaved(false)
    setNotificationsError('')
  }

  /*
   * Save notification preferences
   */
  const handleSaveNotificationPreferences =
    async () => {
      if (!supabase || !organizationId) return

      setNotificationsSaving(true)
      setNotificationsSaved(false)
      setNotificationsError('')

      try {
        const {
          data: userData,
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          throw userError
        }

        const userId = userData.user?.id

        if (!userId) {
          throw new Error(
            'تعذر تحديد المستخدم الحالي.'
          )
        }

        const {
          error: upsertError,
        } = await supabase
          .from('notification_preferences')
          .upsert(
            {
              user_id: userId,
              organization_id: organizationId,
              new_lead:
                notificationPreferences.new_lead,
              new_message:
                notificationPreferences.new_message,
              overdue_tasks:
                notificationPreferences.overdue_tasks,
              weekly_report_email:
                notificationPreferences.weekly_report_email,
              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict: 'user_id',
            }
          )

        if (upsertError) {
          throw upsertError
        }

        setNotificationsSaved(true)

        window.setTimeout(() => {
          setNotificationsSaved(false)
        }, 2500)
      } catch (err: any) {
        setNotificationsError(
          err?.message ||
            'تعذر حفظ إعدادات الإشعارات.'
        )
      } finally {
        setNotificationsSaving(false)
      }
    }

  if (orgLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (orgError || !organizationId) {
    return (
      <div className="text-center py-20 text-sm text-red-600">
        {orgError ??
          'تعذر تحديد المؤسسة الخاصة بحسابك'}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
      <nav className="space-y-1">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`w-full text-right px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              active === tab
                ? 'bg-ink-900 text-sand-50'
                : 'text-ink-900/60 hover:bg-sand-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      <Card className="p-6">
        {/* Company */}
        {active === 'بيانات الشركة' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 className="text-lg font-semibold text-ink-900">
                بيانات الشركة
              </h2>

              <p className="text-sm text-ink-900/50 mt-1">
                هذه البيانات مرتبطة بحساب مؤسستك ويتم استخدامها داخل Dragon Media.
              </p>
            </div>

            {/* Logo */}
            <div className="border border-sand-200 rounded-xl p-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border border-sand-200 bg-sand-50 flex items-center justify-center overflow-hidden shrink-0">
                  {org.logo_url ? (
                    <img
                      src={org.logo_url}
                      alt={
                        org.name ||
                        'شعار الشركة'
                      }
                      className="w-full h-full object-contain"
                      onError={e => {
                        e.currentTarget.style.display =
                          'none'
                      }}
                    />
                  ) : (
                    <span className="text-xs text-ink-900/40 text-center px-2">
                      لا يوجد شعار
                    </span>
                  )}
                </div>

                <div className="flex-1">
                  <label className="text-xs text-ink-900/50">
                    رابط شعار الشركة
                  </label>

                  <input
                    value={org.logo_url}
                    onChange={e =>
                      updateOrg(
                        'logo_url',
                        e.target.value
                      )
                    }
                    placeholder="https://..."
                    dir="ltr"
                    className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700"
                  />

                  <p className="text-xs text-ink-900/40 mt-1.5">
                    أدخل رابط صورة الشعار لحفظه مع بيانات الشركة.
                  </p>
                </div>
              </div>
            </div>

            <Field
              label="اسم الشركة"
              required
              value={org.name}
              onChange={value =>
                updateOrg('name', value)
              }
            />

            <Field
              label="اسم المسؤول / المدير"
              value={org.manager_name}
              onChange={value =>
                updateOrg(
                  'manager_name',
                  value
                )
              }
            />

            <div>
              <label className="text-xs text-ink-900/50">
                نوع النشاط
              </label>

              <select
                value={org.business_type}
                onChange={e =>
                  updateOrg(
                    'business_type',
                    e.target.value
                  )
                }
                className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white"
              >
                <option value="">
                  اختر نوع النشاط
                </option>
                <option value="عقارات">
                  عقارات
                </option>
                <option value="مطاعم">
                  مطاعم
                </option>
                <option value="عيادات">
                  عيادات
                </option>
                <option value="تعليم">
                  مراكز تعليمية
                </option>
                <option value="سيارات">
                  معارض سيارات
                </option>
                <option value="تجارة إلكترونية">
                  تجارة إلكترونية
                </option>
                <option value="سوشيال ميديا">
                  تسويق وسوشيال ميديا
                </option>
                <option value="أخرى">
                  أخرى
                </option>
              </select>
            </div>

            <Field
              label="البريد الإلكتروني للتواصل"
              value={org.email}
              onChange={value =>
                updateOrg('email', value)
              }
              type="email"
              dir="ltr"
            />

            <Field
              label="رقم الهاتف"
              value={org.phone}
              onChange={value =>
                updateOrg('phone', value)
              }
              type="tel"
              dir="ltr"
              placeholder="+201012345678"
            />

            <div>
              <label className="text-xs text-ink-900/50">
                عنوان مقر الشركة
              </label>

              <textarea
                value={org.address}
                onChange={e =>
                  updateOrg(
                    'address',
                    e.target.value
                  )
                }
                rows={3}
                placeholder="أدخل عنوان مقر الشركة"
                className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-ink-900/50">
                المنطقة الزمنية
              </label>

              <select
                value={org.timezone}
                onChange={e =>
                  updateOrg(
                    'timezone',
                    e.target.value
                  )
                }
                className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white"
              >
                <option value="Africa/Cairo">
                  القاهرة — Africa/Cairo
                </option>
                <option value="Asia/Riyadh">
                  الرياض — Asia/Riyadh
                </option>
                <option value="Asia/Dubai">
                  دبي — Asia/Dubai
                </option>
                <option value="UTC">
                  UTC
                </option>
              </select>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {saved && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                تم حفظ بيانات الشركة بنجاح.
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={saving}
              >
                {saving
                  ? 'جاري الحفظ...'
                  : 'حفظ التغييرات'}
              </Button>

              {saving && (
                <span className="text-xs text-ink-900/40">
                  يتم حفظ البيانات...
                </span>
              )}
            </div>
          </div>
        )}

        {/* Notifications */}
        {active === 'الإشعارات' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 className="text-lg font-semibold text-ink-900">
                إعدادات الإشعارات
              </h2>

              <p className="text-sm text-ink-900/50 mt-1">
                تحكم في أنواع الإشعارات التي تريد استقبالها على حسابك.
              </p>
            </div>

            {notificationsLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-7 h-7 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <NotificationToggle
                    label="إشعار عند وجود عميل محتمل جديد"
                    description="استقبل إشعارًا عند إضافة Lead جديد إلى مؤسستك."
                    checked={
                      notificationPreferences.new_lead
                    }
                    onChange={value =>
                      updateNotificationPreference(
                        'new_lead',
                        value
                      )
                    }
                  />

                  <NotificationToggle
                    label="إشعار عند رسالة جديدة في الإنبوكس"
                    description="استقبل إشعارًا عند وصول رسالة جديدة."
                    checked={
                      notificationPreferences.new_message
                    }
                    onChange={value =>
                      updateNotificationPreference(
                        'new_message',
                        value
                      )
                    }
                  />

                  <NotificationToggle
                    label="تذكير بالمهام المتأخرة"
                    description="استقبل تنبيهًا عند وجود مهام تجاوزت موعدها."
                    checked={
                      notificationPreferences.overdue_tasks
                    }
                    onChange={value =>
                      updateNotificationPreference(
                        'overdue_tasks',
                        value
                      )
                    }
                  />

                  <NotificationToggle
                    label="تقرير أداء أسبوعي بالبريد"
                    description="استقبل ملخصًا أسبوعيًا لأداء مؤسستك عبر البريد الإلكتروني."
                    checked={
                      notificationPreferences.weekly_report_email
                    }
                    onChange={value =>
                      updateNotificationPreference(
                        'weekly_report_email',
                        value
                      )
                    }
                  />
                </div>

                {notificationsError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {notificationsError}
                  </div>
                )}

                {notificationsSaved && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    تم حفظ إعدادات الإشعارات بنجاح.
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={
                      handleSaveNotificationPreferences
                    }
                    disabled={
                      notificationsSaving
                    }
                  >
                    {notificationsSaving
                      ? 'جاري الحفظ...'
                      : 'حفظ إعدادات الإشعارات'}
                  </Button>

                  {notificationsSaving && (
                    <span className="text-xs text-ink-900/40">
                      يتم حفظ الإعدادات...
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Integrations */}
        {active === 'التكاملات' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink-900">
                    التكاملات
                  </h2>

                  <p className="text-sm text-ink-900/50 mt-1">
                    حالة التكاملات الخاصة بمؤسستك من قاعدة البيانات مباشرة.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadIntegrations}
                  disabled={integrationsLoading}
                  className="text-sm px-3 py-2 rounded-lg border border-sand-200 hover:bg-sand-50 transition-colors disabled:opacity-50"
                >
                  {integrationsLoading
                    ? 'جاري التحديث...'
                    : 'تحديث الحالة'}
                </button>
              </div>
            </div>

            {integrationsError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {integrationsError}
              </div>
            )}

            {integrationsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {integrationProviders.map(item => {
                  const integration =
                    getIntegration(
                      item.provider
                    )

                  const status =
                    getIntegrationStatus(
                      integration
                    )

                  const connected =
                    isIntegrationConnected(
                      integration
                    )

                  return (
                    <div
                      key={item.provider}
                      className={`border rounded-xl p-5 transition-colors ${
                        connected
                          ? 'border-emerald-200 bg-emerald-50/40'
                          : 'border-sand-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-ink-900">
                            {item.name}
                          </div>

                          <p className="text-xs text-ink-900/50 mt-1.5 leading-5">
                            {item.description}
                          </p>
                        </div>

                        <Badge
                          tone={
                            status.tone
                          }
                        >
                          {status.label}
                        </Badge>
                      </div>

                      {integration?.connected_at && (
                        <div className="mt-4 pt-3 border-t border-sand-200/70">
                          <div className="text-xs text-ink-900/45">
                            تاريخ الاتصال
                          </div>

                          <div
                            className="text-xs text-ink-900/70 mt-1"
                            dir="ltr"
                          >
                            {new Date(
                              integration.connected_at
                            ).toLocaleString(
                              'ar-EG'
                            )}
                          </div>
                        </div>
                      )}

                      {integration?.last_verified_at && (
                        <div className="mt-3">
                          <div className="text-xs text-ink-900/45">
                            آخر تحقق
                          </div>

                          <div
                            className="text-xs text-ink-900/70 mt-1"
                            dir="ltr"
                          >
                            {new Date(
                              integration.last_verified_at
                            ).toLocaleString(
                              'ar-EG'
                            )}
                          </div>
                        </div>
                      )}

                      {integration?.error_message && (
                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          {integration.error_message}
                        </div>
                      )}

                      <div className="mt-4 text-xs text-ink-900/40">
                        {integration
                          ? `Provider: ${integration.provider}`
                          : 'لم يتم إنشاء سجل لهذا التكامل بعد.'}
                      </div>
                    </div>
                  )
                })}

                {/* Supabase */}
                <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-ink-900">
                        Supabase
                      </div>

                      <p className="text-xs text-ink-900/50 mt-1.5">
                        قاعدة البيانات والمصادقة الخاصة بالمنصة.
                      </p>
                    </div>

                    <Badge tone="success">
                      متصل
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* WhatsApp */}
        {active === 'إعدادات واتساب' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 className="text-lg font-semibold text-ink-900">
                إعدادات واتساب
              </h2>

              <p className="text-sm text-ink-900/50 mt-1">
                سيتم التحكم في إعدادات WhatsApp Business من خلال التكامل الرسمي مع Meta.
              </p>
            </div>

            {(() => {
              const whatsapp =
                getIntegration('whatsapp')

              const connected =
                isIntegrationConnected(
                  whatsapp
                )

              const status =
                getIntegrationStatus(
                  whatsapp
                )

              return (
                <div
                  className={`border rounded-xl p-5 ${
                    connected
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : 'border-sand-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-sm text-ink-900">
                        WhatsApp Business
                      </div>

                      <p className="text-xs text-ink-900/50 mt-1">
                        الحالة الحالية مأخوذة مباشرة من Supabase.
                      </p>
                    </div>

                    <Badge
                      tone={status.tone}
                    >
                      {status.label}
                    </Badge>
                  </div>

                  {whatsapp?.metadata &&
                    Object.keys(
                      whatsapp.metadata
                    ).length > 0 && (
                      <div className="mt-4 border-t border-sand-200 pt-4">
                        <div className="text-xs font-medium text-ink-900/60 mb-2">
                          معلومات الاتصال
                        </div>

                        <pre
                          dir="ltr"
                          className="text-xs bg-white border border-sand-200 rounded-lg p-3 overflow-auto"
                        >
                          {JSON.stringify(
                            whatsapp.metadata,
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}

                  {whatsapp?.error_message && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {whatsapp.error_message}
                    </div>
                  )}

                  {!whatsapp && (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      حساب WhatsApp Business غير مربوط حتى الآن.
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* AI */}
        {active === 'إعدادات الذكاء الاصطناعي' && (
          <div className="max-w-md">
            <p className="text-sm text-ink-900/55">
              RYAN يعمل حاليًا بـ Google Gemini. إعدادات مخصصة أكثر ستُضاف لاحقًا.
            </p>
          </div>
        )}

        {/* Billing */}
        {active === 'الفوترة' && (
          <div className="max-w-md">
            <p className="text-sm text-ink-900/55">
              سيتم تفعيل هذا القسم بعد ربط بوابة دفع حقيقية.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}

function NotificationToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-4 border border-sand-200 rounded-xl px-4 py-4 cursor-pointer hover:bg-sand-50 transition-colors">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink-900">
          {label}
        </div>

        <div className="text-xs text-ink-900/45 mt-1">
          {description}
        </div>
      </div>

      <input
        type="checkbox"
        checked={checked}
        onChange={e =>
          onChange(e.target.checked)
        }
        className="w-5 h-5 accent-ink-900 shrink-0"
      />
    </label>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  dir,
  required = false,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  dir?: 'rtl' | 'ltr'
  required?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs text-ink-900/50">
        {label}

        {required && (
          <span className="text-red-500 mr-1">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        value={value}
        dir={dir}
        placeholder={placeholder}
        onChange={e =>
          onChange(e.target.value)
        }
        className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700"
      />
    </div>
  )
}
