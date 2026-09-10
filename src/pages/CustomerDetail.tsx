import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, statusTone } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface Customer {
  id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
  status: string
  total_spent: number
  tags: string[] | null
  created_at: string
  source: string | null
  notes: string | null
  follow_up_at: string | null
  assigned_to: string | null
  updated_at: string | null
}

interface Deal {
  id: string
  title: string
  value: number
  stage_id: string | null
  pipeline_stages?: { name: string } | null
}

interface Appointment {
  id: string
  appointment_date: string | null
  appointment_time: string | null
  status: string
  services?: { name: string } | null
}

interface Activity {
  id: string
  activity_type: string
  title: string
  description: string | null
  created_at: string
}

interface Task {
  id: string
  title: string
  due_date: string | null
  priority: string | null
  status: string | null
}

interface Conversation {
  id: string
  channel: string | null
  handled_by: string | null
  last_message_at: string | null
}

interface User {
  id: string
  full_name: string | null
  email: string | null
  active: boolean | null
}

const statuses = [
  'نشط',
  'غير نشط',
  'جديد',
  'متابعة',
  'محتمل',
  'مهم',
]

const activityIcon = (type: string) => {
  const icons: Record<string, string> = {
    created: '✦',
    conversion: '↗',
    note: '✎',
    status_change: '↻',
    task: '✓',
    deal: '◆',
    appointment: '◷',
    call: '☎',
    message: '◌',
  }

  return icons[type] || '•'
}

