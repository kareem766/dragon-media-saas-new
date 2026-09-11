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

export default function AdminOrganizations() {
  const [organizations, setOrganizations] =
    useState<Organization[]>([])

  const [plans, setPlans] =
    useState<Plan[]>([])

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

      setOrganizations(
        json.organizations ??
          [],
      )

      if (
        plansRes.error
      ) {
        throw new Error(
          plansRes.error.message,
        )
      }

      setPlans(
        (plansRes.data ??
          []) as Plan[],
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
        className="p-4 sm:p-6 space-y-6"
      >
        <Skeleton className="h-10 w-72" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>

        <Skeleton className="h-96" />
      </div>
    )
  }

  if (error) {
    return (
      <div
        dir="rtl"
        className="p-6"
      >
        <Card className="p-8 text-center">
          <div className="text-red-600 font-semibold">
            {error}
          </div>

          <Button
            className="mt-5"
            onClick={loadData}
          >
            إعادة المحاولة
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-sand-50 p-4 sm:p-6 space-y-6"
    >
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-ink-950 text-white px-5 py-3 rounded-xl shadow-2xl text-sm">
          {toast}
        </div>
      )}

      {/* Header */}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-ink-950 text-gold-400 flex items-center justify-center text-xl font-bold">
              C
            </div>

            <div>
              <h1 className="text-2xl font-bold text-ink-950">
                إدارة الشركات
              </h1>

              <p className="text-sm text-ink-900/50 mt-1">
                إنشاء وإدارة حسابات الشركات والعملاء المشتركين في Dragon Media
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={openCreate}
          className="shadow-sm"
        >
          + إنشاء شركة جديدة
        </Button>
      </div>

      {/* Stats */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Filters */}

      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1">
            <input
              value={search}
              onChange={e =>
                setSearch(
                  e.target.value,
                )
              }
              placeholder="ابحث باسم الشركة أو المسؤول أو البريد أو الهاتف..."
              className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gold-500/20"
            />
          </div>

          <div className="flex gap-2">
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
                      value as any,
                    )
                  }
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                    filter ===
                    value
                      ? 'bg-ink-950 text-white'
                      : 'bg-white border border-sand-200 text-ink-900/60 hover:bg-sand-100'
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>
      </Card>

      {/* Desktop */}

      <Card className="hidden lg:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-ink-900/45">
                <th className="text-right p-4 font-semibold">
                  الشركة
                </th>

                <th className="text-right p-4 font-semibold">
                  المسؤول
                </th>

                <th className="text-right p-4 font-semibold">
                  الباقة
                </th>

                <th className="text-right p-4 font-semibold">
                  البيانات
                </th>

                <th className="text-right p-4 font-semibold">
                  الحالة
                </th>

                <th className="text-right p-4 font-semibold">
                  إجراءات
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-sand-100">
              {filteredOrganizations.map(
                org => (
                  <tr
                    key={org.id}
                    className="hover:bg-sand-50/70"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {org.logo_url ? (
                          <img
                            src={
                              org.logo_url
                            }
                            alt=""
                            className="w-11 h-11 rounded-xl object-cover border border-sand-200"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-ink-950 text-gold-400 flex items-center justify-center font-bold">
                            {org.name
                              .charAt(
                                0,
                              )
                              .toUpperCase()}
                          </div>
                        )}

                        <div>
                          <div className="font-bold text-ink-950">
                            {org.name}
                          </div>

                          <div className="text-xs text-ink-900/45 mt-1">
                            {org.business_type ||
                              'نشاط غير محدد'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="font-semibold">
                        {org.admin_name ||
                          org.manager_name ||
                          '—'}
                      </div>

                      <div className="text-xs text-ink-900/45 mt-1">
                        {org.admin_email ||
                          org.email ||
                          '—'}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="font-semibold">
                        {org.plan_name ||
                          'بدون باقة'}
                      </div>

                      {org.active_subscription && (
                        <div className="text-xs text-emerald-600 mt-1">
                          حتى{' '}
                          {formatDate(
                            org.renewal_date,
                          )}
                        </div>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="text-xs text-ink-900/60 space-y-1">
                        <div>
                          المستخدمون:{' '}
                          {org.users_count}
                        </div>

                        <div>
                          العملاء:{' '}
                          {org.customers_count}
                        </div>

                        <div>
                          Leads:{' '}
                          {org.leads_count}
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
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

                    <td className="p-4">
                      <div className="flex items-center gap-2">
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
                ),
              )}
            </tbody>
          </table>
        </div>

        {!filteredOrganizations.length && (
          <div className="p-14 text-center text-sm text-ink-900/45">
            لا توجد شركات مطابقة للبحث.
          </div>
        )}
      </Card>

      {/* Mobile */}

      <div className="lg:hidden space-y-3">
        {filteredOrganizations.map(
          org => (
            <Card
              key={org.id}
              className="p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {org.logo_url ? (
                    <img
                      src={
                        org.logo_url
                      }
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-ink-950 text-gold-400 flex items-center justify-center font-bold">
                      {org.name.charAt(
                        0,
                      )}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="font-bold truncate">
                      {org.name}
                    </div>

                    <div className="text-xs text-ink-900/45 mt-1 truncate">
                      {org.admin_email ||
                        org.email ||
                        '—'}
                    </div>
                  </div>
                </div>

                {org.suspended ? (
                  <Badge tone="danger">
                    معلقة
                  </Badge>
                ) : (
                  <Badge tone="success">
                    نشطة
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-xl bg-sand-50 p-3">
                  <div className="text-xs text-ink-900/45">
                    الباقة
                  </div>

                  <div className="font-semibold mt-1">
                    {org.plan_name ||
                      'بدون باقة'}
                  </div>
                </div>

                <div className="rounded-xl bg-sand-50 p-3">
                  <div className="text-xs text-ink-900/45">
                    المستخدمون
                  </div>

                  <div className="font-semibold mt-1">
                    {org.users_count}
                  </div>
                </div>

                <div className="rounded-xl bg-sand-50 p-3">
                  <div className="text-xs text-ink-900/45">
                    العملاء
                  </div>

                  <div className="font-semibold mt-1">
                    {org.customers_count}
                  </div>
                </div>

                <div className="rounded-xl bg-sand-50 p-3">
                  <div className="text-xs text-ink-900/45">
                    Leads
                  </div>

                  <div className="font-semibold mt-1">
                    {org.leads_count}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  variant="secondary"
                  className="flex-1"
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
                  className="flex-1"
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
                  className="text-red-600"
                  onClick={() =>
                    deleteOrganization(
                      org,
                    )
                  }
                >
                  حذف
                </Button>
              </div>
            </Card>
          ),
        )}

        {!filteredOrganizations.length && (
          <Card className="p-10 text-center text-sm text-ink-900/45">
            لا توجد شركات مطابقة.
          </Card>
        )}
      </div>

      {/* Modal */}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            onClick={closeModal}
          />

          <Card className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div>
                <h2 className="text-xl font-bold text-ink-950">
                  {editing
                    ? 'تعديل بيانات الشركة'
                    : 'إنشاء شركة جديدة'}
                </h2>

                <p className="text-sm text-ink-900/45 mt-1">
                  {editing
                    ? 'حدّث بيانات الشركة وحساب المسؤول.'
                    : 'سيتم إنشاء الشركة وحساب المسؤول وتسجيل الدخول مباشرة.'}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="w-9 h-9 rounded-xl bg-sand-100 text-ink-900/60 hover:bg-sand-200"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={save}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <label className="block text-xs font-semibold text-ink-900/60 mb-1.5">
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
                    className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-gold-500/20"
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
                  <label className="block text-xs font-semibold text-ink-900/60 mb-1.5">
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
                    className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-gold-500/20"
                    placeholder="عنوان مقر الشركة"
                  />
                </div>
              </div>

              {!editing && (
                <div className="rounded-2xl bg-gold-500/10 border border-gold-500/20 p-4 text-sm text-ink-900/70">
                  سيتم إنشاء حساب
                  المسؤول داخل Supabase
                  Auth مع تأكيد البريد
                  تلقائيًا، وبالتالي
                  يستطيع تسجيل الدخول
                  مباشرة بعد إنشاء الشركة.
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex-1"
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
                  className="flex-1"
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
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
      <label className="block text-xs font-semibold text-ink-900/60 mb-1.5">
        {label}
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
        className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-gold-500/20"
      />
    </div>
  )
}
