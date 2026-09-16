import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'node:crypto'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'
const REDIRECT_URI = 'https://dragon-media-saas-new.vercel.app/api/meta/whatsapp/signup'

type MetaState = { user_id: string; organization_id: string; provider: 'whatsapp'; nonce: string; issued_at: number }

type CompletionBody = {
  state?: unknown
  code?: unknown
  access_token?: unknown
  waba_id?: unknown
  phone_number_id?: unknown
  business_id?: unknown
}

function env(name: string, fallbackNames: string[] = []) {
  for (const current of [name, ...fallbackNames]) {
    const value = process.env[current]
    if (value) return value
  }
  throw new Error(`Missing environment variable: ${name}`)
}

function verifyState(state: string): MetaState | null {
  const separator = state.lastIndexOf('.')
  if (separator <= 0) return null
  const payload = state.slice(0, separator)
  const signature = state.slice(separator + 1)
  const expected = createHmac('sha256', env('META_STATE_SECRET')).update(payload).digest('base64url')
  try {
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  } catch {
    return null
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as MetaState
    if (!parsed || parsed.provider !== 'whatsapp' || !parsed.user_id || !parsed.organization_id || !parsed.nonce) return null
    if (!Number.isFinite(parsed.issued_at) || Math.abs(Date.now() - parsed.issued_at) > 15 * 60 * 1000) return null
    return parsed
  } catch {
    return null
  }
}