const channelLabel = (channel: string | null) => {
  if (!channel) return 'محادثة'
  const labels: Record<string, string> = {
    whatsapp: 'واتساب',
    facebook: 'فيسبوك',
    messenger: 'Messenger',
    instagram: 'Instagram',
    web: 'الموقع',
  }

  return labels[channel.toLowerCase()] || channel
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—'

  return new Date(value).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '—'

  return new Date(value).toLocaleString('ar-EG', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { organizationId, loading: orgLoading } = useOrganization()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [users, setUsers] = useState<User[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    status: '',
    source: '',
    notes: '',
    follow_up_at: '',
    assigned_to: '',
    tags: '',
  })

  const loadCustomer = async () => {
    if (!supabase || !organizationId || !id) return

    const sb = supabase

    setLoading(true)
    setError(null)

    try {
      const [
        customerRes,
        dealsRes,
        appointmentsRes,
        activitiesRes,
        tasksRes,
        conversationsRes,
        usersRes,
      ] = await Promise.all([
        sb
          .from('customers')
          .select('*')
          .eq('id', id)
          .eq('organization_id', organizationId)
          .single(),

        sb
          .from('deals')
          .select('id,title,value,stage_id,pipeline_stages(name)')
          .eq('customer_id', id)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false }),

        sb
          .from('appointments')
          .select('id,appointment_date,appointment_time,status,services(name)')
          .eq('customer_id', id)
          .eq('organization_id', organizationId)
          .order('appointment_date', { ascending: false }),

        sb
          .from('crm_activities')
          .select('id,activity_type,title,description,created_at')
          .eq('entity_type', 'customer')
          .eq('entity_id', id)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(20),

        sb
         .from('tasks')
         .select('id,title,due_date,priority,status')
         .eq('organization_id', organizationId)
         .eq('customer_id', id)
         .order('due_date', { ascending: true })
         .limit(50),

        sb
          .from('conversations')
          .select('id,channel,handled_by,last_message_at')
          .eq('customer_id', id)
          .eq('organization_id', organizationId)
          .order('last_message_at', { ascending: false })
          .limit(10),

        sb
          .from('users')
          .select('id,full_name,email,active')
          .eq('organization_id', organizationId)
          .eq('active', true)
          .order('full_name'),
      ])

      if (customerRes.error) throw customerRes.error

      const customerData = customerRes.data as Customer

      setCustomer(customerData)
      setDeals((dealsRes.data || []) as unknown as Deal[])
      setAppointments((appointmentsRes.data || []) as unknown as Appointment[])
      setActivities((activitiesRes.data || []) as Activity[])
      setConversations((conversationsRes.data || []) as Conversation[])
      setUsers((usersRes.data || []) as User[])  
  
      const customerTasks = (tasksRes.data || []) as Task[
      
      setTasks(customerTasks)

      setForm({
        name: customerData.name || '',
        company: customerData.company || '',
        phone: customerData.phone || '',
        email: customerData.email || '',
        status: customerData.status || '',
        source: customerData.source || '',
        notes: customerData.notes || '',
        follow_up_at: customerData.follow_up_at
          ? new Date(customerData.follow_up_at).toISOString().slice(0, 16)
          : '',
        assigned_to: customerData.assigned_to || '',
        tags: customerData.tags?.join(', ') || '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء تحميل العميل')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomer()
  }, [id, organizationId])

  const assignedUser = useMemo(
    () => users.find(user => user.id === customer?.assigned_to),
    [users, customer]
  )

  const totalDealsValue = useMemo(
    () => deals.reduce((sum, deal) => sum + Number(deal.value || 0), 0),
    [deals]
  )

  const upcomingFollowUp = customer?.follow_up_at
    ? new Date(customer.follow_up_at)
    : null

  const saveCustomer = async () => {
    if (!supabase || !organizationId || !id || !customer) return

    if (!form.name.trim()) {
      setError('اسم العميل مطلوب')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const tags = form.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean)

      const { data, error: updateError } = await supabase
        .from('customers')
        .update({
          name: form.name.trim(),
          company: form.company.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          status: form.status || 'نشط',
          source: form.source.trim() || null,
          notes: form.notes.trim() || null,
          follow_up_at: form.follow_up_at
            ? new Date(form.follow_up_at).toISOString()
            : null,
          assigned_to: form.assigned_to || null,
          tags,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('organization_id', organizationId)
        .select('*')
        .single()

      if (updateError) throw updateError

      setCustomer(data as Customer)
      setShowEdit(false)

      await supabase.from('crm_activities').insert({
        organization_id: organizationId,
        entity_type: 'customer',
        entity_id: id,
        activity_type: 'note',
        title: 'تم تحديث بيانات العميل',
        description: 'تم تعديل بيانات العميل من صفحة تفاصيل العميل.',
      })

      await loadCustomer()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ التعديلات')
    } finally {
      setSaving(false)
    }
  }

  const deleteCustomer = async () => {
    if (!supabase || !organizationId || !id) return

    setSaving(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId)

      if (deleteError) throw deleteError

      navigate('/crm')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حذف العميل')
      setSaving(false)
    }
  }

  if (orgLoading || loading) {
    return (
      <div dir="rtl" className="space-y-6 animate-pulse">
        <div className="h-5 w-28 bg-sand-200 rounded-lg" />
        <div className="h-48 bg-sand-100 rounded-3xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(item => (
            <div key={item} className="h-28 bg-sand-100 rounded-2xl" />
          ))}
        </div>
        <div className="h-80 bg-sand-100 rounded-3xl" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div dir="rtl" className="py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto text-2xl">
          !
        </div>
        <h2 className="mt-5 text-xl font-bold text-ink-950">
          العميل غير موجود
        </h2>
        <p className="text-sm text-ink-900/50 mt-2">
          قد يكون العميل محذوفًا أو غير متاح لحسابك.
        </p>
        <Link
          to="/crm"
          className="inline-flex mt-5 px-5 py-2.5 rounded-xl bg-ink-900 text-white text-sm font-semibold"
        >
          العودة إلى CRM
        </Link>
      </div>
    )
  }

  return (
    <div dir="rtl" className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/crm"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-900/55 hover:text-ink-950 transition-colors"
        >
          <span className="text-lg">→</span>
          العودة للعملاء
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setShowEdit(true)}
          >
            تعديل العميل
          </Button>

          <button
            onClick={() => setShowDelete(true)}
            className="w-10 h-10 rounded-xl border border-red-100 bg-white text-red-500 hover:bg-red-50 transition-colors"
            title="حذف العميل"
          >
            ×
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Customer Hero */}
      <Card className="overflow-hidden">
        <div className="relative p-6 lg:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-gold-400 via-ink-900 to-ink-900" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-3xl bg-ink-900 text-white flex items-center justify-center text-2xl lg:text-3xl font-bold shadow-lg">
                {customer.name.trim().charAt(0)}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl lg:text-3xl font-bold text-ink-950">
                    {customer.name}
                  </h1>

                  <Badge tone={statusTone(customer.status)}>
                    {customer.status}
                  </Badge>
                </div>

                {customer.company && (
                  <p className="mt-1.5 text-sm text-ink-900/50">
                    {customer.company}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-ink-900/60">
                  {customer.phone && (
                    <a
                      href={`tel:${customer.phone}`}
                      dir="ltr"
                      className="hover:text-ink-950 transition-colors"
                    >
                      {customer.phone}
                    </a>
                  )}

                  {customer.email && (
                    <a
                      href={`mailto:${customer.email}`}
                      dir="ltr"
                      className="hover:text-ink-950 transition-colors"
                    >
                      {customer.email}
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {customer.phone && (
                <a
                  href={`tel:${customer.phone}`}
                  className="px-4 py-2.5 rounded-xl bg-ink-900 text-white text-sm font-semibold hover:bg-ink-800 transition-colors"
                >
                  اتصال
                </a>
              )}

              {customer.email && (
                <a
                  href={`mailto:${customer.email}`}
                  className="px-4 py-2.5 rounded-xl bg-white border border-sand-200 text-ink-900 text-sm font-semibold hover:bg-sand-50 transition-colors"
                >
                  بريد إلكتروني
                </a>
              )}
            </div>
          </div>

          <div className="mt-7 pt-6 border-t border-sand-100 grid grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <div className="text-xs text-ink-900/40">العميل منذ</div>
              <div className="mt-1 text-sm font-semibold text-ink-950">
                {formatDate(customer.created_at)}
              </div>
            </div>

            <div>
              <div className="text-xs text-ink-900/40">المصدر</div>
              <div className="mt-1 text-sm font-semibold text-ink-950">
                {customer.source || 'غير محدد'}
              </div>
            </div>

            <div>
              <div className="text-xs text-ink-900/40">المسؤول</div>
              <div className="mt-1 text-sm font-semibold text-ink-950">
                {assignedUser?.full_name || 'غير مُعيّن'}
              </div>
            </div>

            <div>
              <div className="text-xs text-ink-900/40">المتابعة القادمة</div>
              <div className="mt-1 text-sm font-semibold text-ink-950">
                {upcomingFollowUp
                  ? formatDateTime(customer.follow_up_at)
                  : 'لا توجد'}
              </div>
            </div>
          </div>

          {customer.tags && customer.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5">
              {customer.tags.map(tag => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="text-xs text-ink-900/45">إجمالي الإنفاق</div>
          <div className="text-xl lg:text-2xl font-bold text-ink-950 mt-2">
            {Number(customer.total_spent || 0).toLocaleString('ar-EG')}
            <span className="text-xs font-medium mr-1">ج.م</span>
          </div>
          <div className="text-xs text-emerald-600 mt-2">
            قيمة العملاء المحققة
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-ink-900/45">قيمة الصفقات</div>
          <div className="text-xl lg:text-2xl font-bold text-gold-600 mt-2">
            {totalDealsValue.toLocaleString('ar-EG')}
            <span className="text-xs font-medium mr-1">ج.م</span>
          </div>
          <div className="text-xs text-ink-900/45 mt-2">
            {deals.length} صفقة
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-ink-900/45">المواعيد</div>
          <div className="text-xl lg:text-2xl font-bold text-ink-950 mt-2">
            {appointments.length}
          </div>
          <div className="text-xs text-ink-900/45 mt-2">
            مواعيد مسجلة
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-ink-900/45">المحادثات</div>
          <div className="text-xl lg:text-2xl font-bold text-ink-950 mt-2">
            {conversations.length}
          </div>
          <div className="text-xs text-ink-900/45 mt-2">
            محادثة مرتبطة
          </div>
        </Card>
      </div>

      {/* Main */}
      <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
        {/* Timeline */}
        <Card className="p-5 lg:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-ink-950">
                النشاط الأخير
              </h2>
              <p className="text-xs text-ink-900/45 mt-1">
                سجل التفاعلات والتحديثات الخاصة بالعميل
              </p>
            </div>

            <span className="text-xs text-ink-900/40">
              {activities.length} نشاط
            </span>
          </div>

          {activities.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-sand-100 flex items-center justify-center mx-auto text-ink-900/40">
                ◌
              </div>
              <p className="text-sm text-ink-900/45 mt-3">
                لا يوجد نشاط مسجل حتى الآن
              </p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute right-[17px] top-3 bottom-3 w-px bg-sand-200" />

              <div className="space-y-6">
                {activities.map(activity => (
                  <div
                    key={activity.id}
                    className="relative flex gap-4"
                  >
                    <div className="relative z-10 shrink-0 w-9 h-9 rounded-xl bg-white border border-sand-200 flex items-center justify-center text-sm text-ink-900">
                      {activityIcon(activity.activity_type)}
                    </div>

                    <div className="min-w-0 pt-0.5">
                      <div className="font-semibold text-sm text-ink-950">
                        {activity.title}
                      </div>

                      {activity.description && (
                        <p className="text-xs leading-5 text-ink-900/50 mt-1">
                          {activity.description}
                        </p>
                      )}

                      <div className="text-[11px] text-ink-900/35 mt-2">
                        {formatDateTime(activity.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Customer Info */}
        <Card className="p-5 lg:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-ink-950">
                معلومات العميل
              </h2>
              <p className="text-xs text-ink-900/45 mt-1">
                البيانات الأساسية وإدارة المتابعة
              </p>
            </div>

            <button
              onClick={() => setShowEdit(true)}
              className="text-xs font-semibold text-ink-900 hover:underline"
            >
              تعديل
            </button>
          </div>

          <div className="space-y-5">
            <div>
              <div className="text-xs text-ink-900/40">الاسم</div>
              <div className="text-sm font-semibold text-ink-950 mt-1">
                {customer.name}
              </div>
            </div>

            <div>
              <div className="text-xs text-ink-900/40">الشركة</div>
              <div className="text-sm font-semibold text-ink-950 mt-1">
                {customer.company || '—'}
              </div>
            </div>

            <div>
              <div className="text-xs text-ink-900/40">المصدر</div>
              <div className="text-sm font-semibold text-ink-950 mt-1">
                {customer.source || '—'}
              </div>
            </div>

            <div>
              <div className="text-xs text-ink-900/40">المسؤول</div>
              <div className="text-sm font-semibold text-ink-950 mt-1">
                {assignedUser?.full_name || 'غير مُعيّن'}
              </div>
            </div>

            <div>
              <div className="text-xs text-ink-900/40">
                الملاحظات
              </div>

              <div className="mt-2 rounded-xl bg-sand-50 border border-sand-100 p-3 text-sm leading-6 text-ink-900/65 min-h-[80px]">
                {customer.notes || 'لا توجد ملاحظات لهذا العميل'}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Deals */}
      <Card className="p-5 lg:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-ink-950">
              الصفقات
            </h2>
            <p className="text-xs text-ink-900/45 mt-1">
              جميع الصفقات المرتبطة بالعميل
            </p>
          </div>

          <Badge>{deals.length} صفقة</Badge>
        </div>

        {deals.length === 0 ? (
          <div className="py-10 text-center text-sm text-ink-900/40">
            لا توجد صفقات مرتبطة بهذا العميل
          </div>
        ) : (
          <div className="space-y-2">
            {deals.map(deal => (
              <div
                key={deal.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-sand-100 hover:border-sand-200 hover:bg-sand-50/50 transition-colors"
              >
                <div>
                  <div className="font-semibold text-sm text-ink-950">
                    {deal.title}
                  </div>

                  <div className="text-xs text-ink-900/45 mt-1">
                    {deal.pipeline_stages?.name || 'بدون مرحلة'}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge tone="gold">
                    {Number(deal.value || 0).toLocaleString('ar-EG')} ج.م
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Appointments + Conversations */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-ink-950">
                المواعيد
              </h2>
              <p className="text-xs text-ink-900/45 mt-1">
                المواعيد المرتبطة بالعميل
              </p>
            </div>

            <Badge>{appointments.length}</Badge>
          </div>

          {appointments.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-900/40">
              لا توجد مواعيد
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map(appointment => (
                <div
                  key={appointment.id}
                  className="p-4 rounded-2xl border border-sand-100"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-sm text-ink-950">
                        {appointment.services?.name || 'موعد'}
                      </div>

                      <div className="text-xs text-ink-900/45 mt-1">
                        {appointment.appointment_date || '—'}
                        {appointment.appointment_time
                          ? ` · ${appointment.appointment_time}`
                          : ''}
                      </div>
                    </div>

                    <Badge tone={statusTone(appointment.status)}>
                      {appointment.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-ink-950">
                المحادثات
              </h2>
              <p className="text-xs text-ink-900/45 mt-1">
                قنوات التواصل المرتبطة بالعميل
              </p>
            </div>

            <Badge>{conversations.length}</Badge>
          </div>

          {conversations.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-900/40">
              لا توجد محادثات مرتبطة
            </div>
          ) : (
            <div className="space-y-3">
              {conversations.map(conversation => (
                <div
                  key={conversation.id}
                  className="p-4 rounded-2xl border border-sand-100 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-semibold text-sm text-ink-950">
                      {channelLabel(conversation.channel)}
                    </div>

                    <div className="text-xs text-ink-900/45 mt-1">
                      {conversation.handled_by || 'غير محدد'}
                    </div>
                  </div>

                  <div className="text-xs text-ink-900/40">
                    {formatDateTime(conversation.last_message_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Tasks placeholder intentionally empty until task-customer relation exists */}
      {tasks.length > 0 && (
        <Card className="p-5 lg:p-6">
          <h2 className="text-lg font-bold text-ink-950 mb-5">
            المهام المرتبطة
          </h2>

          <div className="space-y-2">
            {tasks.map(task => (
              <div
                key={task.id}
                className="p-4 rounded-2xl border border-sand-100 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-sm">
                    {task.title}
                  </div>

                  <div className="text-xs text-ink-900/45 mt-1">
                    {task.due_date || 'بدون موعد'}
                  </div>
                </div>

                <Badge tone={statusTone(task.status || '')}>
                  {task.status || 'غير محدد'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/45 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              setShowEdit(false)
            }
          }}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl"
            dir="rtl"
          >
            <div className="p-6 border-b border-sand-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-ink-950">
                    تعديل بيانات العميل
                  </h2>
                  <p className="text-xs text-ink-900/45 mt-1">
                    حدّث بيانات العميل واحفظ التغييرات
                  </p>
                </div>

                <button
                  onClick={() => setShowEdit(false)}
                  className="w-9 h-9 rounded-xl bg-sand-50 text-ink-900/60 hover:bg-sand-100"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="اسم العميل *"
                  value={form.name}
                  onChange={value =>
                    setForm(prev => ({ ...prev, name: value }))
                  }
                />

                <Field
                  label="الشركة"
                  value={form.company}
                  onChange={value =>
                    setForm(prev => ({ ...prev, company: value }))
                  }
                />

                <Field
                  label="الهاتف"
                  value={form.phone}
                  dir="ltr"
                  onChange={value =>
                    setForm(prev => ({ ...prev, phone: value }))
                  }
                />

                <Field
                  label="البريد الإلكتروني"
                  value={form.email}
                  dir="ltr"
                  onChange={value =>
                    setForm(prev => ({ ...prev, email: value }))
                  }
                />

                <div>
                  <label className="block text-xs font-semibold text-ink-900/65 mb-2">
                    الحالة
                  </label>

                  <select
                    value={form.status}
                    onChange={event =>
                      setForm(prev => ({
                        ...prev,
                        status: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm outline-none focus:border-ink-900"
                  >
                    {statuses.map(status => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <Field
                  label="المصدر"
                  value={form.source}
                  onChange={value =>
                    setForm(prev => ({ ...prev, source: value }))
                  }
                />

                <div>
                  <label className="block text-xs font-semibold text-ink-900/65 mb-2">
                    الموظف المسؤول
                  </label>

                  <select
                    value={form.assigned_to}
                    onChange={event =>
                      setForm(prev => ({
                        ...prev,
                        assigned_to: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm outline-none focus:border-ink-900"
                  >
                    <option value="">بدون مسؤول</option>

                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.full_name || user.email || 'موظف'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-900/65 mb-2">
                    موعد المتابعة
                  </label>

                  <input
                    type="datetime-local"
                    value={form.follow_up_at}
                    onChange={event =>
                      setForm(prev => ({
                        ...prev,
                        follow_up_at: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm outline-none focus:border-ink-900"
                  />
                </div>

                <Field
                  label="Tags"
                  value={form.tags}
                  placeholder="عميل مهم، إعلانات، متابعة"
                  onChange={value =>
                    setForm(prev => ({ ...prev, tags: value }))
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-900/65 mb-2">
                  الملاحظات
                </label>

                <textarea
                  value={form.notes}
                  onChange={event =>
                    setForm(prev => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  rows={5}
                  placeholder="أضف ملاحظات عن العميل..."
                  className="w-full resize-none rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm outline-none focus:border-ink-900"
                />
              </div>
            </div>

            <div className="p-6 border-t border-sand-100 flex gap-3">
              <Button
                onClick={saveCustomer}
                disabled={saving}
                className="flex-1"
              >
                {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </Button>

              <Button
                variant="secondary"
                onClick={() => setShowEdit(false)}
                disabled={saving}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 bg-ink-950/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6"
            dir="rtl"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center text-xl">
              !
            </div>

            <h2 className="text-xl font-bold text-ink-950 mt-5">
              حذف العميل؟
            </h2>

            <p className="text-sm leading-6 text-ink-900/55 mt-2">
              سيتم حذف العميل من قائمة العملاء. تأكد من رغبتك في تنفيذ هذا
              الإجراء.
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={deleteCustomer}
                disabled={saving}
                className="flex-1 rounded-xl bg-red-600 text-white px-4 py-3 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'جاري الحذف...' : 'نعم، حذف العميل'}
              </button>

              <button
                onClick={() => setShowDelete(false)}
                disabled={saving}
                className="flex-1 rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm font-semibold text-ink-900 hover:bg-sand-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  dir,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  dir?: 'ltr' | 'rtl'
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink-900/65 mb-2">
        {label}
      </label>

      <input
        value={value}
        dir={dir}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm outline-none focus:border-ink-900 focus:ring-2 focus:ring-ink-900/5"
      />
    </div>
  )
}
