import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createHmac, randomBytes } from 'node:crypto'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'
const REDIRECT_URI = 'https://dragon-media-saas-new.vercel.app/api/meta/oauth/callback'

const env = (...names: string[]) => names.map((name) => process.env[name]).find((value) => value && value.trim())?.trim() || ''

function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body)
}

function signState(payload: Record<string, unknown>) {
  const raw = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const secret = env('META_STATE_SECRET', 'META_APP_SECRET')
  const signature = createHmac('sha256', secret).update(raw).digest('base64url')
  return `${raw}.${signature}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  try {
    const appId = env('META_APP_ID', 'FACEBOOK_APP_ID')
    const configId = env('META_CONFIG_ID', 'META_WHATSAPP_CONFIG_ID', 'FACEBOOK_CONFIG_ID')
    const stateSecret = env('META_STATE_SECRET', 'META_APP_SECRET')
    const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')

    if (!appId || !configId || !stateSecret || !supabaseUrl || !serviceKey) {
      return json(res, 500, { error: 'إعدادات Meta أو Supabase غير مكتملة على الخادم.' })
    }

    const authorization = String(req.headers.authorization || '')
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
    if (!accessToken) return json(res, 401, { error: 'جلسة الدخول غير موجودة.' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const organizationId = String(body.organizationId || '')
    if (!organizationId) return json(res, 400, { error: 'معرّف الشركة غير موجود.' })

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: userData, error: userError } = await db.auth.getUser(accessToken)
    if (userError || !userData.user) return json(res, 401, { error: 'جلسة الدخول غير صالحة.' })

    const { data: membership } = await db
      .from('users')
      .select('id,organization_id,active')
      .eq('id', userData.user.id)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (!membership || membership.active === false) {
      return json(res, 403, { error: 'لا تملك صلاحية ربط Meta لهذه الشركة.' })
    }

    const state = signState({
      organizationId,
      userId: userData.user.id,
      nonce: randomBytes(16).toString('hex'),
      iat: Date.now(),
    })

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      config_id: configId,
      state,
      override_default_response_type: 'true',
    })

    return json(res, 200, {
      url: `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`,
      redirect_uri: REDIRECT_URI,
    })
  } catch (error) {
    console.error('Meta OAuth start failed', error)
    return json(res, 500, { error: 'تعذر بدء اتصال Meta.' })
  }
}
