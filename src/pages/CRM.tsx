import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

type Lead = {
  id: string
  organization_id: string
  name: string
  company: string | null
  phone: string | null
  source: string | null
  status: string | null
  assigned_to: string | null
  notes: string | null
  follow_up_at: string | null
  created_at: string
}

type Customer = {
  id: string
  organization_id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
  status: string | null
  total_spent: number | null
  tags: string[] | null
  source: string | null
  notes: string | null
  follow_up_at: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string | null
}

const LEAD_STATUSES = [
  'الكل',
  'جديد',
  'تم التواصل',
  'مهتم',
  'عرض سعر',
  'تفاوض',
  'تم التعاقد',
  'خسرنا',
]

const SOURCE_OPTIONS = [
  'فيسبوك',
  'إنستجرام',
  'واتساب',
  'موقع إلكتروني',
  'إعلان',
  'إحالة',
  'أخرى',
]

const formatDate = (value: string | null) => {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const formatShortDate = (value: string | null) => {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
  }).format(date)
}

const normalizeValue = (value: string) => {
  const normalized = value.trim()
  return normalized || null
}

const statusClasses = (status: string | null) => {
  switch (status) {
    case 'جديد':
      return 'bg-blue-50 text-blue-700 border-blue-100'
    case 'تم التواصل':
      return 'bg-indigo-50 text-indigo-700 border-indigo-100'
    case 'مهتم':
      return 'bg-amber-50 text-amber-700 border-amber-100'
    case 'عرض سعر':
      return 'bg-purple-50 text-purple-700 border-purple-100'
    case 'تفاوض':
      return 'bg-orange-50 text-orange-700 border-orange-100'
    case 'تم التعاقد':
      return 'bg-green-50 text-green-700 border-green-100'
    case 'خسرنا':
      return 'bg-red-50 text-red-700 border-red-100'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-100'
  }
}

