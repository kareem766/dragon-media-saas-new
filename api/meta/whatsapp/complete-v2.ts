import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'node:crypto'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'

function env(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function verifyState(state: string) {
  const [payload, signature] = state.split('.')
  if (!payload || !signature) return null
  const expected = createHmac('sha256', env('META_STATE_SECRET')).update(payload).digest('base64url')
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  } catch {
    return null
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!data || data.provider !== 'whatsapp') return null
    if (!Number.isFinite(Number(data.issued_at)) || Math.abs(Date.now() - Number(data.issued_at)) > 15 * 60 * 1000) return null
    return data as { user_id: string; organization_id: string; provider: 'whatsapp' }
  } catch {
    return null
  }
}

async function graphGet(path: string, token: string) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`)
  const data = await response.json().catch(() => null)
  return { response, data }
}

async function graphPost(path: string, token: string) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await response.json().catch(() => null)
  return { response, data }
}

async function discoverPhone(wabaId: string, token: string, preferred: string | null) {
  const { response, data } = await graphGet(`/${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name`, token)
  if (!response.ok || !Array.isArray(data?.data)) return { id: preferred, display: null, verified: null }
  const phone = preferred ? data.data.find((p: any) => String(p?.id || '') === preferred) : data.data[0]
  return {
    id: phone?.id ? String(phone.id) : preferred,
    display: phone?.display_phone_number || null,
    verified: phone?.verified_name || null,
  }
}

async function discoverWaba(businessId: string, token: string) {
  for (const path of [
    `/${encodeURIComponent(businessId)}/owned_whatsapp_business_accounts?fields=id,name`,
    `/${encodeURIComponent(businessId)}/client_whatsapp_business_accounts?fields=id,name`,
  ]) {
    const { response, data } = await graphGet(path, token)
    if (response.ok && Array.isArray(data?.data) && data.data[0]?.id) return String(data.data[0].id)
  }
  return null
}

function messageOf(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>
    if (typeof value.message === 'string') return value.message
  }
  return 'Unable to complete WhatsApp Embedded Signup.'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {}
    const state = typeof body.state === 'string' ? body.state : ''
    const code = typeof body.code === 'string' ? body.code : ''
    const eventWabaId = typeof body.waba_id === 'string' ? body.waba_id : null
    const eventPhoneId = typeof body.phone_number_id === 'string' ? body.phone_number_id : null
    const eventBusinessId = typeof body.business_id === 'string' ? body.business_id : null

    const stateData = verifyState(state)
    if (!stateData) return res.status(400).json({ error: 'Invalid or expired OAuth state', code: 'META_INVALID_STATE' })
    if (!code) return res.status(400).json({ error: 'Meta did not return an authorization code', code: 'META_AUTH_CODE_MISSING' })

    const appId = env('META_APP_ID')
    const appSecret = env('META_APP_SECRET')

    // Facebook JS SDK Embedded Signup binds the returned code to its own OAuth dialog redirect.
    // Do not send a different redirect_uri during this code exchange.
    const params = new URLSearchParams({ client_id: appId, client_secret: appSecret, code })
    const exchange = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${params.toString()}`)
    const exchangeData = await exchange.json().catch(() => null)
    if (!exchange.ok || !exchangeData?.access_token) {
      console.error('WhatsApp Embedded Signup token exchange failed', { status: exchange.status, error: exchangeData?.error })
      return res.status(502).json({ error: exchangeData?.error?.message || 'Meta authorization code exchange failed', code: 'META_TOKEN_EXCHANGE_FAILED' })
    }

    const token = String(exchangeData.access_token)
    const debug = new URLSearchParams({ input_token: token, access_token: `${appId}|${appSecret}` })
    const debugResponse = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/debug_token?${debug.toString()}`)
    const debugData = await debugResponse.json().catch(() => null)
    if (!debugResponse.ok || !debugData?.data?.is_valid) return res.status(502).json({ error: 'Meta returned an invalid WhatsApp access token.', code: 'META_TOKEN_INVALID' })

    const metaUserId = debugData.data.user_id ? String(debugData.data.user_id) : null
    if (!metaUserId) return res.status(502).json({ error: 'Meta user ID was not returned.', code: 'META_USER_ID_MISSING' })

    let businessId = eventBusinessId
    let wabaId = eventWabaId
    let phoneNumberId = eventPhoneId
    let displayPhoneNumber: string | null = null
    let verifiedName: string | null = null

    if (!wabaId && businessId) wabaId = await discoverWaba(businessId, token)

    if (!wabaId && Array.isArray(debugData.data.granular_scopes)) {
      for (const scope of debugData.data.granular_scopes) {
        if (scope?.scope !== 'whatsapp_business_management' || !Array.isArray(scope.target_ids)) continue
        const candidate = scope.target_ids.find((id: unknown) => typeof id === 'string' && id.trim())
        if (candidate) {
          const candidateId = String(candidate).trim()
          const check = await graphGet(`/${encodeURIComponent(candidateId)}?fields=id,owner_business_info`, token)
          if (check.response.ok && check.data?.id) {
            wabaId = String(check.data.id)
            if (!businessId && check.data.owner_business_info?.id) businessId = String(check.data.owner_business_info.id)
            break
          }
        }
      }
    }

    if (wabaId) {
      const phone = await discoverPhone(wabaId, token, phoneNumberId)
      phoneNumberId = phone.id
      displayPhoneNumber = phone.display
      verifiedName = phone.verified
      const subscription = await graphPost(`/${encodeURIComponent(wabaId)}/subscribed_apps`, token)
      const webhookSubscribed = subscription.response.ok

      const supabase = createClient(env('VITE_SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
      const existingResult = await supabase.from('meta_connections').select('id,waba_id,phone_number_id,business_id,display_phone_number,verified_name').eq('organization_id', stateData.organization_id).eq('provider', 'whatsapp').maybeSingle()
      if (existingResult.error) throw existingResult.error

      const existing = existingResult.data
      const finalWabaId = wabaId || existing?.waba_id || null
      const finalPhoneId = phoneNumberId || existing?.phone_number_id || null
      const finalBusinessId = businessId || existing?.business_id || null
      const finalDisplay = displayPhoneNumber || existing?.display_phone_number || null
      const finalVerified = verifiedName || existing?.verified_name || null
      const ready = Boolean(finalWabaId && finalPhoneId && webhookSubscribed)
      const metadata = { connection_type: 'meta_login_business_embedded_signup', meta_user_id: metaUserId, business_id: finalBusinessId, waba_id: finalWabaId, phone_number_id: finalPhoneId, display_phone_number: finalDisplay, verified_name: finalVerified, whatsapp_webhook_subscribed: webhookSubscribed, ready_for_messaging: ready, last_oauth_verified_at: new Date().toISOString() }

      const payload = { organization_id: stateData.organization_id, provider: 'whatsapp', access_token: token, meta_user_id: metaUserId, business_id: finalBusinessId, waba_id: finalWabaId, phone_number_id: finalPhoneId, display_phone_number: finalDisplay, verified_name: finalVerified, status: 'connected', metadata, updated_at: new Date().toISOString() }
      const write = existing?.id ? await supabase.from('meta_connections').update(payload).eq('id', existing.id) : await supabase.from('meta_connections').insert(payload)
      if (write.error) throw write.error

      const integration = await supabase.from('integrations').upsert({ organization_id: stateData.organization_id, provider: 'whatsapp', connected: true, status: 'connected', connected_at: new Date().toISOString(), last_verified_at: new Date().toISOString(), error_message: ready ? null : 'WhatsApp connected but messaging setup is incomplete.', metadata }, { onConflict: 'organization_id,provider' })
      if (integration.error) throw integration.error

      return res.status(200).json({ success: true, ready_for_messaging: ready, waba_id: finalWabaId, phone_number_id: finalPhoneId, business_id: finalBusinessId, display_phone_number: finalDisplay, verified_name: finalVerified, webhook_subscribed: webhookSubscribed, message: ready ? 'WhatsApp Business connected successfully.' : 'WhatsApp connected, but messaging setup is incomplete.', redirect_url: '/#/settings' })
    }

    return res.status(200).json({ success: false, ready_for_messaging: false, waba_id: null, phone_number_id: null, business_id: businessId, webhook_subscribed: false, error: 'Meta completed authorization, but no WhatsApp Business Account was returned.', code: 'META_WABA_MISSING' })
  } catch (error) {
    console.error('WhatsApp Embedded Signup completion error:', error)
    return res.status(500).json({ success: false, error: messageOf(error), code: 'META_WHATSAPP_COMPLETE_FAILED' })
  }
}
