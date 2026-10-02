import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticate, db, getTelegramToken, obj, telegramApi, text } from '../_server/telegram'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  try {
    const client = db()
    const internalSecret = text(req.headers['x-ryan-inbox-secret'], 300)
    const secretRow = await client.from('system_secrets').select('value').eq('key', 'ai_agent_inbox_secret').maybeSingle()
    const internalAllowed = Boolean(internalSecret && secretRow.data?.value && internalSecret === String(secretRow.data.value))

    let organizationId = ''
    if (internalAllowed) {
      organizationId = text(req.body?.organization_id, 100)
    } else {
      const auth = await authenticate(req)
      if (!auth) return res.status(401).json({ error: 'Unauthorized.' })
      organizationId = auth.organizationId
    }

    const messageId = text(req.body?.message_id, 100)
    const conversationId = text(req.body?.conversation_id, 100)
    const content = text(req.body?.content, 4000)
    if (!organizationId || (!messageId && (!conversationId || !content))) return res.status(400).json({ error: 'Missing message identifiers.' })

    let message: any = null
    if (messageId) {
      const { data } = await client.from('messages').select('id,conversation_id,sender_type,content,metadata,external_id').eq('id', messageId).maybeSingle()
      message = data
      if (!message) return res.status(404).json({ error: 'Message not found.' })
    }

    const targetConversationId = message?.conversation_id || conversationId
    const bodyText = message?.content || content
    if (!targetConversationId || !bodyText) return res.status(400).json({ error: 'Missing Telegram message content.' })

    const { data: conversation } = await client.from('conversations').select('id,organization_id,channel,metadata').eq('id', targetConversationId).eq('organization_id', organizationId).maybeSingle()
    if (!conversation || conversation.channel !== 'telegram') return res.status(404).json({ error: 'Telegram conversation not found.' })

    const chatId = text(obj(conversation.metadata).telegram_chat_id, 100)
    if (!chatId) return res.status(422).json({ error: 'Telegram chat ID is not configured.' })

    const { token } = await getTelegramToken(client, organizationId)
    const result = await telegramApi(token, 'sendMessage', { chat_id: chatId, text: bodyText, disable_web_page_preview: true })
    const externalId = String(result.result?.message_id || '')
    const outboundMessageId = message?.id || ''
    if (outboundMessageId) {
      await client.from('messages').update({
        external_id: externalId || null,
        metadata: {
          ...obj(message.metadata),
          outbound_status: 'accepted',
          telegram_message_id: externalId || null,
          telegram_chat_id: chatId,
        },
      }).eq('id', outboundMessageId).eq('conversation_id', targetConversationId)
    }
    await client.from('conversations').update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', targetConversationId).eq('organization_id', organizationId)
    return res.status(200).json({ ok: true, external_id: externalId, message_id: outboundMessageId || null })
  } catch (error: any) {
    console.error('Telegram send failed', error)
    return res.status(502).json({ error: error?.message || 'Telegram message send failed.' })
  }
}
