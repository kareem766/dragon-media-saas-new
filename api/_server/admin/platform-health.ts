import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from '../config.js'

const json = (res: VercelResponse, status: number, body: Record<string, unknown>) => res.status(status).json(body)

const getAnonKey = () =>
  String(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim()

async function authorize(req: VercelRequest, res: VercelResponse) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  const anon = getAnonKey()
  if (!token || !SUPABASE_URL || !anon || !SUPABASE_SERVICE_ROLE_KEY) {
    json(res, 401, { error: 'غير مصرح' })
    return null
  }

  const userClient = createClient(SUPABASE_URL, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: auth, error: authError } = await userClient.auth.getUser(token)
  if (authError || !auth.user) {
    json(res, 401, { error: 'جلسة الدخول غير صالحة' })
    return null
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: caller, error } = await admin
    .from('users')
    .select('is_platform_admin, active')
    .eq('id', auth.user.id)
    .maybeSingle()

  if (error || !caller?.is_platform_admin || caller.active === false) {
    json(res, 403, { error: 'هذه الصفحة مخصصة لمدير المنصة فقط' })
    return null
  }

  return admin
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await authorize(req, res)
  if (!admin) return
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })

  const [orgs, users, integrations, ryan, handoff, payments] = await Promise.all([
    admin.from('organizations').select('id', { count: 'exact', head: true }),
    admin.from('users').select('id', { count: 'exact', head: true }).eq('active', true),
    admin.from('integrations').select('provider, status, connected, error_message, last_verified_at, updated_at').order('updated_at', { ascending: false }).limit(100),
    admin.from('ai_agents').select('id, active, updated_at').eq('name', 'Ryan').limit(100),
    admin.from('human_handoff_requests').select('id, status, created_at').eq('status', 'open').order('created_at', { ascending: false }).limit(100),
    admin.from('payment_requests').select('id, status, created_at').in('status', ['pending', 'pending_review']).order('created_at', { ascending: false }).limit(100),
  ])

  const integrationRows = integrations.data || []
  const failedIntegrations = integrationRows.filter((item: any) => item.connected === false || item.status === 'error' || Boolean(item.error_message))
  const staleIntegrations = integrationRows.filter((item: any) => {
    if (!item.connected || !item.last_verified_at) return false
    return Date.now() - new Date(item.last_verified_at).getTime() > 1000 * 60 * 60 * 24 * 7
  })

  return res.status(200).json({
    checked_at: new Date().toISOString(),
    database: { status: orgs.error || users.error ? 'warning' : 'healthy', organizations: orgs.count || 0, active_users: users.count || 0, error: orgs.error?.message || users.error?.message || null },
    integrations: { total: integrationRows.length, connected: integrationRows.filter((x: any) => x.connected).length, errors: failedIntegrations.length, stale: staleIntegrations.length, recent: integrationRows.slice(0, 12) },
    ryan: { total: ryan.data?.length || 0, active: (ryan.data || []).filter((x: any) => x.active).length, error: ryan.error?.message || null },
    operations: { open_handoffs: handoff.data?.length || 0, pending_payments: payments.data?.length || 0 },
    environment: {
      supabase: Boolean(SUPABASE_URL && getAnonKey() && SUPABASE_SERVICE_ROLE_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY),
      meta: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
    },
  })
}
