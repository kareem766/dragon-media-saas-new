import type { VercelRequest, VercelResponse } from '@vercel/node'

import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'node:crypto'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'

function env(name: string, fallbackNames: string[] = []) {
  const names = [name, ...fallbackNames]
  for (const currentName of names) {
    const value = process.env[currentName]
    if (value) return value
  }
  throw new Error(`Missing environment variable: ${name}`)
}

function verifyState(state: string) {
  const secret = env('META_STATE_SECRET')
  const parts = state.split('.')
  if (parts.length !== 2) return null
  const [encodedPayload, signature] = parts
  const expected = createHmac('sha256', secret).update(encodedPayload).digest('base64url')
  try {
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'))) return null
  } catch {
    return null
  }
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
    if (!payload || typeof payload !== 'object') return null
    const issuedAt = Number(payload.issued_at)
    if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > 15 * 60 * 1000) return null
    if (payload.provider !== 'whatsapp') return null
    return payload as { user_id: string; organization_id: string; provider: 'whatsapp'; nonce: string; issued_at: number }
  } catch {
    return null
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'string' && error.trim()) return error.trim()
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>
    for (const key of ['message', 'error', 'error_description', 'details']) {
      const candidate = value[key]
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    }
  }
  return fallback
}

async function graphGet(path: string, accessToken: string) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}${path}`
  const response = await fetch(`${url}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(accessToken)}`)
  const data = await response.json().catch(() => null)
  return { response, data }
}

async function graphPost(path: string, accessToken: string) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}${path}`
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } })
  const data = await response.json().catch(() => null)
  return { response, data }
}

function extractTargetIds(granularScopes: unknown) {
  const ids: string[] = []
  if (!Array.isArray(granularScopes)) return ids
  for (const scope of granularScopes) {
    if (!scope || typeof scope !== 'object') continue
    const current = scope as { target_ids?: unknown }
    if (!Array.isArray(current.target_ids)) continue
    for (const id of current.target_ids) {
      if (typeof id === 'string' && id.trim() && !ids.includes(id.trim())) ids.push(id.trim())
    }
  }
  return ids
}

async function subscribeWaba(wabaId: string, accessToken: string) {
  const { response, data } = await graphPost(`/${encodeURIComponent(wabaId)}/subscribed_apps`, accessToken)
  return { success: response.ok, error: response.ok ? null : data?.error?.message || 'Unable to subscribe WABA webhook' }
}

async function discoverPhone(wabaId: string, accessToken: string, preferredPhoneId: string | null) {
  const { response, data } = await graphGet(`/${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name`, accessToken)
  if (!response.ok || !Array.isArray(data?.data) || !data.data.length) {
    return { phoneNumberId: preferredPhoneId, displayPhoneNumber: null, verifiedName: null }
  }
  const phone = preferredPhoneId ? data.data.find((item: any) => String(item?.id || '') === preferredPhoneId) || data.data[0] : data.data[0]
  return {
    phoneNumberId: phone?.id ? String(phone.id) : preferredPhoneId,
    displayPhoneNumber: phone?.display_phone_number || null,
    verifiedName: phone?.verified_name || null,
  }
}

