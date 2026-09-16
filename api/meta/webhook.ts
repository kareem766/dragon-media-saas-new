import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'
const env = (...names: string[]) => names.map((name) => process.env[name]).find((value) => value && value.trim())?.trim() || ''

function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body)
}

function verifySignature(req: VercelRequest, rawBody: string) {
  const signature = String(req.headers['x-hub-signature-256'] || '')
  const secret = env('META_APP_SECRET', 'FACEBOOK_APP_SECRET')
  if (!signature || !secret) return false
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function normalizePhone(value: unknown) {
  return String(value || '').replace(/[^0-9+]/g, '').replace(/^\+/, '')
}

async function getDb() {
  const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase server configuration is incomplete.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function findIntegration(db: any, phoneNumberId: string, wabaId: string) {
  const { data: rows, error } = await db
    .from('integrations')
    .select('id, organization_id, metadata')
    .eq('provider', 'whatsapp')
    .eq('connected', true)
  if (error) throw error
  return (rows || []).find((row: any) => {
    const metadata = row.metadata || {}
    return String(metadata.phone_number_id || '') === phoneNumberId || String(metadata.waba_id || '') === wabaId
  }) || null
}

async function handleMessage(db: any, organizationId: string, phoneNumberId: string, message: any, contact: any) {
  const externalId = String(message?.id || '')
  const from = normalizePhone(message?.from)
  if (!externalId || !from) return

  const { data: existing } = await db.from('messages').select('id').eq('external_id', externalId).maybeSingle()
  if (existing) return

  let customer = null
  const { data: existingCustomer } = await db
    .from('customers')
    .select('id, name, phone')
    .eq('organization_id', organizationId)
    .eq('phone', from)
    .maybeSingle()
  customer = existingCustomer

  if (!customer) {
    const profileName = String(contact?.profile?.name || `WhatsApp ${from}`)
    const { data: createdCustomer, error: customerError } = await db
      .from('customers')
      .insert({ organization_id: organizationId, name: profileName, phone: from, source: 'whatsapp' })
      .select('id, name, phone')
      .single()
    if (customerError) throw customerError
    customer = createdCustomer
  }

  const { data: conversation } = await db
    .from('conversations')
    .select('id, unread_count, handled_by')
    .eq('organization_id', organizationId)
    .eq('channel', 'whatsapp')
    .eq('customer_id', customer.id)
    .in('status', ['open', 'pending'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const now = new Date().toISOString()
  const conversationId = conversation?.id || null
  let activeConversation = conversation

  if (!conversationId) {
    const { data: createdConversation, error: conversationError } = await db
      .from('conversations')
      .insert({
        organization_id: organizationId,
        customer_id: customer.id,
        channel: 'whatsapp',
        handled_by: 'ai',
        status: 'open',
        unread_count: 1,
        last_message_at: now,
        updated_at: now,
        metadata: { whatsapp_phone_number_id: phoneNumberId, whatsapp_from: from },
      })
      .select('id, unread_count, handled_by')
      .single()
    if (conversationError) throw conversationError
    activeConversation = createdConversation
  }

  const messageType = String(message?.type || 'text')
  let content = ''
  if (messageType === 'text') content = String(message?.text?.body || '')
  else if (messageType === 'button') content = String(message?.button?.text || '')
  else if (messageType === 'interactive') content = String(message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title || '')
  else content = `[${messageType}]`

  const { error: insertError } = await db.from('messages').insert({
    conversation_id: activeConversation.id,
    sender_type: 'customer',
    content: content || `[${messageType}]`,
    external_id: externalId,
    metadata: {
      source: 'whatsapp_webhook',
      whatsapp_message_id: externalId,
      whatsapp_message_type: messageType,
      whatsapp_from: from,
      whatsapp_phone_number_id: phoneNumberId,
      timestamp: message?.timestamp || null,
    },
    created_at: message?.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : now,
  })
  if (insertError) throw insertError

  const nextUnread = Number(activeConversation.unread_count || 0) + (activeConversation.id === conversationId ? 1 : 0)
  await db.from('conversations').update({
    last_message_at: now,
    updated_at: now,
    unread_count: nextUnread,
    status: 'open',
  }).eq('id', activeConversation.id)
}

async function handleStatus(db: any, organizationId: string, status: any) {
  const externalId = String(status?.id || '')
  if (!externalId) return
  const state = String(status?.status || '')
  const timestamp = status?.timestamp ? new Date(Number(status.timestamp) * 1000).toISOString() : new Date().toISOString()
  const patch: Record<string, unknown> = { metadata: { whatsapp_status: state, whatsapp_status_timestamp: timestamp } }
  if (state === 'delivered' || state === 'read') patch.delivered_at = timestamp
  await db.from('messages').update(patch).eq('external_id', externalId)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const mode = String(req.query['hub.mode'] || '')
    const token = String(req.query['hub.verify_token'] || '')
    const challenge = String(req.query['hub.challenge'] || '')
    const verifyToken = env('META_WEBHOOK_VERIFY_TOKEN', 'META_STATE_SECRET')
    if (mode === 'subscribe' && verifyToken && token === verifyToken) return res.status(200).send(challenge)
    return json(res, 403, { error: 'Webhook verification failed.' })
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' })

  try {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})
    if (!verifySignature(req, rawBody)) return json(res, 401, { error: 'Invalid webhook signature.' })

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    if (payload.object !== 'whatsapp_business_account') return json(res, 200, { ok: true, ignored: true })

    const db = await getDb()
    for (const entry of Array.isArray(payload.entry) ? payload.entry : []) {
      const wabaId = String(entry?.id || '')
      for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
        if (change?.field !== 'messages') continue
        const value = change.value || {}
        const phoneNumberId = String(value?.metadata?.phone_number_id || '')
        const integration = await findIntegration(db, phoneNumberId, wabaId)
        if (!integration) continue
        const organizationId = String(integration.organization_id)
        const contacts = Array.isArray(value.contacts) ? value.contacts : []
        const contactMap = new Map(contacts.map((contact: any) => [normalizePhone(contact?.wa_id), contact]))
        for (const message of Array.isArray(value.messages) ? value.messages : []) {
          await handleMessage(db, organizationId, phoneNumberId, message, contactMap.get(normalizePhone(message?.from)))
        }
        for (const status of Array.isArray(value.statuses) ? value.statuses : []) await handleStatus(db, organizationId, status)
      }
    }

    return json(res, 200, { ok: true })
  } catch (error) {
    console.error('Meta WhatsApp webhook failed', error)
    return json(res, 500, { error: error instanceof Error ? error.message : 'Webhook processing failed.' })
  }
}
