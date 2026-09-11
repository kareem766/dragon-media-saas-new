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
  marketing_opt_in: boolean
  marketing_opt_out_at: string | null
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
  description?: string | null
  due_date: string | null
  reminder_at?: string | null
  priority: string | null
  status: string | null
  assigned_to?: string | null
  customer_id?: string | null
  created_at?: string | null
  completed_at?: string | null
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

const taskStatuses = [
  'جديدة',
  'قيد التنفيذ',
  'مكتملة',
  'ملغاة',
  'متأخرة',
]

const taskPriorities = [
  'عالية',
  'متوسطة',
  'منخفضة',
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
    marketing_consent: '✓',
    marketing_opt_out: '×',
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
    year: 'numeric',
  })
}

const formatTaskDueDate = (value: string | null | undefined) => {
  if (!value) return 'بدون موعد'

  const date = new Date(value)

  return date.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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
  const [taskSaving, setTaskSaving] = useState(false)
  const [marketingSaving, setMarketingSaving] = useState(false)

  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [marketingError, setMarketingError] = useState<string | null>(null)

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

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    due_date: '',
    reminder_at: '',
    priority: 'متوسطة',
    status: 'جديدة',
    assigned_to: '',
  })

  const loadCustomer = async () => {
    if (!supabase || !organizationId || !id) return

    const sb = supabase

    setLoading(true)
    setError(null)

    try {
      /*
       * IMPORTANT:
       * The customer query is the critical query.
       * Related data must never prevent the customer
       * itself from being displayed.
       */

      const { data: customerData, error: customerError } =
        await sb
          .from('customers')
          .select('*')
          .eq('id', id)
          .eq('organization_id', organizationId)
          .single()

      if (customerError) throw customerError
      if (!customerData) {
        throw new Error('العميل غير موجود')
      }

      const typedCustomer = customerData as Customer

      /*
       * Set the customer immediately after the critical
       * query succeeds. This prevents secondary query
       * failures from causing a false "customer not found".
       */
      setCustomer(typedCustomer)

      setForm({
        name: typedCustomer.name || '',
        company: typedCustomer.company || '',
        phone: typedCustomer.phone || '',
        email: typedCustomer.email || '',
        status: typedCustomer.status || '',
        source: typedCustomer.source || '',
        notes: typedCustomer.notes || '',
        follow_up_at: typedCustomer.follow_up_at
          ? new Date(typedCustomer.follow_up_at)
              .toISOString()
              .slice(0, 16)
          : '',
        assigned_to: typedCustomer.assigned_to || '',
        tags: typedCustomer.tags?.join(', ') || '',
      })

      /*
       * All related queries are best-effort.
       * A failure in any one of them should only affect
       * that specific section, not the whole customer page.
       */
      const [
        dealsRes,
        appointmentsRes,
        activitiesRes,
        tasksRes,
        conversationsRes,
        usersRes,
      ] = await Promise.all([
        sb
          .from('deals')
          .select('id,title,value,stage_id,pipeline_stages(name)')
          .eq('customer_id', id)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false }),

        sb
          .from('appointments')
          .select(
            'id,appointment_date,appointment_time,status,services(name)'
          )
          .eq('customer_id', id)
          .eq('organization_id', organizationId)
          .order('appointment_date', { ascending: false }),

        sb
          .from('crm_activities')
          .select(
            'id,activity_type,title,description,created_at'
          )
          .eq('entity_type', 'customer')
          .eq('entity_id', id)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(20),

        sb
          .from('tasks')
          .select(
            'id,title,description,due_date,reminder_at,priority,status,assigned_to,customer_id,created_at,completed_at'
          )
          .eq('organization_id', organizationId)
          .eq('customer_id', id)
          .order('due_date', { ascending: true })
          .limit(50),

        sb
          .from('conversations')
          .select(
            'id,channel,handled_by,last_message_at'
          )
          .eq('customer_id', id)
          .eq('organization_id', organizationId)
          .order('last_message_at', { ascending: false })
          .limit(10),

        sb
          .from('users')
          .select(
            'id,full_name,email,active'
          )
          .eq('organization_id', organizationId)
          .eq('active', true)
          .order('full_name'),
      ])

      /*
       * Log secondary query errors for debugging,
       * but do not throw them.
       */
      if (dealsRes.error) {
        console.error(
          'CustomerDetail: deals query failed',
          dealsRes.error
        )
      }

      if (appointmentsRes.error) {
        console.error(
          'CustomerDetail: appointments query failed',
          appointmentsRes.error
        )
      }

      if (activitiesRes.error) {
        console.error(
          'CustomerDetail: activities query failed',
          activitiesRes.error
        )
      }

      if (tasksRes.error) {
        console.error(
          'CustomerDetail: tasks query failed',
          tasksRes.error
        )
      }

      if (conversationsRes.error) {
        console.error(
          'CustomerDetail: conversations query failed',
          conversationsRes.error
        )
      }

      if (usersRes.error) {
        console.error(
          'CustomerDetail: users query failed',
          usersRes.error
        )
      }

      setDeals(
        dealsRes.error
          ? []
          : ((dealsRes.data || []) as unknown as Deal[])
      )

      setAppointments(
        appointmentsRes.error
          ? []
          : ((appointmentsRes.data || []) as unknown as Appointment[])
      )

      setActivities(
        activitiesRes.error
          ? []
          : ((activitiesRes.data || []) as Activity[])
      )

      setTasks(
        tasksRes.error
          ? []
          : ((tasksRes.data || []) as Task[])
      )

      setConversations(
        conversationsRes.error
          ? []
          : ((conversationsRes.data || []) as Conversation[])
      )

      setUsers(
        usersRes.error
          ? []
          : ((usersRes.data || []) as User[])
      )
    } catch (err) {
      setCustomer(null)

      setError(
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء تحميل العميل'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomer()
  }, [id, organizationId])

  const assignedUser = useMemo(
    () =>
      users.find(
        user => user.id === customer?.assigned_to
      ),
    [users, customer]
  )

  const totalDealsValue = useMemo(
    () =>
      deals.reduce(
        (sum, deal) => sum + Number(deal.value || 0),
        0
      ),
    [deals]
  )

  const upcomingFollowUp = customer?.follow_up_at
    ? new Date(customer.follow_up_at)
    : null

  const openTasksCount = useMemo(
    () =>
      tasks.filter(
        task =>
          task.status !== 'مكتملة' &&
          task.status !== 'ملغاة'
      ).length,
    [tasks]
  )

  const completedTasksCount = useMemo(
    () =>
      tasks.filter(
        task => task.status === 'مكتملة'
      ).length,
    [tasks]
  )

  /*
   * Marketing Consent
   *
   * This is intentionally handled separately from the general
   * customer edit form so changing the customer's basic data
   * cannot accidentally change marketing consent.
   */
  const updateMarketingConsent = async (
    nextOptIn: boolean
  ) => {
    if (
      !supabase ||
      !organizationId ||
      !id ||
      !customer ||
      marketingSaving
    ) {
      return
    }

    if (customer.marketing_opt_in === nextOptIn) {
      return
    }

    setMarketingSaving(true)
    setMarketingError(null)

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError) throw authError

      const userId = authData.user?.id || null
      const now = new Date().toISOString()

      const updatePayload: {
        marketing_opt_in: boolean
        marketing_opt_out_at?: string
        updated_at: string
      } = {
        marketing_opt_in: nextOptIn,
        updated_at: now,
      }

      /*
       * Keep the latest opt-out timestamp permanently.
       * If the customer opts back in, we intentionally do NOT
       * clear marketing_opt_out_at because it represents the
       * last time the customer opted out.
       */
      if (!nextOptIn) {
        updatePayload.marketing_opt_out_at = now
      }

      const { data, error: updateError } =
        await supabase
          .from('customers')
          .update(updatePayload)
          .eq('id', id)
          .eq('organization_id', organizationId)
          .select('*')
          .single()

      if (updateError) throw updateError

      const activityType = nextOptIn
        ? 'marketing_consent'
        : 'marketing_opt_out'

      const activityTitle = nextOptIn
        ? 'تم تفعيل الموافقة على الرسائل التسويقية'
        : 'تم إلغاء الموافقة على الرسائل التسويقية'

      const activityDescription = nextOptIn
        ? 'وافق العميل على استلام الرسائل والحملات التسويقية.'
        : 'ألغى العميل موافقته على استلام الرسائل والحملات التسويقية. لن يتم إدراجه في الحملات التسويقية المستقبلية.'

      const { error: activityError } =
        await supabase.from('crm_activities').insert({
          organization_id: organizationId,
          entity_type: 'customer',
          entity_id: id,
          activity_type: activityType,
          title: activityTitle,
          description: activityDescription,
          actor_id: userId,
          metadata: {
            marketing_opt_in: nextOptIn,
            changed_at: now,
            source: 'customer_detail',
          },
        })

      if (activityError) {
        console.error(
          'Failed to record marketing consent activity:',
          activityError
        )
      }

      setCustomer(data as Customer)

      /*
       * Reload the activity timeline so the consent change
       * appears immediately without changing the existing
       * timeline implementation.
       */
      await loadCustomer()
    } catch (err) {
      setMarketingError(
        err instanceof Error
          ? err.message
          : 'تعذر تحديث حالة الموافقة التسويقية'
      )
    } finally {
      setMarketingSaving(false)
    }
  }

  const resetTaskForm = () => {
    setTaskForm({
      title: '',
      description: '',
      due_date: '',
      reminder_at: '',
      priority: 'متوسطة',
      status: 'جديدة',
      assigned_to: customer?.assigned_to || '',
    })

    setTaskError(null)
  }

  const openTaskModal = () => {
    resetTaskForm()
    setShowTaskModal(true)
  }

  const createTask = async () => {
    if (!supabase || !organizationId || !id || !customer) {
      return
    }

    if (!taskForm.title.trim()) {
      setTaskError('عنوان المهمة مطلوب')
      return
    }

    setTaskSaving(true)
    setTaskError(null)

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError) throw authError

      const userId = authData.user?.id || null

      const { data, error: insertError } =
        await supabase
          .from('tasks')
          .insert({
            organization_id: organizationId,
            title: taskForm.title.trim(),
            description:
              taskForm.description.trim() || null,
            due_date: taskForm.due_date || null,
            reminder_at: taskForm.reminder_at
              ? new Date(
                  taskForm.reminder_at
                ).toISOString()
              : null,
            priority: taskForm.priority,
            status: taskForm.status,
            assigned_to:
              taskForm.assigned_to || null,
            customer_id: id,
            created_by: userId,
          })
          .select(
            'id,title,description,due_date,reminder_at,priority,status,assigned_to,customer_id,created_at,completed_at'
          )
          .single()

      if (insertError) throw insertError

      setTasks(prev => [
        ...prev,
        data as Task,
      ])

      await supabase.from('crm_activities').insert({
        organization_id: organizationId,
        entity_type: 'customer',
        entity_id: id,
        activity_type: 'task',
        title: 'تم إنشاء مهمة جديدة',
        description: `تم إنشاء المهمة: ${taskForm.title.trim()}`,
        actor_id: userId,
        metadata: {
          task_id: data.id,
          task_title: taskForm.title.trim(),
        },
      })

      setShowTaskModal(false)
      resetTaskForm()

      await loadCustomer()
    } catch (err) {
      setTaskError(
        err instanceof Error
          ? err.message
          : 'تعذر إنشاء المهمة'
      )
    } finally {
      setTaskSaving(false)
    }
  }

  const updateTaskStatus = async (
    task: Task,
    status: string
  ) => {
    if (!supabase || !organizationId || !id) {
      return
    }

    setTaskSaving(true)
    setTaskError(null)

    try {
      const { data: authData } =
        await supabase.auth.getUser()

      const userId = authData.user?.id || null

      const { data, error: updateError } =
        await supabase
          .from('tasks')
          .update({
            status,
            completed_at:
              status === 'مكتملة'
                ? new Date().toISOString()
                : null,
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', task.id)
          .eq('organization_id', organizationId)
          .eq('customer_id', id)
          .select(
            'id,title,description,due_date,reminder_at,priority,status,assigned_to,customer_id,created_at,completed_at'
          )
          .single()

      if (updateError) throw updateError

      setTasks(prev =>
        prev.map(item =>
          item.id === task.id
            ? (data as Task)
            : item
        )
      )

      await supabase.from('crm_activities').insert({
        organization_id: organizationId,
        entity_type: 'customer',
        entity_id: id,
        activity_type: 'task',
        title:
          status === 'مكتملة'
            ? 'تم إكمال مهمة'
            : 'تم تحديث حالة مهمة',
        description:
          status === 'مكتملة'
            ? `تم إكمال المهمة: ${task.title}`
            : `تم تغيير حالة المهمة "${task.title}" إلى ${status}.`,
        actor_id: userId,
        metadata: {
          task_id: task.id,
          previous_status: task.status,
          new_status: status,
        },
      })

      await loadCustomer()
    } catch (err) {
      setTaskError(
        err instanceof Error
          ? err.message
          : 'تعذر تحديث المهمة'
      )
    } finally {
      setTaskSaving(false)
    }
  }

  const deleteTask = async (task: Task) => {
    if (!supabase || !organizationId || !id) {
      return
    }

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف المهمة "${task.title}"؟`
    )

    if (!confirmed) return

    setTaskSaving(true)
    setTaskError(null)

    try {
      const { error: deleteError } =
        await supabase
          .from('tasks')
          .delete()
          .eq('id', task.id)
          .eq('organization_id', organizationId)
          .eq('customer_id', id)

      if (deleteError) throw deleteError

      setTasks(prev =>
        prev.filter(item => item.id !== task.id)
      )

      await loadCustomer()
    } catch (err) {
      setTaskError(
        err instanceof Error
          ? err.message
          : 'تعذر حذف المهمة'
      )
    } finally {
      setTaskSaving(false)
    }
  }

  const saveCustomer = async () => {
    if (!supabase || !organizationId || !id || !customer) {
      return
    }

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

      const { data, error: updateError } =
        await supabase
          .from('customers')
          .update({
            name: form.name.trim(),
            company:
              form.company.trim() || null,
            phone:
              form.phone.trim() || null,
            email:
              form.email.trim() || null,
            status:
              form.status || 'نشط',
            source:
              form.source.trim() || null,
            notes:
              form.notes.trim() || null,
            follow_up_at: form.follow_up_at
              ? new Date(
                  form.follow_up_at
                ).toISOString()
              : null,
            assigned_to:
              form.assigned_to || null,
            tags,
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', id)
          .eq('organization_id', organizationId)
          .select('*')
          .single()

      if (updateError) throw updateError

      const { data: authData } =
        await supabase.auth.getUser()

      const userId = authData.user?.id || null

      setCustomer(data as Customer)
      setShowEdit(false)

      await supabase.from('crm_activities').insert({
        organization_id: organizationId,
        entity_type: 'customer',
        entity_id: id,
        activity_type: 'note',
        title: 'تم تحديث بيانات العميل',
        description:
          'تم تعديل بيانات العميل من صفحة تفاصيل العميل.',
        actor_id: userId,
      })

      await loadCustomer()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر حفظ التعديلات'
      )
    } finally {
      setSaving(false)
    }
  }

  const deleteCustomer = async () => {
    if (!supabase || !organizationId || !id) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { error: deleteError } =
        await supabase
          .from('customers')
          .delete()
          .eq('id', id)
          .eq('organization_id', organizationId)

      if (deleteError) throw deleteError

      navigate('/crm')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر حذف العميل'
      )
      setSaving(false)
    }
  }

  if (orgLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="h-48 bg-sand-100 rounded-3xl" />

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(item => (
            <div
              key={item}
              className="h-28 bg-sand-100 rounded-2xl"
            />
          ))}
        </div>

        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
          <div className="h-80 bg-sand-100 rounded-3xl" />
          <div className="h-80 bg-sand-100 rounded-3xl" />
        </div>

        <div className="h-72 bg-sand-100 rounded-3xl" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div
        className="py-16 text-center"
        dir="rtl"
      >
        <div className="w-16 h-16 mx-auto rounded-3xl bg-sand-100 flex items-center justify-center text-2xl text-ink-900/40">
          !
        </div>

        <h2 className="mt-5 text-xl font-bold text-ink-950">
          العميل غير موجود
        </h2>

        <p className="text-sm text-ink-900/50 mt-2">
          قد يكون العميل محذوفًا أو غير متاح لحسابك.
        </p>

        {error && (
          <p className="max-w-xl mx-auto text-xs text-red-600 mt-3 break-words">
            {error}
          </p>
        )}

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
    <div
      className="space-y-6"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/crm"
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900/60 hover:text-ink-950 transition-colors"
        >
          <span>←</span>
          <span>العودة للعملاء</span>
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

      {taskError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {taskError}
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

                  <Badge
                    tone={statusTone(customer.status)}
                  >
                    {customer.status}
                  </Badge>

                  {customer.marketing_opt_in ? (
                    <Badge tone="success">
                      تسويق: موافق
                    </Badge>
                  ) : (
                    <Badge tone="danger">
                      تسويق: غير موافق
                    </Badge>
                  )}
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
              <div className="text-xs text-ink-900/40">
                العميل منذ
              </div>

              <div className="mt-1 text-sm font-semibold text-ink-950">
                {formatDate(customer.created_at)}
              </div>
            </div>

            <div>
              <div className="text-xs text-ink-900/40">
                المصدر
              </div>

              <div className="mt-1 text-sm font-semibold text-ink-950">
                {customer.source || 'غير محدد'}
              </div>
            </div>

            <div>
              <div className="text-xs text-ink-900/40">
                المسؤول
              </div>

              <div className="mt-1 text-sm font-semibold text-ink-950">
                {assignedUser?.full_name ||
                  'غير مُعيّن'}
              </div>
            </div>

            <div>
              <div className="text-xs text-ink-900/40">
                المتابعة القادمة
              </div>

              <div className="mt-1 text-sm font-semibold text-ink-950">
                {upcomingFollowUp
                  ? formatDateTime(
                      customer.follow_up_at
                    )
                  : 'لا توجد'}
              </div>
            </div>
          </div>

          {customer.tags &&
            customer.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-5">
                {customer.tags.map(tag => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
            )}
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-5">
          <div className="text-xs text-ink-900/45">
            إجمالي الإنفاق
          </div>

          <div className="text-xl lg:text-2xl font-bold text-ink-950 mt-2">
            {Number(
              customer.total_spent || 0
            ).toLocaleString('ar-EG')}

            <span className="text-xs font-medium mr-1">
              ج.م
            </span>
          </div>

          <div className="text-xs text-emerald-600 mt-2">
            قيمة العملاء المحققة
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-ink-900/45">
            قيمة الصفقات
          </div>

          <div className="text-xl lg:text-2xl font-bold text-gold-600 mt-2">
            {totalDealsValue.toLocaleString(
              'ar-EG'
            )}

            <span className="text-xs font-medium mr-1">
              ج.م
            </span>
          </div>

          <div className="text-xs text-ink-900/45 mt-2">
            {deals.length} صفقة
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-ink-900/45">
            المهام المفتوحة
          </div>

          <div className="text-xl lg:text-2xl font-bold text-ink-950 mt-2">
            {openTasksCount}
          </div>

          <div className="text-xs text-ink-900/45 mt-2">
            تحتاج متابعة
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-ink-900/45">
            المهام المكتملة
          </div>

          <div className="text-xl lg:text-2xl font-bold text-emerald-600 mt-2">
            {completedTasksCount}
          </div>

          <div className="text-xs text-ink-900/45 mt-2">
            تم إنجازها
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-ink-900/45">
            المحادثات
          </div>

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
                      {activityIcon(
                        activity.activity_type
                      )}
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
                        {formatDateTime(
                          activity.created_at
                        )}
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
              <div className="text-xs text-ink-900/40">
                الاسم
              </div>

              <div className="text-sm font-semibold text-ink-950 mt-1">
                {customer.name}
              </div>
            </div>

            <div>
              <div className="text-xs text-ink-900/40">
                الشركة
              </div>

              <div className="text-sm font-semibold text-ink-950 mt-1">
                {customer.company || '—'}
              </div>
            </div>

            <div>
              <div className="text-xs text-ink-900/40">
                المصدر
              </div>

              <div className="text-sm font-semibold text-ink-950 mt-1">
                {customer.source || '—'}
              </div>
            </div>

            <div>
              <div className="text-xs text-ink-900/40">
                المسؤول
              </div>

              <div className="text-sm font-semibold text-ink-950 mt-1">
                {assignedUser?.full_name ||
                  'غير مُعيّن'}
              </div>
            </div>

            {/* Marketing Consent */}
            <div className="rounded-2xl border border-sand-200 bg-sand-50/60 p-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm ${
                        customer.marketing_opt_in
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {customer.marketing_opt_in
                        ? '✓'
                        : '×'}
                    </div>

                    <div>
                      <div className="text-sm font-bold text-ink-950">
                        الموافقة على الرسائل التسويقية
                      </div>

                      <div className="text-xs text-ink-900/45 mt-0.5">
                        {customer.marketing_opt_in
                          ? 'العميل يسمح بإدراجه في الحملات التسويقية.'
                          : 'العميل غير مسموح بإدراجه في الحملات التسويقية.'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-ink-900/45">
                        الحالة:
                      </span>

                      <span
                        className={`font-semibold ${
                          customer.marketing_opt_in
                            ? 'text-emerald-700'
                            : 'text-red-600'
                        }`}
                      >
                        {customer.marketing_opt_in
                          ? 'موافق على التسويق'
                          : 'ملغى'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-ink-900/45">
                        آخر Opt-out:
                      </span>

                      <span className="font-semibold text-ink-950">
                        {customer.marketing_opt_out_at
                          ? formatDateTime(
                              customer.marketing_opt_out_at
                            )
                          : 'لم يحدث'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  {customer.marketing_opt_in ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateMarketingConsent(false)
                      }
                      disabled={marketingSaving}
                      className="px-3 py-2 rounded-xl border border-red-200 bg-white text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {marketingSaving
                        ? 'جاري الحفظ...'
                        : 'إلغاء الموافقة'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        updateMarketingConsent(true)
                      }
                      disabled={marketingSaving}
                      className="px-3 py-2 rounded-xl bg-ink-900 text-white text-xs font-semibold hover:bg-ink-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {marketingSaving
                        ? 'جاري الحفظ...'
                        : 'تفعيل الموافقة'}
                    </button>
                  )}
                </div>
              </div>

              {marketingError && (
                <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  {marketingError}
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-sand-200 text-[11px] leading-5 text-ink-900/40">
                العملاء الذين ألغوا الموافقة يتم استبعادهم تلقائيًا من الحملات التسويقية.
              </div>
            </div>

            <div>
              <div className="text-xs text-ink-900/40">
                الملاحظات
              </div>

              <div className="mt-2 rounded-xl bg-sand-50 border border-sand-100 p-3 text-sm leading-6 text-ink-900/65 min-h-[80px]">
                {customer.notes ||
                  'لا توجد ملاحظات لهذا العميل'}
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
                    {deal.pipeline_stages?.name ||
                      'بدون مرحلة'}
                  </div>
                </div>

                <Badge tone="gold">
                  {Number(
                    deal.value || 0
                  ).toLocaleString('ar-EG')}{' '}
                  ج.م
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Tasks */}
      <Card className="p-5 lg:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-ink-950">
              المهام والمتابعات
            </h2>

            <p className="text-xs text-ink-900/45 mt-1">
              جميع المهام المرتبطة بهذا العميل
            </p>
          </div>

          <Button onClick={openTaskModal}>
            إضافة مهمة
          </Button>
        </div>

        {tasks.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-sand-200 rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-sand-100 flex items-center justify-center mx-auto text-ink-900/40">
              ✓
            </div>

            <p className="text-sm font-semibold text-ink-950 mt-3">
              لا توجد مهام لهذا العميل
            </p>

            <p className="text-xs text-ink-900/45 mt-1">
              أضف أول مهمة للمتابعة مع العميل.
            </p>

            <button
              onClick={openTaskModal}
              className="mt-4 text-sm font-semibold text-ink-900 hover:underline"
            >
              إضافة مهمة جديدة
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => {
              const assignedTaskUser =
                users.find(
                  user =>
                    user.id ===
                    task.assigned_to
                )

              const isCompleted =
                task.status === 'مكتملة'

              return (
                <div
                  key={task.id}
                  className={`p-4 rounded-2xl border transition-colors ${
                    isCompleted
                      ? 'border-emerald-100 bg-emerald-50/30'
                      : 'border-sand-100 hover:border-sand-200'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={`font-semibold text-sm ${
                            isCompleted
                              ? 'text-ink-900/50 line-through'
                              : 'text-ink-950'
                          }`}
                        >
                          {task.title}
                        </h3>

                        {task.priority && (
                          <Badge
                            tone={
                              task.priority ===
                              'عالية'
                                ? 'danger'
                                : task.priority ===
                                    'متوسطة'
                                  ? 'gold'
                                  : 'default'
                            }
                          >
                            {task.priority}
                          </Badge>
                        )}

                        {task.status && (
                          <Badge
                            tone={statusTone(
                              task.status
                            )}
                          >
                            {task.status}
                          </Badge>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs leading-5 text-ink-900/50 mt-2">
                          {task.description}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-4 mt-3 text-xs text-ink-900/45">
                        <span>
                          الموعد:{' '}
                          {formatTaskDueDate(
                            task.due_date
                          )}
                        </span>

                        {assignedTaskUser && (
                          <span>
                            المسؤول:{' '}
                            {assignedTaskUser.full_name ||
                              assignedTaskUser.email ||
                              'موظف'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {!isCompleted && (
                        <button
                          onClick={() =>
                            updateTaskStatus(
                              task,
                              'مكتملة'
                            )
                          }
                          disabled={taskSaving}
                          className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50"
                        >
                          إكمال
                        </button>
                      )}

                      {isCompleted && (
                        <button
                          onClick={() =>
                            updateTaskStatus(
                              task,
                              'قيد التنفيذ'
                            )
                          }
                          disabled={taskSaving}
                          className="px-3 py-2 rounded-xl bg-sand-100 text-ink-900 text-xs font-semibold hover:bg-sand-200 disabled:opacity-50"
                        >
                          إعادة فتح
                        </button>
                      )}

                      <button
                        onClick={() =>
                          deleteTask(task)
                        }
                        disabled={taskSaving}
                        className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 disabled:opacity-50"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
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
              {appointments.map(
                appointment => (
                  <div
                    key={appointment.id}
                    className="p-4 rounded-2xl border border-sand-100"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-sm text-ink-950">
                          {appointment.services
                            ?.name || 'موعد'}
                        </div>

                        <div className="text-xs text-ink-900/45 mt-1">
                          {appointment.appointment_date ||
                            '—'}

                          {appointment.appointment_time
                            ? ` · ${appointment.appointment_time}`
                            : ''}
                        </div>
                      </div>

                      <Badge
                        tone={statusTone(
                          appointment.status
                        )}
                      >
                        {appointment.status}
                      </Badge>
                    </div>
                  </div>
                )
              )}
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
              {conversations.map(
                conversation => (
                  <div
                    key={conversation.id}
                    className="p-4 rounded-2xl border border-sand-100 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-sm text-ink-950">
                        {channelLabel(
                          conversation.channel
                        )}
                      </div>

                      <div className="text-xs text-ink-900/45 mt-1">
                        {conversation.handled_by ||
                          'غير محدد'}
                      </div>
                    </div>

                    <div className="text-xs text-ink-900/40">
                      {formatDateTime(
                        conversation.last_message_at
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Task Modal */}
      {showTaskModal && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/45 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={event => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowTaskModal(false)
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
                    إضافة مهمة للعميل
                  </h2>

                  <p className="text-xs text-ink-900/45 mt-1">
                    المهمة سيتم ربطها تلقائيًا بالعميل{' '}
                    {customer.name}
                  </p>
                </div>

                <button
                  onClick={() =>
                    setShowTaskModal(false)
                  }
                  className="w-9 h-9 rounded-xl bg-sand-50 text-ink-900/60 hover:bg-sand-100"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {taskError && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {taskError}
                </div>
              )}

              <Field
                label="عنوان المهمة *"
                value={taskForm.title}
                placeholder="مثال: التواصل مع العميل"
                onChange={value =>
                  setTaskForm(prev => ({
                    ...prev,
                    title: value,
                  }))
                }
              />

              <div>
                <label className="block text-xs font-semibold text-ink-900/65 mb-2">
                  وصف المهمة
                </label>

                <textarea
                  value={taskForm.description}
                  onChange={event =>
                    setTaskForm(prev => ({
                      ...prev,
                      description:
                        event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="أضف تفاصيل المهمة..."
                  className="w-full resize-none rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm outline-none focus:border-ink-900"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-900/65 mb-2">
                    تاريخ الاستحقاق
                  </label>

                  <input
                    type="date"
                    value={taskForm.due_date}
                    onChange={event =>
                      setTaskForm(prev => ({
                        ...prev,
                        due_date:
                          event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm outline-none focus:border-ink-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-900/65 mb-2">
                    التذكير
                  </label>

                  <input
                    type="datetime-local"
                    value={taskForm.reminder_at}
                    onChange={event =>
                      setTaskForm(prev => ({
                        ...prev,
                        reminder_at:
                          event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm outline-none focus:border-ink-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-900/65 mb-2">
                    الأولوية
                  </label>

                  <select
                    value={taskForm.priority}
                    onChange={event =>
                      setTaskForm(prev => ({
                        ...prev,
                        priority:
                          event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm outline-none focus:border-ink-900"
                  >
                    {taskPriorities.map(
                      priority => (
                        <option
                          key={priority}
                          value={priority}
                        >
                          {priority}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-900/65 mb-2">
                    الحالة
                  </label>

                  <select
                    value={taskForm.status}
                    onChange={event =>
                      setTaskForm(prev => ({
                        ...prev,
                        status:
                          event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm outline-none focus:border-ink-900"
                  >
                    {taskStatuses.map(
                      status => (
                        <option
                          key={status}
                          value={status}
                        >
                          {status}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-ink-900/65 mb-2">
                    الموظف المسؤول
                  </label>

                  <select
                    value={taskForm.assigned_to}
                    onChange={event =>
                      setTaskForm(prev => ({
                        ...prev,
                        assigned_to:
                          event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm outline-none focus:border-ink-900"
                  >
                    <option value="">
                      بدون مسؤول
                    </option>

                    {users.map(user => (
                      <option
                        key={user.id}
                        value={user.id}
                      >
                        {user.full_name ||
                          user.email ||
                          'موظف'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-sand-100 flex gap-3">
              <Button
                onClick={createTask}
                disabled={taskSaving}
                className="flex-1"
              >
                {taskSaving
                  ? 'جاري الإنشاء...'
                  : 'إنشاء المهمة'}
              </Button>

              <Button
                variant="secondary"
                onClick={() =>
                  setShowTaskModal(false)
                }
                disabled={taskSaving}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/45 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={event => {
            if (
              event.target ===
              event.currentTarget
            ) {
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
                  onClick={() =>
                    setShowEdit(false)
                  }
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
                    setForm(prev => ({
                      ...prev,
                      name: value,
                    }))
                  }
                />

                <Field
                  label="الشركة"
                  value={form.company}
                  onChange={value =>
                    setForm(prev => ({
                      ...prev,
                      company: value,
                    }))
                  }
                />

                <Field
                  label="الهاتف"
                  value={form.phone}
                  dir="ltr"
                  onChange={value =>
                    setForm(prev => ({
                      ...prev,
                      phone: value,
                    }))
                  }
                />

                <Field
                  label="البريد الإلكتروني"
                  value={form.email}
                  dir="ltr"
                  onChange={value =>
                    setForm(prev => ({
                      ...prev,
                      email: value,
                    }))
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
                        status:
                          event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm outline-none focus:border-ink-900"
                  >
                    {statuses.map(status => (
                      <option
                        key={status}
                        value={status}
                      >
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <Field
                  label="المصدر"
                  value={form.source}
                  onChange={value =>
                    setForm(prev => ({
                      ...prev,
                      source: value,
                    }))
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
                        assigned_to:
                          event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm outline-none focus:border-ink-900"
                  >
                    <option value="">
                      بدون مسؤول
                    </option>

                    {users.map(user => (
                      <option
                        key={user.id}
                        value={user.id}
                      >
                        {user.full_name ||
                          user.email ||
                          'موظف'}
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
                        follow_up_at:
                          event.target.value,
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
                    setForm(prev => ({
                      ...prev,
                      tags: value,
                    }))
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

              <div className="rounded-2xl border border-sand-200 bg-sand-50/60 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-ink-950">
                      حالة الرسائل التسويقية
                    </div>

                    <div className="text-xs text-ink-900/45 mt-1">
                      يتم التحكم فيها من بطاقة الموافقة التسويقية داخل صفحة العميل.
                    </div>
                  </div>

                  <Badge
                    tone={
                      customer.marketing_opt_in
                        ? 'success'
                        : 'danger'
                    }
                  >
                    {customer.marketing_opt_in
                      ? 'موافق'
                      : 'غير موافق'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-sand-100 flex gap-3">
              <Button
                onClick={saveCustomer}
                disabled={saving}
                className="flex-1"
              >
                {saving
                  ? 'جاري الحفظ...'
                  : 'حفظ التغييرات'}
              </Button>

              <Button
                variant="secondary"
                onClick={() =>
                  setShowEdit(false)
                }
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
        <div
          className="fixed inset-0 z-50 bg-ink-950/45 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={event => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowDelete(false)
            }
          }}
        >
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
              سيتم حذف العميل من قائمة العملاء. تأكد من رغبتك في تنفيذ هذا الإجراء.
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={deleteCustomer}
                disabled={saving}
                className="flex-1 rounded-xl bg-red-600 text-white px-4 py-3 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {saving
                  ? 'جاري الحذف...'
                  : 'نعم، حذف العميل'}
              </button>

              <button
                onClick={() =>
                  setShowDelete(false)
                }
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
        onChange={event =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm outline-none focus:border-ink-900 focus:ring-2 focus:ring-ink-900/5"
      />
    </div>
  )
}
