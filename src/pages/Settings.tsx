import { useEffect, useState } from 'react'
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
    description:
      'ربط WhatsApp Business واستقبال وإرسال الرسائل.',
    actionLabel: 'ربط WhatsApp',
    connectedActionLabel: 'إدارة WhatsApp',
    meta: true,
  },
  {
    provider: 'facebook',
    name: 'فيسبوك ماسنجر',
    description:
      'ربط صفحات Facebook وإدارة محادثات Messenger.',
    actionLabel: 'ربط Facebook',
    connectedActionLabel: 'إدارة Facebook',
    meta: true,
  },
  {
    provider: 'instagram',
    name: 'إنستجرام',
    description:
      'ربط حساب Instagram وإدارة الرسائل.',
    actionLabel: 'ربط Instagram',
    connectedActionLabel: 'إدارة Instagram',
    meta: true,
  },
  {
    provider: 'telegram',
    name: 'تليجرام',
    description:
      'ربط Telegram Bot وإدارة المحادثات.',
    actionLabel: 'إعداد Telegram',
    connectedActionLabel: 'إدارة Telegram',
    meta: false,
  },
  {
    provider: 'paymob',
    name: 'بوابة الدفع',
    description:
      'حالة تكامل بوابة الدفع والعمليات المالية.',
    actionLabel: 'إعداد Paymob',
    connectedActionLabel: 'إدارة Paymob',
    meta: false,
  },
]