async function discoverWabaFromBusiness(accessToken: string, businessId: string) {
  const endpoints = [
    `/${encodeURIComponent(businessId)}/owned_whatsapp_business_accounts?fields=id,name`,
    `/${encodeURIComponent(businessId)}/client_whatsapp_business_accounts?fields=id,name`,
  ]
  for (const endpoint of endpoints) {
    const { response, data } = await graphGet(endpoint, accessToken)
    if (response.ok && Array.isArray(data?.data) && data.data.length && data.data[0]?.id) {
      return { id: String(data.data[0].id), name: data.data[0].name || null }
    }
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const state = typeof req.query.state === 'string' ? req.query.state : ''
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    const eventWabaId = typeof req.query.waba_id === 'string' ? req.query.waba_id : null
    const eventPhoneNumberId = typeof req.query.phone_number_id === 'string' ? req.query.phone_number_id : null
    const eventBusinessId = typeof req.query.business_id === 'string' ? req.query.business_id : null

    if (!state) return res.status(400).json({ error: 'Missing OAuth state' })
    const stateData = verifyState(state)
    if (!stateData) return res.status(400).json({ error: 'Invalid or expired OAuth state', code: 'META_INVALID_STATE' })
    if (!code) return res.status(400).json({ error: 'Meta did not return an authorization code', code: 'META_AUTH_CODE_MISSING' })

    const appId = env('META_APP_ID')
    const appSecret = env('META_APP_SECRET')

    // FB.login() above intentionally does not send a redirect_uri. For an
    // Embedded Signup code, do not send an empty redirect_uri here: Meta treats
    // an empty value as an explicit URI and rejects the code with subcode 36008.
    // The exchange must therefore contain only the OAuth parameters that were
    // actually used by the Embedded Signup dialog.
    const exchangeParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code,
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
      })
      return res.status(502).json({ error: exchangeData?.error?.message || 'Meta authorization code exchange failed', code: 'META_TOKEN_EXCHANGE_FAILED' })
    }

    const accessToken = String(exchangeData.access_token)
    const debugParams = new URLSearchParams({ input_token: accessToken, access_token: `${appId}|${appSecret}` })
    const debugResponse = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/debug_token?${debugParams.toString()}`)
    const debugData = await debugResponse.json().catch(() => null)

    if (!debugResponse.ok || !debugData?.data?.is_valid) {
      return res.status(502).json({ error: 'Meta returned an invalid WhatsApp access token.', code: 'META_TOKEN_INVALID' })
    }

    const metaUserId = debugData.data.user_id ? String(debugData.data.user_id) : null
    if (!metaUserId) return res.status(502).json({ error: 'Meta user ID was not returned.', code: 'META_USER_ID_MISSING' })

    const granularScopes = debugData.data.granular_scopes
    const targetIds = extractTargetIds(granularScopes)
    let businessId = eventBusinessId
    let wabaId = eventWabaId
    let phoneNumberId = eventPhoneNumberId
    let displayPhoneNumber: string | null = null
    let verifiedName: string | null = null

    if (!wabaId && Array.isArray(granularScopes)) {
      for (const scope of granularScopes) {
        if (!scope || typeof scope !== 'object') continue
        const current = scope as { scope?: unknown; target_ids?: unknown }
        if (current.scope !== 'whatsapp_business_management' || !Array.isArray(current.target_ids)) continue
        const candidate = current.target_ids.find((id) => typeof id === 'string' && id.trim())
        if (candidate) {
          wabaId = String(candidate)
          break
        }
      }
    }

    if (!wabaId) {
      for (const candidate of targetIds) {
        const waba = await discoverWabaFromBusiness(accessToken, candidate)
        if (waba) {
          businessId = candidate
          wabaId = waba.id
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

    const readyForMessaging = Boolean(wabaId && phoneNumberId)
    const subscriptionResult = wabaId ? await subscribeWaba(wabaId, accessToken) : { success: false, error: 'WABA ID not discovered' }

    const supabaseUrl = env('SUPABASE_URL', ['VITE_SUPABASE_URL'])
    const supabase = createClient(supabaseUrl, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })

    const metadata = {
      connection_type: 'meta_login_business',
      meta_user_name: null,
      business_id: businessId,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      display_phone_number: displayPhoneNumber,
      verified_name: verifiedName,
      ready_for_messaging: readyForMessaging,
      whatsapp_webhook_subscribed: subscriptionResult.success,
      last_oauth_verified_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabase.from('meta_connections').upsert({
      organization_id: stateData.organization_id,
      provider: 'whatsapp',
      access_token: accessToken,
      token_expires_at: exchangeData.expires_in ? new Date(Date.now() + Number(exchangeData.expires_in) * 1000).toISOString() : null,
      meta_user_id: metaUserId,
      business_id: businessId,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      display_phone_number: displayPhoneNumber,
      verified_name: verifiedName,
      status: readyForMessaging ? 'connected' : 'pending',
      metadata,
      discovery_errors: readyForMessaging ? null : 'Meta OAuth succeeded but WABA/phone number discovery is incomplete.',
      sync_error: subscriptionResult.success ? null : subscriptionResult.error,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,provider' })

    if (upsertError) {
      console.error('WhatsApp connection save failed:', upsertError)
      return res.status(500).json({ error: 'تعذر حفظ اتصال WhatsApp.', code: 'WHATSAPP_CONNECTION_SAVE_FAILED' })
    }

    return res.status(200).json({
      success: true,
      connected: readyForMessaging,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      display_phone_number: displayPhoneNumber,
      webhook_subscribed: subscriptionResult.success,
    })
  } catch (error) {
    console.error('WhatsApp OAuth completion failed:', error)
    return res.status(500).json({ error: getErrorMessage(error, 'تعذر إكمال ربط WhatsApp.'), code: 'WHATSAPP_OAUTH_COMPLETION_FAILED' })
  }
}
