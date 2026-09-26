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
  return { v: 1, alg: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') }
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

async function subscribeWhatsAppWebhook(wabaId: string, token: string, appId: string) {
  let subscribeResponse: any
  try {
    subscribeResponse = await graph(`/${encodeURIComponent(wabaId)}/subscribed_apps`, token, { method: 'POST' })
  } catch (error) {
    return { subscribed: false, error: error instanceof Error ? error.message : 'فشل اشتراك WhatsApp Webhook لدى Meta.', response: null }
  }
  try {
    const current = await graph(`/${encodeURIComponent(wabaId)}/subscribed_apps`, token)
    const apps = Array.isArray(current?.data) ? current.data : []
    const found = apps.some((item: any) => String(item?.id || item?.app_id || '') === String(appId))
    if (found || subscribeResponse?.success === true) return { subscribed: true, error: null, response: subscribeResponse }
    return { subscribed: false, error: 'تم تنفيذ طلب الاشتراك لكن Meta لم تؤكد اشتراك تطبيق Dragon Media على WABA.', response: subscribeResponse }
  } catch {
    if (subscribeResponse?.success === true) return { subscribed: true, error: null, response: subscribeResponse }
    return { subscribed: false, error: 'تعذر التحقق من اشتراك WhatsApp Webhook لدى Meta بعد طلب الاشتراك.', response: subscribeResponse }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return errorRedirect(res, 'طلب OAuth غير صالح.')
  try {
    const body = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})) : {}
    const code = String(req.method === 'POST' ? body.code || '' : req.query.code || '')
    const state = String(req.method === 'POST' ? body.state || '' : req.query.state || '')
    const suppliedWabaId = String(req.method === 'POST' ? body.waba_id || '' : '')
    const suppliedPhoneId = String(req.method === 'POST' ? body.phone_number_id || '' : '')
    const suppliedBusinessId = String(req.method === 'POST' ? body.business_id || body.businessId || '' : '')
    if (!code || !state) return errorRedirect(res, 'Meta لم تُرجع authorization code صالحًا.')
    const stateData = verifyState(state)
    if (!stateData || typeof stateData.organizationId !== 'string') return errorRedirect(res, 'جلسة Meta انتهت أو غير صالحة. ابدأ الربط من جديد.')
    const appId = env('META_APP_ID', 'FACEBOOK_APP_ID')
    const appSecret = env('META_APP_SECRET', 'FACEBOOK_APP_SECRET')
    const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY')
    if (!appId || !appSecret || !supabaseUrl || !serviceKey) return errorRedirect(res, 'إعدادات Meta أو Supabase على الخادم غير مكتملة.')
    const stateUserId = typeof stateData.userId === 'string' ? stateData.userId : ''
    if (!stateUserId) return errorRedirect(res, 'جلسة Meta غير مرتبطة بمستخدم صالح.')
    if (req.method === 'POST') {
      const authorization = String(req.headers.authorization || '')
      const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
      if (!accessToken) return res.status(401).json({ error: 'جلسة الدخول غير موجودة.' })
      const authDb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
      const { data: authUser, error: authError } = await authDb.auth.getUser(accessToken)
      if (authError || !authUser.user || authUser.user.id !== stateUserId) return res.status(403).json({ error: 'جلسة الربط لا تطابق المستخدم الحالي.' })
    }
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: membership, error: membershipError } = await db.from('users').select('id,organization_id,active,role').eq('id', stateUserId).eq('organization_id', String(stateData.organizationId)).maybeSingle()
    if (membershipError || !membership || membership.active === false) return errorRedirect(res, 'المستخدم غير مرتبط بهذه الشركة أو حسابه غير نشط.')
    const { data: permission } = await db.from('role_permissions').select('can_edit').eq('role', membership.role).eq('resource', 'settings').maybeSingle()
    if (!permission?.can_edit) return errorRedirect(res, 'ربط Meta متاح فقط لمن لديه صلاحية تعديل إعدادات الشركة.')
    const tokenParams = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: REDIRECT_URI, code })
    const tokenResponse = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: tokenParams })
    const tokenData = await tokenResponse.json().catch(() => ({}))
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error(tokenData?.error?.message || 'فشل تبادل authorization code مع Meta.')
    const token = String(tokenData.access_token)
    if (stateData.provider === 'facebook') {
      const pages = await graph('/me/accounts?fields=id,name,category,access_token,tasks&limit=100', token)
      const page = Array.isArray(pages?.data) ? pages.data.find((item: any) => item?.id && item?.access_token) : null
      if (!page) throw new Error('تم تسجيل الدخول إلى Facebook، لكن لم يتم العثور على صفحة قابلة للربط.')
      const pageToken = String(page.access_token)
      let subscription = false
      let webhookFields: string[] = []
      let webhookVerificationError = ''
      try {
        const subscribeResponse = await graph(`/${encodeURIComponent(String(page.id))}/subscribed_apps?subscribed_fields=feed,messages,messaging_postbacks,messaging_optins,messaging_referrals,message_deliveries`, pageToken, { method: 'POST' })
        console.log('Facebook page webhook subscribe response', { pageId: String(page.id), appId: String(appId), response: subscribeResponse })
        const current = await graph(`/${encodeURIComponent(String(page.id))}/subscribed_apps?fields=id,app_id,subscribed_fields`, pageToken)
        const apps = Array.isArray(current?.data) ? current.data : []
        const safeApps = apps.map((item: any) => ({ id: item?.id ?? null, app_id: item?.app_id ?? null, subscribed_fields: Array.isArray(item?.subscribed_fields) ? item.subscribed_fields.map(String) : [] }))
        console.log('Facebook page webhook subscriptions', { pageId: String(page.id), appId: String(appId), apps: safeApps, raw: JSON.stringify(safeApps) })
        const appRow = safeApps.find((item: any) => String(item.id || item.app_id || '') === String(appId))
        webhookFields = Array.isArray(appRow?.subscribed_fields) ? appRow.subscribed_fields : []
        subscription = webhookFields.includes('feed')
        if (!subscription) webhookVerificationError = 'Meta لم تؤكد حقل feed على اشتراك الصفحة.'
      } catch (subscribeError) {
        webhookVerificationError = subscribeError instanceof Error ? subscribeError.message : 'فشل اشتراك Webhook للصفحة لدى Meta.'
        console.error('Facebook page webhook subscription verification failed', { pageId: String(page.id), appId: String(appId), error: webhookVerificationError })
      }
      const { error: saveError } = await db.from('integrations').upsert({
        organization_id: String(stateData.organizationId), provider: 'facebook', connected: true, status: 'connected', config: { access_token: encryptToken(pageToken) },
        metadata: { facebook_page_id: String(page.id), facebook_page_name: String(page.name || ''), facebook_page_category: String(page.category || ''), facebook_tasks: Array.isArray(page.tasks) ? page.tasks : [], facebook_webhook_subscribed: subscription, facebook_webhook_fields: webhookFields, facebook_webhook_feed_verified: webhookFields.includes('feed'), facebook_webhook_verification_error: webhookVerificationError || null, ready_for_messaging: subscription, connected_via: 'facebook_oauth' },
        connected_at: new Date().toISOString(), last_verified_at: new Date().toISOString(), error_message: subscription ? null : (webhookVerificationError || 'تم الربط لكن اشتراك Webhook للصفحة لم يكتمل.'), updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,provider' })
      if (saveError) throw new Error('تمت مصادقة Facebook لكن تعذر حفظ الاتصال في Dragon Media.')
      if (req.method === 'POST') return res.status(200).json({ ok: true, connected: true, provider: 'facebook' })
      return res.redirect(302, 'https://dragon-media-saas-new.vercel.app/#/integrations/meta?meta_provider=facebook&meta_status=connected')
    }
    let selectedWaba: any = null
    let selectedPhone: any = null
    let businessId = suppliedBusinessId
    if (suppliedWabaId) {
      selectedWaba = await graph(`/${encodeURIComponent(suppliedWabaId)}?fields=id,name`, token)
      if (suppliedPhoneId) { try { selectedPhone = await graph(`/${encodeURIComponent(suppliedPhoneId)}?fields=id,display_phone_number,verified_name`, token) } catch { selectedPhone = null } }
      if (!selectedPhone) { const phones = await graph(`/${encodeURIComponent(suppliedWabaId)}/phone_numbers?fields=id,display_phone_number,verified_name&limit=50`, token); selectedPhone = phones.data?.[0] || null }
    }
    if (!selectedWaba) {
      const appAccessToken = `${appId}|${appSecret}`
      const debugToken = await graph(`/debug_token?input_token=${encodeURIComponent(token)}`, appAccessToken)
      const granularScopes = Array.isArray(debugToken?.data?.granular_scopes) ? debugToken.data.granular_scopes : []
      const whatsappScope = granularScopes.find((item: any) => item?.scope === 'whatsapp_business_management')
      const targetIds = Array.isArray(whatsappScope?.target_ids) ? whatsappScope.target_ids.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0) : []
      for (const wabaId of targetIds) { try { const waba = await graph(`/${encodeURIComponent(wabaId)}?fields=id,name`, token); const phones = await graph(`/${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name&limit=50`, token); if (phones.data?.[0]) { selectedWaba = waba; selectedPhone = phones.data[0]; break } } catch {} }
    }
    if (!selectedWaba || !selectedPhone) throw new Error('Meta أكملت المصادقة، لكن لم تُرسل بيانات WABA/رقم WhatsApp إلى Dragon Media. تأكد أن الربط يتم من زر WhatsApp داخل Dragon Media.')
    const webhook = await subscribeWhatsAppWebhook(String(selectedWaba.id), token, appId)
    const now = new Date().toISOString()
    const metadata = { business_id: businessId, business_name: '', waba_id: String(selectedWaba.id), waba_name: String(selectedWaba.name || ''), phone_number_id: String(selectedPhone.id), display_phone_number: String(selectedPhone.display_phone_number || ''), verified_name: String(selectedPhone.verified_name || ''), webhook_subscribed: webhook.subscribed, ready_for_messaging: webhook.subscribed, connected_via: 'meta_embedded_signup_sdk' }
    const { error: saveError } = await db.from('integrations').upsert({ organization_id: String(stateData.organizationId), provider: 'whatsapp', connected: true, status: webhook.subscribed ? 'connected' : 'error', config: { access_token: encryptToken(token) }, metadata, connected_at: now, last_verified_at: now, error_message: webhook.error, updated_at: now }, { onConflict: 'organization_id,provider' })
    if (saveError) throw new Error('تمت مصادقة Meta لكن تعذر حفظ اتصال WhatsApp في Dragon Media.')
    if (!webhook.subscribed) throw new Error(`تم حفظ رقم WhatsApp، لكن Meta لم تُكمل اشتراك Webhook. ${webhook.error || ''}`.trim())
    if (req.method === 'POST') return res.status(200).json({ ok: true, connected: true, provider: 'whatsapp' })
    return res.redirect(302, 'https://dragon-media-saas-new.vercel.app/#/integrations/meta?meta_status=connected')
  } catch (error) {
    console.error('Meta OAuth callback failed', error)
    if (req.method === 'POST') return res.status(400).json({ error: error instanceof Error ? error.message : 'فشل اتصال Meta.' })
    return errorRedirect(res, error instanceof Error ? error.message : 'فشل اتصال Meta.')
  }
}