async function graphGet(path: string, accessToken: string) {
  const separator = path.includes('?') ? '&' : '?'
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}${separator}access_token=${encodeURIComponent(accessToken)}`)
  return { response, data: await response.json().catch(() => null) }
}

async function graphPost(path: string, accessToken: string) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return { response, data: await response.json().catch(() => null) }
}

function extractTargetIds(scopes: unknown): string[] {
  if (!Array.isArray(scopes)) return []
  const ids = new Set<string>()
  for (const scope of scopes) {
    const targets = (scope as { target_ids?: unknown })?.target_ids
    if (!Array.isArray(targets)) continue
    for (const id of targets) if (typeof id === 'string' && id.trim()) ids.add(id.trim())
  }
  return [...ids]
}

async function discoverWabaFromBusiness(accessToken: string, businessId: string) {
  for (const edge of ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts']) {
    const { response, data } = await graphGet(`/${encodeURIComponent(businessId)}/${edge}?fields=id,name`, accessToken)
    if (response.ok && Array.isArray(data?.data) && data.data[0]?.id) return String(data.data[0].id)
  }
  return null
}

async function discoverPhone(wabaId: string, accessToken: string, preferred: string | null) {
  const { response, data } = await graphGet(`/${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name`, accessToken)
  if (!response.ok || !Array.isArray(data?.data) || !data.data.length) {
    return { phoneNumberId: preferred, displayPhoneNumber: null, verifiedName: null }
  }
  const phone = preferred ? data.data.find((item: any) => String(item?.id) === preferred) || data.data[0] : data.data[0]
  return {
    phoneNumberId: phone?.id ? String(phone.id) : preferred,
    displayPhoneNumber: phone?.display_phone_number || null,
    verifiedName: phone?.verified_name || null,
  }
}

async function readBody(req: VercelRequest): Promise<CompletionBody> {
  if (req.method !== 'POST') return {}
  if (req.body && typeof req.body === 'object') return req.body as CompletionBody
  if (typeof req.body === 'string' && req.body.trim()) {
    try { return JSON.parse(req.body) as CompletionBody } catch { return {} }
  }
  return {}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const body = await readBody(req)
    const state = typeof body.state === 'string' ? body.state : typeof req.query.state === 'string' ? req.query.state : ''
    const code = typeof body.code === 'string' ? body.code : typeof req.query.code === 'string' ? req.query.code : ''
    const directAccessToken = typeof body.access_token === 'string' ? body.access_token : typeof req.query.access_token === 'string' ? req.query.access_token : ''
    const eventWabaId = typeof body.waba_id === 'string' ? body.waba_id : typeof req.query.waba_id === 'string' ? req.query.waba_id : null
    const eventPhoneNumberId = typeof body.phone_number_id === 'string' ? body.phone_number_id : typeof req.query.phone_number_id === 'string' ? req.query.phone_number_id : null
    const eventBusinessId = typeof body.business_id === 'string' ? body.business_id : typeof req.query.business_id === 'string' ? req.query.business_id : null

    const stateData = verifyState(state)
    if (!stateData) return res.status(400).json({ error: 'Invalid or expired OAuth state', code: 'META_INVALID_STATE' })
    if (!directAccessToken && !code) return res.status(400).json({ error: 'Meta did not return an authorization token or code', code: 'META_AUTH_RESPONSE_MISSING' })

    const appId = env('META_APP_ID')
    const appSecret = env('META_APP_SECRET')
    let accessToken = directAccessToken

    if (!accessToken) {
      const exchangeParams = new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        code,
        redirect_uri: REDIRECT_URI,
      })
      const exchangeResponse = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: exchangeParams.toString(),
      })
      const exchangeData = await exchangeResponse.json().catch(() => null)
      if (!exchangeResponse.ok || !exchangeData?.access_token) {
        console.error('WhatsApp Embedded Signup token exchange failed:', {
          status: exchangeResponse.status,
          error: exchangeData?.error,
          redirect_uri: REDIRECT_URI,
        })
        return res.status(502).json({ error: exchangeData?.error?.message || 'Meta authorization code exchange failed', code: 'META_TOKEN_EXCHANGE_FAILED' })
      }
      accessToken = String(exchangeData.access_token)
    }

    const debugParams = new URLSearchParams({
      input_token: accessToken,
      access_token: `${appId}|${appSecret}`,
    })
    const debugResponse = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/debug_token?${debugParams}`)
    const debugData = await debugResponse.json().catch(() => null)
    if (!debugResponse.ok || !debugData?.data?.is_valid) {
      console.error('WhatsApp Embedded Signup token validation failed:', { status: debugResponse.status, error: debugData?.error })
      return res.status(502).json({ error: 'Meta returned an invalid WhatsApp access token.', code: 'META_TOKEN_INVALID' })
    }

    const metaUserId = debugData.data.user_id ? String(debugData.data.user_id) : null
    if (!metaUserId) return res.status(502).json({ error: 'Meta user ID was not returned.', code: 'META_USER_ID_MISSING' })

    const scopes = debugData.data.granular_scopes
    const targetIds = extractTargetIds(scopes)
    let businessId = eventBusinessId
    let wabaId = eventWabaId
    let phoneNumberId = eventPhoneNumberId
    let displayPhoneNumber: string | null = null
    let verifiedName: string | null = null

    if (!wabaId && Array.isArray(scopes)) {
      for (const scope of scopes) {
        if ((scope as any)?.scope === 'whatsapp_business_management' && Array.isArray((scope as any)?.target_ids) && (scope as any).target_ids[0]) {
          wabaId = String((scope as any).target_ids[0])
          break
        }
      }
    }

    if (!wabaId) {
      for (const candidate of targetIds) {
        const discovered = await discoverWabaFromBusiness(accessToken, candidate)
        if (discovered) {
          businessId = candidate
          wabaId = discovered
          break
        }
      }
    }

    if (wabaId) {
      const phone = await discoverPhone(wabaId, accessToken, phoneNumberId)
      phoneNumberId = phone.phoneNumberId
      displayPhoneNumber = phone.displayPhoneNumber
      verifiedName = phone.verifiedName
    }

    console.info('WhatsApp Embedded Signup discovery:', {
      hasAccessToken: Boolean(accessToken),
      targetIdCount: targetIds.length,
      businessId,
      wabaId,
      phoneNumberId,
    })

    const readyForMessaging = Boolean(wabaId && phoneNumberId)
    const webhook = wabaId ? await graphPost(`/${encodeURIComponent(wabaId)}/subscribed_apps`, accessToken) : null
    const webhookSubscribed = Boolean(webhook?.response.ok)
    const webhookError = webhookSubscribed ? null : (webhook?.data?.error?.message || 'WABA ID not discovered')

    const supabase = createClient(
      env('SUPABASE_URL', ['VITE_SUPABASE_URL']),
      env('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { error } = await supabase.from('meta_connections').upsert({
      organization_id: stateData.organization_id,
      provider: 'whatsapp',
      access_token: accessToken,
      token_expires_at: debugData.data.expires_at ? new Date(Number(debugData.data.expires_at) * 1000).toISOString() : null,
      meta_user_id: metaUserId,
      business_id: businessId,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      display_phone_number: displayPhoneNumber,
      verified_name: verifiedName,
      status: readyForMessaging ? 'connected' : 'pending',
      metadata: {
        connection_type: 'meta_embedded_signup',
        business_id: businessId,
        waba_id: wabaId,
        phone_number_id: phoneNumberId,
        display_phone_number: displayPhoneNumber,
        verified_name: verifiedName,
        ready_for_messaging: readyForMessaging,
        whatsapp_webhook_subscribed: webhookSubscribed,
        last_oauth_verified_at: new Date().toISOString(),
        webhook_error: webhookError,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,provider' })

    if (error) {
      console.error('WhatsApp connection save failed:', { message: error.message, code: error.code, details: error.details, hint: error.hint })
      return res.status(500).json({ error: 'تعذر حفظ اتصال WhatsApp.', code: 'WHATSAPP_CONNECTION_SAVE_FAILED' })
    }

    if (!readyForMessaging) {
      return res.status(422).json({
        success: false,
        connected: false,
        error: 'تمت مصادقة Meta لكن لم يتم اكتشاف WABA ورقم WhatsApp. تأكد من إكمال Embedded Signup بالكامل.',
        code: 'WHATSAPP_ASSETS_NOT_DISCOVERED',
        waba_id: wabaId,
        phone_number_id: phoneNumberId,
      })
    }

    if (req.method === 'GET') return res.redirect(303, `https://dragon-media-saas-new.vercel.app/#/settings?meta=connected&provider=whatsapp`)
    return res.status(200).json({ success: true, connected: true, waba_id: wabaId, phone_number_id: phoneNumberId, display_phone_number: displayPhoneNumber, webhook_subscribed: webhookSubscribed })
  } catch (error) {
    console.error('WhatsApp OAuth completion failed:', error)
    return res.status(500).json({ error: error instanceof Error ? error.message : 'تعذر إكمال ربط WhatsApp.', code: 'WHATSAPP_OAUTH_COMPLETION_FAILED' })
  }
}