export default function Settings() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization()

  const [active, setActive] = useState(tabs[0])

  const [org, setOrg] =
    useState<OrgData>(initialOrg)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [
    notificationPreferences,
    setNotificationPreferences,
  ] = useState<NotificationPreferences>(
    initialNotificationPreferences
  )

  const [
    notificationsLoading,
    setNotificationsLoading,
  ] = useState(false)

  const [
    notificationsSaving,
    setNotificationsSaving,
  ] = useState(false)

  const [
    notificationsSaved,
    setNotificationsSaved,
  ] = useState(false)

  const [
    notificationsError,
    setNotificationsError,
  ] = useState('')

  const [integrations, setIntegrations] =
    useState<Integration[]>([])

  const [
    integrationsLoading,
    setIntegrationsLoading,
  ] = useState(false)

  const [
    integrationsError,
    setIntegrationsError,
  ] = useState('')

  const [
    metaConnecting,
    setMetaConnecting,
  ] = useState(false)

  const [
    metaConnectionError,
    setMetaConnectionError,
  ] = useState('')

  const updateOrg = (
    field: keyof OrgData,
    value: string
  ) => {
    setOrg(prev => ({
      ...prev,
      [field]: value,
    }))

    setSaved(false)
    setError('')
  }

  useEffect(() => {
    const loadOrganization = async () => {
      if (!organizationId || !supabase) {
        return
      }

      setLoading(true)
      setError('')

      try {
        const {
          data,
          error: fetchError,
        } = await supabase
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
            manager_name:
              data.manager_name ?? '',
            phone: data.phone ?? '',
            email: data.email ?? '',
            address: data.address ?? '',
            timezone:
              data.timezone ?? 'Africa/Cairo',
            business_type:
              data.business_type ?? '',
            logo_url: data.logo_url ?? '',
          })
        }
      } catch (err: any) {
        setError(
          err?.message ||
            'تعذر تحميل بيانات الشركة.'
        )
      } finally {
        setLoading(false)
      }
    }

    loadOrganization()
  }, [organizationId])

  useEffect(() => {
    const loadNotificationPreferences =
      async () => {
        if (!organizationId || !supabase) {
          return
        }

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
            throw new Error(
              'تعذر تحديد المستخدم الحالي.'
            )
          }

          const {
            data,
            error: fetchError,
          } = await supabase
            .from(
              'notification_preferences'
            )
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
              new_lead:
                data.new_lead ?? true,
              new_message:
                data.new_message ?? true,
              overdue_tasks:
                data.overdue_tasks ?? true,
              weekly_report_email:
                data.weekly_report_email ??
                false,
            })
          } else {
            const {
              data: createdData,
              error: createError,
            } = await supabase
              .from(
                'notification_preferences'
              )
              .insert({
                user_id: userId,
                organization_id:
                  organizationId,
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
                new_lead:
                  createdData.new_lead ??
                  true,
                new_message:
                  createdData.new_message ??
                  true,
                overdue_tasks:
                  createdData.overdue_tasks ??
                  true,
                weekly_report_email:
                  createdData.weekly_report_email ??
                  false,
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

  const loadIntegrations = async () => {
    if (!organizationId || !supabase) {
      return
    }

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
        .eq(
          'organization_id',
          organizationId
        )
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

  useEffect(() => {
    if (!organizationId) {
      return
    }

    loadIntegrations()
  }, [organizationId])

  const getIntegration = (
    provider: string
  ) => {
    return integrations.find(
      integration =>
        integration.provider.toLowerCase() ===
        provider.toLowerCase()
    )
  }

  const isIntegrationConnected = (
    integration?: Integration
  ) => {
    if (!integration) {
      return false
    }

    return (
      integration.connected === true ||
      integration.status === 'connected' ||
      integration.status === 'active'
    )
  }

  const getIntegrationStatus = (
    integration?: Integration
  ) => {
    if (!integration) {
      return {
        label: 'غير متصل',
        tone: 'neutral' as const,
      }
    }

    if (
      isIntegrationConnected(integration)
    ) {
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
        tone: 'danger' as const,
      }
    }

    return {
      label: 'غير متصل',
      tone: 'neutral' as const,
    }
  }

  const handleMetaConnect = async () => {
    if (!supabase) {
      setMetaConnectionError(
        'تعذر الاتصال بخدمة المصادقة.'
      )
      return
    }

    if (metaConnecting) {
      return
    }

    setMetaConnecting(true)
    setMetaConnectionError('')

    try {
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        throw sessionError
      }

      const accessToken =
        sessionData.session?.access_token

      if (!accessToken) {
        throw new Error(
          'يرجى تسجيل الدخول مرة أخرى ثم محاولة ربط Meta.'
        )
      }

      const response = await fetch(
        '/api/meta/oauth/start',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
          cache: 'no-store',
        }
      )

      const data = await response
        .json()
        .catch(() => null)

      if (
        !response.ok ||
        !data?.auth_url
      ) {
        throw new Error(
          data?.error ||
            'تعذر بدء عملية ربط Meta. حاول مرة أخرى.'
        )
      }

      window.location.assign(
        data.auth_url
      )
    } catch (err: any) {
      setMetaConnectionError(
        err?.message ||
          'تعذر بدء ربط Meta. حاول مرة أخرى.'
      )
      setMetaConnecting(false)
    }
  }

  const validate = () => {
    if (!org.name.trim()) {
      return 'اسم الشركة مطلوب.'
    }

    if (org.email.trim()) {
      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/

      if (
        !emailRegex.test(
          org.email.trim()
        )
      ) {
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

  const handleSave = async () => {
    if (!supabase || !organizationId) {
      return
    }

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
            org.manager_name.trim() ||
            null,
          phone:
            org.phone.trim() || null,
          email:
            org.email.trim() || null,
          address:
            org.address.trim() || null,
          timezone:
            org.timezone ||
            'Africa/Cairo',
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

  const handleSaveNotificationPreferences =
    async () => {
      if (!supabase || !organizationId) {
        return
      }

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
              organization_id:
                organizationId,
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
      <div
        dir="rtl"
        className="mx-auto w-full max-w-6xl space-y-6 pb-8"
      >
        <div className="space-y-2">
          <div className="h-3.5 w-24 animate-pulse rounded-lg bg-sand-200" />
          <div className="h-8 w-32 animate-pulse rounded-lg bg-sand-200" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded-lg bg-sand-100" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
          <div className="hidden space-y-2 lg:block">
            {tabs.map(tab => (
              <div
                key={tab}
                className="h-11 animate-pulse rounded-xl bg-sand-100"
              />
            ))}
          </div>

          <div className="overflow-hidden rounded-3xl border border-sand-200 bg-white">
            <div className="h-20 animate-pulse border-b border-sand-100 bg-sand-50" />
            <div className="space-y-5 p-6 sm:p-8">
              {[1, 2, 3, 4, 5].map(item => (
                <div
                  key={item}
                  className="space-y-2"
                >
                  <div className="h-3.5 w-28 animate-pulse rounded bg-sand-100" />
                  <div className="h-11 animate-pulse rounded-xl bg-sand-100" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (orgError || !organizationId) {
    return (
      <div
        dir="rtl"
        className="mx-auto w-full max-w-6xl py-8"
      >
        <div
          className="rounded-3xl border border-red-200 bg-red-50 p-6"
          role="alert"
        >
          <p className="text-sm font-semibold text-red-800">
            {orgError ||
              'تعذر تحديد المؤسسة الخاصة بحسابك.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      dir="rtl"
      className="mx-auto w-full max-w-6xl space-y-6 pb-8"
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span className="text-xs font-bold text-ink-900/50">
            إدارة المنصة
          </span>
        </div>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
          الإعدادات
        </h1>

        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-900/55">
          إدارة بيانات الشركة والإشعارات والتكاملات وإعدادات الخدمات المرتبطة بحسابك.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <nav
            className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible"
            aria-label="أقسام الإعدادات"
          >
            {tabs.map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActive(tab)}
                className={`shrink-0 rounded-xl px-4 py-3 text-right text-sm font-bold transition-all duration-200 lg:w-full ${
                  active === tab
                    ? 'bg-ink-950 text-white shadow-sm'
                    : 'border border-sand-200 bg-white text-ink-900/65 hover:border-sand-300 hover:bg-sand-50 hover:text-ink-950'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <main className="min-w-0 overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-sm">
          {active === 'بيانات الشركة' && (
            <CompanySection
              org={org}
              error={error}
              saved={saved}
              saving={saving}
              updateOrg={updateOrg}
              handleSave={handleSave}
            />
          )}

          {active === 'الإشعارات' && (
            <NotificationsSection
              preferences={
                notificationPreferences
              }
              loading={
                notificationsLoading
              }
              saving={
                notificationsSaving
              }
              saved={notificationsSaved}
              error={notificationsError}
              updatePreference={
                updateNotificationPreference
              }
              onSave={
                handleSaveNotificationPreferences
              }
            />
          )}

          {active === 'التكاملات' && (
            <IntegrationsSection
              integrations={integrations}
              loading={integrationsLoading}
              error={integrationsError}
              loadIntegrations={
                loadIntegrations
              }
              getIntegration={
                getIntegration
              }
              getIntegrationStatus={
                getIntegrationStatus
              }
              onMetaConnect={
                handleMetaConnect
              }
              metaConnecting={
                metaConnecting
              }
              metaConnectionError={
                metaConnectionError
              }
            />
          )}

          {active === 'إعدادات واتساب' && (
            <WhatsAppSection
              integration={getIntegration(
                'whatsapp'
              )}
              status={getIntegrationStatus(
                getIntegration('whatsapp')
              )}
              onMetaConnect={
                handleMetaConnect
              }
              metaConnecting={
                metaConnecting
              }
              metaConnectionError={
                metaConnectionError
              }
            />
          )}

          {active ===
            'إعدادات الذكاء الاصطناعي' && (
            <AISection />
          )}

          {active === 'الفوترة' && (
            <BillingSection />
          )}
        </main>
      </div>
    </div>
  )
}

function CompanySection({
  org,
  error,
  saved,
  saving,
  updateOrg,
  handleSave,
}: {
  org: OrgData
  error: string
  saved: boolean
  saving: boolean
  updateOrg: (
    field: keyof OrgData,
    value: string
  ) => void
  handleSave: () => void
}) {
  return (
    <section>
      <SectionHeader
        eyebrow="بيانات المؤسسة"
        title="بيانات الشركة"
        description="هذه البيانات مرتبطة بحساب مؤسستك ويتم استخدامها داخل Dragon Media."
      />

      <div className="space-y-6 p-6 sm:p-8">
        <div className="rounded-2xl border border-sand-200 bg-gradient-to-l from-amber-50/70 via-white to-sand-50 p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
              {org.logo_url ? (
                <img
                  src={org.logo_url}
                  alt={
                    org.name ||
                    'شعار الشركة'
                  }
                  className="h-full w-full object-contain p-2"
                  onError={event => {
                    event.currentTarget.style.display =
                      'none'
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-ink-950 text-xs font-bold text-amber-400">
                  شعار الشركة
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-ink-950">
                شعار الشركة
              </h3>

              <p className="mt-1 text-xs leading-5 text-ink-900/50">
                أضف رابط صورة الشعار ليظهر داخل حساب الشركة.
              </p>

              <input
                value={org.logo_url}
                onChange={event =>
                  updateOrg(
                    'logo_url',
                    event.target.value
                  )
                }
                placeholder="https://..."
                dir="ltr"
                className="mt-3 w-full rounded-xl border border-sand-300 bg-white px-4 py-3 text-left text-sm text-ink-950 outline-none transition placeholder:text-ink-900/30 focus:border-ink-900/30 focus:ring-4 focus:ring-amber-100"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
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
            <label
              htmlFor="business-type"
              className="mb-2 block text-sm font-bold text-ink-900"
            >
              نوع النشاط
            </label>

            <select
              id="business-type"
              value={org.business_type}
              onChange={event =>
                updateOrg(
                  'business_type',
                  event.target.value
                )
              }
              className="w-full rounded-xl border border-sand-300 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-ink-900/30 focus:ring-4 focus:ring-amber-100"
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

          <div className="md:col-span-2">
            <label
              htmlFor="company-address"
              className="mb-2 block text-sm font-bold text-ink-900"
            >
              عنوان مقر الشركة
            </label>

            <textarea
              id="company-address"
              value={org.address}
              onChange={event =>
                updateOrg(
                  'address',
                  event.target.value
                )
              }
              rows={3}
              placeholder="أدخل عنوان مقر الشركة"
              className="w-full resize-none rounded-xl border border-sand-300 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/30 focus:border-ink-900/30 focus:ring-4 focus:ring-amber-100"
            />
          </div>

          <div>
            <label
              htmlFor="company-timezone"
              className="mb-2 block text-sm font-bold text-ink-900"
            >
              المنطقة الزمنية
            </label>

            <select
              id="company-timezone"
              value={org.timezone}
              onChange={event =>
                updateOrg(
                  'timezone',
                  event.target.value
                )
              }
              className="w-full rounded-xl border border-sand-300 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-ink-900/30 focus:ring-4 focus:ring-amber-100"
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
        </div>

        {error && (
          <MessageBox
            type="error"
            message={error}
          />
        )}

        {saved && (
          <MessageBox
            type="success"
            message="تم حفظ بيانات الشركة بنجاح."
          />
        )}

        <div className="flex flex-col gap-3 border-t border-sand-100 pt-6 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-ink-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}

            {saving
              ? 'جاري الحفظ...'
              : 'حفظ التغييرات'}
          </button>

          <span className="text-xs text-ink-900/40">
            يتم حفظ التعديلات مباشرة على بيانات المؤسسة.
          </span>
        </div>
      </div>
    </section>
  )
}

function NotificationsSection({
  preferences,
  loading,
  saving,
  saved,
  error,
  updatePreference,
  onSave,
}: {
  preferences: NotificationPreferences
  loading: boolean
  saving: boolean
  saved: boolean
  error: string
  updatePreference: (
    field: keyof NotificationPreferences,
    value: boolean
  ) => void
  onSave: () => void
}) {
  return (
    <section>
      <SectionHeader
        eyebrow="التنبيهات"
        title="إعدادات الإشعارات"
        description="تحكم في أنواع الإشعارات التي تريد استقبالها على حسابك."
      />

      <div className="space-y-4 p-6 sm:p-8">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(item => (
              <div
                key={item}
                className="h-20 animate-pulse rounded-2xl bg-sand-100"
              />
            ))}
          </div>
        ) : (
          <>
            <NotificationToggle
              label="عميل محتمل جديد"
              description="استقبل إشعارًا عند إضافة Lead جديد إلى مؤسستك."
              checked={
                preferences.new_lead
              }
              onChange={value =>
                updatePreference(
                  'new_lead',
                  value
                )
              }
            />

            <NotificationToggle
              label="رسالة جديدة في الإنبوكس"
              description="استقبل إشعارًا عند وصول رسالة جديدة."
              checked={
                preferences.new_message
              }
              onChange={value =>
                updatePreference(
                  'new_message',
                  value
                )
              }
            />

            <NotificationToggle
              label="المهام المتأخرة"
              description="استقبل تنبيهًا عند وجود مهام تجاوزت موعدها."
              checked={
                preferences.overdue_tasks
              }
              onChange={value =>
                updatePreference(
                  'overdue_tasks',
                  value
                )
              }
            />

            <NotificationToggle
              label="تقرير أداء أسبوعي"
              description="استقبل ملخصًا أسبوعيًا لأداء مؤسستك عبر البريد الإلكتروني."
              checked={
                preferences.weekly_report_email
              }
              onChange={value =>
                updatePreference(
                  'weekly_report_email',
                  value
                )
              }
            />

            {error && (
              <MessageBox
                type="error"
                message={error}
              />
            )}

            {saved && (
              <MessageBox
                type="success"
                message="تم حفظ إعدادات الإشعارات بنجاح."
              />
            )}

            <div className="border-t border-sand-100 pt-6">
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="inline-flex min-w-44 items-center justify-center gap-2 rounded-xl bg-ink-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}

                {saving
                  ? 'جاري الحفظ...'
                  : 'حفظ إعدادات الإشعارات'}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function IntegrationsSection({
  integrations,
  loading,
  error,
  loadIntegrations,
  getIntegration,
  getIntegrationStatus,
  onMetaConnect,
  metaConnecting,
  metaConnectionError,
}: {
  integrations: Integration[]
  loading: boolean
  error: string
  loadIntegrations: () => void
  getIntegration: (
    provider: string
  ) => Integration | undefined
  getIntegrationStatus: (
    integration?: Integration
  ) => {
    label: string
    tone:
      | 'success'
      | 'warning'
      | 'danger'
      | 'neutral'
  }
  onMetaConnect: () => void
  metaConnecting: boolean
  metaConnectionError: string
}) {
  return (
    <section>
      <SectionHeader
        eyebrow="الاتصالات"
        title="التكاملات"
        description="حالة التكاملات الخاصة بمؤسستك مأخوذة مباشرة من Supabase."
        action={
          <button
            type="button"
            onClick={loadIntegrations}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-sand-300 bg-white px-4 py-2.5 text-xs font-bold text-ink-900 transition hover:bg-sand-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-900/20 border-t-ink-900" />
            )}

            {loading
              ? 'جاري التحديث...'
              : 'تحديث الحالة'}
          </button>
        }
      />

      <div className="p-6 sm:p-8">
        {metaConnectionError && (
          <div className="mb-5">
            <MessageBox
              type="error"
              message={metaConnectionError}
            />
          </div>
        )}

        {error && (
          <div className="mb-5">
            <MessageBox
              type="error"
              message={error}
            />
          </div>
        )}

        <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/60 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs font-black text-blue-700">
              M
            </div>

            <div>
              <div className="text-sm font-bold text-blue-900">
                ربط Meta الرسمي
              </div>

              <p className="mt-1 text-xs leading-5 text-blue-800/70">
                ربط Meta يتيح إعداد أصول WhatsApp Business وFacebook وInstagram الخاصة بشركتك من خلال الاتصال الرسمي. بيانات الاعتماد الحساسة لا يتم عرضها داخل لوحة التحكم.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4, 5].map(item => (
              <div
                key={item}
                className="h-40 animate-pulse rounded-2xl bg-sand-100"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
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
                status.label === 'متصل'

              const isMetaProvider =
                item.meta

              return (
                <div
                  key={item.provider}
                  className={`rounded-2xl border p-5 transition-all duration-200 ${
                    connected
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : status.label ===
                        'يوجد خطأ'
                      ? 'border-red-200 bg-red-50/30'
                      : 'border-sand-200 bg-white hover:border-sand-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                          connected
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-sand-100 text-ink-900/60'
                        }`}
                      >
                        {item.provider
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-ink-950">
                          {item.name}
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-ink-900/50">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <StatusBadge
                      label={status.label}
                      tone={status.tone}
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-sand-200/70 pt-4">
                    <div className="text-xs text-ink-900/40">
                      {connected
                        ? 'الاتصال مفعل'
                        : isMetaProvider
                          ? 'يتطلب اتصال Meta الرسمي'
                          : 'إعداد التكامل من لوحة الإدارة'}
                    </div>

                    {isMetaProvider ? (
                      <button
                        type="button"
                        onClick={
                          onMetaConnect
                        }
                        disabled={
                          metaConnecting
                        }
                        className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          connected
                            ? 'border border-sand-300 bg-white text-ink-900 hover:bg-sand-50'
                            : 'bg-ink-950 text-white hover:bg-ink-900'
                        }`}
                      >
                        {metaConnecting && (
                          <span
                            className={`h-3.5 w-3.5 animate-spin rounded-full border-2 ${
                              connected
                                ? 'border-ink-900/20 border-t-ink-900'
                                : 'border-white/30 border-t-white'
                            }`}
                          />
                        )}

                        {metaConnecting
                          ? 'جاري الربط...'
                          : connected
                            ? item.connectedActionLabel
                            : item.actionLabel}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="سيتم تفعيل تدفق الربط الخاص بهذا التكامل بعد اكتمال الـAPI الخاص به."
                        className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-xs font-bold text-ink-900/40"
                      >
                        {connected
                          ? item.connectedActionLabel
                          : item.actionLabel}
                      </button>
                    )}
                  </div>

                  {integration?.connected_at && (
                    <div className="mt-4">
                      <div className="text-[11px] font-semibold text-ink-900/40">
                        تاريخ الاتصال
                      </div>

                      <div
                        dir="ltr"
                        className="mt-1 text-xs font-medium text-ink-900/65"
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
                      <div className="text-[11px] font-semibold text-ink-900/40">
                        آخر تحقق
                      </div>

                      <div
                        dir="ltr"
                        className="mt-1 text-xs font-medium text-ink-900/65"
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
                    <div
                      className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium leading-5 text-red-700"
                      role="alert"
                    >
                      {integration.error_message}
                    </div>
                  )}

                  {!integration && (
                    <div className="mt-4 text-xs text-ink-900/40">
                      لم يتم إنشاء سجل لهذا التكامل بعد.
                    </div>
                  )}
                </div>
              )
            })}

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-xs font-black text-emerald-700">
                    SB
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-ink-950">
                      Supabase
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-ink-900/50">
                      قاعدة البيانات والمصادقة الخاصة بالمنصة.
                    </p>
                  </div>
                </div>

                <StatusBadge
                  label="متصل"
                  tone="success"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function WhatsAppSection({
  integration,
  status,
  onMetaConnect,
  metaConnecting,
  metaConnectionError,
}: {
  integration?: Integration
  status: {
    label: string
    tone:
      | 'success'
      | 'warning'
      | 'danger'
      | 'neutral'
  }
  onMetaConnect: () => void
  metaConnecting: boolean
  metaConnectionError: string
}) {
  return (
    <section>
      <SectionHeader
        eyebrow="Meta"
        title="إعدادات واتساب"
        description="حالة WhatsApp Business الحالية مأخوذة مباشرة من التكامل المرتبط بالمؤسسة."
      />

      <div className="p-6 sm:p-8">
        {metaConnectionError && (
          <div className="mb-5">
            <MessageBox
              type="error"
              message={metaConnectionError}
            />
          </div>
        )}

        <div
          className={`rounded-3xl border p-6 ${
            status.label === 'متصل'
              ? 'border-emerald-200 bg-emerald-50/40'
              : 'border-sand-200 bg-sand-50/50'
          }`}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink-950 text-xs font-black text-amber-400">
                WA
              </div>

              <div>
                <h3 className="text-base font-bold text-ink-950">
                  WhatsApp Business
                </h3>

                <p className="mt-1 text-sm leading-6 text-ink-900/50">
                  سيتم التحكم في الربط والإعدادات المتقدمة من خلال التكامل الرسمي مع Meta.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <StatusBadge
                label={status.label}
                tone={status.tone}
              />

              <button
                type="button"
                onClick={onMetaConnect}
                disabled={metaConnecting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {metaConnecting && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}

                {metaConnecting
                  ? 'جاري الربط...'
                  : status.label === 'متصل'
                    ? 'إدارة WhatsApp'
                    : 'ربط WhatsApp'}
              </button>
            </div>
          </div>

          {integration?.connected_at && (
            <div className="mt-6 border-t border-sand-200/70 pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoRow
                  label="تاريخ الاتصال"
                  value={new Date(
                    integration.connected_at
                  ).toLocaleString(
                    'ar-EG'
                  )}
                  dir="ltr"
                />

                <InfoRow
                  label="آخر تحقق"
                  value={
                    integration.last_verified_at
                      ? new Date(
                          integration.last_verified_at
                        ).toLocaleString(
                          'ar-EG'
                        )
                      : 'لم يتم التحقق بعد'
                  }
                  dir="ltr"
                />
              </div>
            </div>
          )}

          {integration?.error_message && (
            <div
              className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
              role="alert"
            >
              {integration.error_message}
            </div>
          )}

          {!integration && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              حساب WhatsApp Business غير مربوط حتى الآن.
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-sand-200 bg-white px-4 py-3 text-xs leading-5 text-ink-900/45">
            بيانات الاعتماد الحساسة لا يتم عرضها في هذه الصفحة.
          </div>
        </div>
      </div>
    </section>
  )
}

function AISection() {
  return (
    <section>
      <SectionHeader
        eyebrow="AI"
        title="إعدادات الذكاء الاصطناعي"
        description="إعدادات المساعد الذكي داخل Dragon Media."
      />

      <div className="p-6 sm:p-8">
        <div className="rounded-3xl border border-sand-200 bg-gradient-to-l from-amber-50/70 via-white to-sand-50 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink-950 text-sm font-black text-amber-400">
              AI
            </div>

            <div>
              <h3 className="text-base font-bold text-ink-950">
                RYAN
              </h3>

              <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-900/60">
                RYAN يعمل حاليًا باستخدام Google Gemini. الإعدادات المتقدمة الخاصة بالمساعد وإدارة حدود الاستخدام سيتم التعامل معها من خلال نظام AI والإدارة المركزي في المنصة.
              </p>

              <div className="mt-4 inline-flex rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
                Gemini متصل
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function BillingSection() {
  return (
    <section>
      <SectionHeader
        eyebrow="الاشتراك"
        title="الفوترة"
        description="إدارة حالة الاشتراك وطرق الدفع الخاصة بالحساب."
      />

      <div className="p-6 sm:p-8">
        <div className="rounded-3xl border border-sand-200 bg-sand-50/60 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-sm font-black text-amber-700">
            $
          </div>

          <h3 className="mt-4 text-base font-bold text-ink-950">
            إدارة الفوترة والاشتراك
          </h3>

          <p className="mt-2 max-w-xl text-sm leading-7 text-ink-900/55">
            يتم التعامل مع الاشتراكات وطلبات الدفع ومراجعة المدفوعات من خلال نظام Plans وBilling المخصص للمنصة.
          </p>

          <div className="mt-5 rounded-2xl border border-sand-200 bg-white px-4 py-3 text-xs leading-5 text-ink-900/45">
            لا يتم عرض بيانات دفع وهمية أو معلومات مالية غير مرتبطة بالحساب.
          </div>
        </div>
      </div>
    </section>
  )
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="border-b border-sand-200 bg-gradient-to-l from-sand-50/80 via-white to-white px-6 py-6 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[11px] font-bold text-amber-700">
            {eyebrow}
          </div>

          <h2 className="mt-1 text-xl font-bold tracking-tight text-ink-950">
            {title}
          </h2>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-900/50">
            {description}
          </p>
        </div>

        {action}
      </div>
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
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-sand-200 bg-white px-4 py-4 transition-all duration-200 hover:border-sand-300 hover:bg-sand-50/60">
      <div className="min-w-0">
        <div className="text-sm font-bold text-ink-950">
          {label}
        </div>

        <div className="mt-1 text-xs leading-5 text-ink-900/45">
          {description}
        </div>
      </div>

      <span className="relative shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={event =>
            onChange(
              event.target.checked
            )
          }
          className="peer sr-only"
        />

        <span
          className={`block h-7 w-12 rounded-full p-1 transition-colors ${
            checked
              ? 'bg-ink-950'
              : 'bg-sand-300'
          }`}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              checked
                ? 'translate-x-0'
                : 'translate-x-5'
            }`}
          />
        </span>
      </span>
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
      <label className="mb-2 block text-sm font-bold text-ink-900">
        {label}

        {required && (
          <span className="mr-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        value={value}
        dir={dir}
        placeholder={placeholder}
        onChange={event =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-sand-300 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/30 focus:border-ink-900/30 focus:ring-4 focus:ring-amber-100"
      />
    </div>
  )
}

function StatusBadge({
  label,
  tone,
}: {
  label: string
  tone:
    | 'success'
    | 'warning'
    | 'danger'
    | 'neutral'
}) {
  const classes =
    tone === 'success'
      ? 'bg-emerald-100 text-emerald-700'
      : tone === 'warning'
        ? 'bg-amber-100 text-amber-700'
        : tone === 'danger'
          ? 'bg-red-100 text-red-700'
          : 'bg-sand-100 text-ink-900/55'

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${classes}`}
    >
      {label}
    </span>
  )
}

function MessageBox({
  type,
  message,
}: {
  type: 'success' | 'error'
  message: string
}) {
  const success = type === 'success'

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm leading-6 ${
        success
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-red-200 bg-red-50 text-red-800'
      }`}
      role={success ? 'status' : 'alert'}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-black text-white ${
          success
            ? 'bg-emerald-500'
            : 'bg-red-500'
        }`}
      >
        {success ? '✓' : '!'}
      </span>

      <span>{message}</span>
    </div>
  )
}

function InfoRow({
  label,
  value,
  dir,
}: {
  label: string
  value: string
  dir?: 'rtl' | 'ltr'
}) {
  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-4">
      <div className="text-[11px] font-semibold text-ink-900/40">
        {label}
      </div>

      <div
        dir={dir}
        className="mt-1.5 text-sm font-bold text-ink-950"
      >
        {value}
      </div>
    </div>
  )
}
