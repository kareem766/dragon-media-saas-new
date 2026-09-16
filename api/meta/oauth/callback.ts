import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createCipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'
const REDIRECT_URI = 'https://dragon-media-saas-new.vercel.app/api/meta/oauth/callback'
const env = (...names: string[]) => names.map((name) => process.env[name]).find((value) => value && value.trim())?.trim() || ''

function errorRedirect(res: VercelResponse, message: string) {
  return res.redirect(302, `https://dragon-media-saas-new.vercel.app/#/integrations/meta?meta_status=error&meta_message=${encodeURIComponent(message)}`)
}

function verifyState(value: string) {
  const [raw, signature] = value.split('.')
  if (!raw || !signature) return null
  const secret = env('META_STATE_SECRET', 'META_APP_SECRET')
  const expected = createHmac('sha256', secret).update(raw).digest('base64url')
  const providedBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) return null
  try {
    const payload = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Record<string, unknown>
    if (typeof payload.iat !== 'number' || Date.now() - payload.iat > 10 * 60 * 1000) return null
    return payload
  } catch {
    return null
  }
}

function encryptToken(token: string) {
  const seed = env('META_TOKEN_ENCRYPTION_KEY', 'META_APP_SECRET')
  const key = createHash('sha256').update(seed).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  }
}

async function graph(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error?.message || `Meta Graph request failed (${response.status})`)
  return data
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return errorRedirect(res, 'طلب OAuth غير صالح.')

  try {
    const code = String(req.query.code || '')
    const state = String(req.query.state || '')
    if (!code || !state) return errorRedirect(res, 'Meta لم تُرجع authorization code صالحًا.')

    const stateData = verifyState(state)
    if (!stateData || typeof stateData.organizationId !== 'string') {
      return errorRedirect(res, 'جلسة Meta انتهت أو غير صالحة. ابدأ الربط من جديد.')
    }

    const appId = env('META_APP_ID', 'FACEBOOK_APP_ID')
    const appSecret = env('META_APP_SECRET', 'FACEBOOK_APP_SECRET')
    const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
    if (!appId || !appSecret || !supabaseUrl || !serviceKey) return errorRedirect(res, 'إعدادات Meta على الخادم غير مكتملة.')

    const tokenParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: REDIRECT_URI,
      code,
    })

    const tokenResponse = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams,
    })
    const tokenData = await tokenResponse.json().catch(() => ({}))
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData?.error?.message || 'فشل تبادل authorization code مع Meta.')
    }

    const token = String(tokenData.access_token)
    const businesses = await graph('/me/businesses?fields=id,name&limit=50', token)
    const businessList = Array.isArray(businesses.data) ? businesses.data : []

    let selectedBusiness: any = null
    let selectedWaba: any = null
    let selectedPhone: any = null

    for (const business of businessList) {
      const wabas = await graph(`/${encodeURIComponent(business.id)}/client_whatsapp_business_accounts?fields=id,name&limit=50`, token).catch(() => ({ data: [] }))
      for (const waba of Array.isArray(wabas.data) ? wabas.data : []) {
        const phones = await graph(`/${encodeURIComponent(waba.id)}/phone_numbers?fields=id,display_phone_number,verified_name&limit=50`, token).catch(() => ({ data: [] }))
        if (phones.data?.[0]) {
          selectedBusiness = business
          selectedWaba = waba
          selectedPhone = phones.data[0]
          break
        }
      }
      if (selectedWaba) break
    }

    if (!selectedWaba) throw new Error('تمت مصادقة Meta لكن لم يتم العثور على WhatsApp Business Account متاح لهذا المستخدم.')

    await graph(`/${encodeURIComponent(selectedWaba.id)}/subscribed_apps`, token, { method: 'POST' }).catch(() => null)

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const metadata = {
      business_id: String(selectedBusiness?.id || ''),
      business_name: String(selectedBusiness?.name || ''),
      waba_id: String(selectedWaba.id),
      waba_name: String(selectedWaba.name || ''),
      phone_number_id: String(selectedPhone.id),
      display_phone_number: String(selectedPhone.display_phone_number || ''),
      verified_name: String(selectedPhone.verified_name || ''),
      ready_for_messaging: true,
      connected_via: 'meta_oauth_configured_redirect',
    }

    const { error: saveError } = await db.from('integrations').upsert({
      organization_id: String(stateData.organizationId),
      provider: 'whatsapp',
      connected: true,
      status: 'connected',
      config: { access_token: encryptToken(token) },
      metadata,
      connected_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      error_message: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,provider' })

    if (saveError) throw new Error('تمت مصادقة Meta لكن تعذر حفظ الاتصال في Dragon Media.')

    return res.redirect(302, 'https://dragon-media-saas-new.vercel.app/#/integrations/meta?meta_status=connected')
  } catch (error) {
    console.error('Meta OAuth callback failed', error)
    return errorRedirect(res, error instanceof Error ? error.message : 'فشل اتصال Meta.')
  }
}