const StatusBadge = ({ status }: { status: string | null }) => {
  const value = status || 'غير محدد'

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none ${statusClasses(
        status
      )}`}
    >
      {value}
    </span>
  )
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="11"
        cy="11"
        r="7"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M20 20L16.2 16.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 5V19M5 12H19"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M16 20V18.5C16 16.84 14.66 15.5 13 15.5H7C5.34 15.5 4 16.84 4 18.5V20"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle
        cx="10"
        cy="8"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M17 11.5C18.66 11.5 20 10.16 20 8.5C20 6.84 18.66 5.5 17 5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M20 20V18.5C20 17.18 19.15 16.06 18 15.64"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CustomerIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="8"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M5 20C5.55 16.94 8.26 15 12 15C15.74 15 18.45 16.94 19 20"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function FollowUpIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="17"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8 2V6M16 2V6M3 9H21"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M8 13H8.01M12 13H12.01M16 13H16.01M8 17H8.01M12 17H12.01"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: 'leads' | 'customers'
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-sand-100 bg-sand-50 text-ink-400">
        {icon === 'leads' ? <UsersIcon /> : <CustomerIcon />}
      </div>

      <h3 className="text-sm font-bold text-ink-900">
        {title}
      </h3>

      <p className="mt-1.5 max-w-sm text-xs leading-5 text-ink-400">
        {description}
      </p>

      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-sand-100" />
        <div className="h-4 w-72 animate-pulse rounded bg-sand-100" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl border border-sand-100 bg-white"
          />
        ))}
      </div>

      <div className="h-20 animate-pulse rounded-2xl border border-sand-100 bg-white" />

      <div className="h-20 animate-pulse rounded-2xl border border-sand-100 bg-white" />

      <div className="overflow-hidden rounded-2xl border border-sand-100 bg-white">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-4 border-b border-sand-100 p-5 last:border-0"
          >
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-sand-100" />
              <div className="h-3 w-52 animate-pulse rounded bg-sand-100" />
            </div>

            <div className="h-8 w-20 animate-pulse rounded-lg bg-sand-100" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CRM() {
  const navigate = useNavigate()

  const {
    organizationId,
    loading: organizationLoading,
    error: organizationError,
  } = useOrganization()

  const [leads, setLeads] = useState<Lead[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [activeTab, setActiveTab] = useState<'leads' | 'customers'>(
    'leads'
  )

  const [search, setSearch] = useState('')
  const [leadStatus, setLeadStatus] = useState('الكل')

  const [showAddLead, setShowAddLead] = useState(false)

  const [newLead, setNewLead] = useState({
    name: '',
    company: '',
    phone: '',
    source: '',
    notes: '',
    follow_up_at: '',
  })

  const loadCRM = async () => {
    if (!supabase || !organizationId) return

    setLoading(true)

    try {
      const [leadsResult, customersResult] = await Promise.all([
        supabase
          .from('leads')
          .select(
            `
              id,
              organization_id,
              name,
              company,
              phone,
              source,
              status,
              assigned_to,
              notes,
              follow_up_at,
              created_at
            `
          )
          .eq('organization_id', organizationId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),

        supabase
          .from('customers')
          .select(
            `
              id,
              organization_id,
              name,
              company,
              phone,
              email,
              status,
              total_spent,
              tags,
              source,
              notes,
              follow_up_at,
              assigned_to,
              created_at,
              updated_at
            `
          )
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false }),
      ])

      if (leadsResult.error) {
        throw leadsResult.error
      }

      if (customersResult.error) {
        throw customersResult.error
      }

      setLeads((leadsResult.data || []) as Lead[])
      setCustomers((customersResult.data || []) as Customer[])
    } catch (error) {
      console.error('CRM load error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (organizationId) {
      loadCRM()
    } else if (!organizationLoading) {
      setLoading(false)
    }
  }, [organizationId, organizationLoading])

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase()

    return leads.filter((lead) => {
      const matchesStatus =
        leadStatus === 'الكل' || lead.status === leadStatus

      if (!matchesStatus) return false

      if (!query) return true

      return [
        lead.name,
        lead.company,
        lead.phone,
        lead.source,
        lead.notes,
        lead.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        )
    })
  }, [leads, search, leadStatus])

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return customers

    return customers.filter((customer) =>
      [
        customer.name,
        customer.company,
        customer.phone,
        customer.email,
        customer.source,
        customer.notes,
        customer.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        )
    )
  }, [customers, search])

  const stats = useMemo(() => {
    const followUps = [...leads, ...customers].filter(
      (item) => item.follow_up_at
    ).length

    return {
      leads: leads.length,
      newLeads: leads.filter(
        (lead) => lead.status === 'جديد'
      ).length,
      interested: leads.filter(
        (lead) => lead.status === 'مهتم'
      ).length,
      customers: customers.length,
      followUps,
    }
  }, [leads, customers])

  const handleAddLead = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!supabase || !organizationId) {
      alert('لا يمكن الاتصال بقاعدة البيانات حاليًا')
      return
    }

    if (!newLead.name.trim()) {
      alert('اكتب اسم العميل المحتمل')
      return
    }

    setSaving(true)

    try {
      const followUp = newLead.follow_up_at
        ? new Date(newLead.follow_up_at).toISOString()
        : null

      const { data, error } = await supabase
        .from('leads')
        .insert({
          organization_id: organizationId,
          name: newLead.name.trim(),
          company: normalizeValue(newLead.company),
          phone: normalizeValue(newLead.phone),
          source: normalizeValue(newLead.source),
          notes: normalizeValue(newLead.notes),
          follow_up_at: followUp,
          status: 'جديد',
        })
        .select(
          `
            id,
            organization_id,
            name,
            company,
            phone,
            source,
            status,
            assigned_to,
            notes,
            follow_up_at,
            created_at
          `
        )
        .single()

      if (error) {
        throw error
      }

      if (data) {
        setLeads((current) => [data as Lead, ...current])
      }

      setNewLead({
        name: '',
        company: '',
        phone: '',
        source: '',
        notes: '',
        follow_up_at: '',
      })

      setShowAddLead(false)
    } catch (error) {
      console.error('Add lead error:', error)

      alert(
        error instanceof Error
          ? error.message
          : 'حدث خطأ أثناء إضافة العميل المحتمل'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleLeadStatus = async (
    leadId: string,
    status: string
  ) => {
    if (!supabase || !organizationId) return

    const previous = leads

    setLeads((current) =>
      current.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              status,
            }
          : lead
      )
    )

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          status,
        })
        .eq('id', leadId)
        .eq('organization_id', organizationId)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Update lead status error:', error)

      setLeads(previous)

      alert('تعذر تحديث حالة العميل المحتمل')
    }
  }

  const handleConvert = async (lead: Lead) => {
    if (!supabase || !organizationId) return

    const confirmed = window.confirm(
      `هل تريد تحويل "${lead.name}" إلى عميل فعلي؟`
    )

    if (!confirmed) return

    setSaving(true)

    try {
      const { data, error } = await supabase.rpc(
        'convert_lead_to_customer',
        {
          p_lead_id: lead.id,
        }
      )

      if (error) {
        throw error
      }

      let customerId: string | null = null

      if (typeof data === 'string') {
        customerId = data
      } else if (Array.isArray(data) && data.length > 0) {
        const result = data[0] as {
          id?: string
          customer_id?: string
        }

        customerId = result.customer_id || result.id || null
      } else if (data && typeof data === 'object') {
        const result = data as {
          id?: string
          customer_id?: string
        }

        customerId = result.customer_id || result.id || null
      }

      await loadCRM()

      if (customerId) {
        navigate(`/crm/customer/${customerId}`)
      } else {
        alert('تم تحويل العميل المحتمل إلى عميل بنجاح')
      }
    } catch (error) {
      console.error('Convert lead error:', error)

      alert(
        error instanceof Error
          ? error.message
          : 'حدث خطأ أثناء تحويل العميل المحتمل'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLead = async (lead: Lead) => {
    if (!supabase || !organizationId) return

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف "${lead.name}"؟`
    )

    if (!confirmed) return

    const previous = leads

    setLeads((current) =>
      current.filter((item) => item.id !== lead.id)
    )

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq('id', lead.id)
        .eq('organization_id', organizationId)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Delete lead error:', error)

      setLeads(previous)

      alert('حدث خطأ أثناء حذف العميل المحتمل')
    }
  }

  const clearSearch = () => {
    setSearch('')
    setLeadStatus('الكل')
  }

  if (!supabase) {
    return (
      <div className="flex min-h-[420px] items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-2xl border border-red-100 bg-red-50 p-7 text-red-700">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-red-100">
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M12 8V12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M12 16H12.01"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M10.3 3.9L2.7 17C1.93 18.33 2.89 20 4.43 20H19.57C21.11 20 22.07 18.33 21.3 17L13.7 3.9C12.93 2.57 11.07 2.57 10.3 3.9Z"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          </div>

          <h2 className="text-lg font-bold">
            قاعدة البيانات غير متصلة
          </h2>

          <p className="mt-2 text-sm leading-6 text-red-600">
            تأكد من إعداد متغيرات Supabase في بيئة التشغيل.
          </p>
        </div>
      </div>
    )
  }

  if (organizationLoading || loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <LoadingState />
      </div>
    )
  }

  if (organizationError || !organizationId) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="w-full max-w-xl rounded-2xl border border-amber-100 bg-amber-50 p-7 text-amber-800">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100">
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M12 8V12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M12 16H12.01"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M10.3 3.9L2.7 17C1.93 18.33 2.89 20 4.43 20H19.57C21.11 20 22.07 18.33 21.3 17L13.7 3.9C12.93 2.57 11.07 2.57 10.3 3.9Z"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          </div>

          <h2 className="text-lg font-bold">
            لا توجد مؤسسة مرتبطة بالحساب
          </h2>

          <p className="mt-2 text-sm leading-6 text-amber-700">
            {organizationError ||
              'الحساب الحالي غير مرتبط بأي مؤسسة.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-gold-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-gold-700">
              CRM
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
            إدارة العملاء
          </h1>

          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-500">
            أدر العملاء المحتملين والعملاء الحاليين وتابع
            مراحل التواصل من مكان واحد.
          </p>
        </div>

        {activeTab === 'leads' && (
          <button
            type="button"
            onClick={() => setShowAddLead(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-ink-900 hover:shadow-md"
          >
            <PlusIcon />
            إضافة عميل محتمل
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
        {[
          {
            label: 'العملاء المحتملون',
            value: stats.leads,
            icon: <UsersIcon />,
            tone: 'bg-gold-50 text-gold-700',
          },
          {
            label: 'عملاء جدد',
            value: stats.newLeads,
            icon: <UsersIcon />,
            tone: 'bg-blue-50 text-blue-700',
          },
          {
            label: 'مهتمون',
            value: stats.interested,
            icon: <UsersIcon />,
            tone: 'bg-amber-50 text-amber-700',
          },
          {
            label: 'العملاء',
            value: stats.customers,
            icon: <CustomerIcon />,
            tone: 'bg-green-50 text-green-700',
          },
          {
            label: 'المتابعات',
            value: stats.followUps,
            icon: <FollowUpIcon />,
            tone: 'bg-purple-50 text-purple-700',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="group rounded-2xl border border-sand-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-ink-400 sm:text-sm">
                  {stat.label}
                </p>

                <p className="mt-2 text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
                  {stat.value}
                </p>
              </div>

              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.tone}`}
              >
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="rounded-2xl border border-sand-100 bg-white p-1.5 shadow-sm">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('leads')}
            className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 ${
              activeTab === 'leads'
                ? 'bg-ink-950 text-white shadow-sm'
                : 'text-ink-500 hover:bg-sand-50 hover:text-ink-800'
            }`}
          >
            العملاء المحتملون
            <span
              className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                activeTab === 'leads'
                  ? 'bg-white/15 text-white'
                  : 'bg-sand-100 text-ink-500'
              }`}
            >
              {leads.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 ${
              activeTab === 'customers'
                ? 'bg-ink-950 text-white shadow-sm'
                : 'text-ink-500 hover:bg-sand-50 hover:text-ink-800'
            }`}
          >
            العملاء
            <span
              className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                activeTab === 'customers'
                  ? 'bg-white/15 text-white'
                  : 'bg-sand-100 text-ink-500'
              }`}
            >
              {customers.length}
            </span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-sand-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-400">
              <SearchIcon />
            </div>

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder={
                activeTab === 'leads'
                  ? 'ابحث بالاسم أو الشركة أو الهاتف...'
                  : 'ابحث في العملاء...'
              }
              className="min-h-11 w-full rounded-xl border border-sand-200 bg-sand-50 py-2.5 pr-10 pl-4 text-sm text-ink-900 outline-none transition-all duration-200 placeholder:text-ink-400 focus:border-gold-400 focus:bg-white focus:ring-4 focus:ring-gold-500/10"
            />
          </div>

          {activeTab === 'leads' && (
            <select
              value={leadStatus}
              onChange={(event) =>
                setLeadStatus(event.target.value)
              }
              className="min-h-11 rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 outline-none transition-all focus:border-gold-400 focus:ring-4 focus:ring-gold-500/10 lg:min-w-44"
            >
              {LEAD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status === 'الكل'
                    ? 'كل الحالات'
                    : status}
                </option>
              ))}
            </select>
          )}

          {(search || leadStatus !== 'الكل') && (
            <button
              type="button"
              onClick={clearSearch}
              className="min-h-11 rounded-xl border border-sand-200 px-4 py-2.5 text-sm font-semibold text-ink-600 transition hover:bg-sand-50 hover:text-ink-900"
            >
              مسح الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* Leads */}
      {activeTab === 'leads' && (
        <div className="overflow-hidden rounded-2xl border border-sand-100 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-sand-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-ink-950">
                العملاء المحتملون
              </h2>

              <p className="mt-1 text-xs text-ink-400">
                {filteredLeads.length} نتيجة مطابقة
              </p>
            </div>

            {filteredLeads.length > 0 && (
              <span className="text-xs font-medium text-ink-400">
                أحدث العملاء أولًا
              </span>
            )}
          </div>

          {filteredLeads.length === 0 ? (
            <EmptyState
              icon="leads"
              title="لا توجد نتائج"
              description="لم يتم العثور على عملاء محتملين مطابقين للبحث أو الفلاتر الحالية."
              action={
                leads.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowAddLead(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-ink-900"
                  >
                    <PlusIcon />
                    إضافة أول عميل محتمل
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="divide-y divide-sand-100">
              {filteredLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="p-5 transition-colors duration-150 hover:bg-sand-50/60"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="font-bold text-ink-950">
                          {lead.name}
                        </h3>

                        <StatusBadge status={lead.status} />
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-ink-500 sm:grid-cols-2 lg:grid-cols-4">
                        {lead.company && (
                          <span className="truncate">
                            <span className="font-semibold text-ink-700">
                              الشركة:
                            </span>{' '}
                            {lead.company}
                          </span>
                        )}

                        {lead.phone && (
                          <span dir="ltr" className="truncate text-right">
                            <span className="font-semibold text-ink-700">
                              الهاتف:
                            </span>{' '}
                            {lead.phone}
                          </span>
                        )}

                        {lead.source && (
                          <span className="truncate">
                            <span className="font-semibold text-ink-700">
                              المصدر:
                            </span>{' '}
                            {lead.source}
                          </span>
                        )}

                        <span>
                          <span className="font-semibold text-ink-700">
                            أضيف:
                          </span>{' '}
                          {formatShortDate(lead.created_at)}
                        </span>
                      </div>

                      {lead.notes && (
                        <p className="mt-3 rounded-xl border border-sand-100 bg-sand-50 px-3.5 py-3 text-xs leading-5 text-ink-600">
                          {lead.notes}
                        </p>
                      )}

                      {lead.follow_up_at && (
                        <p className="mt-2 text-[11px] font-semibold text-purple-600">
                          موعد المتابعة:
                          {' '}
                          {formatDate(lead.follow_up_at)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                      <select
                        value={lead.status || 'جديد'}
                        onChange={(event) =>
                          handleLeadStatus(
                            lead.id,
                            event.target.value
                          )
                        }
                        className="min-h-9 rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 outline-none transition focus:border-gold-400 focus:ring-4 focus:ring-gold-500/10"
                        aria-label={`تغيير حالة ${lead.name}`}
                      >
                        {LEAD_STATUSES.filter(
                          (status) => status !== 'الكل'
                        ).map((status) => (
                          <option
                            key={status}
                            value={status}
                          >
                            {status}
                          </option>
                        ))}
                      </select>

                      {lead.status !== 'تم التعاقد' && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            handleConvert(lead)
                          }
                          className="min-h-9 rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          تحويل لعميل
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          handleDeleteLead(lead)
                        }
                        className="min-h-9 rounded-lg border border-red-100 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Customers */}
      {activeTab === 'customers' && (
        <div className="overflow-hidden rounded-2xl border border-sand-100 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-sand-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-ink-950">
                العملاء الحاليون
              </h2>

              <p className="mt-1 text-xs text-ink-400">
                {filteredCustomers.length} نتيجة مطابقة
              </p>
            </div>

            <span className="text-xs font-medium text-ink-400">
              اضغط على العميل لفتح ملفه
            </span>
          </div>

          {filteredCustomers.length === 0 ? (
            <EmptyState
              icon="customers"
              title="لا توجد نتائج"
              description="لا يوجد عملاء مطابقون للبحث الحالي."
            />
          ) : (
            <div className="divide-y divide-sand-100">
              {filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() =>
                    navigate(
                      `/crm/customer/${customer.id}`
                    )
                  }
                  className="block w-full p-5 text-right transition-colors duration-150 hover:bg-sand-50/60 focus:bg-sand-50 focus:outline-none"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="font-bold text-ink-950">
                          {customer.name}
                        </h3>

                        <StatusBadge
                          status={customer.status}
                        />
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-ink-500 sm:grid-cols-2 lg:grid-cols-4">
                        {customer.company && (
                          <span className="truncate">
                            <span className="font-semibold text-ink-700">
                              الشركة:
                            </span>{' '}
                            {customer.company}
                          </span>
                        )}

                        {customer.phone && (
                          <span
                            dir="ltr"
                            className="truncate text-right"
                          >
                            <span className="font-semibold text-ink-700">
                              الهاتف:
                            </span>{' '}
                            {customer.phone}
                          </span>
                        )}

                        {customer.email && (
                          <span className="truncate">
                            <span className="font-semibold text-ink-700">
                              البريد:
                            </span>{' '}
                            {customer.email}
                          </span>
                        )}

                        {customer.source && (
                          <span className="truncate">
                            <span className="font-semibold text-ink-700">
                              المصدر:
                            </span>{' '}
                            {customer.source}
                          </span>
                        )}
                      </div>

                      {customer.notes && (
                        <p className="mt-3 rounded-xl border border-sand-100 bg-sand-50 px-3.5 py-3 text-xs leading-5 text-ink-600">
                          {customer.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-5 lg:justify-end lg:shrink-0">
                      <div className="text-right">
                        <p className="text-[11px] font-medium text-ink-400">
                          إجمالي الإنفاق
                        </p>

                        <p className="mt-1 font-bold text-ink-950">
                          {Number(
                            customer.total_spent || 0
                          ).toLocaleString('ar-EG')}{' '}
                          ج.م
                        </p>
                      </div>

                      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-sand-100 bg-white text-ink-400 transition group-hover:text-ink-700">
                        <svg
                          width="17"
                          height="17"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path
                            d="M9 18L15 12L9 6"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowAddLead(false)
            }
          }}
        >
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/50 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-lead-title"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-sand-100 bg-white/95 p-5 backdrop-blur">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-50 text-gold-700">
                    <PlusIcon />
                  </div>

                  <span className="text-[11px] font-bold uppercase tracking-wider text-gold-700">
                    عميل محتمل
                  </span>
                </div>

                <h2
                  id="add-lead-title"
                  className="text-lg font-bold text-ink-950"
                >
                  إضافة عميل محتمل
                </h2>

                <p className="mt-1 text-xs text-ink-400">
                  أضف البيانات الأساسية وسيتم حفظها مباشرة في CRM.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddLead(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-xl text-ink-400 transition hover:bg-sand-100 hover:text-ink-800"
                aria-label="إغلاق"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleAddLead}
              className="space-y-5 p-5"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-ink-700">
                    الاسم *
                  </label>

                  <input
                    value={newLead.name}
                    onChange={(event) =>
                      setNewLead((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                    autoFocus
                    className="min-h-11 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-sm text-ink-900 outline-none transition focus:border-gold-400 focus:bg-white focus:ring-4 focus:ring-gold-500/10"
                    placeholder="اسم العميل"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-ink-700">
                    الشركة
                  </label>

                  <input
                    value={newLead.company}
                    onChange={(event) =>
                      setNewLead((current) => ({
                        ...current,
                        company: event.target.value,
                      }))
                    }
                    className="min-h-11 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-sm text-ink-900 outline-none transition focus:border-gold-400 focus:bg-white focus:ring-4 focus:ring-gold-500/10"
                    placeholder="اسم الشركة"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-ink-700">
                    رقم الهاتف
                  </label>

                  <input
                    value={newLead.phone}
                    onChange={(event) =>
                      setNewLead((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    dir="ltr"
                    className="min-h-11 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-left text-sm text-ink-900 outline-none transition focus:border-gold-400 focus:bg-white focus:ring-4 focus:ring-gold-500/10"
                    placeholder="01xxxxxxxxx"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-ink-700">
                    المصدر
                  </label>

                  <select
                    value={newLead.source}
                    onChange={(event) =>
                      setNewLead((current) => ({
                        ...current,
                        source: event.target.value,
                      }))
                    }
                    className="min-h-11 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-sm text-ink-900 outline-none transition focus:border-gold-400 focus:bg-white focus:ring-4 focus:ring-gold-500/10"
                  >
                    <option value="">
                      اختر المصدر
                    </option>

                    {SOURCE_OPTIONS.map((source) => (
                      <option
                        key={source}
                        value={source}
                      >
                        {source}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-ink-700">
                    موعد المتابعة
                  </label>

                  <input
                    type="datetime-local"
                    value={newLead.follow_up_at}
                    onChange={(event) =>
                      setNewLead((current) => ({
                        ...current,
                        follow_up_at:
                          event.target.value,
                      }))
                    }
                    className="min-h-11 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-sm text-ink-900 outline-none transition focus:border-gold-400 focus:bg-white focus:ring-4 focus:ring-gold-500/10"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-ink-700">
                    ملاحظات
                  </label>

                  <textarea
                    value={newLead.notes}
                    onChange={(event) =>
                      setNewLead((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    rows={4}
                    className="w-full resize-none rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 text-sm text-ink-900 outline-none transition focus:border-gold-400 focus:bg-white focus:ring-4 focus:ring-gold-500/10"
                    placeholder="أي ملاحظات مهمة عن العميل..."
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-sand-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setShowAddLead(false)
                  }
                  className="min-h-11 rounded-xl border border-sand-200 px-5 py-2.5 text-sm font-bold text-ink-700 transition hover:bg-sand-50"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-11 rounded-xl bg-ink-950 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-ink-900 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? 'جاري الحفظ...'
                    : 'حفظ العميل المحتمل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
