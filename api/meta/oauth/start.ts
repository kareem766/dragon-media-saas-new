import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createHmac, randomBytes } from 'node:crypto'

const REDIRECT_URI = 'https://dragon-media-saas-new.vercel.app/api/meta/oauth/callback'
const FACEBOOK_REDIRECT_URI = REDIRECT_URI
const env = (...names: string[]) => names.map((name) => process.env[name]).find((value) => value && value.trim())?.trim() || ''

function json(res: VercelResponse, status: number, body: unknown) { return res.status(status).json(body) }
function signState(payload: Record<string, unknown>) {
  const raw = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const secret = env('META_STATE_SECRET', 'META_APP_SECRET')
  return `${raw}.${createHmac('sha256', secret).update(raw).digest('base64url')}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
  try {
    const appId = env('META_APP_ID', 'FACEBOOK_APP_ID')
    const configId = env('META_CONFIG_ID', 'META_WHATSAPP_CONFIG_ID', 'FACEBOOK_CONFIG_ID')
    const stateSecret = env('META_STATE_SECRET', 'META_APP_SECRET')
    const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
    const provider = String(req.query.provider || ((typeof req.body === 'object' && req.body) ? (req.body as any).provider || '' : '')).toLowerCase()

    const missing: string[] = []
    if (!appId) missing.push('META_APP_ID')
    if (!stateSecret) missing.push('META_STATE_SECRET or META_APP_SECRET')
    if (!supabaseUrl) missing.push('SUPABASE_URL or VITE_SUPABASE_URL')
    if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    if (provider !== 'facebook' && !configId) missing.push('META_CONFIG_ID')
    if (missing.length) return json(res, 500, { error: 'إعدادات Meta أو Supabase غير مكتملة على الخادم.', missing })

    const authorization = String(req.headers.authorization || '')
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
    if (!accessToken) return json(res, 401, { error: 'جلسة الدخول غير موجودة.' })

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: userData, error: userError } = await db.auth.getUser(accessToken)
    if (userError || !userData.user) return json(res, 401, { error: 'جلسة الدخول غير صالحة.' })

    let organizationId = ''
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
      organizationId = String(body.organizationId || '')
    }
    if (!organizationId) {
      const { data: membership, error } = await db.from('users').select('organization_id,active').eq('id', userData.user.id).maybeSingle()
      if (error) return json(res, 500, { error: 'تعذر التحقق من الشركة المرتبطة بالحساب.' })
      organizationId = String(membership?.organization_id || '')
      if (!organizationId || membership?.active === false) return json(res, 403, { error: 'لا تملك صلاحية ربط Meta لهذه الشركة.' })
    } else {
      const { data: membership } = await db.from('users').select('id,organization_id,active').eq('id', userData.user.id).eq('organization_id', organizationId).maybeSingle()
      if (!membership || membership.active === false) return json(res, 403, { error: 'لا تملك صلاحية ربط Meta لهذه الشركة.' })
    }

    if (provider === 'facebook') {
      const state = signState({ provider: 'facebook', organizationId, userId: userData.user.id, nonce: randomBytes(16).toString('hex'), iat: Date.now() })
      const scope = ['pages_show_list', 'pages_read_engagement', 'pages_manage_metadata', 'pages_messaging', 'pages_manage_posts'].join(',')
      const params = new URLSearchParams({ client_id: appId, redirect_uri: FACEBOOK_REDIRECT_URI, response_type: 'code', state, scope })
      const url = `https://www.facebook.com/dialog/oauth?${params.toString()}`
      return json(res, 200, { url, auth_url: url, redirect_uri: FACEBOOK_REDIRECT_URI, state, app_id: appId, provider: 'facebook' })
    }

    // WhatsApp path below is intentionally unchanged: it still uses the existing Meta Embedded Signup configuration and callback.
    const state = signState({ organizationId, userId: userData.user.id, nonce: randomBytes(16).toString('hex'), iat: Date.now() })
    const params = new URLSearchParams({ client_id: appId, redirect_uri: REDIRECT_URI, response_type: 'code', config_id: configId, state, override_default_response_type: 'true' })
    const url = `https://www.facebook.com/dialog/oauth?${params.toString()}`
    return json(res, 200, { url, auth_url: url, redirect_uri: REDIRECT_URI, state, app_id: appId, config_id: configId })
  } catch (error) {
    console.error('Meta OAuth start failed', error)
    return json(res, 500, { error: 'تعذر بدء اتصال Meta.' })
  }
}
