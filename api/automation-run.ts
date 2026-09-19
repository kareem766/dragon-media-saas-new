import type {
  VercelRequest,
  VercelResponse,
} from '@vercel/node'

import { createClient } from '@supabase/supabase-js'
import { createDecipheriv, createHash } from 'node:crypto'

type Automation = {
  id: string
  organization_id: string
  name?: string | null

  trigger_event: string

  config?: {
    hours?: number
    days?: number
  } | null

  action_type: string

  action_config?: {
    title_template?: string
    body_template?: string
    priority?: string
  } | null

  active: boolean
}

type Lead = {
  id: string
  organization_id: string | null
  name: string
  company: string | null
  phone: string | null
  status: string | null
  assigned_to: string | null
  created_at: string | null
  deleted_at: string | null
}

type Task = {
  id: string
  organization_id: string | null
  title: string
  assigned_to: string | null
  due_date: string | null
  priority: string | null
  status: string | null
}

type ExecutionSummary = {
  success: boolean
  processed: number
  created: number
  skipped: number
  error?: string
}

type SupabaseClient =
  import('@supabase/supabase-js').SupabaseClient<any>

const PAGE_SIZE = 500

function jsonError(
  res: VercelResponse,
  status: number,
  message: string
) {
  return res.status(status).json({
    success: false,
    error: message,
  })
}

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

function renderLeadTaskTitle(
  template: string,
  lead: Lead
): string {
  return template
    .replace(
      /\{name\}/g,
      lead.name || 'العميل المحتمل'
    )
    .replace(
      /\{company\}/g,
      lead.company || ''
    )
    .replace(
      /\{phone\}/g,
      lead.phone || ''
    )
}

function renderTaskNotificationTitle(
  template: string,
  task: Task
): string {
  return template
    .replace(
      /\{title\}/g,
      task.title || 'مهمة'
    )
    .replace(
      /\{priority\}/g,
      task.priority || 'متوسطة'
    )
}

function renderTaskNotificationBody(
  template: string,
  task: Task
): string {
  return template
    .replace(
      /\{title\}/g,
      task.title || 'مهمة'
    )
    .replace(
      /\{priority\}/g,
      task.priority || 'متوسطة'
    )
    .replace(
      /\{due_date\}/g,
      task.due_date || ''
    )
}

/**
 * Returns today's date according to Egypt time.
 *
 * Important:
 * We intentionally do NOT use:
 *
 * new Date().toISOString().slice(0, 10)
 *
 * because that uses UTC and can produce the wrong business
 * date around midnight in Egypt.
 */
function getEgyptToday(): string {
  const formatter = new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
  )

  return formatter.format(new Date())
}

/**
 * =========================================================
 * PAGINATED LEAD LOADER
 * =========================================================
 */

async function loadStaleLeads(
  supabase: SupabaseClient,
  organizationId: string,
  staleBefore: string
): Promise<Lead[]> {
  const allLeads: Lead[] = []

  let from = 0

  while (true) {
    const to =
      from + PAGE_SIZE - 1

    const {
      data,
      error,
    } = await supabase
      .from('leads')
      .select(
        `
          id,
          organization_id,
          name,
          company,
          phone,
          status,
          assigned_to,
          created_at,
          deleted_at
        `
      )
      .eq(
        'organization_id',
        organizationId
      )
      .eq(
        'status',
        'جديد'
      )
      .is(
        'deleted_at',
        null
      )
      .lte(
        'created_at',
        staleBefore
      )
      .order(
        'created_at',
        {
          ascending: true,
        }
      )
      .order(
        'id',
        {
          ascending: true,
        }
      )
      .range(
        from,
        to
      )

    if (error) {
      throw new Error(
        `Failed to load stale leads: ${error.message}`
      )
    }

    const page =
      (data ?? []) as Lead[]

    allLeads.push(
      ...page
    )

    if (
      page.length < PAGE_SIZE
    ) {
      break
    }

    from += PAGE_SIZE
  }

  return allLeads
}

/**
 * =========================================================
 * PAGINATED TASK LOADER
 * =========================================================
 */

