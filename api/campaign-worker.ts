import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function json(res: VercelResponse, status: number, body: Record<string, unknown>) {
  return res.status(status).json(body)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return json(res, 405, { success: false, error: 'Method not allowed' })

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return json(res, 401, { success: false, error: 'Unauthorized' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    return json(res, 500, { success: false, error: 'Server configuration error' })
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  try {
    const { data: secretRow, error: secretError } = await admin
      .from('system_secrets')
      .select('value')
      .eq('key', 'campaign_worker_webhook_secret')
      .maybeSingle()
    if (secretError) throw secretError

    const workerSecret = String(secretRow?.value || '')
    if (!workerSecret) {
      return json(res, 500, { success: false, error: 'Campaign worker secret is not configured' })
    }

    const { data: campaigns, error: campaignError } = await admin
      .from('campaigns')
      .select('id, organization_id, channel, status')
      .in('status', ['جاهزة للإرسال', 'قيد الإرسال'])
      .order('updated_at', { ascending: true })
      .limit(50)
    if (campaignError) throw campaignError

    const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`
    const results: Array<Record<string, unknown>> = []

    for (const campaign of campaigns || []) {
      const response = await fetch(`${origin}/api/automation-run`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-campaign-worker-secret': workerSecret,
        },
        body: JSON.stringify({ campaignId: campaign.id, action: 'run' }),
      })
      const payload = await response.json().catch(() => ({}))
      results.push({
        campaign_id: campaign.id,
        status: response.status,
        response: payload,
      })
    }

    return json(res, 200, {
      success: true,
      campaigns_checked: campaigns?.length || 0,
      results,
    })
  } catch (error) {
    console.error('[campaign-worker] error', error)
    return json(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : 'Campaign worker failed',
    })
  }
}
