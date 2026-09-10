import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import { usePermissions } from '../hooks/usePermissions'

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

type Organization = {
  id: string
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

  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

const formatShortDate = (value: string | null) => {
  if (!value) return '—'

  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

const normalizeValue = (value: string | null | undefined) =>
  value?.trim() || null

export default function CRM() {
  const navigate = useNavigate()
  const { can } = usePermissions()

  const [organization, setOrganization] = useState<Organization | null>(null)

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

  const loadOrganization = async () => {
    if (!supabase) return null

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw userError || new Error('لم يتم العثور على المستخدم')
    }

    const { data, error } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (error) throw error

    if (!data?.organization_id) {
      throw new Error('المستخدم غير مرتبط بأي مؤسسة')
    }

    const org = {
      id: data.organization_id,
    }

    setOrganization(org)

    return org
  }

  const loadCRM = async (organizationId: string) => {
    if (!supabase) return

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

      if (leadsResult.error) throw leadsResult.error
      if (customersResult.error) throw customersResult.error

      setLeads((leadsResult.data || []) as Lead[])
      setCustomers((customersResult.data || []) as Customer[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      if (!supabase) {
        setLoading(false)
        return
      }

      try {
        const org = await loadOrganization()

        if (mounted && org) {
          await loadCRM(org.id)
        }
      } catch (error) {
        console.error('CRM initialization error:', error)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initialize()

    return () => {
      mounted = false
    }
  }, [])

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
        .some((value) => String(value).toLowerCase().includes(query))
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
        .some((value) => String(value).toLowerCase().includes(query))
    )
  }, [customers, search])

  const stats = useMemo(
    () => ({
      leads: leads.length,
      newLeads: leads.filter((lead) => lead.status === 'جديد').length,
      interested: leads.filter((lead) => lead.status === 'مهتم').length,
      customers: customers.length,
      followUps: [...leads, ...customers].filter(
        (item) => item.follow_up_at
      ).length,
    }),
    [leads, customers]
  )

  const handleAddLead = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!supabase || !organization) return

    if (!can('leads', 'create')) {
      alert('ليس لديك صلاحية لإضافة عميل محتمل')
      return
    }

    if (!newLead.name.trim()) {
      alert('اكتب اسم العميل المحتمل')
      return
    }

    setSaving(true)

    try {
      const { data, error } = await supabase
        .from('leads')
        .insert({
          organization_id: organization.id,
          name: newLead.name.trim(),
          company: normalizeValue(newLead.company),
          phone: normalizeValue(newLead.phone),
          source: normalizeValue(newLead.source),
          notes: normalizeValue(newLead.notes),
          follow_up_at: newLead.follow_up_at
            ? new Date(newLead.follow_up_at).toISOString()
            : null,
          status: 'جديد',
        })
        .select()
        .single()

      if (error) throw error

      setLeads((current) => [data as Lead, ...current])

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
      alert('حدث خطأ أثناء إضافة العميل المحتمل')
    } finally {
      setSaving(false)
    }
  }

  const handleLeadStatus = async (
    leadId: string,
    status: string
  ) => {
    if (!supabase || !organization) return

    if (!can('leads', 'update')) {
      alert('ليس لديك صلاحية لتعديل العميل المحتمل')
      return
    }

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
        .eq('organization_id', organization.id)

      if (error) throw error
    } catch (error) {
      console.error('Update lead status error:', error)
      setLeads(previous)
      alert('تعذر تحديث حالة العميل المحتمل')
    }
  }

  const handleConvert = async (lead: Lead) => {
    if (!supabase || !organization) return

    if (!can('leads', 'update')) {
      alert('ليس لديك صلاحية لتحويل العميل المحتمل')
      return
    }

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

      if (error) throw error

      const customerId =
        typeof data === 'string'
          ? data
          : data?.customer_id || data?.id || null

      if (customerId) {
        navigate(`/crm/customer/${customerId}`)
        return
      }

      await loadCRM(organization.id)
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
    if (!supabase || !organization) return

    if (!can('leads', 'delete')) {
      alert('ليس لديك صلاحية لحذف العميل المحتمل')
      return
    }

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
        .eq('organization_id', organization.id)

      if (error) throw error
    } catch (error) {
      console.error('Delete lead error:', error)
      setLeads(previous)
      alert('حدث خطأ أثناء حذف العميل المحتمل')
    }
  }

  const handleCustomerClick = (customerId: string) => {
    navigate(`/crm/customer/${customerId}`)
  }

  const renderStatusBadge = (status: string | null) => {
    const value = status || 'غير محدد'

    const classes =
      value === 'جديد'
        ? 'bg-blue-50 text-blue-700'
        : value === 'تم التواصل'
        ? 'bg-indigo-50 text-indigo-700'
        : value === 'مهتم'
        ? 'bg-amber-50 text-amber-700'
        : value === 'عرض سعر'
        ? 'bg-purple-50 text-purple-700'
        : value === 'تفاوض'
        ? 'bg-orange-50 text-orange-700'
        : value === 'تم التعاقد'
        ? 'bg-green-50 text-green-700'
        : value === 'خسرنا'
        ? 'bg-red-50 text-red-700'
        : 'bg-gray-50 text-gray-700'

    return (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${classes}`}
      >
        {value}
      </span>
    )
  }

  if (!supabase) {
    return (
      <div className="p-6" dir="rtl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h2 className="mb-2 text-lg font-bold">
            قاعدة البيانات غير متصلة
          </h2>
          <p className="text-sm">
            تأكد من إعداد متغيرات Supabase في بيئة التشغيل.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6" dir="rtl">
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

          {activeTab === 'leads' && can('leads', 'create') && (
            <button
              type="button"
              onClick={() => setShowAddLead(true)}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              + إضافة عميل محتمل
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm text-gray-500">
              العملاء المحتملون
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {stats.leads}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm text-gray-500">
              عملاء جدد
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-600">
              {stats.newLeads}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm text-gray-500">
              مهتمون
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600">
              {stats.interested}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm text-gray-500">
              العملاء
            </div>
            <div className="mt-2 text-2xl font-bold text-green-600">
              {stats.customers}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm text-gray-500">
              متابعات
            </div>
            <div className="mt-2 text-2xl font-bold text-purple-600">
              {stats.followUps}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="rounded-2xl border bg-white p-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('leads')
                setSearch('')
              }}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === 'leads'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              العملاء المحتملون ({leads.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('customers')
                setSearch('')
              }}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === 'customers'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              العملاء ({customers.length})
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="flex-1">
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder={
                  activeTab === 'leads'
                    ? 'ابحث بالاسم أو الشركة أو الهاتف...'
                    : 'ابحث بالاسم أو الشركة أو الهاتف أو البريد...'
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
                    {status}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-hidden rounded-2xl border bg-white">
          {loading ? (
            <div className="p-12 text-center text-sm text-gray-500">
              جاري تحميل بيانات العملاء...
            </div>
          ) : activeTab === 'leads' ? (
            filteredLeads.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-lg font-semibold text-gray-800">
                  لا يوجد عملاء محتملون
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  أضف أول عميل محتمل للبدء في إدارة المبيعات.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-right">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="px-5 py-4 text-xs font-semibold text-gray-500">
                        العميل
                      </th>
                      <th className="px-5 py-4 text-xs font-semibold text-gray-500">
                        الهاتف
                      </th>
                      <th className="px-5 py-4 text-xs font-semibold text-gray-500">
                        المصدر
                      </th>
                      <th className="px-5 py-4 text-xs font-semibold text-gray-500">
                        الحالة
                      </th>
                      <th className="px-5 py-4 text-xs font-semibold text-gray-500">
                        المتابعة
                      </th>
                      <th className="px-5 py-4 text-xs font-semibold text-gray-500">
                        تاريخ الإضافة
                      </th>
                      <th className="px-5 py-4 text-xs font-semibold text-gray-500">
                        الإجراءات
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {filteredLeads.map((lead) => (
                      <tr
                        key={lead.id}
                        className="transition hover:bg-gray-50"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-gray-900">
                            {lead.name}
                          </div>

                          {lead.company && (
                            <div className="mt-1 text-xs text-gray-500">
                              {lead.company}
                            </div>
                          )}

                          {lead.notes && (
                            <div className="mt-1 max-w-xs truncate text-xs text-gray-400">
                              {lead.notes}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {lead.phone || '—'}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {lead.source || '—'}
                        </td>

                        <td className="px-5 py-4">
                          {can('leads', 'update') ? (
                            <select
                              value={lead.status || 'جديد'}
                              onChange={(event) =>
                                handleLeadStatus(
                                  lead.id,
                                  event.target.value
                                )
                              }
                              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-500"
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
                          ) : (
                            renderStatusBadge(lead.status)
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {lead.follow_up_at
                            ? formatDate(lead.follow_up_at)
                            : '—'}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-500">
                          {formatShortDate(lead.created_at)}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            {can('leads', 'update') && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                  handleConvert(lead)
                                }
                                className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                              >
                                تحويل لعميل
                              </button>
                            )}

                            {can('leads', 'delete') && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteLead(lead)
                                }
                                className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                              >
                                حذف
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredCustomers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-lg font-semibold text-gray-800">
                لا يوجد عملاء
              </div>
              <p className="mt-2 text-sm text-gray-500">
                العملاء الذين تم تحويلهم من الـ Leads سيظهرون هنا.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-right">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-5 py-4 text-xs font-semibold text-gray-500">
                      العميل
                    </th>
                    <th className="px-5 py-4 text-xs font-semibold text-gray-500">
                      الهاتف
                    </th>
                    <th className="px-5 py-4 text-xs font-semibold text-gray-500">
                      البريد
                    </th>
                    <th className="px-5 py-4 text-xs font-semibold text-gray-500">
                      المصدر
                    </th>
                    <th className="px-5 py-4 text-xs font-semibold text-gray-500">
                      المتابعة
                    </th>
                    <th className="px-5 py-4 text-xs font-semibold text-gray-500">
                      إجمالي الإنفاق
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      onClick={() =>
                        handleCustomerClick(customer.id)
                      }
                      className="cursor-pointer transition hover:bg-blue-50"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900">
                          {customer.name}
                        </div>

                        {customer.company && (
                          <div className="mt-1 text-xs text-gray-500">
                            {customer.company}
                          </div>
                        )}

                        {customer.status && (
                          <div className="mt-2">
                            {renderStatusBadge(customer.status)}
                          </div>
                        )}

                        {customer.notes && (
                          <div className="mt-1 max-w-xs truncate text-xs text-gray-400">
                            {customer.notes}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {customer.phone || '—'}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {customer.email || '—'}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {customer.source || '—'}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {customer.follow_up_at
                          ? formatDate(customer.follow_up_at)
                          : '—'}
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-gray-800">
                        {customer.total_spent
                          ? `${Number(
                              customer.total_spent
                            ).toLocaleString('ar-EG')} ج.م`
                          : '0 ج.م'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAddLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  إضافة عميل محتمل
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  أضف البيانات الأساسية للبدء في متابعة العميل.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddLead(false)}
                className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleAddLead}
              className="space-y-5 p-6"
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
                    placeholder="اسم العميل"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    required
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
                    placeholder="اسم الشركة"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    الهاتف
                  </label>

                  <input
                    value={newLead.phone}
                    onChange={(event) =>
                      setNewLead((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="01xxxxxxxxx"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    dir="ltr"
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
                    <option value="">اختر المصدر</option>

                    {SOURCE_OPTIONS.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    موعد المتابعة
                  </label>

                  <input
                    type="datetime-local"
                    value={newLead.follow_up_at}
                    onChange={(event) =>
                      setNewLead((current) => ({
                        ...current,
                        follow_up_at: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
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
                  placeholder="اكتب أي ملاحظات مهمة عن العميل..."
                  className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 pt-2 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddLead(false)}
                  className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ العميل المحتمل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
