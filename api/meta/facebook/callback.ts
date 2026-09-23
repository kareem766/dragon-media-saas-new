import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createCipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'
const REDIRECT_URI = 'https://dragon-media-saas-new.vercel.app/api/meta/facebook/callback'
const APP_URL = 'https://dragon-media-saas-new.vercel.app'
const env = (...names: string[]) => names.map((name) => process.env[name]).find((value) => value && value.trim())?.trim() || ''

function verifyState(value: string) {
  const [raw, signature] = value.split('.')
  if (!raw || !signature) return null
  const secret = env('META_STATE_SECRET', 'META_APP_SECRET')
  const expected = createHmac('sha256', secret).update(raw).digest('base64url')
  const a = Buffer.from(signature), b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Record<string, unknown>
    if (payload.provider !== 'facebook' || typeof payload.organizationId !== 'string' || typeof payload.iat !== 'number') return null
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
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}`, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error?.message || `Meta Graph request failed (${response.status})`)
  return data
}

function redirect(res: VercelResponse, status: string, message = '') {
  return res.redirect(302, `${APP_URL}/#/integrations/meta?meta_provider=facebook&meta_status=${status}${message ? `&meta_message=${encodeURIComponent(message)}` : ''}`)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return redirect(res, 'error', 'طلب Facebook OAuth غير صالح.')
  try {
    const code = String(req.query.code || '')
    const state = String(req.query.state || '')
    if (req.query.error) return redirect(res, 'error', String(req.query.error_description || req.query.error))
    if (!code || !state) return redirect(res, 'error', 'Facebook لم يُرجع authorization code صالحًا.')
    const stateData = verifyState(state)
    if (!stateData) return redirect(res, 'error', 'جلسة Facebook انتهت أو غير صالحة.')

    const appId = env('META_APP_ID', 'FACEBOOK_APP_ID')
    const appSecret = env('META_APP_SECRET', 'FACEBOOK_APP_SECRET')
    const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
    if (!appId || !appSecret || !supabaseUrl || !serviceKey) return redirect(res, 'error', 'إعدادات Facebook على الخادم غير مكتملة.')

    const params = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: REDIRECT_URI, code })
    const tokenResponse = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params })
    const tokenData = await tokenResponse.json().catch(() => ({}))
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error(tokenData?.error?.message || 'فشل تبادل authorization code مع Facebook.')

    const userToken = String(tokenData.access_token)

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const stateUserId = String(stateData.userId || '')
    const organizationId = String(stateData.organizationId || '')
    if (!stateUserId || !organizationId) throw new Error('بيانات جلسة Facebook غير مكتملة.')

    const { data: membership } = await db
      .from('users')
      .select('id,organization_id,active,role')
      .eq('id', stateUserId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (!membership || membership.active === false) throw new Error('حساب المستخدم لم يعد مخولًا لربط Facebook بهذه الشركة.')

    const { data: platformSettings } = await db.from('platform_settings').select('integrations_enabled_before_subscription').eq('id', 1).maybeSingle()
    const allowBeforeSubscription = Boolean(platformSettings?.integrations_enabled_before_subscription)
    const { data: subscription } = await db.from('subscriptions').select('status,expires_at,renewal_date').eq('organization_id', organizationId).order('renewal_date', { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
    const expiry = String(subscription?.expires_at || subscription?.renewal_date || '')
    const today = new Date().toISOString().slice(0, 10)
    const subscriptionActive = ['active', 'trialing'].includes(String(subscription?.status || '')) && (!expiry || expiry >= today)
    if (!subscriptionActive && !allowBeforeSubscription) throw new Error('ربط التكاملات متاح بعد تفعيل الاشتراك.')

    const { data: permission } = await db.from('role_permissions').select('can_edit').eq('role', membership.role).eq('resource', 'settings').maybeSingle()
    if (!permission?.can_edit) throw new Error('ربط Facebook متاح فقط لمن لديه صلاحية تعديل إعدادات الشركة.')

    const pages = await graph('/me/accounts?fields=id,name,category,access_token,tasks&limit=100', userToken)
    const page = Array.isArray(pages?.data) ? pages.data.find((item: any) => item?.id && item?.access_token) : null
    if (!page) throw new Error('تم تسجيل الدخول إلى Facebook، لكن لم يتم العثور على صفحة قابلة للربط.')

    const pageToken = String(page.access_token)
    const subscription = await graph(`/${encodeURIComponent(String(page.id))}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,messaging_optins,messaging_referrals,message_deliveries`, pageToken, { method: 'POST' }).then(() => true).catch(() => false)

    const { error } = await db.from('integrations').upsert({
      organization_id: String(stateData.organizationId), provider: 'facebook', connected: true, status: 'connected',
      config: { access_token: encryptToken(pageToken) },
      metadata: { facebook_page_id: String(page.id), facebook_page_name: String(page.name || ''), facebook_page_category: String(page.category || ''), facebook_tasks: Array.isArray(page.tasks) ? page.tasks : [], facebook_webhook_subscribed: subscription, ready_for_messaging: subscription, connected_via: 'facebook_oauth' },
      connected_at: new Date().toISOString(), last_verified_at: new Date().toISOString(), error_message: subscription ? null : 'تم الربط لكن اشتراك Webhook للصفحة لم يكتمل.', updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,provider' })
    if (error) throw new Error('تعذر حفظ اتصال Facebook في Dragon Media.')
    return redirect(res, 'connected')
  } catch (error) {
    console.error('Facebook OAuth callback failed', error)
    return redirect(res, 'error', error instanceof Error ? error.message : 'فشل اتصال Facebook.')
  }
}
