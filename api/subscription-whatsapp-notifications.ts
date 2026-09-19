import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createDecipheriv, createHash } from 'node:crypto'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'
const REMINDER_DAYS = [7, 3, 1]

function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body)
}

function normalizePhone(value: unknown) {
  return String(value || '').replace(/[\u200e\u200f\u202a-\u202e\s+]/g, '').replace(/[^0-9]/g, '')
}

function decryptToken(value: any) {
  if (!value?.iv || !value?.tag || !value?.data) throw new Error('WhatsApp access token is unavailable.')
  const seed = String(process.env.META_TOKEN_ENCRYPTION_KEY || process.env.META_APP_SECRET || '').trim()
  if (!seed) throw new Error('Meta token encryption configuration is missing.')
  const key = createHash('sha256').update(seed).digest()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(String(value.iv), 'base64'))
  decipher.setAuthTag(Buffer.from(String(value.tag), 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(String(value.data), 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

async function sendTemplate(phoneNumberId: string, token: string, to: string, templateName: string, language: string, parameters: string[], buttonParameter?: string) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: [
          { type: 'body', parameters: parameters.map((text) => ({ type: 'text', text })) },
          ...(buttonParameter ? [{ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: buttonParameter }] }] : []),
        ],
      },
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error?.message || `Meta send failed (${response.status})`)
  return data
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return json(res, 405, { success: false, error: 'Method not allowed' })

  const cronSecret = String(process.env.CRON_SECRET || '')
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return json(res, 401, { success: false, error: 'Unauthorized' })
  }

  const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '')
  const serviceKey = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '')
  if (!supabaseUrl || !serviceKey) return json(res, 500, { success: false, error: 'Server configuration error' })

  const templateName = String(process.env.WHATSAPP_SUBSCRIPTION_EXPIRY_TEMPLATE || '').trim()
  const templateLanguage = String(process.env.WHATSAPP_SUBSCRIPTION_EXPIRY_TEMPLATE_LANGUAGE || 'ar').trim()
  if (!templateName) {
    console.error('[subscription-whatsapp] WHATSAPP_SUBSCRIPTION_EXPIRY_TEMPLATE is not configured')
    return json(res, 200, { success: true, sent: 0, skipped: 0, failed: 0, reason: 'template_not_configured' })
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const today = new Date()
  const todayDate = today.toISOString().slice(0, 10)
  const maxDate = new Date(today)
  maxDate.setUTCDate(maxDate.getUTCDate() + Math.max(...REMINDER_DAYS))
  const maxDateValue = maxDate.toISOString().slice(0, 10)

  const { data: subscriptions, error: subscriptionError } = await admin
    .from('subscriptions')
    .select('id, organization_id, plan, plan_id, status, expires_at, organizations!inner(id, name, phone, suspended), plans(name)')
    .eq('status', 'active')
    .gte('expires_at', todayDate)
    .lte('expires_at', maxDateValue)

  if (subscriptionError) {
    console.error('[subscription-whatsapp] subscription query failed', subscriptionError)
    return json(res, 500, { success: false, error: subscriptionError.message })
  }

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const subscription of subscriptions || []) {
    const expiresAt = String(subscription.expires_at || '')
    if (!expiresAt) continue

    const expiry = new Date(`${expiresAt}T00:00:00Z`)
    const diffDays = Math.round((expiry.getTime() - new Date(`${todayDate}T00:00:00Z`).getTime()) / 86400000)
    if (!REMINDER_DAYS.includes(diffDays)) continue

    const organization = Array.isArray((subscription as any).organizations)
      ? (subscription as any).organizations[0]
      : (subscription as any).organizations
    if (!organization || organization.suspended) {
      skipped++
      continue
    }

    const phone = normalizePhone(organization.phone)
    if (!phone) {
      skipped++
      continue
    }

    const { data: existing } = await admin
      .from('whatsapp_subscription_notifications')
      .select('id, status, external_id')
      .eq('subscription_id', subscription.id)
      .eq('reminder_days', diffDays)
      .maybeSingle()

    if (existing?.status === 'sent') {
      skipped++
      continue
    }

    const { data: claim, error: claimError } = await admin
      .from('whatsapp_subscription_notifications')
      .upsert({
        organization_id: subscription.organization_id,
        subscription_id: subscription.id,
        reminder_days: diffDays,
        phone,
        template_name: templateName,
        template_language: templateLanguage,
        status: 'pending',
        error: null,
      }, { onConflict: 'subscription_id,reminder_days', ignoreDuplicates: false })
      .select('id')
      .single()

    if (claimError || !claim) {
      failed++
      console.error('[subscription-whatsapp] failed to claim notification', claimError)
      continue
    }

    const integrationResult = await admin
      .from('integrations')
      .select('config, metadata')
      .eq('organization_id', subscription.organization_id)
      .eq('provider', 'whatsapp')
      .eq('connected', true)
      .maybeSingle()

    const integration = integrationResult.data
    const phoneNumberId = String(integration?.metadata?.phone_number_id || '')
    if (!integration || !phoneNumberId || !integration.config?.access_token) {
      await admin.from('whatsapp_subscription_notifications').update({
        status: 'skipped',
        error: 'WhatsApp is not connected or ready for messaging.',
      }).eq('id', claim.id)
      skipped++
      continue
    }

    try {
      const plan = Array.isArray((subscription as any).plans)
        ? (subscription as any).plans[0]
        : (subscription as any).plans
      const planName = String(plan?.name || subscription.plan || 'الباقة الحالية')
      const daysText = diffDays === 1 ? 'يوم واحد' : `${diffDays} أيام`
      const message = await sendTemplate(
        phoneNumberId,
        decryptToken(integration.config.access_token),
        phone,
        templateName,
        templateLanguage,
        [String(organization.name || 'عميلنا'), planName, daysText, expiresAt],
        String(subscription.id),
      )
      const externalId = String(message?.messages?.[0]?.id || '')

      await admin.from('whatsapp_subscription_notifications').update({
        status: 'sent',
        external_id: externalId || null,
        sent_at: new Date().toISOString(),
        error: null,
      }).eq('id', claim.id)

      sent++
      console.log('[subscription-whatsapp] sent', {
        organizationId: subscription.organization_id,
        subscriptionId: subscription.id,
        reminderDays: diffDays,
        externalId,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'WhatsApp send failed'
      await admin.from('whatsapp_subscription_notifications').update({
        status: 'failed',
        error: message,
      }).eq('id', claim.id)
      failed++
      console.error('[subscription-whatsapp] send failed', {
        organizationId: subscription.organization_id,
        subscriptionId: subscription.id,
        reminderDays: diffDays,
        error: message,
      })
    }
  }

  return json(res, 200, {
    success: failed === 0,
    sent,
    skipped,
    failed,
    reminders: REMINDER_DAYS,
  })
}
