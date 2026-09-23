import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createDecipheriv, createHash, timingSafeEqual } from 'node:crypto'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'
const env = (...names: string[]) => names.map((name) => process.env[name]).find((value) => value && value.trim())?.trim() || ''
function json(res: VercelResponse, status: number, body: unknown) { return res.status(status).json(body) }
function sameSecret(a: string, b: string) { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right) }

function decryptToken(value: any) {
  if (!value?.iv || !value?.tag || !value?.data) throw new Error('Facebook token is not encrypted in the expected format.')
  const seed = env('META_TOKEN_ENCRYPTION_KEY', 'META_APP_SECRET')
  if (!seed) throw new Error('Meta token encryption configuration is missing.')
  const key = createHash('sha256').update(seed).digest()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(String(value.iv), 'base64'))
  decipher.setAuthTag(Buffer.from(String(value.tag), 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(String(value.data), 'base64')), decipher.final()]).toString('utf8')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  try {
    const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY')
    if (!supabaseUrl || !serviceKey) return json(res, 500, { error: 'Supabase server configuration is incomplete.' })

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const auth = String(req.headers.authorization || '')
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
    const internalSecret = String(req.headers['x-dragon-facebook-outbound-secret'] || '').trim()
    let authenticatedUserId = ''
    let internalDispatch = false

    if (bearer) {
      const { data: userData, error: userError } = await db.auth.getUser(bearer)
      if (!userError && userData.user) authenticatedUserId = userData.user.id
    }

    if (!authenticatedUserId && internalSecret) {
      const { data: secretRow } = await db.from('system_secrets').select('value').eq('key', 'whatsapp_outbound_webhook_secret').maybeSingle()
      internalDispatch = Boolean(secretRow?.value && sameSecret(internalSecret, String(secretRow.value)))
    }

    if (!authenticatedUserId && !internalDispatch) return json(res, 401, { error: 'Authentication required.' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    let organizationId = String(body.organizationId || '')
    let conversationId = String(body.conversationId || '')
    let recipientId = String(body.recipientId || '')
    let content = String(body.content || '').trim()
    const messageId = String(body.message_id || body.messageId || '')
    let sourceSenderType = 'agent'

    if (messageId) {
      const { data: sourceMessage, error: sourceError } = await db.from('messages').select('id,conversation_id,sender_type,content,external_id,metadata').eq('id', messageId).maybeSingle()
      if (sourceError || !sourceMessage) return json(res, 404, { error: 'رسالة الإرسال غير موجودة.' })
      if (!['agent', 'ai'].includes(String(sourceMessage.sender_type))) return json(res, 200, { ok: true, skipped: true, reason: 'unsupported_sender' })
      if (sourceMessage.external_id) return json(res, 200, { ok: true, skipped: true, reason: 'already_sent', external_id: sourceMessage.external_id })
      conversationId = String(sourceMessage.conversation_id)
      content = String(sourceMessage.content || '').trim()
      sourceSenderType = String(sourceMessage.sender_type)
      const sourceMetadata = sourceMessage.metadata && typeof sourceMessage.metadata === 'object' ? sourceMessage.metadata : {}
      if ((sourceMetadata as any).outbound_status === 'failed') return json(res, 200, { ok: true, skipped: true, reason: 'previously_failed' })
    }

    if (!conversationId || !content) return json(res, 400, { error: 'conversationId and content are required.' })

    const { data: conversation } = await db.from('conversations').select('id,organization_id,channel,customer_id,customers(id,phone)').eq('id', conversationId).maybeSingle()
    if (!conversation || !['facebook', 'messenger'].includes(String(conversation.channel || ''))) return json(res, 404, { error: 'Facebook conversation not found.' })
    organizationId = organizationId || String(conversation.organization_id || '')
    if (!organizationId) return json(res, 400, { error: 'Organization is required.' })

    if (authenticatedUserId) {
      const { data: membership } = await db.from('users').select('id,organization_id,active,role').eq('id', authenticatedUserId).eq('organization_id', organizationId).maybeSingle()
      if (!membership || membership.active === false) return json(res, 403, { error: 'You are not a member of this organization.' })

      const { data: permission, error: permissionError } = await db
        .from('role_permissions')
        .select('can_edit')
        .eq('role', membership.role || '')
        .eq('resource', 'inbox')
        .maybeSingle()
      if (permissionError) throw permissionError
      if (!permission?.can_edit) return json(res, 403, { error: 'ليس لديك صلاحية إرسال رسائل من صندوق المحادثات.' })
    }

    const customer = Array.isArray((conversation as any).customers) ? (conversation as any).customers[0] : (conversation as any).customers
    recipientId = recipientId || String(customer?.phone || '')
    if (!recipientId) return json(res, 400, { error: 'Facebook recipient is not configured.' })

    const { data: connection } = await db.from('integrations').select('config,metadata,status,connected').eq('organization_id', organizationId).eq('provider', 'facebook').maybeSingle()
    if (!connection?.connected || connection.status !== 'connected') return json(res, 422, { error: 'Facebook connection is not ready.', code: 'FACEBOOK_NOT_READY' })
    const pageId = String(connection.metadata?.facebook_page_id || '')
    if (!pageId) return json(res, 422, { error: 'Facebook Page is not configured.', code: 'FACEBOOK_PAGE_NOT_READY' })
    const pageToken = decryptToken(connection.config?.access_token)

    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${pageToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ recipient: { id: recipientId }, message: { text: content } }) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) return json(res, 502, { error: payload?.error?.message || 'Facebook Messenger send failed.', code: 'FACEBOOK_SEND_FAILED' })

    const externalId = String(payload?.message_id || payload?.messages?.[0]?.id || '')
    if (messageId) {
      const { data: message, error: updateError } = await db.from('messages').update({ external_id: externalId || null, metadata: { source: sourceSenderType === 'ai' ? 'ryan' : 'inbox', outbound_status: 'accepted', sent_by: authenticatedUserId || null, meta_message_id: externalId || null, facebook_page_id: pageId, facebook_outbound: true, facebook_recipient_id: recipientId, dispatch: internalDispatch ? 'database_trigger' : 'inbox' } }).eq('id', messageId).select('id,conversation_id,sender_type,content,created_at,metadata,external_id').single()
      if (updateError) throw updateError
      await db.from('conversations').update({ handled_by: sourceSenderType === 'ai' ? 'ai' : 'human', last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', conversationId).eq('organization_id', organizationId)
      return json(res, 200, { ok: true, message })
    }

    const { data: message, error: insertError } = await db.from('messages').insert({ conversation_id: conversationId, sender_type: 'agent', content, external_id: externalId || null, metadata: { source: 'inbox', outbound_status: 'accepted', sent_by: authenticatedUserId || null, meta_message_id: externalId || null, facebook_page_id: pageId, facebook_outbound: true, facebook_recipient_id: recipientId }, created_at: new Date().toISOString() }).select('id,conversation_id,sender_type,content,created_at,metadata,external_id').single()
    if (insertError) throw insertError
    await db.from('conversations').update({ handled_by: 'human', last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', conversationId).eq('organization_id', organizationId)
    return json(res, 200, { ok: true, message })
  } catch (error) {
    console.error('Facebook outbound handler failed', error)
    return json(res, 500, { error: error instanceof Error ? error.message : 'Unable to send Facebook message.' })
  }
}
