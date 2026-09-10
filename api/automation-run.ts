import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

type Automation = {
  id: string
  organization_id: string
  name?: string | null
  enabled?: boolean | null
  hours?: number | null
  [key: string]: unknown
}

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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // ---------------------------------------------------------
  // 1. Method protection
  // Vercel Cron calls this endpoint with GET.
  // ---------------------------------------------------------
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return jsonError(res, 405, 'Method not allowed')
  }

  // ---------------------------------------------------------
  // 2. CRON_SECRET must exist.
  // Never allow the endpoint to run without authentication.
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // 3. Verify Authorization header.
  // ---------------------------------------------------------
  const authorization = req.headers.authorization

  if (
    !authorization ||
    authorization !== `Bearer ${cronSecret}`
  ) {
    return jsonError(res, 401, 'Unauthorized')
  }

  // ---------------------------------------------------------
  // 4. Validate Supabase server credentials.
  // ---------------------------------------------------------
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(
      '[automation-run] Missing Supabase server configuration'
    )

    return jsonError(
      res,
      500,
      'Server configuration error'
    )
  }

  // ---------------------------------------------------------
  // 5. Create a stateless service-role client.
  // This endpoint is server-side only.
  // ---------------------------------------------------------
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
    // -------------------------------------------------------
    // 6. Fetch enabled automations only.
    // -------------------------------------------------------
    const {
      data: automations,
      error: automationsError,
    } = await supabase
      .from('automations')
      .select('*')
      .eq('enabled', true)

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

    // -------------------------------------------------------
    // 7. Nothing to execute.
    // -------------------------------------------------------
    if (automationList.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No enabled automations found',
        processed: 0,
        succeeded: 0,
        failed: 0,
      })
    }

    let succeeded = 0
    let failed = 0

    const results: Array<{
      automation_id: string
      status: 'success' | 'failed'
      error?: string
    }> = []

    // -------------------------------------------------------
    // 8. Execute each automation.
    // -------------------------------------------------------
    for (const automation of automationList) {
      const automationId = automation.id

      if (!automationId || !automation.organization_id) {
        failed++

        results.push({
          automation_id: automationId || 'unknown',
          status: 'failed',
          error: 'Invalid automation configuration',
        })

        continue
      }

      try {
        /*
         * IMPORTANT:
         *
         * Keep the actual automation execution logic that already
         * exists in your project inside this section.
         *
         * This security wrapper intentionally does NOT invent
         * business logic that may differ from your current schema.
         *
         * Example:
         *
         * await executeAutomation(automation)
         *
         * Replace the placeholder below with your existing
         * automation execution code if the current file has one.
         */

        // -----------------------------------------------------
        // Existing execution logic should run here.
        // -----------------------------------------------------
        const executionResult = await executeAutomation(
          supabase,
          automation
        )

        if (!executionResult.success) {
          throw new Error(
            executionResult.error ||
              'Automation execution failed'
          )
        }

        // -----------------------------------------------------
        // 9. Record successful run only after execution succeeds.
        // -----------------------------------------------------
        const { error: runInsertError } = await supabase
          .from('automation_runs')
          .insert({
            automation_id: automation.id,
            organization_id: automation.organization_id,
            status: 'completed',
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          })

        if (runInsertError) {
          console.error(
            `[automation-run] Failed to record run for ${automation.id}:`,
            runInsertError
          )

          /*
           * The automation itself succeeded.
           * Therefore don't mark the automation execution as failed
           * just because logging the run failed.
           */
        }

        succeeded++

        results.push({
          automation_id: automation.id,
          status: 'success',
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

        // -----------------------------------------------------
        // Record failed run.
        // -----------------------------------------------------
        try {
          await supabase
            .from('automation_runs')
            .insert({
              automation_id: automation.id,
              organization_id: automation.organization_id,
              status: 'failed',
              started_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              error_message: message.slice(0, 1000),
            })
        } catch (loggingError) {
          console.error(
            `[automation-run] Failed to record failed run for ${automation.id}:`,
            loggingError
          )
        }

        results.push({
          automation_id: automation.id,
          status: 'failed',
          error: message,
        })
      }
    }

    // ---------------------------------------------------------
    // 10. Final response.
    // ---------------------------------------------------------
    return res.status(200).json({
      success: failed === 0,
      processed: automationList.length,
      succeeded,
      failed,
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

/**
 * Executes one automation.
 *
 * IMPORTANT:
 * Replace the body of this function with the existing
 * automation execution logic from your current file.
 *
 * The security-sensitive part of this endpoint is already
 * handled above:
 *
 * - GET only
 * - mandatory CRON_SECRET
 * - exact Bearer authentication
 * - server-side Supabase service role
 * - no client access token
 * - explicit error handling
 */
async function executeAutomation(
  _supabase: ReturnType<typeof createClient>,
  automation: Automation
): Promise<{
  success: boolean
  error?: string
}> {
  /*
   * TEMPORARY SAFE EXECUTION PLACEHOLDER.
   *
   * Do not leave this as the final business implementation
   * if your original file already contains actual automation
   * execution logic.
   *
   * Move that existing logic here.
   */

  console.log(
    `[automation-run] Processing automation ${automation.id}`
  )

  return {
    success: true,
  }
}
