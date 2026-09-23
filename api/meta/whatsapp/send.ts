import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createDecipheriv, createHash, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'
const env = (...names: string[]) => names.map((name) => process.env[name]).find((value) => value && value.trim())?.trim() || ''

function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body)
}

function sameSecret(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
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
  let phone = String(value || '').replace(/[^0-9]/g, '')
  if (phone.startsWith('00')) phone = phone.slice(2)
  if (/^01[0125]\d{8}$/.test(phone)) phone = `20${phone.slice(1)}`
  return phone
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
    const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
    const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY')
    if (!supabaseUrl || !serviceKey) return json(res, 500, { error: 'Server configuration is incomplete.' })

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    let authenticatedUserId = ''
    let internalAuthorized = false
    let internalDispatch = false

    if (bearerToken) {
      const { data: authData, error: authError } = await admin.auth.getUser(bearerToken)
      if (!authError && authData.user) authenticatedUserId = authData.user.id
    }

    if (!authenticatedUserId) {
      const ryanSecret = String(req.headers['x-ryan-inbox-secret'] || '').trim()
      const outboundSecret = String(req.headers['x-dragon-outbound-secret'] || '').trim()

      if (ryanSecret) {
        const { data: secretRows } = await admin
          .from('system_secrets')
          .select('key, value')
          .in('key', ['ai_agent_inbox_secret', 'ryan_inbox_webhook_secret'])
        internalAuthorized = (secretRows || []).some((row: any) =>
          row?.value && sameSecret(ryanSecret, String(row.value))
        )
      }

      if (!internalAuthorized && outboundSecret) {
        const { data: secretRow } = await admin
          .from('system_secrets')
          .select('value')
          .eq('key', 'whatsapp_outbound_webhook_secret')
          .maybeSingle()
        internalAuthorized = Boolean(secretRow?.value && sameSecret(outboundSecret, String(secretRow.value)))
        internalDispatch = internalAuthorized
      }
    }

    if (!authenticatedUserId && !internalAuthorized) return json(res, 401, { error: 'Unauthorized.' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const messageId = String(body.message_id || body.messageId || '')
    let organizationId = String(body.organizationId || body.organization_id || '')
    let conversationId = String(body.conversationId || body.conversation_id || '')
    let content = String(body.content || body.reply || '').trim()
    let sourceSenderType: 'agent' | 'ai' = 'agent'

    if (messageId) {
      const { data: sourceMessage, error: sourceMessageError } = await admin
        .from('messages')
        .select('id, conversation_id, sender_type, content, external_id, metadata')
        .eq('id', messageId)
        .maybeSingle()
      if (sourceMessageError || !sourceMessage) return json(res, 404, { error: 'رسالة الإرسال غير موجودة.' })
      if (!['agent', 'ai'].includes(String(sourceMessage.sender_type))) return json(res, 200, { ok: true, skipped: true, reason: 'unsupported_sender' })

      conversationId = String(sourceMessage.conversation_id)
      content = String(sourceMessage.content || '').trim()
      sourceSenderType = sourceMessage.sender_type === 'ai' ? 'ai' : 'agent'

      if (sourceMessage.external_id) {
        return json(res, 200, { ok: true, skipped: true, reason: 'already_sent', external_id: sourceMessage.external_id })
      }

      const sourceMetadata = sourceMessage.metadata && typeof sourceMessage.metadata === 'object' ? sourceMessage.metadata : {}
      if (sourceMetadata && (sourceMetadata as any).outbound_status === 'failed') {
        return json(res, 200, { ok: true, skipped: true, reason: 'previously_failed' })
      }
    }

    if (!organizationId && conversationId) {
      const { data: conversationForOrg } = await admin
        .from('conversations')
        .select('organization_id')
        .eq('id', conversationId)
        .maybeSingle()
      organizationId = String(conversationForOrg?.organization_id || '')
    }

    if (!organizationId || !conversationId || !content) return json(res, 400, { error: 'بيانات الرسالة غير مكتملة.' })

    if (authenticatedUserId) {
      const { data: membership, error: membershipError } = await admin
        .from('users')
        .select('id, organization_id, active')
        .eq('id', authenticatedUserId)
        .eq('organization_id', organizationId)
        .eq('active', true)
        .maybeSingle()
      if (membershipError || !membership) return json(res, 403, { error: 'غير مصرح لهذا الحساب.' })

      const { data: permission, error: permissionError } = await admin
        .from('role_permissions')
        .select('can_edit')
        .eq('role', membership.role || '')
        .eq('resource', 'inbox')
        .maybeSingle()
      if (permissionError) throw permissionError
      if (!permission?.can_edit) return json(res, 403, { error: 'ليس لديك صلاحية إرسال رسائل من صندوق المحادثات.' })
    }

    const { data: conversation, error: conversationError } = await admin
      .from('conversations')
      .select('id, organization_id, channel, customer_id, customers(id, phone)')
      .eq('id', conversationId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (conversationError || !conversation || conversation.channel !== 'whatsapp') return json(res, 404, { error: 'محادثة WhatsApp غير موجودة.' })

    const customer = Array.isArray((conversation as any).customers) ? (conversation as any).customers[0] : (conversation as any).customers
    const conversationMetadata = (conversation as any).metadata && typeof (conversation as any).metadata === 'object' ? (conversation as any).metadata : {}
    // Always reply to the verified WhatsApp participant for this conversation.
    // customer.phone may be an alternate callback number supplied during qualification.
    const channelRecipient = normalizePhone(conversationMetadata.whatsapp_from)
    const to = channelRecipient || normalizePhone(customer?.phone)
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

    if (messageId) {
      const { data: message, error: updateError } = await admin.from('messages').update({
        external_id: externalId || null,
        metadata: {
          source: sourceSenderType === 'ai' ? 'ryan' : 'whatsapp',
          outbound_status: 'accepted',
          sent_by: authenticatedUserId || null,
          whatsapp_message_id: externalId || null,
          whatsapp_outbound: true,
          dispatch: internalDispatch ? 'database_webhook' : 'internal',
        },
      }).eq('id', messageId).select('id, conversation_id, sender_type, content, created_at, metadata, read_at, delivered_at, external_id').single()
      if (updateError) throw updateError

      await admin.from('conversations').update({
        handled_by: sourceSenderType === 'ai' ? 'ai' : 'human',
        last_message_at: now,
        updated_at: now,
      }).eq('id', conversationId).eq('organization_id', organizationId)

      console.log('WhatsApp outbound message sent', { organizationId, conversationId, phoneNumberId, to, externalId, sourceSenderType, internalDispatch })
      return json(res, 200, { ok: true, message })
    }

    const { data: message, error: insertError } = await admin.from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'agent',
      content,
      external_id: externalId || null,
      metadata: { source: 'whatsapp', outbound_status: 'accepted', sent_by: authenticatedUserId || null, whatsapp_message_id: externalId || null },
      created_at: now,
    }).select('id, conversation_id, sender_type, content, created_at, metadata, read_at, delivered_at, external_id').single()
    if (insertError) throw insertError

    await admin.from('conversations').update({ handled_by: 'human', last_message_at: now, updated_at: now }).eq('id', conversationId).eq('organization_id', organizationId)
    console.log('WhatsApp outbound message sent', { organizationId, conversationId, phoneNumberId, to, externalId, internalAuthorized })
    return json(res, 200, { ok: true, message })
  } catch (error) {
    console.error('WhatsApp outbound send failed', error)
    return json(res, 400, { error: error instanceof Error ? error.message : 'فشل إرسال رسالة WhatsApp.' })
  }
}
