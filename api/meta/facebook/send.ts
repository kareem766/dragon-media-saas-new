import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function errorResponse(res: VercelResponse, status: number, error: string, code?: string) {
  return res.status(status).json({ error, ...(code ? { code } : {}) })
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

async function getPageAccessToken(
  graphVersion: string,
  connectionToken: string,
  pageId: string,
): Promise<string> {
  // The OAuth callback currently stores the Meta user token in access_token.
  // Messenger Send API requires the Page Access Token. Resolve it server-side
  // from /me/accounts and never expose it to the browser or database metadata.
  try {
    const response = await fetch(
      `https://graph.facebook.com/${graphVersion}/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(connectionToken)}`,
    )
    const payload = await response.json().catch(() => ({}))

    if (response.ok && Array.isArray(payload?.data)) {
      const page = payload.data.find(
        (item: any) => String(item?.id ?? '') === pageId && typeof item?.access_token === 'string' && item.access_token.length > 0,
      )
      if (page?.access_token) return page.access_token
    }
  } catch (error) {
    console.warn('Facebook Page access token resolution failed; trying stored token', error)
  }

  // Backward-compatible fallback for connections that already store a Page token.
  return connectionToken
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed')

  try {
    const providedSecret = String(req.headers['x-dragon-facebook-outbound-secret'] ?? '')
    const messageId = String(req.body?.message_id ?? '')
    if (!providedSecret || !messageId) return errorResponse(res, 400, 'Invalid Facebook outbound request')

    const db = createClient(env('VITE_SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: secretRow, error: secretError } = await db
      .from('system_secrets')
      .select('value')
      .eq('key', 'whatsapp_outbound_webhook_secret')
      .maybeSingle()

    if (secretError || !secretRow?.value || !safeEqual(providedSecret, String(secretRow.value))) {
      return errorResponse(res, 401, 'Unauthorized')
    }

    const { data: message, error: messageError } = await db
      .from('messages')
      .select('id, conversation_id, sender_type, content, external_id, metadata')
      .eq('id', messageId)
      .maybeSingle()

    if (messageError) {
      console.error('Facebook outbound message lookup failed', messageError)
      return errorResponse(res, 500, 'Unable to load message')
    }
    if (!message) return errorResponse(res, 404, 'Message not found')

    const metadata = message.metadata && typeof message.metadata === 'object'
      ? (message.metadata as Record<string, unknown>)
      : {}
    const isRyanMessage = message.sender_type === 'ai' && metadata.source === 'ryan'

    if (message.sender_type !== 'agent' && !isRyanMessage) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'not_outbound_agent_or_ryan_message' })
    }
    if (message.external_id) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'already_sent', external_id: message.external_id })
    }

    const { data: conversation, error: conversationError } = await db
      .from('conversations')
      .select('id, organization_id, channel, customer_id')
      .eq('id', message.conversation_id)
      .maybeSingle()

    if (conversationError || !conversation) return errorResponse(res, 404, 'Conversation not found')
    if (conversation.channel !== 'facebook' && conversation.channel !== 'messenger') {
      return res.status(200).json({ ok: true, skipped: true, reason: 'not_facebook_conversation' })
    }

    const { data: customer, error: customerError } = await db
      .from('customers')
      .select('id, phone, name')
      .eq('id', conversation.customer_id)
      .eq('organization_id', conversation.organization_id)
      .maybeSingle()

    if (customerError || !customer?.phone) return errorResponse(res, 422, 'Facebook customer identifier is missing')

    const recipientId = String(customer.phone).trim()

    const { data: connection, error: connectionError } = await db
      .from('meta_connections')
      .select('id, access_token, status, metadata')
      .eq('organization_id', conversation.organization_id)
      .eq('provider', 'facebook')
      .eq('status', 'connected')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (connectionError || !connection?.access_token) {
      return errorResponse(res, 422, 'Facebook connection is not ready', 'FACEBOOK_NOT_READY')
    }

    const connectionMetadata = connection.metadata && typeof connection.metadata === 'object'
      ? (connection.metadata as Record<string, unknown>)
      : {}
    const pageId = String(connectionMetadata.facebook_page_id ?? connectionMetadata.page_id ?? '').trim()
    if (!pageId) return errorResponse(res, 422, 'Facebook Page is not configured', 'FACEBOOK_PAGE_NOT_READY')

    const graphVersion = process.env.META_GRAPH_API_VERSION || 'v23.0'
    const pageAccessToken = await getPageAccessToken(graphVersion, String(connection.access_token), pageId)

    const metaResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${pageId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pageAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message.content },
      }),
    })

    const payload = await metaResponse.json().catch(() => ({}))

    if (!metaResponse.ok) {
      const errorMessage = payload?.error?.message || 'Facebook Messenger send failed'
      console.error('Facebook Messenger send failed', {
        status: metaResponse.status,
        error: payload?.error ?? payload,
        messageId,
        organizationId: conversation.organization_id,
        pageId,
        recipientId,
      })
      await db
        .from('messages')
        .update({
          metadata: {
            ...metadata,
            facebook_outbound: true,
            outbound_status: 'failed',
            outbound_error: errorMessage,
            facebook_page_id: pageId,
            facebook_recipient_id: recipientId,
          },
        })
        .eq('id', message.id)
      return errorResponse(res, 502, errorMessage, 'FACEBOOK_SEND_FAILED')
    }

    const externalId = payload?.message_id || payload?.messages?.[0]?.id
    if (!externalId) return errorResponse(res, 502, 'Facebook did not return a message id', 'FACEBOOK_MESSAGE_ID_MISSING')

    const now = new Date().toISOString()
    await db
      .from('messages')
      .update({
        external_id: externalId,
        metadata: {
          ...metadata,
          facebook_outbound: true,
          outbound_status: 'accepted',
          facebook_page_id: pageId,
          facebook_recipient_id: recipientId,
          meta_message_id: externalId,
        },
      })
      .eq('id', message.id)

    await db
      .from('conversations')
      .update({ last_message_at: now, updated_at: now })
      .eq('id', conversation.id)
      .eq('organization_id', conversation.organization_id)

    return res.status(200).json({ ok: true, external_id: externalId, recipient_id: recipientId, page_id: pageId })
  } catch (error) {
    console.error('Facebook outbound handler error', error)
    return errorResponse(res, 500, 'Unable to send Facebook message', 'FACEBOOK_OUTBOUND_HANDLER_FAILED')
  }
}
