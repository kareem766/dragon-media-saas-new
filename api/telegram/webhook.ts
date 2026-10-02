import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db, findTelegramIntegrationBySecret, getTelegramToken, internalRyanDispatch, obj, text } from '../_server/telegram'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  try {
    const secret = text(req.headers['x-telegram-bot-api-secret-token'], 300)
    if (!secret) return res.status(401).json({ error: 'Missing Telegram webhook secret.' })

    const client = db()
    const integration = await findTelegramIntegrationBySecret(client, secret)
    if (!integration) return res.status(401).json({ error: 'Invalid Telegram webhook secret.' })

    const update = obj(req.body)
    const message = obj(update.message)
    if (!message.message_id || !message.chat?.id) return res.status(200).json({ ok: true, ignored: true })

    const organizationId = String(integration.organization_id)
    const chatId = String(message.chat.id)
    const user = obj(message.from)
    const userId = user.id ? String(user.id) : chatId
    const firstName = text(user.first_name, 80)
    const lastName = text(user.last_name, 80)
    const username = text(user.username, 120)
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || (username ? '@' + username : 'عميل Telegram')
    const content = text(message.text || message.caption, 4000)

    const externalId = `telegram_${message.message_id}`
    const { data: existingMessage } = await client.from('messages').select('id').eq('external_id', externalId).maybeSingle()
    if (existingMessage) return res.status(200).json({ ok: true, duplicate: true })

    let { data: customer } = await client.from('customers').select('id,name,phone,email,company,notes').eq('organization_id', organizationId).filter('metadata->>telegram_user_id', 'eq', userId).maybeSingle()
    if (!customer) {
      const { data: createdCustomer, error } = await client.from('customers').insert({
        organization_id: organizationId,
        name: displayName,
        phone: null,
        source: 'telegram',
        metadata: { telegram_user_id: userId, telegram_username: username || null, telegram_chat_id: chatId },
      }).select('id,name,phone,email,company,notes').single()
      if (error) throw error
      customer = createdCustomer
    } else {
      await client.from('customers').update({
        metadata: { telegram_user_id: userId, telegram_username: username || null, telegram_chat_id: chatId },
        updated_at: new Date().toISOString(),
      }).eq('id', customer.id).eq('organization_id', organizationId)
    }

    let { data: conversation } = await client.from('conversations').select('id,unread_count,metadata').eq('organization_id', organizationId).eq('channel', 'telegram').eq('customer_id', customer.id).order('updated_at', { ascending: false }).limit(1).maybeSingle()
    const now = new Date().toISOString()
    const conversationMetadata = {
      ...obj(conversation?.metadata),
      provider: 'telegram',
      telegram_chat_id: chatId,
      telegram_user_id: userId,
      telegram_username: username || null,
      telegram_bot_username: text(integration.metadata?.bot_username, 120),
    }

    if (!conversation) {
      const created = await client.from('conversations').insert({
        organization_id: organizationId,
        customer_id: customer.id,
        channel: 'telegram',
        handled_by: 'ai',
        status: 'open',
        unread_count: 1,
        last_message_at: now,
        updated_at: now,
        metadata: conversationMetadata,
      }).select('id,unread_count,metadata').single()
      if (created.error) throw created.error
      conversation = created.data
    } else {
      const updated = await client.from('conversations').update({
        unread_count: Number(conversation.unread_count || 0) + 1,
        status: 'open',
        last_message_at: now,
        updated_at: now,
        metadata: conversationMetadata,
      }).eq('id', conversation.id).eq('organization_id', organizationId).select('id,unread_count,metadata').single()
      if (updated.error) throw updated.error
      conversation = updated.data
    }

    const attachments: any[] = []
    if (Array.isArray(message.photo) && message.photo.length) {
      attachments.push({ type: 'image', mime_type: 'image/jpeg', telegram_file_id: String(message.photo[message.photo.length - 1]?.file_id || '') })
    }
    if (message.document?.mime_type?.startsWith('image/')) {
      attachments.push({ type: 'image', mime_type: text(message.document.mime_type, 120), telegram_file_id: text(message.document.file_id, 300) })
    }

    if (!content && !attachments.length) return res.status(200).json({ ok: true, ignored: true })

    const inserted = await client.from('messages').insert({
      conversation_id: conversation.id,
      sender_type: 'customer',
      content: content || 'أرسل العميل صورة.',
      external_id: externalId,
      metadata: {
        provider: 'telegram',
        telegram_message_id: String(message.message_id),
        telegram_chat_id: chatId,
        telegram_user_id: userId,
        telegram_username: username || null,
        attachments,
      },
      created_at: now,
    }).select('id').single()
    if (inserted.error) throw inserted.error

    try {
      await internalRyanDispatch(req, organizationId, String(conversation.id), String(inserted.data.id))
    } catch (dispatchError: any) {
      console.error('Telegram Ryan dispatch failed', dispatchError)
    }

    return res.status(200).json({ ok: true })
  } catch (error: any) {
    console.error('Telegram webhook failed', error)
    return res.status(500).json({ error: error?.message || 'Telegram webhook processing failed.' })
  }
}
