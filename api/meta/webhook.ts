import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: false } }
const env = (...names: string[]) => names.map((name) => process.env[name]).find((value) => value && value.trim())?.trim() || ''
function json(res: VercelResponse, status: number, body: unknown) { return res.status(status).json(body) }
function verifySignature(req: VercelRequest, rawBody: string) {
  const signature = String(req.headers['x-hub-signature-256'] || ''), secret = env('META_APP_SECRET', 'FACEBOOK_APP_SECRET')
  if (!signature || !secret) return false
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`
  const a = Buffer.from(signature), b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
function normalizePhone(value: unknown) { return String(value || '').replace(/[^0-9+]/g, '').replace(/^\+/, '') }
function readRawBody(req: VercelRequest) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
async function getDb() {
  const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase server configuration is incomplete.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function findIntegration(db: any, phoneNumberId: string, wabaId: string) {
  const { data: rows, error } = await db.from('integrations').select('id, organization_id, metadata').eq('provider', 'whatsapp').eq('connected', true)
  if (error) throw error
  return (rows || []).find((row: any) => { const metadata = row.metadata || {}; return String(metadata.phone_number_id || '') === phoneNumberId || String(metadata.waba_id || '') === wabaId }) || null
}

async function findOrCreateConversation(db: any, organizationId: string, customerId: string, channel: 'whatsapp' | 'facebook', metadata: Record<string, unknown>, now: string) {
  // The database intentionally allows only one conversation per organization/customer/channel.
  // Reuse that conversation even when it is closed, then reopen it for a new inbound message.
  const { data: existing, error: lookupError } = await db.from('conversations')
    .select('id, unread_count, handled_by, status')
    .eq('organization_id', organizationId)
    .eq('channel', channel)
    .eq('customer_id', customerId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (existing) return { conversation: existing, existed: true }

  const { data: created, error: createError } = await db.from('conversations').insert({
    organization_id: organizationId,
    customer_id: customerId,
    channel,
    handled_by: 'ai',
    status: 'open',
    unread_count: 1,
    last_message_at: now,
    updated_at: now,
    metadata,
  }).select('id, unread_count, handled_by, status').single()
  if (createError) {
    // Meta can retry the same delivery concurrently. If another request won the
    // unique insert race, fetch that conversation instead of returning HTTP 500.
    const { data: raced } = await db.from('conversations')
      .select('id, unread_count, handled_by, status')
      .eq('organization_id', organizationId)
      .eq('channel', channel)
      .eq('customer_id', customerId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (raced) return { conversation: raced, existed: true }
    throw createError
  }
  return { conversation: created, existed: false }
}

async function handleMessage(db: any, organizationId: string, phoneNumberId: string, message: any, contact: any) {
  const externalId = String(message?.id || ''), from = normalizePhone(message?.from)
  if (!externalId || !from) return
  const { data: existing } = await db.from('messages').select('id').eq('external_id', externalId).maybeSingle()
  if (existing) return
  let customer = null
  const { data: existingCustomer } = await db.from('customers').select('id, name, phone').eq('organization_id', organizationId).eq('phone', from).maybeSingle()
  customer = existingCustomer
  if (!customer) {
    const profileName = String(contact?.profile?.name || `WhatsApp ${from}`)
    const { data: createdCustomer, error } = await db.from('customers').insert({ organization_id: organizationId, name: profileName, phone: from, source: 'whatsapp' }).select('id, name, phone').single()
    if (error) throw error
    customer = createdCustomer
  }
  const now = new Date().toISOString()
  const { conversation, existed } = await findOrCreateConversation(db, organizationId, customer.id, 'whatsapp', { whatsapp_phone_number_id: phoneNumberId, whatsapp_from: from }, now)
  const messageType = String(message?.type || 'text')
  let content = ''
  if (messageType === 'text') content = String(message?.text?.body || '')
  else if (messageType === 'button') content = String(message?.button?.text || '')
  else if (messageType === 'interactive') content = String(message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title || '')
  else content = `[${messageType}]`
  const { error: insertError } = await db.from('messages').insert({ conversation_id: conversation.id, sender_type: 'customer', content: content || `[${messageType}]`, external_id: externalId, metadata: { source: 'whatsapp_webhook', whatsapp_message_id: externalId, whatsapp_message_type: messageType, whatsapp_from: from, whatsapp_phone_number_id: phoneNumberId, timestamp: message?.timestamp || null }, created_at: message?.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : now })
  if (insertError) throw insertError
  const nextUnread = Number(conversation.unread_count || 0) + (existed ? 1 : 0)
  await db.from('conversations').update({ last_message_at: now, updated_at: now, unread_count: nextUnread, status: 'open' }).eq('id', conversation.id)
  console.log('WhatsApp message stored', { organizationId, phoneNumberId, from, externalId, conversationId: conversation.id })
}
async function handleStatus(db: any, organizationId: string, status: any) {
  const externalId = String(status?.id || ''), state = String(status?.status || '').toLowerCase()
  if (!externalId) return
  const timestamp = status?.timestamp ? new Date(Number(status.timestamp) * 1000).toISOString() : new Date().toISOString()
  const messagePatch: Record<string, unknown> = {
    metadata: { whatsapp_status: state, whatsapp_status_timestamp: timestamp, whatsapp_status_errors: status?.errors || null },
  }
  if (state === 'delivered' || state === 'read') {
    messagePatch.delivered_at = timestamp
  }
  if (state === 'failed') {
    messagePatch.metadata = {
      whatsapp_status: state,
      whatsapp_status_timestamp: timestamp,
      whatsapp_status_errors: status?.errors || null,
    }
  }
  console.log('WhatsApp status received', {
    organizationId,
    externalId,
    state,
    errors: status?.errors || [],
  })
  const { error } = await db.from('messages').update(messagePatch).eq('external_id', externalId)
  if (error) console.error('WhatsApp status update failed', { organizationId, externalId, state, error: error.message })

  const { data: campaignRows, error: campaignLookupError } = await db
    .from('campaign_messages')
    .select('id, campaign_id')
    .eq('external_id', externalId)
    .eq('organization_id', organizationId)
  if (campaignLookupError) {
    console.error('WhatsApp campaign status lookup failed', { organizationId, externalId, state, error: campaignLookupError.message })
    return
  }

  for (const row of campaignRows || []) {
    const patch: Record<string, unknown> = { updated_at: timestamp }
    if (state === 'delivered' || state === 'read') {
      patch.status = 'تم التسليم'
      patch.delivered_at = timestamp
    } else if (state === 'failed') {
      patch.status = 'فشلت'
      patch.failed_at = timestamp
      patch.error_message = status?.errors?.[0]?.title || status?.errors?.[0]?.message || 'WhatsApp delivery failed.'
    }
    const { error: updateError } = await db.from('campaign_messages').update(patch).eq('id', row.id).eq('organization_id', organizationId)
    if (updateError) console.error('WhatsApp campaign message status update failed', { organizationId, campaignId: row.campaign_id, externalId, state, error: updateError.message })

    const { data: rows } = await db.from('campaign_messages').select('status').eq('campaign_id', row.campaign_id).eq('organization_id', organizationId)
    const counts = (rows || []).reduce((acc: Record<string, number>, item: any) => {
      const key = String(item.status || '')
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
    await db.from('campaigns').update({
      sent_count: counts['تم الإرسال'] || 0,
      delivered_count: counts['تم التسليم'] || 0,
      failed_count: counts['فشلت'] || 0,
      queued_count: counts['قيد الإرسال'] || 0,
      skipped_count: counts['تم التخطي'] || 0,
      total_recipients: rows?.length || 0,
      updated_at: new Date().toISOString(),
    }).eq('id', row.campaign_id).eq('organization_id', organizationId)
  }
}

async function handleFacebookWebhook(db: any, payload: any) {
  for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
    const pageId = String(entry?.id || '')
    if (!pageId) continue
    const { data: integration } = await db.from('integrations').select('organization_id,metadata').eq('provider', 'facebook').eq('connected', true).filter('metadata->>facebook_page_id', 'eq', pageId).maybeSingle()
    if (!integration) { console.warn('Facebook webhook integration not found', { pageId }); continue }
    const organizationId = String(integration.organization_id)
    for (const event of Array.isArray(entry?.messaging) ? entry.messaging : []) {
      const externalId = String(event?.message?.mid || event?.postback?.mid || '')
      const senderId = String(event?.sender?.id || '')
      if (!externalId || !senderId || senderId === pageId) continue
      const { data: existing } = await db.from('messages').select('id').eq('external_id', externalId).maybeSingle()
      if (existing) continue
      const content = String(event?.message?.text || event?.postback?.title || event?.postback?.payload || '').trim()
      if (!content) continue
      const { data: customerExisting } = await db.from('customers').select('id,name,phone').eq('organization_id', organizationId).eq('phone', senderId).maybeSingle()
      const customer = customerExisting || (await db.from('customers').insert({ organization_id: organizationId, name: `Facebook ${senderId}`, phone: senderId, source: 'facebook' }).select('id,name,phone').single()).data
      if (!customer) continue
      const now = new Date().toISOString()
      const { conversation, existed } = await findOrCreateConversation(db, organizationId, customer.id, 'facebook', { facebook_page_id: pageId, facebook_psid: senderId }, now)
      const { error: insertError } = await db.from('messages').insert({ conversation_id: conversation.id, sender_type: 'customer', content, external_id: externalId, metadata: { source: 'facebook_webhook', facebook_page_id: pageId, facebook_psid: senderId, facebook_message_id: externalId }, created_at: now })
      if (insertError) throw insertError
      await db.from('conversations').update({ last_message_at: now, updated_at: now, unread_count: Number(conversation.unread_count || 0) + (existed ? 1 : 0), status: 'open' }).eq('id', conversation.id)
      console.log('Facebook message stored', { organizationId, pageId, senderId, externalId, conversationId: conversation.id })
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    if (String(req.query.renew || '') === '1') return res.redirect(302, '/#/billing')
    const mode = String(req.query['hub.mode'] || ''), token = String(req.query['hub.verify_token'] || ''), challenge = String(req.query['hub.challenge'] || '')
    const verifyToken = env('META_WEBHOOK_VERIFY_TOKEN', 'META_STATE_SECRET')
    if (mode === 'subscribe' && verifyToken && token === verifyToken) return res.status(200).send(challenge)
    return json(res, 403, { error: 'Webhook verification failed.' })
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' })
  try {
    const rawBody = await readRawBody(req)
    if (!verifySignature(req, rawBody)) return json(res, 401, { error: 'Invalid webhook signature.' })
    const payload = JSON.parse(rawBody)
    const db = await getDb()
    if (payload.object === 'page') {
      await handleFacebookWebhook(db, payload)
      return json(res, 200, { ok: true, provider: 'facebook' })
    }
    console.log('Meta WhatsApp webhook received', { object: payload?.object, entries: Array.isArray(payload?.entry) ? payload.entry.length : 0 })
    if (payload.object !== 'whatsapp_business_account') return json(res, 200, { ok: true, ignored: true })
    for (const entry of Array.isArray(payload.entry) ? payload.entry : []) {
      const wabaId = String(entry?.id || '')
      for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
        const value = change?.value || {}, phoneNumberId = String(value?.metadata?.phone_number_id || '')
        const messageCount = Array.isArray(value?.messages) ? value.messages.length : 0, statusCount = Array.isArray(value?.statuses) ? value.statuses.length : 0
        console.log('Meta WhatsApp webhook change', { wabaId, field: change?.field, phoneNumberId, messageCount, statusCount })
        if (change?.field !== 'messages') continue
        const integration = await findIntegration(db, phoneNumberId, wabaId)
        if (!integration) { console.warn('WhatsApp webhook integration not found', { wabaId, phoneNumberId }); continue }
        const organizationId = String(integration.organization_id), contacts = Array.isArray(value.contacts) ? value.contacts : []
        const contactMap = new Map(contacts.map((contact: any) => [normalizePhone(contact?.wa_id), contact]))
        for (const message of Array.isArray(value.messages) ? value.messages : []) await handleMessage(db, organizationId, phoneNumberId, message, contactMap.get(normalizePhone(message?.from)))
        for (const status of Array.isArray(value.statuses) ? value.statuses : []) await handleStatus(db, organizationId, status)
      }
    }
    return json(res, 200, { ok: true })
  } catch (error) {
    console.error('Meta webhook failed', error)
    return json(res, 500, { error: error instanceof Error ? error.message : 'Webhook processing failed.' })
  }
}

// Trigger deployment after WhatsApp status diagnostics fix.
