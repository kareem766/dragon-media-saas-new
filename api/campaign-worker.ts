import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { handleCampaignRequest } from './_server/campaign-run.js'
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from './_server/config.js'

function responseAdapter() {
  const state: any = { statusCode: 200, body: null, headers: {} }
  const res: any = {
    setHeader(name: string, value: unknown) { state.headers[name] = value; return res },
    status(code: number) { state.statusCode = code; return res },
    json(body: unknown) { state.body = body; return res },
  }
  return { res, state }
}

function requestFor(campaignId: string, action: string): any {
  return {
    method: 'POST',
    headers: {
      'x-campaign-worker-secret': String(process.env.CRON_SECRET || ''),
    },
    body: { campaignId, action },
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const cronSecret = String(process.env.CRON_SECRET || '')
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[campaign-worker] Supabase server configuration is missing')
    return res.status(500).json({ success: false, error: 'Supabase server configuration is missing' })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  try {
    const now = new Date().toISOString()
    const { data: campaigns, error } = await admin
      .from('campaigns')
      .select('id,status,scheduled_at,organization_id')
      .in('status', ['مجدولة', 'جاهزة', 'قيد الإرسال'])
      .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
      .order('scheduled_at', { ascending: true, nullsFirst: true })
      .limit(20)

    if (error) throw error

    const results: any[] = []

    for (const campaign of campaigns || []) {
      const steps = campaign.status === 'مجدولة' ? ['prepare', 'run'] : ['run']

      for (const action of steps) {
        const { res: internalRes, state } = responseAdapter()
        await handleCampaignRequest(requestFor(String(campaign.id), action), internalRes)
        results.push({
          campaign_id: campaign.id,
          action,
          status_code: state.statusCode,
          response: state.body,
        })
        if (state.statusCode >= 400) break
      }
    }

    return res.status(200).json({
      success: results.every((item) => item.status_code < 400),
      processed: results.length,
      results,
    })
  } catch (error) {
    console.error('[campaign-worker] execution failed', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Campaign worker failed',
    })
  }
}
