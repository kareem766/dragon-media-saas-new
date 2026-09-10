import { useEffect, useMemo, useState } from 'react'
import { Card, Badge, Button, Table, statusTone } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'
import { IconPlus } from '../components/Icon'

type TaskStatus =
  | 'جديدة'
  | 'قيد التنفيذ'
  | 'مكتملة'
  | 'ملغاة'
  | 'متأخرة'

type TaskPriority =
  | 'عالية'
  | 'متوسطة'
  | 'منخفضة'

type Relation<T> = T | T[] | null

type DBTask = {
  id: string
  organization_id: string
  title: string
  description: string | null
  assigned_to: string | null
  due_date: string | null
  reminder_at: string | null
  priority: TaskPriority | null
  status: TaskStatus | null
  customer_id: string | null
  lead_id: string | null
  deal_id: string | null
  created_by: string | null
  completed_at: string | null
  created_at: string | null
  updated_at: string | null

  customers?: Relation<{
    id: string
    name: string
    company: string | null
  }>

  leads?: Relation<{
    id: string
    name: string
    company: string | null
  }>

  deals?: Relation<{
    id: string
    title: string
    value: number | null
  }>

  users?: Relation<{
    id: string
    full_name: string
    email: string
  }>
}

type Customer = {
  id: string
  name: string
  company: string | null
}

type Lead = {
  id: string
  name: string
  company: string | null
}

type Deal = {
  id: string
  title: string
  value: number | null
}

type User = {
  id: string
  full_name: string
  email: string
}

type TaskForm = {
  title: string
  description: string
  due_date: string
  reminder_at: string
  priority: TaskPriority
  status: TaskStatus
  assigned_to: string
  customer_id: string
  lead_id: string
  deal_id: string
}

const EMPTY_FORM: TaskForm = {
  title: '',
  description: '',
  due_date: '',
  reminder_at: '',
  priority: 'متوسطة',
  status: 'قيد التنفيذ',
  assigned_to: '',
  customer_id: '',
  lead_id: '',
  deal_id: '',
}

function normalizeRelation<T>(
  value: Relation<T> | undefined
): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

function getLocalDateKey(date = new Date()) {
  const local = new Date(
    date.getTime() -
      date.getTimezoneOffset() * 60000
  )

  return local.toISOString().slice(0, 10)
}

