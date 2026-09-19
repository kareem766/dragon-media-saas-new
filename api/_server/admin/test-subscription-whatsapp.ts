import { createClient } from '@supabase/supabase-js'
import { createDecipheriv, createHash } from 'node:crypto'

const json = (res: any, status: number, body: unknown) => res.status(status).json(body)
const normalizePhone = (value: unknown) => String(value || '').replace(/\D/g, '')

function decryptToken(value: any) {
  if (!value?.iv || !value?.tag || !value?.data) throw new Error('WhatsApp access token is unavailable.')
  const seed = String(process.env.META_TOKEN_ENCRYPTION_KEY || process.env.META_APP_SECRET || '').trim()
  if (!seed) throw new Error('Meta token encryption configuration is missing.')
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(seed).digest(), Buffer.from(String(value.iv), 'base64'))
  decipher.setAuthTag(Buffer.from(String(value.tag), 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(String(value.data), 'base64')), decipher.final()]).toString('utf8')
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  const accessToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '')
  const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || '')
  const serviceKey = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '')
  if (!accessToken || !supabaseUrl || !anonKey || !serviceKey) return json(res, 401, { error: 'غير مصرح' })

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
  const { data: authData } = await userClient.auth.getUser()
  if (!authData?.user) return json(res, 401, { error: 'جلسة الدخول غير صالحة' })

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: caller } = await admin.from('users').select('is_platform_admin,active').eq('id', authData.user.id).single()
  if (!caller?.is_platform_admin || caller.active === false) return json(res, 403, { error: 'هذه العملية لمدير المنصة فقط' })

  const { organizationId } = req.body || {}
  if (!organizationId) return json(res, 400, { error: 'organizationId مطلوب' })

  const templateName = String(process.env.WHATSAPP_SUBSCRIPTION_EXPIRY_TEMPLATE || '').trim()
  const language = String(process.env.WHATSAPP_SUBSCRIPTION_EXPIRY_TEMPLATE_LANGUAGE || 'ar').trim()
  if (!templateName) return json(res, 409, { error: 'WHATSAPP_SUBSCRIPTION_EXPIRY_TEMPLATE غير مضبوط' })

  const { data: org } = await admin.from('organizations').select('id,name,phone,suspended').eq('id', organizationId).single()
  if (!org || org.suspended) return json(res, 404, { error: 'المنظمة غير موجودة أو موقوفة' })

  const phone = normalizePhone(org.phone)
  if (!phone) return json(res, 400, { error: 'رقم WhatsApp للمنظمة غير موجود' })

  const { data: integration } = await admin.from('integrations').select('config,metadata').eq('organization_id', organizationId).eq('provider', 'whatsapp').eq('connected', true).maybeSingle()
  const phoneNumberId = String(integration?.metadata?.phone_number_id || '')
  if (!integration || !phoneNumberId || !integration.config?.access_token) return json(res, 409, { error: 'WhatsApp غير متصل لهذه المنظمة' })

  const graphVersion = process.env.META_GRAPH_API_VERSION || 'v23.0'
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${decryptToken(integration.config.access_token)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', recipient_type: 'individual', to: phone, type: 'template',
      template: {
        name: templateName, language: { code: language },
        components: [{ type: 'body', parameters: [
          { type: 'text', text: String(org.name || 'عميلنا') },
          { type: 'text', text: 'اختبار التجديد' },
          { type: 'text', text: 'يوم واحد' },
          { type: 'text', text: new Date().toISOString().slice(0, 10) },
        ] }],
      },
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) return json(res, 502, { success: false, error: data?.error?.message || `Meta send failed (${response.status})` })

  return json(res, 200, {
    success: true,
    test: true,
    organizationId,
    phoneMasked: phone.length > 4 ? `${phone.slice(0, 3)}****${phone.slice(-2)}` : '****',
    externalId: String(data?.messages?.[0]?.id || ''),
    templateName,
  })
}
