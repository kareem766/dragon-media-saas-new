import React, {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Card,
  StatCard,
  Badge,
  Button,
  Skeleton,
} from '../components/ui'

import { supabase } from '../lib/supabaseClient'

interface Plan {
  id: string
  name: string
  price: number
  currency: string
  billing_cycle: string
  status: string
}

interface Organization {
  id: string
  name: string
  slug: string
  phone: string | null
  email: string | null
  business_type: string | null
  suspended: boolean
  manager_name: string | null
  address: string | null
  logo_url: string | null
  plan: string | null
  created_at: string

  users_count: number
  customers_count: number
  leads_count: number

  admin_user_id: string | null
  admin_name: string | null
  admin_email: string | null
  admin_active: boolean

  subscription_id: string | null
  subscription_status: string | null
  active_subscription: boolean
  renewal_date: string | null

  plan_id: string | null
  plan_name: string | null
}

interface UsageMetric {
  used: number
  limit: number
  remaining: number
  percent: number
}

interface RyanUsageMetric {
  used: number
  base_limit: number
  purchased: number
  total_limit: number
  remaining: number
  percent: number
  feature_enabled: boolean
}

interface OrganizationUsage {
  organization_id: string
  organization_name: string
  suspended: boolean
  plan_id: string | null
  plan_name: string | null
  subscription_status: string | null
  renewal_date: string | null
  users: UsageMetric
  customers: UsageMetric
  ai_messages: RyanUsageMetric
}

interface UsageTotals {
  users: UsageMetric
  customers: UsageMetric
  ai_messages: RyanUsageMetric
}

interface UsageDashboard {
  month_start: string
  organizations: OrganizationUsage[]
  totals: UsageTotals
}

type FormState = {
  name: string
  businessType: string
  managerName: string
  email: string
  phone: string
  address: string
  logoUrl: string
  planId: string
  password: string
}

const emptyForm: FormState = {
  name: '',
  businessType: '',
  managerName: '',
  email: '',
  phone: '',
  address: '',
  logoUrl: '',
  planId: '',
  password: '',
}

const formatDate = (
  value: string | null,
) => {
  if (!value) return '—'

  return new Date(
    value,
  ).toLocaleDateString(
    'ar-EG',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    },
  )
}

const formatMoney = (
  value: number,
  currency = 'EGP',
) => {
  return `${Number(
    value || 0,
  ).toLocaleString(
    'ar-EG',
  )} ${currency === 'EGP' ? 'ج.م' : currency}`
}

const clampPercent = (
  value: number,
) => {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(
    100,
    Math.max(
      0,
      value,
    ),
  )
}

const getUsagePercent = (
  used: number,
  limit: number,
) => {
  if (
    !Number.isFinite(limit) ||
    limit <= 0
  ) {
    return used > 0 ? 100 : 0
  }

  return clampPercent(
    (used / limit) * 100,
  )
}

const getUsageTone = (
  percent: number,
) => {
  if (percent >= 90) {
    return {
      bar: 'bg-red-500',
      text: 'text-red-600',
      background: 'bg-red-50',
      border: 'border-red-100',
    }
  }

  if (percent >= 80) {
    return {
      bar: 'bg-amber-500',
      text: 'text-amber-600',
      background: 'bg-amber-50',
      border: 'border-amber-100',
    }
  }

  return {
    bar: 'bg-emerald-500',
    text: 'text-emerald-600',
    background: 'bg-emerald-50',
    border: 'border-emerald-100',
  }
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M6 6l12 12M18 6L6 18"
        strokeLinecap="round"
      />
    </svg>
  )
}

function BuildingIcon({
  className = 'h-5 w-5',
}: {
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        d="M4 20V5.5A1.5 1.5 0 0 1 5.5 4H14a1.5 1.5 0 0 1 1.5 1.5V20"
        strokeLinecap="round"
      />
      <path
        d="M15.5 9.5H19A1 1 0 0 1 20 10.5V20M8 8h2M8 12h2M8 16h2M12 8h1M12 12h1M12 16h1M3 20h18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SearchIcon({
  className = 'h-4 w-4',
}: {
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle
        cx="11"
        cy="11"
        r="6.5"
      />
      <path
        d="m16 16 4.5 4.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PlusIcon({
  className = 'h-4 w-4',
}: {
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M12 5v14M5 12h14"
        strokeLinecap="round"
      />
    </svg>
  )
}

