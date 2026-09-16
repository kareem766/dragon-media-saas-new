import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createDecipheriv, createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'
const env = (...names: string[]) => names.map((name) => process.env[name]).find((value) => value && value.trim())?.trim() || ''

function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body)
}

function decryptToken(value: any) {
  if (!value?.iv || !value?.tag || !value?.data) throw new Error('WhatsApp access token is unavailable.')
  const seed = env('META_TOKEN_ENCRYPTION_KEY', 'META_APP_SECRET')
  if (!seed) throw new Error('Meta token encryption configuration is missing.')
  const key = createHash('sha256').update(seed).digest()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(String(value.iv), 'base64'))
  decipher.setAuthTag(Buffer.from(String(value.tag), 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(String(value.data), 'base64')), decipher.final()]).toString('utf8')
}

function normalizePhone(value: unknown) {
  return String(value || '').replace(/[^0-9]/g, '')
}

async function graph(path: string, token: string, body: unknown) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error?.message || `Meta send failed (${response.status})`)
  return data
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' })

  try {
    const authorization = String(req.headers.authorization || '')
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
    if (!accessToken) return json(res, 401, { error: 'Unauthorized.' })

    const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return json(res, 500, { error: 'Server configuration is incomplete.' })

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: authData, error: authError } = await admin.auth.getUser(accessToken)
    if (authError || !authData.user) return json(res, 401, { error: 'جلسة الدخول غير صالحة.' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const organizationId = String(body.organizationId || '')
    const conversationId = String(body.conversationId || '')
    const content = String(body.content || '').trim()
    if (!organizationId || !conversationId || !content) return json(res, 400, { error: 'بيانات الرسالة غير مكتملة.' })

    const { data: membership, error: membershipError } = await admin
      .from('users')
      .select('id, organization_id, active')
      .eq('id', authData.user.id)
      .eq('organization_id', organizationId)
      .eq('active', true)
      .maybeSingle()
    if (membershipError || !membership) return json(res, 403, { error: 'غير مصرح لهذا الحساب.' })

    const { data: conversation, error: conversationError } = await admin
      .from('conversations')
      .select('id, organization_id, channel, customer_id, customers(id, phone)')
      .eq('id', conversationId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (conversationError || !conversation || conversation.channel !== 'whatsapp') return json(res, 404, { error: 'محادثة WhatsApp غير موجودة.' })

    const customer = Array.isArray((conversation as any).customers) ? (conversation as any).customers[0] : (conversation as any).customers
    const to = normalizePhone(customer?.phone)
    if (!to) return json(res, 400, { error: 'رقم العميل غير موجود.' })

    const { data: integration, error: integrationError } = await admin
      .from('integrations')
      .select('id, config, metadata')
      .eq('organization_id', organizationId)
      .eq('provider', 'whatsapp')
      .eq('connected', true)
      .maybeSingle()
    if (integrationError || !integration) return json(res, 400, { error: 'WhatsApp غير متصل.' })

    const metadata = integration.metadata || {}
    const phoneNumberId = String(metadata.phone_number_id || '')
    if (!phoneNumberId) return json(res, 400, { error: 'Phone Number ID غير موجود.' })
    const token = decryptToken(integration.config?.access_token)

    const sent = await graph(`/${encodeURIComponent(phoneNumberId)}/messages`, token, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: content },
    })

    const externalId = String(sent?.messages?.[0]?.id || '')
    const now = new Date().toISOString()
    const { data: message, error: insertError } = await admin.from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'agent',
      content,
      external_id: externalId || null,
      metadata: { source: 'whatsapp', outbound_status: 'accepted', sent_by: authData.user.id, whatsapp_message_id: externalId || null },
      created_at: now,
    }).select('id, conversation_id, sender_type, content, created_at, metadata, read_at, delivered_at, external_id').single()
    if (insertError) throw insertError

    await admin.from('conversations').update({ handled_by: 'human', last_message_at: now, updated_at: now }).eq('id', conversationId).eq('organization_id', organizationId)
    return json(res, 200, { ok: true, message })
  } catch (error) {
    console.error('WhatsApp outbound send failed', error)
    return json(res, 400, { error: error instanceof Error ? error.message : 'فشل إرسال رسالة WhatsApp.' })
  }
}
