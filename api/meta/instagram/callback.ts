import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createCipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'
const REDIRECT_URI = 'https://dragon-media-saas-new.vercel.app/api/meta/instagram/callback'
const APP_URL = 'https://dragon-media-saas-new.vercel.app'
const env = (...names: string[]) => names.map((name) => process.env[name]).find((value) => value && value.trim())?.trim() || ''

function redirect(res: VercelResponse, status: string, message = '') {
  return res.redirect(302, `${APP_URL}/#/integrations/meta?meta_provider=instagram&meta_status=${status}${message ? `&meta_message=${encodeURIComponent(message)}` : ''}`)
}

function verifyState(value: string) {
  const [raw, signature] = value.split('.')
  if (!raw || !signature) return null
  const secret = env('META_STATE_SECRET', 'META_APP_SECRET')
  const expected = createHmac('sha256', secret).update(raw).digest('base64url')
  const a = Buffer.from(signature), b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Record<string, unknown>
    if (payload.provider !== 'instagram' || typeof payload.organizationId !== 'string' || typeof payload.iat !== 'number') return null
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return redirect(res, 'error', 'طلب Instagram OAuth غير صالح.')
  try {
    const code = String(req.query.code || '')
    const state = String(req.query.state || '')
    if (req.query.error) return redirect(res, 'error', String(req.query.error_description || req.query.error))
    if (!code || !state) return redirect(res, 'error', 'Instagram لم يُرجع authorization code صالحًا.')

    const stateData = verifyState(state)
    if (!stateData) return redirect(res, 'error', 'جلسة Instagram انتهت أو غير صالحة.')

    const instagramAppId = env('INSTAGRAM_APP_ID', 'META_INSTAGRAM_APP_ID')
    const instagramAppSecret = env('INSTAGRAM_APP_SECRET', 'META_INSTAGRAM_APP_SECRET')
    const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY')
    if (!instagramAppId || !instagramAppSecret || !supabaseUrl || !serviceKey) return redirect(res, 'error', 'إعدادات Instagram App ID أو Instagram App Secret أو Supabase غير مكتملة على الخادم.')

    const organizationId = String(stateData.organizationId || '')
    const userId = String(stateData.userId || '')
    if (!organizationId || !userId) return redirect(res, 'error', 'بيانات جلسة Instagram غير مكتملة.')

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: membership } = await db.from('users').select('id,organization_id,active,role').eq('id', userId).eq('organization_id', organizationId).maybeSingle()
    if (!membership || membership.active === false) return redirect(res, 'error', 'حساب المستخدم لم يعد مخولًا لربط Instagram بهذه الشركة.')

    const { data: platformSettings } = await db.from('platform_settings').select('integrations_enabled_before_subscription').eq('id', 1).maybeSingle()
    const allowBeforeSubscription = Boolean(platformSettings?.integrations_enabled_before_subscription)
    const { data: subscription } = await db.from('subscriptions').select('status,expires_at,renewal_date').eq('organization_id', organizationId).order('renewal_date', { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
    const expiry = String(subscription?.expires_at || subscription?.renewal_date || '')
    const today = new Date().toISOString().slice(0, 10)
    const subscriptionActive = ['active', 'trialing'].includes(String(subscription?.status || '')) && (!expiry || expiry >= today)
    if (!subscriptionActive && !allowBeforeSubscription) return redirect(res, 'error', 'ربط التكاملات متاح بعد تفعيل الاشتراك.')

    const { data: integrationsEnabled, error: entitlementError } = await db.rpc('service_subscription_has_feature', { p_organization_id: organizationId, p_feature: 'integrations' })
    if (entitlementError || integrationsEnabled !== true) return redirect(res, 'error', 'التكاملات غير متاحة في الباقة الحالية.')
    const { data: permission } = await db.from('role_permissions').select('can_edit').eq('role', membership.role).eq('resource', 'settings').maybeSingle()
    if (!permission?.can_edit) return redirect(res, 'error', 'ربط Instagram متاح فقط لمن لديه صلاحية تعديل إعدادات الشركة.')

    const codeParams = new URLSearchParams({
      client_id: instagramAppId,
      client_secret: instagramAppSecret,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code,
    })
    const codeResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: codeParams,
    })
    const codeData = await codeResponse.json().catch(() => ({}))
    const shortLivedToken = String(codeData?.access_token || codeData?.data?.[0]?.access_token || '')
    if (!codeResponse.ok || !shortLivedToken) throw new Error(codeData?.error_message || codeData?.error?.message || 'فشل تبادل authorization code مع Instagram.')

    // Important: Meta/Instagram may reject a GET to this endpoint with
    // "Unsupported request - method type: get". Use POST form data explicitly.
    const longLivedParams = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: instagramAppSecret,
      access_token: shortLivedToken,
    })
    const longLivedResponse = await fetch('https://graph.instagram.com/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: longLivedParams,
    })
    const longLivedData = await longLivedResponse.json().catch(() => ({}))
    const token = String(longLivedData?.access_token || '')
    if (!longLivedResponse.ok || !token) throw new Error(longLivedData?.error?.message || longLivedData?.error_message || 'تم تسجيل الدخول إلى Instagram لكن تعذر إصدار Access Token طويل المدى.')

    const profileResponse = await fetch('https://graph.instagram.com/me?fields=id,user_id,username,name,profile_picture_url,account_type', { headers: { Authorization: `Bearer ${token}` } })
    const profileData = await profileResponse.json().catch(() => ({}))
    if (!profileResponse.ok || !profileData?.id) throw new Error(profileData?.error?.message || 'تعذر قراءة بيانات حساب Instagram بعد تسجيل الدخول.')

    const instagramUserId = String(profileData.user_id || profileData.id)
    let webhookSubscribed = false
    let webhookError = ''
    let webhookFields: string[] = []
    try {
      const webhookResponse = await fetch(`https://graph.instagram.com/${GRAPH_VERSION}/${encodeURIComponent(instagramUserId)}/subscribed_apps?subscribed_fields=comments,messages,messaging_postbacks`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const webhookPayload = await webhookResponse.json().catch(() => ({}))
      if (!webhookResponse.ok) throw new Error(webhookPayload?.error?.message || `فشل اشتراك Instagram Webhook لدى Meta (${webhookResponse.status}).`)
      const currentResponse = await fetch(`https://graph.instagram.com/${GRAPH_VERSION}/${encodeURIComponent(instagramUserId)}/subscribed_apps`, { headers: { Authorization: `Bearer ${token}` } })
      const current = await currentResponse.json().catch(() => ({}))
      const apps = Array.isArray(current?.data) ? current.data : []
      const row = apps.find((item: any) => String(item?.id || item?.app_id || '') === String(instagramAppId))
      webhookFields = Array.isArray(row?.subscribed_fields) ? row.subscribed_fields.map(String) : []
      webhookSubscribed = Boolean(row) || webhookFields.length > 0
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
      config: { access_token: encryptToken(token) },
      metadata: {
        instagram_user_id: instagramUserId,
        instagram_app_scoped_id: String(profileData.id || ''),
        instagram_username: String(profileData.username || ''),
        instagram_name: String(profileData.name || ''),
        instagram_profile_picture_url: String(profileData.profile_picture_url || ''),
        instagram_account_type: String(profileData.account_type || ''),
        instagram_webhook_subscribed: webhookSubscribed,
        instagram_webhook_fields: webhookFields,
        ready_for_messaging: webhookSubscribed,
        connected_via: 'instagram_business_login',
      },
      connected_at: now,
      last_verified_at: now,
      error_message: webhookError || null,
      updated_at: now,
    }, { onConflict: 'organization_id,provider' })
    if (saveError) throw new Error('تمت مصادقة Instagram لكن تعذر حفظ الاتصال في Dragon Media.')

    return redirect(res, webhookSubscribed ? 'connected' : 'error', webhookError)
  } catch (error) {
    console.error('Instagram OAuth callback failed', error)
    return redirect(res, 'error', error instanceof Error ? error.message : 'فشل إكمال مصادقة Instagram.')
  }
}
