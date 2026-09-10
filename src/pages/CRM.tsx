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
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusClasses(
        status
      )}`}
    >
      {value}
    </span>
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

  const [activeTab, setActiveTab] = useState<'leads' | 'customers'>('leads')

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
      newLeads: leads.filter((lead) => lead.status === 'جديد').length,
      interested: leads.filter((lead) => lead.status === 'مهتم').length,
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
      <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-200 bg-red-50 p-8 text-red-700">
          <h2 className="text-xl font-bold">
            قاعدة البيانات غير متصلة
          </h2>

          <p className="mt-2 text-sm">
            تأكد من إعداد متغيرات Supabase في بيئة التشغيل.
          </p>
        </div>
      </div>
    )
  }

  if (organizationLoading || loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-gray-50"
        dir="rtl"
      >
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />

          <p className="mt-4 text-sm text-gray-500">
            جاري تحميل بيانات CRM...
          </p>
        </div>
      </div>
    )
  }

  if (organizationError || !organizationId) {
    return (
      <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
        <div className="mx-auto max-w-5xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-amber-800">
          <h2 className="text-xl font-bold">
            لا توجد مؤسسة مرتبطة بالحساب
          </h2>

          <p className="mt-2 text-sm">
            {organizationError ||
              'الحساب الحالي غير مرتبط بأي مؤسسة.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-gray-50 p-4 md:p-6"
      dir="rtl"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              إدارة العملاء
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              إدارة العملاء المحتملين والعملاء الحاليين من مكان واحد
            </p>
          </div>

          {activeTab === 'leads' && (
            <button
              type="button"
              onClick={() => setShowAddLead(true)}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              + إضافة عميل محتمل
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              العملاء المحتملون
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              {stats.leads}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              عملاء جدد
            </p>

            <p className="mt-2 text-2xl font-bold text-blue-600">
              {stats.newLeads}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              مهتمون
            </p>

            <p className="mt-2 text-2xl font-bold text-amber-600">
              {stats.interested}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              العملاء
            </p>

            <p className="mt-2 text-2xl font-bold text-green-600">
              {stats.customers}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              المتابعات
            </p>

            <p className="mt-2 text-2xl font-bold text-purple-600">
              {stats.followUps}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('leads')}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition md:flex-none ${
                activeTab === 'leads'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              العملاء المحتملون ({leads.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('customers')}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition md:flex-none ${
                activeTab === 'customers'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              العملاء ({customers.length})
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
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
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </div>

            {activeTab === 'leads' && (
              <select
                value={leadStatus}
                onChange={(event) =>
                  setLeadStatus(event.target.value)
                }
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
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
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50"
              >
                مسح
              </button>
            )}
          </div>
        </div>

        {/* Leads */}
        {activeTab === 'leads' && (
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-bold text-gray-900">
                العملاء المحتملون
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                {filteredLeads.length} نتيجة
              </p>
            </div>

            {filteredLeads.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="text-4xl">👥</div>

                <h3 className="mt-4 font-bold text-gray-900">
                  لا توجد نتائج
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  لم يتم العثور على عملاء محتملين مطابقين للبحث.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="p-5 transition hover:bg-gray-50"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="font-bold text-gray-900">
                            {lead.name}
                          </h3>

                          <StatusBadge status={lead.status} />
                        </div>

                        <div className="mt-2 grid gap-2 text-sm text-gray-500 md:grid-cols-2 lg:grid-cols-4">
                          {lead.company && (
                            <span>
                              الشركة: {lead.company}
                            </span>
                          )}

                          {lead.phone && (
                            <span>
                              الهاتف: {lead.phone}
                            </span>
                          )}

                          {lead.source && (
                            <span>
                              المصدر: {lead.source}
                            </span>
                          )}

                          <span>
                            أضيف في: {formatShortDate(lead.created_at)}
                          </span>
                        </div>

                        {lead.notes && (
                          <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                            {lead.notes}
                          </p>
                        )}

                        {lead.follow_up_at && (
                          <p className="mt-2 text-xs font-medium text-purple-600">
                            المتابعة:
                            {' '}
                            {formatDate(lead.follow_up_at)}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={lead.status || 'جديد'}
                          onChange={(event) =>
                            handleLeadStatus(
                              lead.id,
                              event.target.value
                            )
                          }
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
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
                            className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
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
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
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
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-bold text-gray-900">
                العملاء الحاليون
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                {filteredCustomers.length} نتيجة
              </p>
            </div>

            {filteredCustomers.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="text-4xl">🏢</div>

                <h3 className="mt-4 font-bold text-gray-900">
                  لا توجد نتائج
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  لا يوجد عملاء مطابقون للبحث الحالي.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() =>
                      navigate(
                        `/crm/customer/${customer.id}`
                      )
                    }
                    className="block w-full p-5 text-right transition hover:bg-gray-50"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="font-bold text-gray-900">
                            {customer.name}
                          </h3>

                          <StatusBadge
                            status={customer.status}
                          />
                        </div>

                        <div className="mt-2 grid gap-2 text-sm text-gray-500 md:grid-cols-2 lg:grid-cols-4">
                          {customer.company && (
                            <span>
                              الشركة: {customer.company}
                            </span>
                          )}

                          {customer.phone && (
                            <span>
                              الهاتف: {customer.phone}
                            </span>
                          )}

                          {customer.email && (
                            <span>
                              البريد: {customer.email}
                            </span>
                          )}

                          {customer.source && (
                            <span>
                              المصدر: {customer.source}
                            </span>
                          )}
                        </div>

                        {customer.notes && (
                          <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                            {customer.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-left">
                          <p className="text-xs text-gray-500">
                            إجمالي الإنفاق
                          </p>

                          <p className="mt-1 font-bold text-gray-900">
                            {Number(
                              customer.total_spent || 0
                            ).toLocaleString('ar-EG')}
                            {' '}
                            ج.م
                          </p>
                        </div>

                        <span className="text-gray-400">
                          ←
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-lead-title"
            >
              <div className="flex items-center justify-between border-b border-gray-100 p-5">
                <div>
                  <h2
                    id="add-lead-title"
                    className="text-lg font-bold text-gray-900"
                  >
                    إضافة عميل محتمل
                  </h2>

                  <p className="mt-1 text-xs text-gray-500">
                    أضف البيانات الأساسية وسيتم حفظها مباشرة في CRM.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddLead(false)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
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
                    <label className="mb-2 block text-sm font-medium text-gray-700">
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
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                      placeholder="اسم العميل"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
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
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                      placeholder="اسم الشركة"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
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
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left text-sm outline-none focus:border-blue-500"
                      placeholder="01xxxxxxxxx"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
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
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
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
                    <label className="mb-2 block text-sm font-medium text-gray-700">
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
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
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
                      className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                      placeholder="أي ملاحظات مهمة عن العميل..."
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setShowAddLead(false)
                    }
                    className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    إلغاء
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
    </div>
  )
}