async function loadTasks(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Task[]> {
  const allTasks: Task[] = []

  let from = 0

  while (true) {
    const to =
      from + PAGE_SIZE - 1

    const {
      data,
      error,
    } = await supabase
      .from('tasks')
      .select(
        `
          id,
          organization_id,
          title,
          assigned_to,
          due_date,
          priority,
          status
        `
      )
      .eq(
        'organization_id',
        organizationId
      )
      .not(
        'assigned_to',
        'is',
        null
      )
      .not(
        'due_date',
        'is',
        null
      )
      .neq(
        'status',
        'مكتملة'
      )
      .neq(
        'status',
        'مكتمل'
      )
      .order(
        'due_date',
        {
          ascending: true,
        }
      )
      .order(
        'id',
        {
          ascending: true,
        }
      )
      .range(
        from,
        to
      )

    if (error) {
      throw new Error(
        `Failed to load tasks: ${error.message}`
      )
    }

    const page =
      (data ?? []) as Task[]

    allTasks.push(
      ...page
    )

    if (
      page.length < PAGE_SIZE
    ) {
      break
    }

    from += PAGE_SIZE
  }

  return allTasks
}

/**
 * =========================================================
 * LEAD STALE AUTOMATION
 * =========================================================
 *
 * Finds leads that stayed in "جديد" longer than the
 * configured number of hours and creates a follow-up task.
 *
 * Deduplication is handled atomically inside Supabase through:
 *
 * execute_automation_task_once()
 *
 * Database uniqueness:
 *
 * (automation_id, target_id)
 *
 * means the same automation will not create the same
 * lead task more than once.
 */
async function executeLeadStaleAutomation(
  supabase: SupabaseClient,
  automation: Automation
): Promise<ExecutionSummary> {
  const hours = Number(
    automation.config?.hours ?? 24
  )

  if (
    !Number.isFinite(hours) ||
    hours <= 0
  ) {
    return {
      success: false,
      processed: 0,
      created: 0,
      skipped: 0,
      error:
        'Invalid automation hours configuration',
    }
  }

  const staleBefore =
    new Date(
      Date.now() -
        hours *
          60 *
          60 *
          1000
    ).toISOString()

  let leadList: Lead[]

  try {
    leadList =
      await loadStaleLeads(
        supabase,
        automation.organization_id,
        staleBefore
      )
  } catch (error) {
    console.error(
      `[automation-run] Failed to load stale leads for ${automation.id}:`,
      error
    )

    return {
      success: false,
      processed: 0,
      created: 0,
      skipped: 0,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to load stale leads',
    }
  }

  let created = 0
  let skipped = 0

  const titleTemplate =
    automation.action_config
      ?.title_template ||
    'تابع مع {name} - عميل محتمل بدون رد'

  const priority =
    automation.action_config
      ?.priority ||
    'متوسطة'

  const dueDate =
    getEgyptToday()

  for (
    const lead of leadList
  ) {
    const taskTitle =
      renderLeadTaskTitle(
        titleTemplate,
        lead
      )

    const {
      data: executionResult,
      error: executionError,
    } =
      await supabase.rpc(
        'execute_automation_task_once',
        {
          p_automation_id:
            automation.id,

          p_organization_id:
            automation.organization_id,

          p_target_id:
            lead.id,

          p_title:
            taskTitle,

          p_assigned_to:
            lead.assigned_to,

          p_due_date:
            dueDate,

          p_priority:
            priority,
        }
      )

    if (executionError) {
      console.error(
        `[automation-run] Failed to execute task action for lead ${lead.id}:`,
        executionError
      )

      throw new Error(
        `Failed to execute automation action for lead ${lead.id}`
      )
    }

    if (
      executionResult === true
    ) {
      created++
    } else {
      skipped++
    }
  }

  return {
    success: true,
    processed:
      leadList.length,
    created,
    skipped,
  }
}

/**
 * =========================================================
 * TASK DUE → NOTIFICATION AUTOMATION
 * =========================================================
 *
 * Finds active/non-completed tasks whose due date is today
 * or already overdue, then creates a notification for the
 * assigned employee.
 *
 * execute_task_due_notification_once()
 *
 * already has database-level deduplication based on:
 *
 * (user_id, entity_type, entity_id, type)
 *
 * Therefore we intentionally do NOT pass automation_id here.
 */
async function executeTaskDueNotificationAutomation(
  supabase: SupabaseClient,
  automation: Automation
): Promise<ExecutionSummary> {
  let taskList: Task[]

  try {
    taskList =
      await loadTasks(
        supabase,
        automation.organization_id
      )
  } catch (error) {
    console.error(
      `[automation-run] Failed to load due tasks for ${automation.id}:`,
      error
    )

    return {
      success: false,
      processed: 0,
      created: 0,
      skipped: 0,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to load due tasks',
    }
  }

  /**
   * Egypt business date.
   *
   * A task is due when:
   *
   * due_date <= today
   *
   * This covers:
   * - tasks due today
   * - overdue tasks
   *
   * Future tasks are ignored.
   */
  const today =
    getEgyptToday()

  const dueTasks =
    taskList.filter(
      (task) =>
        Boolean(
          task.assigned_to
        ) &&
        Boolean(
          task.due_date
        ) &&
        String(
          task.due_date
        ) <= today
    )

  let created = 0
  let skipped = 0

  const titleTemplate =
    automation.action_config
      ?.title_template ||
    'مهمة مستحقة: {title}'

  const bodyTemplate =
    automation.action_config
      ?.body_template ||
    'لديك مهمة مستحقة تحتاج إلى متابعة: {title}'

  const link =
    '/tasks'

  for (
    const task of dueTasks
  ) {
    if (
      !task.assigned_to ||
      !task.due_date ||
      !task.organization_id
    ) {
      skipped++
      continue
    }

    const notificationTitle =
      renderTaskNotificationTitle(
        titleTemplate,
        task
      )

    const notificationBody =
      renderTaskNotificationBody(
        bodyTemplate,
        task
      )

    const {
      data: notificationCreated,
      error: notificationError,
    } =
      await supabase.rpc(
        'execute_task_due_notification_once',
        {
          p_organization_id:
            automation.organization_id,

          p_task_id:
            task.id,

          p_user_id:
            task.assigned_to,

          p_title:
            notificationTitle,

          p_body:
            notificationBody,

          p_link:
            link,
        }
      )

    if (notificationError) {
      console.error(
        `[automation-run] Failed to create task notification for ${task.id}:`,
        notificationError
      )

      throw new Error(
        `Failed to create notification for task ${task.id}`
      )
    }

    if (
      notificationCreated === true
    ) {
      created++
    } else {
      skipped++
    }
  }

  return {
    success: true,
    processed:
      dueTasks.length,
    created,
    skipped,
  }
}

/**
 * =========================================================
 * AUTOMATION DISPATCHER
 * =========================================================
 */

async function executeAutomation(
  supabase: SupabaseClient,
  automation: Automation
): Promise<ExecutionSummary> {
  switch (
    automation.trigger_event
  ) {
    case 'lead_stale': {
      if (
        automation.action_type !==
        'create_task'
      ) {
        return {
          success: false,
          processed: 0,
          created: 0,
          skipped: 0,
          error:
            `Unsupported action "${automation.action_type}" for lead_stale`,
        }
      }

      return executeLeadStaleAutomation(
        supabase,
        automation
      )
    }

    case 'task_due': {
      if (
        automation.action_type !==
        'create_notification'
      ) {
        return {
          success: false,
          processed: 0,
          created: 0,
          skipped: 0,
          error:
            `Unsupported action "${automation.action_type}" for task_due`,
        }
      }

      return executeTaskDueNotificationAutomation(
        supabase,
        automation
      )
    }

    default:
      return {
        success: false,
        processed: 0,
        created: 0,
        skipped: 0,
        error:
          `Unsupported trigger "${automation.trigger_event}"`,
      }
  }
}

/**
 * =========================================================
 * VERCEL HANDLER
 * =========================================================
 */

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === 'POST') {
    return handleCampaignRequest(req, res)
  }

  /**
   * =======================================================
   * 1. METHOD PROTECTION
   * =======================================================
   */

  if (
    req.method !== 'GET'
  ) {
    res.setHeader(
      'Allow',
      'GET'
    )

    return jsonError(
      res,
      405,
      'Method not allowed'
    )
  }

  /**
   * =======================================================
   * 2. CRON SECRET
   * =======================================================
   */

  const cronSecret =
    process.env.CRON_SECRET

  if (!cronSecret) {
    console.error(
      '[automation-run] CRON_SECRET is not configured'
    )

    return jsonError(
      res,
      500,
      'Cron authentication is not configured'
    )
  }

  /**
   * =======================================================
   * 3. AUTHORIZATION
   * =======================================================
   */

  const authorization =
    req.headers.authorization

  if (
    !authorization ||
    authorization !==
      `Bearer ${cronSecret}`
  ) {
    return jsonError(
      res,
      401,
      'Unauthorized'
    )
  }

  /**
   * =======================================================
   * 4. SERVER CONFIGURATION
   * =======================================================
   */

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL

  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_KEY

  if (
    !supabaseUrl ||
    !supabaseServiceKey
  ) {
    console.error(
      '[automation-run] Missing Supabase server configuration'
    )

    return jsonError(
      res,
      500,
      'Server configuration error'
    )
  }

  /**
   * =======================================================
   * 5. SERVICE ROLE CLIENT
   * =======================================================
   */

  const supabase =
    createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken:
            false,

          persistSession:
            false,
        },
      }
    )

  try {
    /**
     * =====================================================
     * 6. LOAD ACTIVE AUTOMATIONS
     * =====================================================
     */

    const {
      data: automations,
      error: automationsError,
    } =
      await supabase
        .from('automations')
        .select(
          `
            id,
            organization_id,
            name,
            trigger_event,
            config,
            action_type,
            action_config,
            active
          `
        )
        .eq(
          'active',
          true
        )

    if (
      automationsError
    ) {
      console.error(
        '[automation-run] Failed to fetch automations:',
        automationsError
      )

      return jsonError(
        res,
        500,
        'Failed to load automations'
      )
    }

    const automationList =
      (automations ??
        []) as Automation[]

    /**
     * =====================================================
     * 7. NO ACTIVE AUTOMATIONS
     * =====================================================
     */

    if (
      automationList.length === 0
    ) {
      return res.status(200).json({
        success: true,

        message:
          'No active automations found',

        processed: 0,

        succeeded: 0,

        failed: 0,

        created_tasks: 0,

        skipped_tasks: 0,

        created_notifications: 0,

        skipped_notifications: 0,

        results: [],
      })
    }

    /**
     * =====================================================
     * 8. EXECUTE AUTOMATIONS
     * =====================================================
     */

    let succeeded = 0
    let failed = 0

    let createdTasks = 0
    let skippedTasks = 0

    let createdNotifications = 0
    let skippedNotifications = 0

    const results: Array<{
      automation_id: string
      automation_name?:
        | string
        | null
      trigger_event: string
      action_type: string
      status:
        | 'success'
        | 'failed'
      processed: number
      created: number
      skipped: number
      error?: string
    }> = []

    for (
      const automation
      of automationList
    ) {
      if (
        !automation.id ||
        !automation.organization_id
      ) {
        failed++

        results.push({
          automation_id:
            automation.id ||
            'unknown',

          automation_name:
            automation.name,

          trigger_event:
            automation.trigger_event,

          action_type:
            automation.action_type,

          status:
            'failed',

          processed: 0,

          created: 0,

          skipped: 0,

          error:
            'Invalid automation configuration',
        })

        continue
      }

      try {
        const executionResult =
          await executeAutomation(
            supabase,
            automation
          )

        if (
          !executionResult.success
        ) {
          failed++

          results.push({
            automation_id:
              automation.id,

            automation_name:
              automation.name,

            trigger_event:
              automation.trigger_event,

            action_type:
              automation.action_type,

            status:
              'failed',

            processed:
              executionResult.processed,

            created:
              executionResult.created,

            skipped:
              executionResult.skipped,

            error:
              executionResult.error ||
              'Automation execution failed',
          })

          continue
        }

        succeeded++

        if (
          automation.trigger_event ===
          'lead_stale'
        ) {
          createdTasks +=
            executionResult.created

          skippedTasks +=
            executionResult.skipped
        }

        if (
          automation.trigger_event ===
          'task_due'
        ) {
          createdNotifications +=
            executionResult.created

          skippedNotifications +=
            executionResult.skipped
        }

        results.push({
          automation_id:
            automation.id,

          automation_name:
            automation.name,

          trigger_event:
            automation.trigger_event,

          action_type:
            automation.action_type,

          status:
            'success',

          processed:
            executionResult.processed,

          created:
            executionResult.created,

          skipped:
            executionResult.skipped,
        })
      } catch (error) {
        failed++

        const message =
          error instanceof Error
            ? error.message
            : 'Unknown automation error'

        console.error(
          `[automation-run] Automation ${automation.id} failed:`,
          error
        )

        results.push({
          automation_id:
            automation.id,

          automation_name:
            automation.name,

          trigger_event:
            automation.trigger_event,

          action_type:
            automation.action_type,

          status:
            'failed',

          processed: 0,

          created: 0,

          skipped: 0,

          error: message,
        })
      }
    }

    /**
     * =====================================================
     * 9. FINAL RESPONSE
     * =====================================================
     */

    return res.status(200).json({
      success:
        failed === 0,

      processed:
        automationList.length,

      succeeded,

      failed,

      created_tasks:
        createdTasks,

      skipped_tasks:
        skippedTasks,

      created_notifications:
        createdNotifications,

      skipped_notifications:
        skippedNotifications,

      results,
    })
  } catch (error) {
    console.error(
      '[automation-run] Unexpected error:',
      error
    )

    return jsonError(
      res,
      500,
      'Automation execution failed'
    )
  }
}


