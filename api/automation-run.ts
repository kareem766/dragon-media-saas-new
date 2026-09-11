import type {
  VercelRequest,
  VercelResponse,
} from '@vercel/node'

import { createClient } from '@supabase/supabase-js'

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
