import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

type Automation = {
  id: string
  organization_id: string
  name?: string | null
  trigger_event: string
  config?: {
    hours?: number
  } | null
  action_type: string
  action_config?: {
    title_template?: string
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

type SupabaseClient = ReturnType<typeof createClient>

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

function renderTaskTitle(
  template: string,
  lead: Lead
): string {
  return template
    .replace(/\{name\}/g, lead.name || 'العميل المحتمل')
    .replace(/\{company\}/g, lead.company || '')
    .replace(/\{phone\}/g, lead.phone || '')
}

async function executeLeadStaleAutomation(
  supabase: SupabaseClient,
  automation: Automation
): Promise<{
  success: boolean
  processed: number
  created: number
  skipped: number
  error?: string
}> {
  const hours = Number(automation.config?.hours ?? 24)

  if (!Number.isFinite(hours) || hours <= 0) {
    return {
      success: false,
      processed: 0,
      created: 0,
      skipped: 0,
      error: 'Invalid automation hours configuration',
    }
  }

  const staleBefore = new Date(
    Date.now() - hours * 60 * 60 * 1000
  ).toISOString()

  const {
    data: leads,
    error: leadsError,
  } = await supabase
    .from('leads')
    .select(
      'id, organization_id, name, company, phone, status, assigned_to, created_at, deleted_at'
    )
    .eq('organization_id', automation.organization_id)
    .eq('status', 'جديد')
    .is('deleted_at', null)
    .lte('created_at', staleBefore)

  if (leadsError) {
    console.error(
      `[automation-run] Failed to load stale leads for ${automation.id}:`,
      leadsError
    )

    return {
      success: false,
      processed: 0,
      created: 0,
      skipped: 0,
      error: 'Failed to load stale leads',
    }
  }

  const leadList = (leads ?? []) as Lead[]

  let created = 0
  let skipped = 0

  const titleTemplate =
    automation.action_config?.title_template ||
    'تابع مع {name} - عميل محتمل بدون رد'

  const priority =
    automation.action_config?.priority ||
    'عالية'

  for (const lead of leadList) {
    /*
     * Deduplication:
     *
     * Before creating a task, check whether this automation
     * has already processed this Lead.
     *
     * automation_runs is the execution history table.
     */
    const {
      data: previousRun,
      error: previousRunError,
    } = await supabase
      .from('automation_runs')
      .select('id')
      .eq('automation_id', automation.id)
      .eq('target_table', 'leads')
      .eq('target_id', lead.id)
      .limit(1)
      .maybeSingle()

    if (previousRunError) {
      console.error(
        `[automation-run] Failed to check previous run for lead ${lead.id}:`,
        previousRunError
      )

      throw new Error(
        'Failed to check automation execution history'
      )
    }

    if (previousRun) {
      skipped++
      continue
    }

    const taskTitle = renderTaskTitle(
      titleTemplate,
      lead
    )

    /*
     * Create the actual Task using only columns that exist
     * in the current production schema.
     */
    const {
      error: taskError,
    } = await supabase
      .from('tasks')
      .insert({
        organization_id: automation.organization_id,
        title: taskTitle,
        assigned_to: lead.assigned_to,
        due_date: new Date().toISOString().slice(0, 10),
        priority,
        status: 'جديدة',
      })

    if (taskError) {
      console.error(
        `[automation-run] Failed to create task for lead ${lead.id}:`,
        taskError
      )

      throw new Error(
        `Failed to create task for lead ${lead.id}`
      )
    }

    /*
     * Only record the automation run AFTER the Task
     * has actually been created successfully.
     */
    const {
      error: runError,
    } = await supabase
      .from('automation_runs')
      .insert({
        automation_id: automation.id,
        target_table: 'leads',
        target_id: lead.id,
      })

    if (runError) {
      console.error(
        `[automation-run] Task created but failed to log automation run for lead ${lead.id}:`,
        runError
      )

      /*
       * Important:
       * The task already exists.
       * Throwing here would cause the outer execution
       * to report a failed automation even though the task
       * was successfully created.
       */
      continue
    }

    created++
  }

  return {
    success: true,
    processed: leadList.length,
    created,
    skipped,
  }
}

async function executeAutomation(
  supabase: SupabaseClient,
  automation: Automation
): Promise<{
  success: boolean
  processed: number
  created: number
  skipped: number
  error?: string
}> {
  switch (automation.trigger_event) {
    case 'lead_stale': {
      if (automation.action_type !== 'create_task') {
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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // =========================================================
  // 1. METHOD PROTECTION
  // =========================================================

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')

    return jsonError(
      res,
      405,
      'Method not allowed'
    )
  }

  // =========================================================
  // 2. CRON SECRET
  // =========================================================

  const cronSecret = process.env.CRON_SECRET

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

  // =========================================================
  // 3. AUTHORIZATION
  // =========================================================

  const authorization =
    req.headers.authorization

  if (
    !authorization ||
    authorization !== `Bearer ${cronSecret}`
  ) {
    return jsonError(
      res,
      401,
      'Unauthorized'
    )
  }

  // =========================================================
  // 4. SERVER CONFIGURATION
  // =========================================================

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

  // =========================================================
  // 5. SERVICE ROLE CLIENT
  // =========================================================

  const supabase = createClient(
    supabaseUrl,
    supabaseServiceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  try {
    // =======================================================
    // 6. LOAD ACTIVE AUTOMATIONS
    // =======================================================

    const {
      data: automations,
      error: automationsError,
    } = await supabase
      .from('automations')
      .select(
        'id, organization_id, name, trigger_event, config, action_type, action_config, active'
      )
      .eq('active', true)

    if (automationsError) {
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
      (automations ?? []) as Automation[]

    // =======================================================
    // 7. NOTHING TO EXECUTE
    // =======================================================

    if (automationList.length === 0) {
      return res.status(200).json({
        success: true,
        message:
          'No active automations found',
        processed: 0,
        succeeded: 0,
        failed: 0,
        created_tasks: 0,
        skipped_tasks: 0,
      })
    }

    // =======================================================
    // 8. EXECUTE AUTOMATIONS
    // =======================================================

    let succeeded = 0
    let failed = 0
    let createdTasks = 0
    let skippedTasks = 0

    const results: Array<{
      automation_id: string
      automation_name?: string | null
      status: 'success' | 'failed'
      processed: number
      created: number
      skipped: number
      error?: string
    }> = []

    for (const automation of automationList) {
      const automationId =
        automation.id

      if (
        !automationId ||
        !automation.organization_id
      ) {
        failed++

        results.push({
          automation_id:
            automationId || 'unknown',
          automation_name:
            automation.name,
          status: 'failed',
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

        if (!executionResult.success) {
          failed++

          results.push({
            automation_id:
              automation.id,
            automation_name:
              automation.name,
            status: 'failed',
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

        createdTasks +=
          executionResult.created

        skippedTasks +=
          executionResult.skipped

        results.push({
          automation_id:
            automation.id,
          automation_name:
            automation.name,
          status: 'success',
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
          status: 'failed',
          processed: 0,
          created: 0,
          skipped: 0,
          error: message,
        })
      }
    }

    // =======================================================
    // 9. FINAL RESPONSE
    // =======================================================

    return res.status(200).json({
      success: failed === 0,
      processed:
        automationList.length,
      succeeded,
      failed,
      created_tasks:
        createdTasks,
      skipped_tasks:
        skippedTasks,
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