import { createDecipheriv, createHash } from 'node:crypto'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body)
}

function getBearer(req: VercelRequest) {
  const value = req.headers.authorization || ''
  return value.startsWith('Bearer ') ? value.slice(7) : null
}

async function getUser(req: VercelRequest) {
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server configuration is missing.')
  const token = getBearer(req)
  if (!token) return null
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

async function getOrganizationId(admin: any, userId: string) {
  const { data: profile, error } = await admin.from('profiles').select('organization_id').eq('id', userId).maybeSingle()
  if (error) throw error
  return profile?.organization_id || null
}

function interpolate(template: string, customer: Record<string, unknown>) {
  return template
    .replaceAll('{name}', String(customer.name ?? customer.full_name ?? ''))
    .replaceAll('{company}', String(customer.company ?? customer.company_name ?? ''))
}

async function handleCampaignRequest(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { message: 'Method not allowed' })
  if (!supabaseUrl || !serviceRoleKey) return json(res, 500, { message: 'Supabase server configuration is missing.' })

  try {
    const user = await getUser(req)
    if (!user) return json(res, 401, { message: 'يجب تسجيل الدخول أولاً.' })

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    const organizationId = await getOrganizationId(admin, user.id)
    if (!organizationId) return json(res, 403, { message: 'لم يتم العثور على مساحة العمل.' })

    const { campaignId, action } = req.body || {}
    if (!campaignId || !action) return json(res, 400, { message: 'بيانات الحملة غير مكتملة.' })

    const { data: campaign, error: campaignError } = await admin
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (campaignError) throw campaignError
    if (!campaign) return json(res, 404, { message: 'الحملة غير موجودة.' })

    if (action === 'cancel') {
      const { error } = await admin.from('campaigns').update({ status: 'ملغاة', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', campaignId).eq('organization_id', organizationId)
      if (error) throw error
      await admin.from('campaign_messages').update({ status: 'ملغاة', skipped_at: new Date().toISOString(), skipped_reason: 'تم إلغاء الحملة' }).eq('campaign_id', campaignId).eq('organization_id', organizationId).in('status', ['قيد الانتظار', 'قيد الإرسال', 'queued', 'pending'])
      return json(res, 200, { message: 'تم إلغاء الحملة.' })
    }

    if (action === 'refresh') {
      const { data: rows, error } = await admin.from('campaign_messages').select('status').eq('campaign_id', campaignId).eq('organization_id', organizationId)
      if (error) throw error
      const counts = (rows || []).reduce((acc: Record<string, number>, row: { status: string | null }) => { const key = row.status || 'unknown'; acc[key] = (acc[key] || 0) + 1; return acc }, {})
      const { error: updateError } = await admin.from('campaigns').update({ total_recipients: rows?.length || 0, queued_count: counts['قيد الإرسال'] || counts.queued || counts.pending || 0, sent_count: counts['تم الإرسال'] || counts.sent || 0, delivered_count: counts['تم التسليم'] || counts.delivered || 0, failed_count: counts['فشل'] || counts.failed || 0, skipped_count: counts['متخطى'] || counts.skipped || 0, updated_at: new Date().toISOString(), last_run_at: new Date().toISOString() }).eq('id', campaignId).eq('organization_id', organizationId)
      if (updateError) throw updateError
      return json(res, 200, { message: 'تم تحديث إحصائيات الحملة.' })
    }

    if (action === 'retry_failed') {
      const { error } = await admin.from('campaign_messages').update({ status: 'قيد الإرسال', error_message: null, failed_at: null, queued_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('campaign_id', campaignId).eq('organization_id', organizationId).eq('status', 'فشل')
      if (error) throw error
      return json(res, 200, { message: 'تمت إعادة تجهيز الرسائل الفاشلة.' })
    }

    if (action === 'prepare') {
      if (['مكتملة', 'ملغاة', 'قيد الإرسال'].includes(campaign.status)) return json(res, 409, { message: 'لا يمكن تجهيز الحملة بهذه الحالة.' })

      const filter = campaign.audience_filter || {}
      let query = admin.from('customers').select('*').eq('organization_id', organizationId)
      if (campaign.audience && campaign.audience !== 'كل العملاء المشتركين') {
        query = query.eq('status', campaign.audience)
      }
      if (filter.tag) query = query.contains('tags', [filter.tag])
      const { data: customers, error: customerError } = await query
      if (customerError) throw customerError

      const eligible = (customers || []).filter((customer: Record<string, unknown>) => customer.marketing_opt_in !== false && customer.opt_in !== false)
      const existing = await admin.from('campaign_messages').select('customer_id').eq('campaign_id', campaignId).eq('organization_id', organizationId)
      if (existing.error) throw existing.error
      const existingIds = new Set((existing.data || []).map((r: { customer_id: string }) => r.customer_id))
      const rows = eligible.filter((customer: Record<string, unknown>) => !existingIds.has(String(customer.id))).map((customer: Record<string, unknown>) => ({ campaign_id: campaignId, customer_id: customer.id, organization_id: organizationId, channel: campaign.channel, message_body: interpolate(campaign.message_body || '', customer), status: 'قيد الإرسال', opt_in: true, queued_at: new Date().toISOString() }))
      if (rows.length) {
        const { error: insertError } = await admin.from('campaign_messages').insert(rows)
        if (insertError) throw insertError
      }
      const { error: updateError } = await admin.from('campaigns').update({ status: 'جاهزة', total_recipients: eligible.length, queued_count: eligible.length, audience_preview_count: eligible.length, last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', campaignId).eq('organization_id', organizationId)
      if (updateError) throw updateError
      return json(res, 200, { message: `تم تجهيز الحملة واستهداف ${eligible.length} عميل.` })
    }

    if (action === 'run') {
      const channel = String(campaign.channel || '').toLowerCase()
      if (!['whatsapp', 'messenger', 'instagram'].includes(channel)) {
        return json(res, 422, { message: 'قناة الحملة غير مدعومة حالياً. اختر WhatsApp أو Messenger أو Instagram.' })
      }

      const { data: queuedRows, error: queueError } = await admin
        .from('campaign_messages')
        .select('id, customer_id, message_body, attempts, status')
        .eq('campaign_id', campaignId)
        .eq('organization_id', organizationId)
        .eq('channel', channel)
        .eq('status', 'قيد الإرسال')
        .order('queued_at', { ascending: true })
        .limit(20)
      if (queueError) throw queueError

      if (!queuedRows?.length) {
        await admin.from('campaigns').update({
          status: 'مكتملة',
          completed_at: new Date().toISOString(),
          last_run_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', campaignId).eq('organization_id', organizationId).neq('status', 'ملغاة')
        return json(res, 200, { message: 'لا توجد رسائل جاهزة للإرسال.', sent: 0, failed: 0, remaining: 0 })
      }

      const ids = queuedRows.map((row: any) => row.id)
      const { data: claimedRows, error: claimError } = await admin
        .from('campaign_messages')
        .update({ status: 'قيد التنفيذ', attempts: (queuedRows[0]?.attempts || 0) + 1, updated_at: new Date().toISOString() })
        .eq('organization_id', organizationId)
        .eq('campaign_id', campaignId)
        .in('id', ids)
        .eq('status', 'قيد الإرسال')
        .select('id, customer_id, message_body, attempts')
      if (claimError) throw claimError
      if (!claimedRows?.length) return json(res, 409, { message: 'الحملة قيد التنفيذ بالفعل. حاول التحديث بعد لحظات.' })

      const customerIds = [...new Set(claimedRows.map((row: any) => row.customer_id).filter(Boolean))]
      const { data: customers, error: customersError } = await admin
        .from('customers')
        .select('id, name, company, phone, marketing_opt_in')
        .eq('organization_id', organizationId)
        .in('id', customerIds)
      if (customersError) throw customersError
      const customerMap = new Map((customers || []).map((customer: any) => [String(customer.id), customer]))

      async function markMessage(id: string, status: string, patch: Record<string, unknown> = {}) {
        const now = new Date().toISOString()
        await admin.from('campaign_messages').update({
          status,
          updated_at: now,
          ...(status === 'تم الإرسال' ? { sent_at: now } : {}),
          ...(status === 'فشل' ? { failed_at: now } : {}),
          ...patch,
        }).eq('id', id).eq('organization_id', organizationId)
      }

      function decryptMetaToken(value: any) {
        if (!value?.iv || !value?.tag || !value?.data) throw new Error('Meta access token غير متاح.')
        const seed = process.env.META_TOKEN_ENCRYPTION_KEY || process.env.META_APP_SECRET
        if (!seed) throw new Error('إعداد تشفير Meta غير موجود.')
        const key = createHash('sha256').update(seed).digest()
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(String(value.iv), 'base64'))
        decipher.setAuthTag(Buffer.from(String(value.tag), 'base64'))
        return Buffer.concat([decipher.update(Buffer.from(String(value.data), 'base64')), decipher.final()]).toString('utf8')
      }

      async function metaPost(path: string, token: string, body: unknown) {
        const response = await fetch('https://graph.facebook.com/' + (process.env.META_GRAPH_API_VERSION || 'v23.0') + path, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.error?.message || 'Meta رفض الإرسال.')
        return payload
      }

      async function metaGet(path: string, token: string) {
        const response = await fetch('https://graph.facebook.com/' + (process.env.META_GRAPH_API_VERSION || 'v23.0') + path, {
          headers: { Authorization: 'Bearer ' + token },
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.error?.message || 'Meta رفض طلب البيانات.')
        return payload
      }

      let token = ''
      let pageId = ''
      let instagramBusinessId = ''

      if (channel === 'whatsapp') {
        const { data: integration, error: integrationError } = await admin
          .from('integrations')
          .select('config,metadata,connected,status')
          .eq('organization_id', organizationId)
          .eq('provider', 'whatsapp')
          .maybeSingle()
        if (integrationError) throw integrationError
        if (!integration?.connected || integration.status !== 'connected') throw new Error('WhatsApp غير متصل.')
        token = decryptMetaToken(integration.config?.access_token)
      } else {
        const { data: integration, error: integrationError } = await admin
          .from('integrations')
          .select('config,metadata,connected,status')
          .eq('organization_id', organizationId)
          .eq('provider', 'facebook')
          .maybeSingle()
        if (integrationError) throw integrationError
        if (!integration?.connected || integration.status !== 'connected') throw new Error('اتصال Facebook غير جاهز. اربط Facebook أولاً.')
        token = decryptMetaToken(integration.config?.access_token)
        pageId = String(integration.metadata?.facebook_page_id || '')
        if (!pageId) throw new Error('Facebook Page ID غير موجود.')
        if (channel === 'instagram') {
          const page = await metaGet('/' + encodeURIComponent(pageId) + '?fields=instagram_business_account', token)
          instagramBusinessId = String(page?.instagram_business_account?.id || '')
          if (!instagramBusinessId) throw new Error('لا يوجد Instagram Business مرتبط بصفحة Facebook المتصلة.')
        }
      }

      let sent = 0
      let failed = 0

      for (const row of claimedRows as any[]) {
        try {
          const customer = customerMap.get(String(row.customer_id))
          if (!customer || customer.marketing_opt_in !== true) {
            await markMessage(row.id, 'تم التخطي', { skipped_at: new Date().toISOString(), skipped_reason: 'العميل غير مشترك في الرسائل التسويقية.' })
            continue
          }

          let recipient = ''
          let conversation: any = null
          if (channel === 'whatsapp') {
            recipient = String(customer.phone || '').replace(/[^0-9]/g, '')
            if (!recipient) throw new Error('رقم WhatsApp غير موجود للعميل.')
          } else {
            const { data: conversationRows, error: conversationError } = await admin
              .from('conversations')
              .select('id,metadata,channel,last_message_at')
              .eq('organization_id', organizationId)
              .eq('customer_id', customer.id)
              .in('channel', channel === 'messenger' ? ['facebook', 'messenger'] : ['instagram'])
              .order('last_message_at', { ascending: false })
              .limit(1)
            if (conversationError) throw conversationError
            conversation = conversationRows?.[0]
            recipient = String(conversation?.metadata?.external_user_id || conversation?.metadata?.instagram_user_id || conversation?.metadata?.facebook_user_id || '')
            if (!recipient) throw new Error('لا يوجد معرّف محادثة صالح لهذه القناة للعميل.')
          }

          let payload: any
          let externalId = ''

          if (channel === 'whatsapp') {
            const phoneNumberId = String((await admin.from('integrations').select('metadata').eq('organization_id', organizationId).eq('provider', 'whatsapp').maybeSingle()).data?.metadata?.phone_number_id || '')
            if (!phoneNumberId) throw new Error('WhatsApp Phone Number ID غير موجود.')

            if (campaign.template_name) {
              const components = Array.isArray(campaign.template_components) ? campaign.template_components : []
              payload = {
                messaging_product: 'whatsapp',
                to: recipient,
                type: 'template',
                template: {
                  name: campaign.template_name,
                  language: { code: campaign.template_language || 'ar' },
                  ...(components.length ? { components } : {}),
                },
              }
            } else {
              payload = {
                messaging_product: 'whatsapp',
                to: recipient,
                type: 'text',
                text: { preview_url: false, body: String(row.message_body || '') },
              }
            }
            const result = await metaPost('/' + encodeURIComponent(phoneNumberId) + '/messages', token, payload)
            externalId = String(result?.messages?.[0]?.id || '')
          } else if (channel === 'messenger') {
            const result = await metaPost('/' + encodeURIComponent(pageId) + '/messages', token, {
              recipient: { id: recipient },
              message: { text: String(row.message_body || '') },
            })
            externalId = String(result?.message_id || result?.messages?.[0]?.id || '')
          } else {
            const result = await metaPost('/' + encodeURIComponent(instagramBusinessId) + '/messages', token, {
              recipient: { id: recipient },
              message: { text: String(row.message_body || '') },
            })
            externalId = String(result?.message_id || result?.messages?.[0]?.id || '')
          }

          await markMessage(row.id, 'تم الإرسال', {
            external_id: externalId || null,
            error_message: null,
          })
          sent++
        } catch (error) {
          const message = error instanceof Error ? error.message : 'فشل الإرسال.'
          await markMessage(row.id, 'فشل', { error_message: message })
          failed++
        }
      }

      const { count: remaining } = await admin
        .from('campaign_messages')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('organization_id', organizationId)
        .eq('status', 'قيد الإرسال')

      const newStatus = (remaining || 0) > 0 ? 'قيد الإرسال' : (failed > 0 ? 'مكتملة مع أخطاء' : 'مكتملة')
      await admin.from('campaigns').update({
        status: newStatus,
        started_at: campaign.started_at || new Date().toISOString(),
        completed_at: (remaining || 0) > 0 ? null : new Date().toISOString(),
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', campaignId).eq('organization_id', organizationId)

      return json(res, 200, {
        message: `تم إرسال الدفعة: ${sent}، فشل: ${failed}، المتبقي: ${remaining || 0}.`,
        sent,
        failed,
        remaining: remaining || 0,
      })
    }

    return json(res, 400, { message: 'إجراء غير معروف.' })
  } catch (error) {
    console.error('campaign-run error', error)
    return json(res, 500, { message: error instanceof Error ? error.message : 'تعذر تنفيذ الحملة.' })
  }
}