function RefreshIcon({
  className = 'h-4 w-4',
}: {
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      aria-hidden="true"
    >
      <path
        d="M20 11a8 8 0 0 0-14.8-4.2L3 9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 4.5V9h4.5M4 13a8 8 0 0 0 14.8 4.2L21 15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 19.5V15h-4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function UsageBar({
  label,
  used,
  limit,
  percent,
  purchased,
}: {
  label: string
  used: number
  limit: number
  percent?: number
  purchased?: number
}) {
  const safeUsed = Math.max(
    0,
    Number(used || 0),
  )

  const safeLimit = Math.max(
    0,
    Number(limit || 0),
  )

  const calculatedPercent =
    getUsagePercent(
      safeUsed,
      safeLimit,
    )

  const displayPercent =
    clampPercent(
      Number.isFinite(
        percent ?? NaN,
      )
        ? Number(percent)
        : calculatedPercent,
    )

  const tone =
    getUsageTone(
      displayPercent,
    )

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-ink-900/60">
          {label}
        </span>

        <span
          className={`text-xs font-bold ${tone.text}`}
        >
          {Math.round(
            displayPercent,
          )}
          %
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-sand-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
          style={{
            width: `${displayPercent}%`,
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-ink-900/45">
        <span>
          {safeUsed.toLocaleString(
            'ar-EG',
          )}{' '}
          /{' '}
          {safeLimit.toLocaleString(
            'ar-EG',
          )}
        </span>

        {typeof purchased ===
          'number' &&
          purchased > 0 && (
            <span className="font-semibold text-amber-600">
              +
              {purchased.toLocaleString(
                'ar-EG',
              )}{' '}
              مشتراة
            </span>
          )}
      </div>
    </div>
  )
}

function UsageWarning({
  percent,
}: {
  percent: number
}) {
  if (percent < 80) {
    return null
  }

  return (
    <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-5 text-amber-700">
      {percent >= 90
        ? 'الاستخدام اقترب من الحد الأقصى'
        : 'الاستخدام تجاوز 80% من الحد'}
    </div>
  )
}

export default function AdminOrganizations() {
  const [organizations, setOrganizations] =
    useState<Organization[]>([])

  const [plans, setPlans] =
    useState<Plan[]>([])

  const [usageByOrganization, setUsageByOrganization] =
    useState<Record<
      string,
      OrganizationUsage
    >>({})

  const [usageTotals, setUsageTotals] =
    useState<UsageTotals | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [toast, setToast] =
    useState<string | null>(null)

  const [search, setSearch] =
    useState('')

  const [filter, setFilter] =
    useState<
      'all' | 'active' | 'suspended'
    >('all')

  const [modalOpen, setModalOpen] =
    useState(false)

  const [editing, setEditing] =
    useState<Organization | null>(null)

  const [form, setForm] =
    useState<FormState>(
      emptyForm,
    )

  const loadData = async () => {
    if (!supabase) {
      setError(
        'Supabase غير متصل',
      )
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const {
        data: sessionData,
      } =
        await supabase.auth.getSession()

      const token =
        sessionData.session
          ?.access_token

      if (!token) {
        setError(
          'جلسة الدخول غير صالحة',
        )
        setLoading(false)
        return
      }

      const [
        organizationsRes,
        plansRes,
        usageRes,
      ] = await Promise.all([
        fetch(
          '/api/admin/organizations',
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        ),

        supabase
          .from('plans')
          .select(
            `
            id,
            name,
            price,
            currency,
            billing_cycle,
            status
            `,
          )
          .eq(
            'status',
            'active',
          )
          .order(
            'sort_order',
            {
              ascending: true,
            },
          ),

        supabase.rpc(
          'get_admin_usage_dashboard',
        ),
      ])

      const json =
        await organizationsRes.json()

      if (
        !organizationsRes.ok
      ) {
        throw new Error(
          json.error ||
            'تعذر تحميل الشركات',
        )
      }

      if (
        plansRes.error
      ) {
        throw new Error(
          plansRes.error.message,
        )
      }

      if (
        usageRes.error
      ) {
        throw new Error(
          `تعذر تحميل بيانات الاستخدام: ${usageRes.error.message}`,
        )
      }

      const dashboard =
        (usageRes.data ||
          null) as UsageDashboard | null

      const usageRows =
        Array.isArray(
          dashboard?.organizations,
        )
          ? dashboard.organizations
          : []

      const usageMap: Record<
        string,
        OrganizationUsage
      > = {}

      usageRows.forEach(
        usage => {
          if (
            usage?.organization_id
          ) {
            usageMap[
              usage.organization_id
            ] = usage
          }
        },
      )

      setOrganizations(
        json.organizations ??
          [],
      )

      setPlans(
        (plansRes.data ??
          []) as Plan[],
      )

      setUsageByOrganization(
        usageMap,
      )

      setUsageTotals(
        dashboard?.totals ||
          null,
      )
    } catch (
      err: any
    ) {
      setError(
        err?.message ||
          'حدث خطأ أثناء تحميل البيانات',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!toast) return

    const timer =
      setTimeout(
        () =>
          setToast(null),
        3500,
      )

    return () =>
      clearTimeout(timer)
  }, [toast])

  const filteredOrganizations =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase()

      return organizations.filter(
        org => {
          const matchesSearch =
            !query ||
            [
              org.name,
              org.email,
              org.phone,
              org.manager_name,
              org.business_type,
            ]
              .filter(Boolean)
              .some(
                value =>
                  String(
                    value,
                  )
                    .toLowerCase()
                    .includes(
                      query,
                    ),
              )

          const matchesFilter =
            filter === 'all' ||
            (filter ===
              'active' &&
              !org.suspended) ||
            (filter ===
              'suspended' &&
              org.suspended)

          return (
            matchesSearch &&
            matchesFilter
          )
        },
      )
    }, [
      organizations,
      search,
      filter,
    ])

  const stats =
    useMemo(() => {
      const total =
        organizations.length

      const suspended =
        organizations.filter(
          org =>
            org.suspended,
        ).length

      const active =
        total - suspended

      const subscribed =
        organizations.filter(
          org =>
            org.active_subscription,
        ).length

      return {
        total,
        active,
        suspended,
        subscribed,
      }
    }, [
      organizations,
    ])

  const usageSummary =
    useMemo(() => {
      if (!usageTotals) {
        return {
          users: {
            used: 0,
            limit: 0,
            percent: 0,
          },
          customers: {
            used: 0,
            limit: 0,
            percent: 0,
          },
          ai: {
            used: 0,
            limit: 0,
            percent: 0,
            purchased: 0,
          },
        }
      }

      return {
        users: {
          used:
            Number(
              usageTotals.users?.used ||
                0,
            ),
          limit:
            Number(
              usageTotals.users?.limit ||
                0,
            ),
          percent:
            Number(
              usageTotals.users?.percent ||
                0,
            ),
        },

        customers: {
          used:
            Number(
              usageTotals.customers?.used ||
                0,
            ),
          limit:
            Number(
              usageTotals.customers?.limit ||
                0,
            ),
          percent:
            Number(
              usageTotals.customers?.percent ||
                0,
            ),
        },

        ai: {
          used:
            Number(
              usageTotals.ai_messages
                ?.used ||
                0,
            ),
          limit:
            Number(
              usageTotals.ai_messages
                ?.total_limit ||
                0,
            ),
          percent:
            Number(
              usageTotals.ai_messages
                ?.percent ||
                0,
            ),
          purchased:
            Number(
              usageTotals.ai_messages
                ?.purchased ||
                0,
            ),
        },
      }
    }, [
      usageTotals,
    ])

  const openCreate = () => {
    setEditing(null)
    setForm({
      ...emptyForm,
    })
    setModalOpen(true)
  }

  const openEdit = (
    org: Organization,
  ) => {
    setEditing(org)

    setForm({
      name:
        org.name || '',

      businessType:
        org.business_type ||
        '',

      managerName:
        org.manager_name ||
        '',

      email:
        org.email || '',

      phone:
        org.phone || '',

      address:
        org.address || '',

      logoUrl:
        org.logo_url || '',

      planId:
        org.plan_id || '',

      password: '',
    })

    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return

    setModalOpen(false)
    setEditing(null)
    setForm({
      ...emptyForm,
    })
  }

  const save = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault()

    if (!supabase) return

    if (
      !form.name.trim() ||
      !form.managerName.trim() ||
      !form.email.trim()
    ) {
      setToast(
        'أكمل بيانات الشركة والمسؤول والبريد الإلكتروني',
      )
      return
    }

    if (
      !editing &&
      form.password.length < 8
    ) {
      setToast(
        'كلمة المرور يجب ألا تقل عن 8 أحرف',
      )
      return
    }

    setSaving(true)

    try {
      const {
        data: sessionData,
      } =
        await supabase.auth.getSession()

      const token =
        sessionData.session
          ?.access_token

      if (!token) {
        throw new Error(
          'جلسة الدخول غير صالحة',
        )
      }

      const payload: any = {
        action:
          editing
            ? 'update'
            : 'create',

        name:
          form.name.trim(),

        businessType:
          form.businessType.trim(),

        managerName:
          form.managerName.trim(),

        email:
          form.email
            .trim()
            .toLowerCase(),

        phone:
          form.phone.trim(),

        address:
          form.address.trim(),

        logoUrl:
          form.logoUrl.trim(),

        planId:
          form.planId || null,
      }

      if (editing) {
        payload.organizationId =
          editing.id
      } else {
        payload.password =
          form.password
      }

      const response =
        await fetch(
          '/api/admin/organizations',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',

              Authorization:
                `Bearer ${token}`,
            },
            body:
              JSON.stringify(
                payload,
              ),
          },
        )

      const json =
        await response.json()

      if (!response.ok) {
        throw new Error(
          json.error ||
            'تعذر حفظ البيانات',
        )
      }

      setToast(
        editing
          ? 'تم تحديث بيانات الشركة بنجاح'
          : 'تم إنشاء الشركة وحساب المسؤول بنجاح',
      )

      closeModal()
      await loadData()
    } catch (
      err: any
    ) {
      setToast(
        err?.message ||
          'حدث خطأ أثناء الحفظ',
      )
    } finally {
      setSaving(false)
    }
  }

  const toggleSuspension =
    async (
      org: Organization,
    ) => {
      if (!supabase) return

      const willSuspend =
        !org.suspended

      const confirmed =
        window.confirm(
          willSuspend
            ? `هل أنت متأكد من تعليق شركة "${org.name}"؟`
            : `هل أنت متأكد من إعادة تفعيل شركة "${org.name}"؟`,
        )

      if (!confirmed) return

      try {
        const {
          data: sessionData,
        } =
          await supabase.auth.getSession()

        const token =
          sessionData.session
            ?.access_token

        if (!token) {
          throw new Error(
            'جلسة الدخول غير صالحة',
          )
        }

        const response =
          await fetch(
            '/api/admin/organizations',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',

                Authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify({
                  action:
                    willSuspend
                      ? 'suspend'
                      : 'activate',

                  organizationId:
                    org.id,
                }),
            },
          )

        const json =
          await response.json()

        if (!response.ok) {
          throw new Error(
            json.error ||
              'تعذر تنفيذ العملية',
          )
        }

        setOrganizations(
          previous =>
            previous.map(
              item =>
                item.id ===
                org.id
                  ? {
                      ...item,
                      suspended:
                        willSuspend,
                    }
                  : item,
            ),
        )

        setToast(
          willSuspend
            ? `تم تعليق شركة "${org.name}"`
            : `تم تفعيل شركة "${org.name}"`,
        )

        await loadData()
      } catch (
        err: any
      ) {
        setToast(
          err?.message ||
            'حدث خطأ أثناء العملية',
        )
      }
    }

  const deleteOrganization =
    async (
      org: Organization,
    ) => {
      if (!supabase) return

      const confirmed =
        window.confirm(
          `سيتم حذف شركة "${org.name}" وحسابات مستخدميها وبياناتها المرتبطة. هذا الإجراء لا يمكن التراجع عنه.\n\nهل تريد المتابعة؟`,
        )

      if (!confirmed) return

      const secondConfirm =
        window.confirm(
          `تأكيد نهائي: حذف "${org.name}" نهائيًا؟`,
        )

      if (!secondConfirm) return

      try {
        const {
          data: sessionData,
        } =
          await supabase.auth.getSession()

        const token =
          sessionData.session
            ?.access_token

        if (!token) {
          throw new Error(
            'جلسة الدخول غير صالحة',
          )
        }

        const response =
          await fetch(
            '/api/admin/organizations',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',

                Authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify({
                  action:
                    'delete',

                  organizationId:
                    org.id,
                }),
            },
          )

        const json =
          await response.json()

        if (!response.ok) {
          throw new Error(
            json.error ||
              'تعذر حذف الشركة',
          )
        }

        setOrganizations(
          previous =>
            previous.filter(
              item =>
                item.id !==
                org.id,
            ),
        )

        setToast(
          `تم حذف شركة "${org.name}"`,
        )

        setUsageByOrganization(
          previous => {
            const next = {
              ...previous,
            }

            delete next[org.id]

            return next
          },
        )
      } catch (
        err: any
      ) {
        setToast(
          err?.message ||
            'حدث خطأ أثناء الحذف',
        )
      }
    }

  if (loading) {
    return (
      <div
        dir="rtl"
        className="min-h-screen space-y-6 bg-sand-50 p-4 sm:p-6"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>

          <Skeleton className="h-11 w-40 rounded-xl" />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>

        <Skeleton className="h-44 rounded-2xl" />

        <Skeleton className="h-20 rounded-2xl" />

        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-sand-50 p-4 sm:p-6"
      >
        <Card className="mx-auto max-w-xl p-6 text-center sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path
                d="M12 8v4M12 16h.01"
                strokeLinecap="round"
              />
              <circle
                cx="12"
                cy="12"
                r="9"
              />
            </svg>
          </div>

          <h2 className="mt-4 text-lg font-bold text-ink-950">
            تعذر تحميل بيانات الشركات
          </h2>

          <p
            role="alert"
            className="mt-2 break-words text-sm leading-6 text-red-600"
          >
            {error}
          </p>

          <Button
            className="mt-5"
            onClick={loadData}
          >
            <span className="inline-flex items-center gap-2">
              <RefreshIcon />
              إعادة المحاولة
            </span>
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen space-y-5 bg-sand-50 p-3.5 sm:space-y-6 sm:p-6"
    >
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-3 top-4 z-[70] mx-auto max-w-md rounded-2xl border border-ink-800 bg-ink-950 px-4 py-3.5 text-sm font-semibold leading-6 text-white shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:left-1/2 sm:right-auto sm:w-auto sm:-translate-x-1/2 sm:px-5"
        >
          {toast}
        </div>
      )}

      {/* Header */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink-950 text-gold-400 shadow-sm">
            <BuildingIcon className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-ink-950 sm:text-2xl">
                إدارة الشركات
              </h1>

              <Badge tone="success">
                بيانات حقيقية
              </Badge>
            </div>

            <p className="mt-1 max-w-2xl text-xs leading-5 text-ink-900/50 sm:text-sm sm:leading-6">
              إنشاء وإدارة حسابات الشركات ومتابعة الاشتراكات والاستخدام من مكان واحد.
            </p>
          </div>
        </div>

        <Button
          onClick={openCreate}
          className="min-h-11 w-full shadow-sm sm:w-auto"
        >
          <span className="inline-flex items-center justify-center gap-2">
            <PlusIcon />
            إنشاء شركة جديدة
          </span>
        </Button>
      </div>

      {/* Main Stats */}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="إجمالي الشركات"
          value={String(
            stats.total,
          )}
          accent="gold"
        />

        <StatCard
          label="الشركات النشطة"
          value={String(
            stats.active,
          )}
          accent="ink"
        />

        <StatCard
          label="الشركات المعلقة"
          value={String(
            stats.suspended,
          )}
          accent="clay"
        />

        <StatCard
          label="اشتراكات نشطة"
          value={String(
            stats.subscribed,
          )}
          accent="gold"
        />
      </div>

      {/* Platform Usage */}

      <Card className="overflow-hidden p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-ink-950">
              استخدام المنصة
            </h2>

            <p className="mt-1 max-w-2xl text-xs leading-5 text-ink-900/45 sm:text-sm">
              البيانات الحالية محسوبة مباشرة من قاعدة البيانات حسب حدود الباقات.
            </p>
          </div>

          <Badge tone="success">
            محدث من قاعدة البيانات
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
          <div className="rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
            <UsageBar
              label="المستخدمون"
              used={
                usageSummary.users
                  .used
              }
              limit={
                usageSummary.users
                  .limit
              }
              percent={
                usageSummary.users
                  .percent
              }
            />

            <UsageWarning
              percent={
                usageSummary.users
                  .percent
              }
            />
          </div>

          <div className="rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
            <UsageBar
              label="العملاء"
              used={
                usageSummary
                  .customers
                  .used
              }
              limit={
                usageSummary
                  .customers
                  .limit
              }
              percent={
                usageSummary
                  .customers
                  .percent
              }
            />

            <UsageWarning
              percent={
                usageSummary
                  .customers
                  .percent
              }
            />
          </div>

          <div className="rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
            <UsageBar
              label="رسائل Ryan AI"
              used={
                usageSummary.ai
                  .used
              }
              limit={
                usageSummary.ai
                  .limit
              }
              percent={
                usageSummary.ai
                  .percent
              }
              purchased={
                usageSummary.ai
                  .purchased
              }
            />

            {usageSummary.ai
              .purchased >
              0 && (
              <div className="mt-2 text-[11px] font-semibold leading-5 text-amber-600">
                تشمل{' '}
                {usageSummary.ai.purchased.toLocaleString(
                  'ar-EG',
                )}{' '}
                Credits مشتراة
              </div>
            )}

            <UsageWarning
              percent={
                usageSummary.ai
                  .percent
              }
            />
          </div>
        </div>
      </Card>

      {/* Filters */}

      <Card className="p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-900/35">
              <SearchIcon />
            </div>

            <input
              value={search}
              onChange={e =>
                setSearch(
                  e.target.value,
                )
              }
              placeholder="ابحث باسم الشركة أو المسؤول أو البريد أو الهاتف..."
              aria-label="البحث في الشركات"
              className="min-h-11 w-full rounded-xl border border-sand-200 bg-white px-10 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/35 focus:border-gold-400 focus:ring-2 focus:ring-gold-500/15"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 lg:flex lg:shrink-0">
            {[
              ['all', 'الكل'],
              ['active', 'نشطة'],
              ['suspended', 'معلقة'],
            ].map(
              ([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setFilter(
                      value as
                        | 'all'
                        | 'active'
                        | 'suspended',
                    )
                  }
                  className={`min-h-11 rounded-xl px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-gold-500/20 sm:px-4 sm:text-sm ${
                    filter ===
                    value
                      ? 'bg-ink-950 text-white shadow-sm'
                      : 'border border-sand-200 bg-white text-ink-900/60 hover:bg-sand-100 hover:text-ink-950'
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>

        {(search ||
          filter !== 'all') && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-sand-100 pt-3">
            <p className="text-xs text-ink-900/45">
              عرض{' '}
              <span className="font-bold text-ink-950">
                {filteredOrganizations.length}
              </span>{' '}
              من{' '}
              <span className="font-bold text-ink-950">
                {organizations.length}
              </span>{' '}
              شركة
            </p>

            <button
              type="button"
              onClick={() => {
                setSearch('')
                setFilter('all')
              }}
              className="text-xs font-semibold text-ink-900/55 transition hover:text-ink-950"
            >
              مسح الفلاتر
            </button>
          </div>
        )}
      </Card>

      {/* Desktop */}

      <Card className="hidden overflow-hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-sand-200 bg-sand-50/70 text-ink-900/45">
                <th className="p-4 text-right font-semibold">
                  الشركة
                </th>

                <th className="p-4 text-right font-semibold">
                  المسؤول
                </th>

                <th className="p-4 text-right font-semibold">
                  الباقة
                </th>

                <th className="min-w-[270px] p-4 text-right font-semibold">
                  الاستخدام
                </th>

                <th className="p-4 text-right font-semibold">
                  الحالة
                </th>

                <th className="p-4 text-right font-semibold">
                  إجراءات
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-sand-100">
              {filteredOrganizations.map(
                org => {
                  const usage =
                    usageByOrganization[
                      org.id
                    ]

                  return (
                    <tr
                      key={org.id}
                      className="transition hover:bg-sand-50/70"
                    >
                      <td className="p-4 align-top">
                        <div className="flex items-center gap-3">
                          {org.logo_url ? (
                            <img
                              src={
                                org.logo_url
                              }
                              alt=""
                              className="h-11 w-11 shrink-0 rounded-xl border border-sand-200 bg-white object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-950 font-bold text-gold-400">
                              {org.name
                                .charAt(
                                  0,
                                )
                                .toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="font-bold text-ink-950">
                              {org.name}
                            </div>

                            <div className="mt-1 text-xs text-ink-900/45">
                              {org.business_type ||
                                'نشاط غير محدد'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 align-top">
                        <div className="font-semibold text-ink-950">
                          {org.admin_name ||
                            org.manager_name ||
                            '—'}
                        </div>

                        <div className="mt-1 break-all text-xs text-ink-900/45">
                          {org.admin_email ||
                            org.email ||
                            '—'}
                        </div>
                      </td>

                      <td className="p-4 align-top">
                        <div className="font-semibold text-ink-950">
                          {org.plan_name ||
                            'بدون باقة'}
                        </div>

                        {org.active_subscription && (
                          <div className="mt-1 text-xs font-semibold text-emerald-600">
                            حتى{' '}
                            {formatDate(
                              org.renewal_date,
                            )}
                          </div>
                        )}
                      </td>

                      <td className="p-4 align-top">
                        {usage ? (
                          <div className="space-y-3">
                            <UsageBar
                              label="Users"
                              used={
                                usage.users
                                  .used
                              }
                              limit={
                                usage.users
                                  .limit
                              }
                              percent={
                                usage.users
                                  .percent
                              }
                            />

                            <UsageBar
                              label="Customers"
                              used={
                                usage.customers
                                  .used
                              }
                              limit={
                                usage.customers
                                  .limit
                              }
                              percent={
                                usage.customers
                                  .percent
                              }
                            />

                            <UsageBar
                              label="Ryan AI"
                              used={
                                usage.ai_messages
                                  .used
                              }
                              limit={
                                usage.ai_messages
                                  .total_limit
                              }
                              percent={
                                usage.ai_messages
                                  .percent
                              }
                              purchased={
                                usage.ai_messages
                                  .purchased
                              }
                            />

                            {!usage.ai_messages
                              .feature_enabled && (
                              <div className="text-[11px] leading-5 text-ink-900/40">
                                Ryan غير مفعّل في الباقة الحالية
                              </div>
                            )}

                            <UsageWarning
                              percent={Math.max(
                                usage.users
                                  .percent,
                                usage.customers
                                  .percent,
                                usage.ai_messages
                                  .percent,
                              )}
                            />
                          </div>
                        ) : (
                          <div className="rounded-xl bg-sand-50 px-3 py-2 text-xs text-ink-900/40">
                            لا توجد بيانات استخدام
                          </div>
                        )}
                      </td>

                      <td className="p-4 align-top">
                        {org.suspended ? (
                          <Badge tone="danger">
                            معلقة
                          </Badge>
                        ) : org.active_subscription ? (
                          <Badge tone="success">
                            نشطة
                          </Badge>
                        ) : (
                          <Badge tone="warning">
                            بدون اشتراك نشط
                          </Badge>
                        )}
                      </td>

                      <td className="p-4 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="secondary"
                            onClick={() =>
                              openEdit(
                                org,
                              )
                            }
                          >
                            تعديل
                          </Button>

                          <Button
                            variant="ghost"
                            onClick={() =>
                              toggleSuspension(
                                org,
                              )
                            }
                          >
                            {org.suspended
                              ? 'تفعيل'
                              : 'تعليق'}
                          </Button>

                          <Button
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() =>
                              deleteOrganization(
                                org,
                              )
                            }
                          >
                            حذف
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                },
              )}
            </tbody>
          </table>
        </div>

        {!filteredOrganizations.length && (
          <EmptyOrganizations
            hasFilters={
              Boolean(search) ||
              filter !== 'all'
            }
            onClear={() => {
              setSearch('')
              setFilter('all')
            }}
            onCreate={openCreate}
          />
        )}
      </Card>

      {/* Mobile */}

      <div className="space-y-3 lg:hidden">
        {filteredOrganizations.map(
          org => {
            const usage =
              usageByOrganization[
                org.id
              ]

            return (
              <Card
                key={org.id}
                className="overflow-hidden p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {org.logo_url ? (
                      <img
                        src={
                          org.logo_url
                        }
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl border border-sand-200 bg-white object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink-950 font-bold text-gold-400">
                        {org.name.charAt(
                          0,
                        )}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="break-words font-bold text-ink-950">
                        {org.name}
                      </div>

                      <div className="mt-1 break-all text-xs text-ink-900/45">
                        {org.admin_email ||
                          org.email ||
                          '—'}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {org.suspended ? (
                      <Badge tone="danger">
                        معلقة
                      </Badge>
                    ) : org.active_subscription ? (
                      <Badge tone="success">
                        نشطة
                      </Badge>
                    ) : (
                      <Badge tone="warning">
                        بدون اشتراك
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <InfoTile
                    label="الباقة"
                    value={
                      org.plan_name ||
                      'بدون باقة'
                    }
                  />

                  <InfoTile
                    label="المستخدمون"
                    value={String(
                      org.users_count,
                    )}
                  />

                  <InfoTile
                    label="العملاء"
                    value={String(
                      org.customers_count,
                    )}
                  />

                  <InfoTile
                    label="Leads"
                    value={String(
                      org.leads_count,
                    )}
                  />
                </div>

                {usage && (
                  <div className="mt-4 rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="font-bold text-sm text-ink-950">
                        الاستخدام
                      </div>

                      <span className="text-[11px] text-ink-900/40">
                        الشهر الحالي
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <UsageBar
                          label="المستخدمون"
                          used={
                            usage.users
                              .used
                          }
                          limit={
                            usage.users
                              .limit
                          }
                          percent={
                            usage.users
                              .percent
                          }
                        />

                        <UsageWarning
                          percent={
                            usage.users
                              .percent
                          }
                        />
                      </div>

                      <div>
                        <UsageBar
                          label="العملاء"
                          used={
                            usage.customers
                              .used
                          }
                          limit={
                            usage.customers
                              .limit
                          }
                          percent={
                            usage.customers
                              .percent
                          }
                        />

                        <UsageWarning
                          percent={
                            usage.customers
                              .percent
                          }
                        />
                      </div>

                      <div>
                        <UsageBar
                          label="Ryan AI"
                          used={
                            usage.ai_messages
                              .used
                          }
                          limit={
                            usage.ai_messages
                              .total_limit
                          }
                          percent={
                            usage.ai_messages
                              .percent
                          }
                          purchased={
                            usage.ai_messages
                              .purchased
                          }
                        />

                        {usage.ai_messages
                          .feature_enabled ===
                          false && (
                          <div className="mt-1 text-[11px] leading-5 text-ink-900/40">
                            Ryan غير مفعّل في الباقة الحالية
                          </div>
                        )}

                        <UsageWarning
                          percent={
                            usage.ai_messages
                              .percent
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    className="min-h-11"
                    onClick={() =>
                      openEdit(
                        org,
                      )
                    }
                  >
                    تعديل
                  </Button>

                  <Button
                    variant="ghost"
                    className="min-h-11"
                    onClick={() =>
                      toggleSuspension(
                        org,
                      )
                    }
                  >
                    {org.suspended
                      ? 'تفعيل'
                      : 'تعليق'}
                  </Button>

                  <Button
                    variant="ghost"
                    className="col-span-2 min-h-11 text-red-600 hover:bg-red-50"
                    onClick={() =>
                      deleteOrganization(
                        org,
                      )
                    }
                  >
                    حذف الشركة
                  </Button>
                </div>
              </Card>
            )
          },
        )}

        {!filteredOrganizations.length && (
          <EmptyOrganizations
            hasFilters={
              Boolean(search) ||
              filter !== 'all'
            }
            onClear={() => {
              setSearch('')
              setFilter('all')
            }}
            onCreate={openCreate}
          />
        )}
      </div>

      {/* Modal */}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 backdrop-blur-[2px] sm:p-5"
          role="presentation"
        >
          <div
            className="absolute inset-0"
            onClick={closeModal}
          />

          <Card
            className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="organization-modal-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-sand-100 bg-white px-4 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-950 text-gold-400">
                    <BuildingIcon className="h-4 w-4" />
                  </div>

                  <h2
                    id="organization-modal-title"
                    className="text-lg font-bold text-ink-950 sm:text-xl"
                  >
                    {editing
                      ? 'تعديل بيانات الشركة'
                      : 'إنشاء شركة جديدة'}
                  </h2>
                </div>

                <p className="mt-2 text-xs leading-5 text-ink-900/45 sm:text-sm">
                  {editing
                    ? 'حدّث بيانات الشركة وحساب المسؤول.'
                    : 'سيتم إنشاء الشركة وحساب المسؤول وتسجيل الدخول مباشرة.'}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="إغلاق"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sand-100 text-ink-900/60 transition hover:bg-sand-200 hover:text-ink-950 focus:outline-none focus:ring-2 focus:ring-gold-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto">
              <form
                onSubmit={save}
                className="space-y-5 p-4 sm:p-6"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="اسم الشركة"
                    value={form.name}
                    onChange={value =>
                      setForm({
                        ...form,
                        name: value,
                      })
                    }
                    required
                  />

                  <Field
                    label="نوع النشاط"
                    value={
                      form.businessType
                    }
                    onChange={value =>
                      setForm({
                        ...form,
                        businessType:
                          value,
                      })
                    }
                  />

                  <Field
                    label="اسم المسؤول"
                    value={
                      form.managerName
                    }
                    onChange={value =>
                      setForm({
                        ...form,
                        managerName:
                          value,
                      })
                    }
                    required
                  />

                  <Field
                    label="البريد الإلكتروني"
                    type="email"
                    value={
                      form.email
                    }
                    onChange={value =>
                      setForm({
                        ...form,
                        email: value,
                      })
                    }
                    required
                  />

                  <Field
                    label="رقم الهاتف"
                    value={
                      form.phone
                    }
                    onChange={value =>
                      setForm({
                        ...form,
                        phone: value,
                      })
                    }
                  />

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">
                      الباقة
                    </label>

                    <select
                      value={
                        form.planId
                      }
                      onChange={e =>
                        setForm({
                          ...form,
                          planId:
                            e.target
                              .value,
                        })
                      }
                      className="min-h-11 w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm text-ink-950 outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-500/15"
                    >
                      <option value="">
                        بدون باقة الآن
                      </option>

                      {plans.map(
                        plan => (
                          <option
                            key={
                              plan.id
                            }
                            value={
                              plan.id
                            }
                          >
                            {plan.name} —{' '}
                            {formatMoney(
                              Number(
                                plan.price,
                              ),
                              plan.currency,
                            )}
                            /{' '}
                            {plan.billing_cycle ===
                            'yearly'
                              ? 'سنوي'
                              : 'شهري'}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  {!editing && (
                    <Field
                      label="كلمة مرور المسؤول"
                      type="password"
                      value={
                        form.password
                      }
                      onChange={value =>
                        setForm({
                          ...form,
                          password:
                            value,
                        })
                      }
                      required
                    />
                  )}

                  <Field
                    label="رابط الشعار"
                    value={
                      form.logoUrl
                    }
                    onChange={value =>
                      setForm({
                        ...form,
                        logoUrl:
                          value,
                      })
                    }
                  />

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">
                      عنوان مقر الشركة
                    </label>

                    <textarea
                      value={
                        form.address
                      }
                      onChange={e =>
                        setForm({
                          ...form,
                          address:
                            e.target
                              .value,
                        })
                      }
                      rows={3}
                      className="w-full resize-none rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/30 focus:border-gold-400 focus:ring-2 focus:ring-gold-500/15"
                      placeholder="عنوان مقر الشركة"
                    />
                  </div>
                </div>

                {!editing && (
                  <div className="rounded-2xl border border-gold-500/20 bg-gold-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/70 text-gold-700">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          aria-hidden="true"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="9"
                          />
                          <path
                            d="M12 10v5M12 7.5h.01"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>

                      <p className="text-xs leading-6 text-ink-900/70 sm:text-sm">
                        سيتم إنشاء حساب المسؤول داخل Supabase Auth مع تأكيد البريد تلقائيًا، وبالتالي يستطيع تسجيل الدخول مباشرة بعد إنشاء الشركة.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2.5 border-t border-sand-100 pt-4 sm:flex-row sm:pt-5">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="min-h-11 flex-1"
                  >
                    {saving
                      ? 'جاري الحفظ...'
                      : editing
                        ? 'حفظ التعديلات'
                        : 'إنشاء الشركة والحساب'}
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving}
                    onClick={
                      closeModal
                    }
                    className="min-h-11 flex-1"
                  >
                    إلغاء
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function InfoTile({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-0 rounded-xl border border-sand-100 bg-sand-50 p-3">
      <div className="text-xs text-ink-900/45">
        {label}
      </div>

      <div className="mt-1 break-words font-semibold leading-5 text-ink-950">
        {value}
      </div>
    </div>
  )
}

function EmptyOrganizations({
  hasFilters,
  onClear,
  onCreate,
}: {
  hasFilters: boolean
  onClear: () => void
  onCreate: () => void
}) {
  return (
    <div className="px-5 py-12 text-center sm:px-10 sm:py-14">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sand-100 text-ink-900/45">
        <BuildingIcon className="h-5 w-5" />
      </div>

      <h3 className="mt-4 text-sm font-bold text-ink-950 sm:text-base">
        {hasFilters
          ? 'لا توجد شركات مطابقة'
          : 'لا توجد شركات حتى الآن'}
      </h3>

      <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-ink-900/45 sm:text-sm sm:leading-6">
        {hasFilters
          ? 'جرّب تعديل البحث أو الفلاتر للوصول إلى النتائج المطلوبة.'
          : 'ابدأ بإضافة أول شركة إلى منصة Dragon Media.'}
      </p>

      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        {hasFilters ? (
          <Button
            variant="secondary"
            onClick={onClear}
          >
            مسح الفلاتر
          </Button>
        ) : (
          <Button
            onClick={onCreate}
          >
            <span className="inline-flex items-center gap-2">
              <PlusIcon />
              إنشاء شركة جديدة
            </span>
          </Button>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string
  value: string
  onChange: (
    value: string,
  ) => void
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">
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
        onChange={e =>
          onChange(
            e.target.value,
          )
        }
        required={required}
        className="min-h-11 w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/30 focus:border-gold-400 focus:ring-2 focus:ring-gold-500/15"
      />
    </div>
  )
}