function formatDate(value: string | null) {
  if (!value) return '—'

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function isOverdue(task: DBTask) {
  if (
    !task.due_date ||
    task.status === 'مكتملة' ||
    task.status === 'ملغاة'
  ) {
    return false
  }

  return task.due_date < getLocalDateKey()
}

function normalizeTask(task: DBTask): DBTask {
  return {
    ...task,
    customers: normalizeRelation(task.customers),
    leads: normalizeRelation(task.leads),
    deals: normalizeRelation(task.deals),
    users: normalizeRelation(task.users),
  }
}

export default function Tasks() {
  const {
    organizationId,
    loading: organizationLoading,
    error: organizationError,
  } = useOrganization()

  const [tasks, setTasks] = useState<DBTask[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [users, setUsers] = useState<User[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] =
    useState<DBTask | null>(null)

  const [form, setForm] =
    useState<TaskForm>(EMPTY_FORM)

  const [search, setSearch] = useState('')

  const [filter, setFilter] = useState<
    'all' | 'today' | 'overdue' | 'open' | 'completed'
  >('all')

  const [error, setError] = useState('')

  const loadData = async () => {
    if (!supabase || !organizationId) {
      setTasks([])
      setCustomers([])
      setLeads([])
      setDeals([])
      setUsers([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [
        tasksResult,
        customersResult,
        leadsResult,
        dealsResult,
        usersResult,
      ] = await Promise.all([
        supabase
          .from('tasks')
          .select(`
            *,
            customers (
              id,
              name,
              company
            ),
            leads (
              id,
              name,
              company
            ),
            deals (
              id,
              title,
              value
            ),
            users (
              id,
              full_name,
              email
            )
          `)
          .eq(
            'organization_id',
            organizationId
          )
          .order('due_date', {
            ascending: true,
            nullsFirst: false,
          })
          .order('created_at', {
            ascending: false,
          }),

        supabase
          .from('customers')
          .select('id,name,company')
          .eq(
            'organization_id',
            organizationId
          )
          .order('name'),

        supabase
          .from('leads')
          .select('id,name,company')
          .eq(
            'organization_id',
            organizationId
          )
          .is('deleted_at', null)
          .order('name'),

        supabase
          .from('deals')
          .select('id,title,value')
          .eq(
            'organization_id',
            organizationId
          )
          .order('created_at', {
            ascending: false,
          }),

        supabase
          .from('users')
          .select(
            'id,full_name,email'
          )
          .eq(
            'organization_id',
            organizationId
          )
          .eq('active', true)
          .order('full_name'),
      ])

      if (tasksResult.error) {
        throw tasksResult.error
      }

      if (customersResult.error) {
        throw customersResult.error
      }

      if (leadsResult.error) {
        throw leadsResult.error
      }

      if (dealsResult.error) {
        throw dealsResult.error
      }

      if (usersResult.error) {
        throw usersResult.error
      }

      setTasks(
        (tasksResult.data ?? []).map(
          task => normalizeTask(task as DBTask)
        )
      )

      setCustomers(
        (customersResult.data ??
          []) as Customer[]
      )

      setLeads(
        (leadsResult.data ?? []) as Lead[]
      )

      setDeals(
        (dealsResult.data ?? []) as Deal[]
      )

      setUsers(
        (usersResult.data ?? []) as User[]
      )
    } catch (err) {
      console.error(
        'Tasks load error:',
        err
      )

      setError(
        'حدث خطأ أثناء تحميل المهام والمتابعات.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (
      !organizationLoading &&
      organizationId
    ) {
      loadData()
    }

    if (
      !organizationLoading &&
      !organizationId
    ) {
      setLoading(false)
    }
  }, [
    organizationId,
    organizationLoading,
  ])

  const openCreateModal = () => {
    setEditingTask(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowModal(true)
  }

  const openEditModal = (
    task: DBTask
  ) => {
    setEditingTask(task)

    setForm({
      title: task.title ?? '',
      description:
        task.description ?? '',
      due_date:
        task.due_date ?? '',
      reminder_at:
        task.reminder_at
          ? task.reminder_at.slice(
              0,
              16
            )
          : '',
      priority:
        task.priority ??
        'متوسطة',
      status:
        task.status ??
        'قيد التنفيذ',
      assigned_to:
        task.assigned_to ?? '',
      customer_id:
        task.customer_id ?? '',
      lead_id:
        task.lead_id ?? '',
      deal_id:
        task.deal_id ?? '',
    })

    setError('')
    setShowModal(true)
  }

  const closeModal = () => {
    if (saving) return

    setShowModal(false)
    setEditingTask(null)
    setForm(EMPTY_FORM)
  }

  const updateForm = <
    K extends keyof TaskForm
  >(
    field: K,
    value: TaskForm[K]
  ) => {
    setForm(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  const saveTask = async () => {
    if (
      !supabase ||
      !organizationId
    ) {
      setError(
        'لا يمكن حفظ المهمة بدون اتصال بقاعدة البيانات.'
      )
      return
    }

    if (!form.title.trim()) {
      setError(
        'اكتب عنوان المهمة أولاً.'
      )
      return
    }

    setSaving(true)
    setError('')

    try {
      const {
        data: {
          user,
        },
      } =
        await supabase.auth.getUser()

      const payload = {
        organization_id:
          organizationId,

        title:
          form.title.trim(),

        description:
          form.description.trim() ||
          null,

        due_date:
          form.due_date || null,

        reminder_at:
          form.reminder_at
            ? new Date(
                form.reminder_at
              ).toISOString()
            : null,

        priority:
          form.priority,

        status:
          form.status,

        assigned_to:
          form.assigned_to ||
          null,

        customer_id:
          form.customer_id ||
          null,

        lead_id:
          form.lead_id ||
          null,

        deal_id:
          form.deal_id ||
          null,
      }

      if (editingTask) {
        const {
          error: updateError,
        } = await supabase
          .from('tasks')
          .update(payload)
          .eq(
            'id',
            editingTask.id
          )
          .eq(
            'organization_id',
            organizationId
          )

        if (updateError) {
          throw updateError
        }
      } else {
        const {
          error: insertError,
        } = await supabase
          .from('tasks')
          .insert({
            ...payload,
            created_by:
              user?.id ?? null,
          })

        if (insertError) {
          throw insertError
        }
      }

      await loadData()
      closeModal()
    } catch (err) {
      console.error(
        'Task save error:',
        err
      )

      setError(
        'حدث خطأ أثناء حفظ المهمة.'
      )
    } finally {
      setSaving(false)
    }
  }

  const deleteTask = async (
    task: DBTask
  ) => {
    if (
      !supabase ||
      !organizationId
    ) {
      return
    }

    const confirmed =
      window.confirm(
        `هل أنت متأكد من حذف المهمة "${task.title}"؟`
      )

    if (!confirmed) {
      return
    }

    try {
      const {
        error: deleteError,
      } = await supabase
        .from('tasks')
        .delete()
        .eq(
          'id',
          task.id
        )
        .eq(
          'organization_id',
          organizationId
        )

      if (deleteError) {
        throw deleteError
      }

      setTasks(prev =>
        prev.filter(
          item =>
            item.id !== task.id
        )
      )
    } catch (err) {
      console.error(
        'Task delete error:',
        err
      )

      setError(
        'حدث خطأ أثناء حذف المهمة.'
      )
    }
  }

  const setTaskStatus = async (
    task: DBTask,
    status: TaskStatus
  ) => {
    if (
      !supabase ||
      !organizationId
    ) {
      return
    }

    try {
      const {
        error: updateError,
      } = await supabase
        .from('tasks')
        .update({
          status,
        })
        .eq(
          'id',
          task.id
        )
        .eq(
          'organization_id',
          organizationId
        )

      if (updateError) {
        throw updateError
      }

      setTasks(prev =>
        prev.map(item =>
          item.id === task.id
            ? {
                ...item,
                status,
                completed_at:
                  status === 'مكتملة'
                    ? item.completed_at ??
                      new Date().toISOString()
                    : null,
              }
            : item
        )
      )
    } catch (err) {
      console.error(
        'Task status error:',
        err
      )

      setError(
        'حدث خطأ أثناء تحديث حالة المهمة.'
      )
    }
  }

  const filteredTasks =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase()

      const today =
        getLocalDateKey()

      return tasks.filter(
        task => {
          const customer =
            normalizeRelation(
              task.customers
            )

          const lead =
            normalizeRelation(
              task.leads
            )

          const deal =
            normalizeRelation(
              task.deals
            )

          const assignedUser =
            normalizeRelation(
              task.users
            )

          const searchableText = [
            task.title,
            task.description,
            customer?.name,
            customer?.company,
            lead?.name,
            lead?.company,
            deal?.title,
            assignedUser?.full_name,
            assignedUser?.email,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

          const matchesSearch =
            !query ||
            searchableText.includes(
              query
            )

          let matchesFilter =
            true

          if (
            filter === 'today'
          ) {
            matchesFilter =
              task.due_date ===
              today
          }

          if (
            filter ===
            'overdue'
          ) {
            matchesFilter =
              isOverdue(task)
          }

          if (
            filter === 'open'
          ) {
            matchesFilter =
              task.status !==
                'مكتملة' &&
              task.status !==
                'ملغاة'
          }

          if (
            filter ===
            'completed'
          ) {
            matchesFilter =
              task.status ===
              'مكتملة'
          }

          return (
            matchesSearch &&
            matchesFilter
          )
        }
      )
    }, [
      tasks,
      search,
      filter,
    ])

  const stats =
    useMemo(() => {
      const today =
        getLocalDateKey()

      return {
        total: tasks.length,

        today:
          tasks.filter(
            task =>
              task.due_date ===
              today
          ).length,

        overdue:
          tasks.filter(
            isOverdue
          ).length,

        open:
          tasks.filter(
            task =>
              task.status !==
                'مكتملة' &&
              task.status !==
                'ملغاة'
          ).length,

        completed:
          tasks.filter(
            task =>
              task.status ===
              'مكتملة'
          ).length,
      }
    }, [tasks])

  const relationLabel = (
    task: DBTask
  ) => {
    const customer =
      normalizeRelation(
        task.customers
      )

    const lead =
      normalizeRelation(
        task.leads
      )

    const deal =
      normalizeRelation(
        task.deals
      )

    if (deal) {
      return `صفقة: ${deal.title}`
    }

    if (customer) {
      return customer.company
        ? `${customer.name} — ${customer.company}`
        : customer.name
    }

    if (lead) {
      return lead.company
        ? `${lead.name} — ${lead.company}`
        : lead.name
    }

    return 'بدون ارتباط'
  }

  if (
    organizationLoading ||
    loading
  ) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center"
        dir="rtl"
      >
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-sand-200 border-t-ink-900" />

          <p className="mt-4 text-sm text-ink-900/55">
            جاري تحميل المهام والمتابعات...
          </p>
        </div>
      </div>
    )
  }

  if (
    organizationError ||
    !organizationId
  ) {
    return (
      <div
        className="space-y-6"
        dir="rtl"
      >
        <Card className="p-8">
          <div className="text-center">
            <h2 className="text-xl font-bold text-ink-900">
              لا توجد مؤسسة مرتبطة بالحساب
            </h2>

            <p className="mt-2 text-sm text-ink-900/55">
              {organizationError ||
                'الحساب الحالي غير مرتبط بمؤسسة.'}
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div
      className="space-y-6"
      dir="rtl"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">
            المهام والمتابعات
          </h1>

          <p className="mt-1 text-sm text-ink-900/55">
            إدارة مهام الفريق ومواعيد المتابعة المرتبطة بالعملاء والعملاء المحتملين والصفقات.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={
            openCreateModal
          }
        >
          <span className="inline-flex items-center gap-2">
            <IconPlus className="h-4 w-4" />
            إضافة مهمة
          </span>
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card className="p-5">
          <p className="text-sm text-ink-900/55">
            إجمالي المهام
          </p>

          <p className="mt-2 text-3xl font-bold text-ink-900">
            {stats.total}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-ink-900/55">
            اليوم
          </p>

          <p className="mt-2 text-3xl font-bold text-gold-500">
            {stats.today}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-ink-900/55">
            متأخرة
          </p>

          <p className="mt-2 text-3xl font-bold text-red-600">
            {stats.overdue}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-ink-900/55">
            مفتوحة
          </p>

          <p className="mt-2 text-3xl font-bold text-amber-600">
            {stats.open}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-ink-900/55">
            مكتملة
          </p>

          <p className="mt-2 text-3xl font-bold text-emerald-600">
            {stats.completed}
          </p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              ['all', 'الكل'],
              ['today', 'اليوم'],
              ['overdue', 'المتأخرة'],
              ['open', 'المفتوحة'],
              ['completed', 'المكتملة'],
            ].map(
              ([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setFilter(
                      key as
                        | 'all'
                        | 'today'
                        | 'overdue'
                        | 'open'
                        | 'completed'
                    )
                  }
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    filter === key
                      ? 'bg-ink-900 text-sand-50'
                      : 'bg-sand-100 text-ink-900/65 hover:bg-sand-200'
                  }`}
                >
                  {label}
                </button>
              )
            )}
          </div>

          <div className="relative w-full lg:max-w-sm">
            <input
              value={search}
              onChange={event =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="بحث في المهام والعملاء والصفقات..."
              className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none transition focus:border-ink-900"
            />
          </div>
        </div>
      </Card>

      <Card>
        {filteredTasks.length ===
        0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sand-100 text-xl text-ink-900">
              ✓
            </div>

            <h3 className="mt-4 font-semibold text-ink-900">
              لا توجد مهام
            </h3>

            <p className="mt-1 text-sm text-ink-900/50">
              {search ||
              filter !== 'all'
                ? 'لا توجد نتائج مطابقة للفلاتر الحالية.'
                : 'ابدأ بإضافة أول مهمة أو متابعة.'}
            </p>

            {!search &&
              filter ===
                'all' && (
                <div className="mt-5">
                  <Button
                    variant="primary"
                    onClick={
                      openCreateModal
                    }
                  >
                    <span className="inline-flex items-center gap-2">
                      <IconPlus className="h-4 w-4" />
                      إضافة أول مهمة
                    </span>
                  </Button>
                </div>
              )}
          </div>
        ) : (
          <Table
            head={[
              'المهمة',
              'الارتباط',
              'المسؤول',
              'تاريخ الاستحقاق',
              'الأولوية',
              'الحالة',
              'إجراءات',
            ]}
          >
            {filteredTasks.map(
              task => {
                const assignedUser =
                  normalizeRelation(
                    task.users
                  )

                const overdue =
                  isOverdue(
                    task
                  )

                const displayStatus =
                  overdue &&
                  task.status !==
                    'مكتملة' &&
                  task.status !==
                    'ملغاة'
                    ? 'متأخرة'
                    : task.status ??
                      'جديدة'

                return (
                  <tr
                    key={
                      task.id
                    }
                  >
                    <td className="px-3 py-4 align-top">
                      <div className="min-w-[220px]">
                        <p className="font-semibold text-ink-900">
                          {task.title}
                        </p>

                        {task.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-ink-900/50">
                            {
                              task.description
                            }
                          </p>
                        )}

                        {task.reminder_at && (
                          <p className="mt-2 text-xs text-ink-900/40">
                            تذكير:{' '}
                            {formatDateTime(
                              task.reminder_at
                            )}
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-4 align-top">
                      <span className="text-sm text-ink-900/65">
                        {relationLabel(
                          task
                        )}
                      </span>
                    </td>

                    <td className="px-3 py-4 align-top">
                      <span className="text-sm text-ink-900/65">
                        {assignedUser?.full_name ||
                          'غير محدد'}
                      </span>
                    </td>

                    <td className="px-3 py-4 align-top">
                      <span
                        className={`text-sm ${
                          overdue
                            ? 'font-semibold text-red-600'
                            : 'text-ink-900/65'
                        }`}
                      >
                        {formatDate(
                          task.due_date
                        )}
                      </span>
                    </td>

                    <td className="px-3 py-4 align-top">
                      <Badge
                        tone={statusTone(
                          task.priority ??
                            'متوسطة'
                        )}
                      >
                        {task.priority ??
                          'متوسطة'}
                      </Badge>
                    </td>

                    <td className="px-3 py-4 align-top">
                      <Badge
                        tone={statusTone(
                          displayStatus
                        )}
                      >
                        {
                          displayStatus
                        }
                      </Badge>
                    </td>

                    <td className="px-3 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        {task.status !==
                          'مكتملة' && (
                          <Button
                            variant="secondary"
                            onClick={() =>
                              setTaskStatus(
                                task,
                                'مكتملة'
                              )
                            }
                          >
                            إكمال
                          </Button>
                        )}

                        {task.status ===
                          'مكتملة' && (
                          <Button
                            variant="secondary"
                            onClick={() =>
                              setTaskStatus(
                                task,
                                'قيد التنفيذ'
                              )
                            }
                          >
                            إعادة فتح
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          onClick={() =>
                            openEditModal(
                              task
                            )
                          }
                        >
                          تعديل
                        </Button>

                        <Button
                          variant="ghost"
                          onClick={() =>
                            deleteTask(
                              task
                            )
                          }
                        >
                          حذف
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              }
            )}
          </Table>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-sand-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-ink-900">
                  {editingTask
                    ? 'تعديل المهمة'
                    : 'إضافة مهمة جديدة'}
                </h2>

                <p className="mt-1 text-xs text-ink-900/45">
                  البيانات يتم حفظها مباشرة في قاعدة البيانات.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeModal
                }
                className="rounded-lg px-3 py-2 text-ink-900/50 transition hover:bg-sand-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 p-6">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-ink-900">
                    عنوان المهمة *
                  </label>

                  <input
                    value={
                      form.title
                    }
                    onChange={event =>
                      updateForm(
                        'title',
                        event.target.value
                      )
                    }
                    placeholder="مثال: متابعة العميل أحمد"
                    className="w-full rounded-xl border border-sand-200 px-4 py-3 text-sm outline-none transition focus:border-ink-900"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-ink-900">
                    وصف المهمة
                  </label>

                  <textarea
                    value={
                      form.description
                    }
                    onChange={event =>
                      updateForm(
                        'description',
                        event.target.value
                      )
                    }
                    rows={3}
                    placeholder="اكتب تفاصيل المهمة..."
                    className="w-full resize-none rounded-xl border border-sand-200 px-4 py-3 text-sm outline-none transition focus:border-ink-900"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-ink-900">
                    تاريخ الاستحقاق
                  </label>

                  <input
                    type="date"
                    value={
                      form.due_date
                    }
                    onChange={event =>
                      updateForm(
                        'due_date',
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-sand-200 px-4 py-3 text-sm outline-none transition focus:border-ink-900"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-ink-900">
                    موعد التذكير
                  </label>

                  <input
                    type="datetime-local"
                    value={
                      form.reminder_at
                    }
                    onChange={event =>
                      updateForm(
                        'reminder_at',
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-sand-200 px-4 py-3 text-sm outline-none transition focus:border-ink-900"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-ink-900">
                    الأولوية
                  </label>

                  <select
                    value={
                      form.priority
                    }
                    onChange={event =>
                      updateForm(
                        'priority',
                        event.target
                          .value as TaskPriority
                      )
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ink-900"
                  >
                    <option value="عالية">
                      عالية
                    </option>
                    <option value="متوسطة">
                      متوسطة
                    </option>
                    <option value="منخفضة">
                      منخفضة
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-ink-900">
                    الحالة
                  </label>

                  <select
                    value={
                      form.status
                    }
                    onChange={event =>
                      updateForm(
                        'status',
                        event.target
                          .value as TaskStatus
                      )
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ink-900"
                  >
                    <option value="جديدة">
                      جديدة
                    </option>
                    <option value="قيد التنفيذ">
                      قيد التنفيذ
                    </option>
                    <option value="مكتملة">
                      مكتملة
                    </option>
                    <option value="متأخرة">
                      متأخرة
                    </option>
                    <option value="ملغاة">
                      ملغاة
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-ink-900">
                    المسؤول
                  </label>

                  <select
                    value={
                      form.assigned_to
                    }
                    onChange={event =>
                      updateForm(
                        'assigned_to',
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ink-900"
                  >
                    <option value="">
                      بدون مسؤول
                    </option>

                    {users.map(
                      user => (
                        <option
                          key={
                            user.id
                          }
                          value={
                            user.id
                          }
                        >
                          {user.full_name ||
                            user.email}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-ink-900">
                    العميل
                  </label>

                  <select
                    value={
                      form.customer_id
                    }
                    onChange={event =>
                      updateForm(
                        'customer_id',
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ink-900"
                  >
                    <option value="">
                      بدون عميل
                    </option>

                    {customers.map(
                      customer => (
                        <option
                          key={
                            customer.id
                          }
                          value={
                            customer.id
                          }
                        >
                          {customer.name}
                          {customer.company
                            ? ` — ${customer.company}`
                            : ''}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-ink-900">
                    العميل المحتمل
                  </label>

                  <select
                    value={
                      form.lead_id
                    }
                    onChange={event =>
                      updateForm(
                        'lead_id',
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ink-900"
                  >
                    <option value="">
                      بدون Lead
                    </option>

                    {leads.map(
                      lead => (
                        <option
                          key={
                            lead.id
                          }
                          value={
                            lead.id
                          }
                        >
                          {lead.name}
                          {lead.company
                            ? ` — ${lead.company}`
                            : ''}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-ink-900">
                    الصفقة
                  </label>

                  <select
                    value={
                      form.deal_id
                    }
                    onChange={event =>
                      updateForm(
                        'deal_id',
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ink-900"
                  >
                    <option value="">
                      بدون صفقة
                    </option>

                    {deals.map(
                      deal => (
                        <option
                          key={
                            deal.id
                          }
                          value={
                            deal.id
                          }
                        >
                          {deal.title}
                          {deal.value !==
                            null &&
                          deal.value !==
                            undefined
                            ? ` — ${deal.value.toLocaleString(
                                'ar-EG'
                              )} ج.م`
                            : ''}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-sand-200 bg-sand-50 p-4">
                <p className="text-xs leading-6 text-ink-900/55">
                  يمكنك ربط المهمة بعميل أو عميل محتمل أو صفقة، وتحديد المسؤول وموعد الاستحقاق وموعد التذكير.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-sand-200 px-6 py-4">
              <Button
                variant="ghost"
                onClick={
                  closeModal
                }
                disabled={saving}
              >
                إلغاء
              </Button>

              <Button
                variant="primary"
                onClick={
                  saveTask
                }
                disabled={saving}
              >
                {saving
                  ? 'جاري الحفظ...'
                  : editingTask
                    ? 'حفظ التعديلات'
                    : 'إضافة المهمة'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
