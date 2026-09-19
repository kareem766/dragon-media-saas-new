import { createClient } from '@supabase/supabase-js'
import { createDecipheriv, createHash } from 'node:crypto'

// Named Meta template parameters are supported; deployment trigger for the WhatsApp renewal fix.
const json = (res: any, status: number, body: unknown) => res.status(status).json(body)
const normalizePhone = (value: unknown) => String(value || '').replace(/\D/g, '')

const variableTokens = (value: unknown) =>
  Array.from(String(value || '').matchAll(/\{\{([^}]+)\}\}/g))
    .map((match: any) => String(match[1] || '').trim())
    .filter(Boolean)

const variableCount = (value: unknown) => new Set(variableTokens(value)).size
const cleanValue = (value: unknown) => String(value ?? '').replace(/[\r\n\t]/g, ' ').trim()

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

  const templateName = String(process.env.WHATSAPP_SUBSCRIPTION_EXPIRY_TEMPLATE || 'subscription_expiry_reminder').trim()
  const language = String(process.env.WHATSAPP_SUBSCRIPTION_EXPIRY_TEMPLATE_LANGUAGE || 'ar').trim()
  if (!templateName) return json(res, 500, { error: 'قالب إشعار التجديد غير مضبوط' })

  const { data: org } = await admin.from('organizations').select('id,name,phone,suspended').eq('id', organizationId).single()
  if (!org || org.suspended) return json(res, 404, { error: 'المنظمة غير موجودة أو موقوفة' })

  const phone = normalizePhone(org.phone)
  if (!phone) return json(res, 400, { error: 'رقم WhatsApp للمنظمة غير موجود' })

  const { data: integration } = await admin.from('integrations').select('config,metadata').eq('organization_id', organizationId).eq('provider', 'whatsapp').eq('connected', true).maybeSingle()
  const phoneNumberId = String(integration?.metadata?.phone_number_id || '')
  if (!integration || !phoneNumberId || !integration.config?.access_token) return json(res, 409, { error: 'WhatsApp غير متصل لهذه المنظمة' })

  const graphVersion = process.env.META_GRAPH_API_VERSION || 'v23.0'
  const token = decryptToken(integration.config.access_token)
  const wabaId = String(integration?.metadata?.waba_id || '')
  if (!wabaId) return json(res, 409, { error: 'WhatsApp WABA ID غير موجود' })

  const templatesResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(wabaId)}/message_templates?name=${encodeURIComponent(templateName)}&limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const templatesData = await templatesResponse.json().catch(() => ({}))
  if (!templatesResponse.ok) return json(res, 502, { success: false, error: templatesData?.error?.message || `Meta template lookup failed (${templatesResponse.status})`, templateName })
  const candidates = Array.isArray(templatesData?.data) ? templatesData.data : []
  const template = candidates.find((item: any) => String(item?.name || '') === templateName && String(item?.status || '').toUpperCase() === 'APPROVED' && String(item?.language || '') === language)
    || candidates.find((item: any) => String(item?.name || '') === templateName && String(item?.status || '').toUpperCase() === 'APPROVED')
  if (!template) return json(res, 409, { success: false, error: 'قالب إشعار التجديد غير موجود أو غير معتمد في Meta، أو لغة القالب مختلفة.', templateName, requestedLanguage: language, available: candidates.map((item: any) => ({ language: item?.language, status: item?.status, category: item?.category })) })

  const cleanText = cleanValue
  const distinctVariableCount = variableCount
  const exampleValues = (value: unknown) => Array.isArray(value) ? value.map(cleanText) : []
  const fallbackValues = [cleanText(org.name || 'عميلنا'), 'اختبار التجديد', 'يوم واحد', new Date().toISOString().slice(0, 10), String(organizationId)]
  const namedExampleValues = (component: any, key: string) =>
    Array.isArray(component?.example?.[key])
      ? component.example[key].map((item: any) => cleanText(item?.example ?? item))
      : []
  const components: any[] = []

  const headerComponent = (template.components || []).find((component: any) => component?.type === 'HEADER')
  const headerCount = distinctVariableCount(headerComponent?.text)
  if (headerCount > 0) {
    const tokens = variableTokens(headerComponent?.text)
    const examples = exampleValues(headerComponent?.example?.header_text?.[0])
    const namedExamples = namedExampleValues(headerComponent, 'header_text_named_params')
    const values = examples.length >= headerCount ? examples : namedExamples.length >= headerCount ? namedExamples : fallbackValues
    components.push({
      type: 'header',
      parameters: tokens.slice(0, headerCount).map((token, index) => ({
        type: 'text',
        text: cleanText(values[index] || fallbackValues[index] || 'اختبار'),
        ...( /^\d+$/.test(token) ? {} : { parameter_name: token }),
      })),
    })
  }

  const bodyComponent = (template.components || []).find((component: any) => component?.type === 'BODY')
  const bodyCount = distinctVariableCount(bodyComponent?.text)
  if (bodyCount > 0) {
    const tokens = variableTokens(bodyComponent?.text)
    const examples = exampleValues(bodyComponent?.example?.body_text?.[0])
    const namedExamples = namedExampleValues(bodyComponent, 'body_text_named_params')
    const values = examples.length >= bodyCount ? examples : namedExamples.length >= bodyCount ? namedExamples : fallbackValues
    components.push({
      type: 'body',
      parameters: tokens.slice(0, bodyCount).map((token, index) => ({
        type: 'text',
        text: cleanText(values[index] || fallbackValues[index] || 'اختبار'),
        ...( /^\d+$/.test(token) ? {} : { parameter_name: token }),
      })),
    })
  }

  const buttonsComponent = (template.components || []).find((component: any) => component?.type === 'BUTTONS')
  const buttons = Array.isArray(buttonsComponent?.buttons) ? buttonsComponent.buttons : []
  buttons.forEach((button: any, buttonIndex: number) => {
    if (String(button?.type || '').toUpperCase() !== 'URL') return
    const tokens = variableTokens(button?.url)
    const count = new Set(tokens).size
    if (count <= 0) return
    const examples = exampleValues(button?.example)
    const templateUrl = String(button?.url || '')
    const token = tokens[0]
    const marker = token ? templateUrl.indexOf('{{' + token + '}}') : -1
    const prefix = marker >= 0 ? templateUrl.slice(0, marker) : ''
    const candidate = String(examples[0] || '')
    let suffix = candidate.startsWith(prefix) ? candidate.slice(prefix.length) : `test-${String(organizationId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'renewal'}`
    if (!suffix || /\{\{[^}]+\}\}/.test(suffix) || /^(https?:\/\/|www\.)/i.test(suffix)) {
      suffix = `test-${String(organizationId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'renewal'}`
    }
    const buttonParameter: any = { type: 'text', text: cleanText(suffix) }
    components.push({
      type: 'button',
      sub_type: 'url',
      index: String(buttonIndex),
      parameters: [buttonParameter],
    })
  })

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', recipient_type: 'individual', to: phone, type: 'template',
      template: {
        name: templateName, language: { code: String(template.language || language) },
        components,
      },
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const metaError = data?.error ? {
      code: data.error.code,
      type: data.error.type,
      subcode: data.error.error_subcode,
      message: data.error.message,
      errorUserTitle: data.error.error_user_title,
      errorUserMsg: data.error.error_user_msg,
      fbtraceId: data.error.fbtrace_id,
      details: data.error?.error_data?.details,
    } : undefined
    console.error('[subscription-whatsapp-test] Meta send rejected', {
      status: response.status,
      templateName,
      templateLanguage: template.language,
      templateStatus: template.status,
      templateCategory: template.category,
      components,
      metaError,
    })
    return json(res, 502, {
      success: false,
      error: data?.error?.message || `Meta send failed (${response.status})`,
      metaError,
      templateName,
      templateLanguage: template.language,
    })
  }

  return json(res, 200, {
    success: true,
    test: true,
    organizationId,
    phoneMasked: phone.length > 4 ? `${phone.slice(0, 3)}****${phone.slice(-2)}` : '****',
    externalId: String(data?.messages?.[0]?.id || ''),
    templateName,
  })
}
