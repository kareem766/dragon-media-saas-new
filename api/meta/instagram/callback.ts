import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createCipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'
const REDIRECT_URI = 'https://dragon-media-saas-new.vercel.app/api/meta/oauth/callback'
const APP_URL = 'https://dragon-media-saas-new.vercel.app'
const env = (...names: string[]) => names.map((name) => process.env[name]).find((value) => value && value.trim())?.trim() || ''

function redirect(res: VercelResponse, status: string, message = '') {
  return res.redirect(302, APP_URL + '/#/integrations/meta?meta_provider=instagram&meta_status=' + status + (message ? '&meta_message=' + encodeURIComponent(message) : ''))
}
function verifyState(value: string) {
  const [raw, signature] = value.split('.')
  if (!raw || !signature) return null
  const secret = env('META_STATE_SECRET', 'META_APP_SECRET')
  if (!secret) return null
  const expected = createHmac('sha256', secret).update(raw).digest('base64url')
  const a = Buffer.from(signature), b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Record<string, unknown>
    if (payload.provider !== 'instagram' || typeof payload.organizationId !== 'string' || typeof payload.userId !== 'string' || typeof payload.iat !== 'number') return null
    if (Date.now() - payload.iat > 10 * 60 * 1000) return null
    return payload
  } catch { return null }
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
  const response = await fetch('https://graph.facebook.com/' + GRAPH_VERSION + path, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: 'Bearer ' + token },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error?.message || 'Meta Graph request failed (' + response.status + ')')
  return data
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return redirect(res, 'error', 'طلب Instagram OAuth غير صالح.')
  try {
    const code = String(req.query.code || '')
    const state = String(req.query.state || '')
    if (req.query.error) return redirect(res, 'error', String(req.query.error_description || req.query.error))
    if (!code || !state) return redirect(res, 'error', 'Instagram لم يُرجع authorization code صالحًا.')

    const stateData = verifyState(state)
    if (!stateData) return redirect(res, 'error', 'جلسة Instagram انتهت أو غير صالحة.')

    const appId = env('META_APP_ID', 'FACEBOOK_APP_ID')
    const appSecret = env('META_APP_SECRET', 'FACEBOOK_APP_SECRET')
    const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY')
    if (!appId || !appSecret || !supabaseUrl || !serviceKey) return redirect(res, 'error', 'إعدادات Meta أو Supabase على الخادم غير مكتملة.')

    const organizationId = String(stateData.organizationId)
    const userId = String(stateData.userId)
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

    const { data: membership } = await db.from('users').select('id,organization_id,active,role').eq('id', userId).eq('organization_id', organizationId).maybeSingle()
    if (!membership || membership.active === false) throw new Error('المستخدم غير مرتبط بهذه الشركة أو حسابه غير نشط.')

    const { data: integrationsEnabled, error: entitlementError } = await db.rpc('service_subscription_has_feature', { p_organization_id: organizationId, p_feature: 'integrations' })
    if (entitlementError || integrationsEnabled !== true) throw new Error('التكاملات غير متاحة في الباقة الحالية.')
    const { data: permission } = await db.from('role_permissions').select('can_edit').eq('role', membership.role).eq('resource', 'settings').maybeSingle()
    if (!permission?.can_edit) throw new Error('ربط Instagram متاح فقط لمن لديه صلاحية تعديل إعدادات الشركة.')

    const tokenParams = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: REDIRECT_URI, code })
    const tokenResponse = await fetch('https://graph.facebook.com/' + GRAPH_VERSION + '/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams,
    })
    const tokenData = await tokenResponse.json().catch(() => ({}))
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error(tokenData?.error?.message || 'فشل تبادل authorization code مع Meta.')
    const userToken = String(tokenData.access_token)

    const { data: existing } = await db.from('integrations').select('metadata').eq('organization_id', organizationId).eq('provider', 'instagram').maybeSingle()
    const existingInstagramId = String(existing?.metadata?.instagram_user_id || '')

    const pages = await graph('/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&limit=100', userToken)
    const candidates = (Array.isArray(pages?.data) ? pages.data : [])
      .filter((page: any) => page?.id && page?.access_token && page?.instagram_business_account?.id)
      .map((page: any) => ({
        pageId: String(page.id),
        pageName: String(page.name || ''),
        pageToken: String(page.access_token),
        instagram: page.instagram_business_account,
      }))

    const selected = existingInstagramId
      ? candidates.find((item: any) => String(item.instagram.id) === existingInstagramId)
      : candidates.length === 1 ? candidates[0] : null

    if (!selected) {
      if (candidates.length > 1) throw new Error('حساب Meta يحتوي على أكثر من حساب Instagram احترافي قابل للربط. اربط حساب Instagram المطلوب بصفحة Facebook واحدة ثم أعد المحاولة.')
      throw new Error('لم يتم العثور على حساب Instagram احترافي مرتبط بصفحة Facebook. يجب تحويل الحساب إلى Professional وربطه بصفحة Facebook ثم إعادة المحاولة.')
    }

    const instagramUserId = String(selected.instagram.id)
    const pageToken = selected.pageToken
    let webhookSubscribed = false
    let webhookFields: string[] = []
    let webhookError = ''

    try {
      await graph('/' + encodeURIComponent(instagramUserId) + '/subscribed_apps?subscribed_fields=comments,messages,mentions', pageToken, { method: 'POST' })
      const current = await graph('/' + encodeURIComponent(instagramUserId) + '/subscribed_apps', pageToken)
      const apps = Array.isArray(current?.data) ? current.data : []
      const row = apps.find((item: any) => String(item?.id || item?.app_id || '') === String(appId))
      webhookFields = Array.isArray(row?.subscribed_fields) ? row.subscribed_fields.map(String) : []
      webhookSubscribed = webhookFields.includes('comments') || Boolean(row)
      if (!webhookSubscribed) webhookError = 'تم ربط Instagram لكن Meta لم تؤكد اشتراك Webhook للحساب.'
    } catch (error) {
      webhookError = error instanceof Error ? error.message : 'فشل اشتراك Instagram Webhook لدى Meta.'
      console.error('Instagram webhook subscription failed', { instagramUserId, error: webhookError })
    }

    const now = new Date().toISOString()
    const { error: saveError } = await db.from('integrations').upsert({
      organization_id: organizationId,
      provider: 'instagram',
      connected: true,
      status: webhookSubscribed ? 'connected' : 'error',
      config: { access_token: encryptToken(pageToken) },
      metadata: {
        instagram_user_id: instagramUserId,
        instagram_username: String(selected.instagram.username || ''),
        instagram_name: String(selected.instagram.name || ''),
        instagram_profile_picture_url: String(selected.instagram.profile_picture_url || ''),
        facebook_page_id: selected.pageId,
        facebook_page_name: selected.pageName,
        instagram_webhook_subscribed: webhookSubscribed,
        instagram_webhook_fields: webhookFields,
        ready_for_messaging: webhookSubscribed,
        connected_via: 'instagram_facebook_login',
      },
      connected_at: now,
      last_verified_at: now,
      error_message: webhookError || null,
      updated_at: now,
    }, { onConflict: 'organization_id,provider' })

    if (saveError) throw new Error('تمت مصادقة Instagram لكن تعذر حفظ الاتصال في Dragon Media.')
    return redirect(res, webhookSubscribed ? 'connected' : 'error', webhookError || '')
  } catch (error) {
    console.error('Instagram OAuth callback failed', error)
    return redirect(res, 'error', error instanceof Error ? error.message : 'فشل اتصال Instagram.')
  }
}
