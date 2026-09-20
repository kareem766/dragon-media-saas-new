import type { VercelRequest, VercelResponse } from '@vercel/node'

import { createClient } from '@supabase/supabase-js'
import { createDecipheriv, createHash } from 'node:crypto'

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from './config.js'

const supabaseUrl = SUPABASE_URL
const serviceRoleKey = SUPABASE_SERVICE_ROLE_KEY

function json(res: VercelResponse, status: number, body: Record<string, unknown>) {
  if (status >= 400 && typeof body.message === 'string' && !body.error) {
    body = { ...body, error: body.message }
  }
  return res.status(status).json(body)
}

function getBearer(req: VercelRequest) {
  const value = req.headers.authorization || ''
  return value.startsWith('Bearer ') ? value.slice(7) : null
}

async function getUser(req: VercelRequest) {
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server configuration is missing.')
  const token = getBearer(req)
  if (!token) return null
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

async function isCampaignWorker(req: VercelRequest, admin: any) {
  const supplied = String(req.headers['x-campaign-worker-secret'] || '')
  if (!supplied) return false

  const cronSecret = String(process.env.CRON_SECRET || '')
  if (cronSecret && supplied === cronSecret) return true

  const { data, error } = await admin
    .from('system_secrets')
    .select('value')
    .eq('key', 'campaign_worker_webhook_secret')
    .maybeSingle()

  if (error) throw error
  return Boolean(data?.value) && supplied === String(data.value)
}

async function getOrganizationId(admin: any, userId: string) {
  const { data: member, error } = await admin
    .from('users')
    .select('organization_id, active')
    .eq('id', userId)
    .eq('active', true)
    .maybeSingle()
  if (error) throw error
  return member?.organization_id || null
}

function interpolate(template: string, customer: Record<string, unknown>) {
  return template
    .replaceAll('{name}', String(customer.name ?? customer.full_name ?? ''))
    .replaceAll('{company}', String(customer.company ?? customer.company_name ?? ''))
}

export async function handleCampaignRequest(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { message: 'Method not allowed' })
  if (!supabaseUrl || !serviceRoleKey) return json(res, 500, { message: 'Supabase server configuration is missing.' })

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    const workerRequest = await isCampaignWorker(req, admin)
    const user = workerRequest ? null : await getUser(req)
    if (!workerRequest && !user) return json(res, 401, { message: 'يجب تسجيل الدخول أولاً.' })

    const { campaignId, action: requestedAction } = req.body || {}
    if (!campaignId || !requestedAction) return json(res, 400, { message: 'بيانات الحملة غير مكتملة.' })
    const action = requestedAction === 'worker' ? 'run' : requestedAction

    let organizationId = ''
    if (user) {
      organizationId = await getOrganizationId(admin, user.id)
      if (!organizationId) return json(res, 403, { message: 'لم يتم العثور على مساحة العمل.' })
    }

    let campaignQuery = admin
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)

    if (organizationId) campaignQuery = campaignQuery.eq('organization_id', organizationId)

    const { data: campaign, error: campaignError } = await campaignQuery.maybeSingle()
    if (campaignError) throw campaignError
    if (!campaign) return json(res, 404, { message: 'الحملة غير موجودة.' })
    if (!organizationId) organizationId = String(campaign.organization_id || '')
    if (!organizationId) return json(res, 403, { message: 'لم يتم العثور على مساحة العمل.' })

    if (action === 'cancel') {
      const { error } = await admin.from('campaigns').update({ status: 'ملغاة', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', campaignId).eq('organization_id', organizationId)
      if (error) throw error
      await admin.from('campaign_messages').update({ status: 'ملغاة', skipped_at: new Date().toISOString(), skipped_reason: 'تم إلغاء الحملة' }).eq('campaign_id', campaignId).eq('organization_id', organizationId).in('status', ['قيد الانتظار', 'قيد الإرسال', 'queued', 'pending'])
      return json(res, 200, { message: 'تم إلغاء الحملة.' })
    }

    if (action === 'refresh') {
      const { data: rows, error } = await admin.from('campaign_messages').select('status').eq('campaign_id', campaignId).eq('organization_id', organizationId)
      if (error) throw error
      const counts = (rows || []).reduce((acc: Record<string, number>, row: { status: string | null }) => { const key = row.status || 'unknown'; acc[key] = (acc[key] || 0) + 1; return acc }, {})
      const { error: updateError } = await admin.from('campaigns').update({ total_recipients: rows?.length || 0, queued_count: counts['قيد الإرسال'] || counts.queued || counts.pending || 0, sent_count: counts['تم الإرسال'] || counts.sent || 0, delivered_count: counts['تم التسليم'] || counts.delivered || 0, failed_count: counts['فشلت'] || counts.failed || 0, skipped_count: counts['متخطى'] || counts.skipped || 0, updated_at: new Date().toISOString(), last_run_at: new Date().toISOString() }).eq('id', campaignId).eq('organization_id', organizationId)
      if (updateError) throw updateError
      return json(res, 200, { message: 'تم تحديث إحصائيات الحملة.' })
    }

    if (action === 'retry_failed') {
      const { error } = await admin.from('campaign_messages').update({ status: 'قيد الإرسال', error_message: null, failed_at: null, queued_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('campaign_id', campaignId).eq('organization_id', organizationId).eq('status', 'فشلت')
      if (error) throw error
      return json(res, 200, { message: 'تمت إعادة تجهيز الرسائل الفاشلة.' })
    }

    if (action === 'prepare') {
      if (['مكتملة', 'ملغاة', 'قيد الإرسال'].includes(campaign.status)) return json(res, 409, { message: 'لا يمكن تجهيز الحملة بهذه الحالة.' })

      const filter = campaign.audience_filter || {}
      let query = admin.from('customers').select('*').eq('organization_id', organizationId)
      if (campaign.audience && campaign.audience !== 'كل العملاء المشتركين') {
        query = query.eq('status', campaign.audience)
      }
      if (filter.tag) query = query.contains('tags', [filter.tag])
      const { data: customers, error: customerError } = await query
      if (customerError) throw customerError

      const eligible = (customers || []).filter((customer: Record<string, unknown>) => customer.marketing_opt_in !== false && customer.opt_in !== false)
      const existing = await admin.from('campaign_messages').select('customer_id').eq('campaign_id', campaignId).eq('organization_id', organizationId)
      if (existing.error) throw existing.error
      const existingIds = new Set((existing.data || []).map((r: { customer_id: string }) => r.customer_id))
      const rows = eligible.filter((customer: Record<string, unknown>) => !existingIds.has(String(customer.id))).map((customer: Record<string, unknown>) => ({ campaign_id: campaignId, customer_id: customer.id, organization_id: organizationId, channel: campaign.channel, message_body: interpolate(campaign.message_body || '', customer), status: 'قيد الإرسال', opt_in: true, queued_at: new Date().toISOString() }))
      if (rows.length) {
        const { error: insertError } = await admin.from('campaign_messages').insert(rows)
        if (insertError) throw insertError
      }
      const { error: updateError } = await admin.from('campaigns').update({ status: 'جاهزة', total_recipients: eligible.length, queued_count: eligible.length, audience_preview_count: eligible.length, last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', campaignId).eq('organization_id', organizationId)
      if (updateError) throw updateError
      return json(res, 200, { message: `تم تجهيز الحملة واستهداف ${eligible.length} عميل.` })
    }

    if (action === 'run') {
      // The Supabase campaign dispatcher locks scheduled campaigns as
      // "قيد الإرسال" before calling this worker. If no queue exists yet,
      // build the queue here so scheduled/worker campaigns cannot be
      // completed with zero recipients.
      const { count: existingMessageCount } = await admin
        .from('campaign_messages')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('organization_id', organizationId)

      if ((existingMessageCount || 0) === 0 && campaign.status === 'قيد الإرسال') {
        const filter = campaign.audience_filter || {}
        let audienceQuery = admin.from('customers').select('*').eq('organization_id', organizationId)
        if (campaign.audience && campaign.audience !== 'كل العملاء المشتركين') {
          audienceQuery = audienceQuery.eq('status', campaign.audience)
        }
        if (filter.tag) audienceQuery = audienceQuery.contains('tags', [filter.tag])
        const { data: audienceCustomers, error: audienceError } = await audienceQuery
        if (audienceError) throw audienceError

        const eligible = (audienceCustomers || []).filter(
          (customer: Record<string, unknown>) =>
            customer.marketing_opt_in !== false && customer.opt_in !== false
        )

        const rows = eligible.map((customer: Record<string, unknown>) => ({
          campaign_id: campaignId,
          customer_id: customer.id,
          organization_id: organizationId,
          channel: campaign.channel,
          message_body: interpolate(campaign.message_body || '', customer),
          status: 'قيد الإرسال',
          opt_in: true,
          queued_at: new Date().toISOString(),
        }))

        if (rows.length) {
          const { error: insertError } = await admin.from('campaign_messages').insert(rows)
          if (insertError) throw insertError
        }

        const { error: queueUpdateError } = await admin
          .from('campaigns')
          .update({
            total_recipients: eligible.length,
            queued_count: eligible.length,
            audience_preview_count: eligible.length,
            updated_at: new Date().toISOString(),
          })
          .eq('id', campaignId)
          .eq('organization_id', organizationId)

        if (queueUpdateError) throw queueUpdateError
      }

      const channel = String(campaign.channel || '').toLowerCase()
      if (!['whatsapp', 'messenger', 'instagram'].includes(channel)) {
        return json(res, 422, { message: 'قناة الحملة غير مدعومة حالياً. اختر WhatsApp أو Messenger أو Instagram.' })
      }

      const staleBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      await admin.from('campaign_messages')
        .update({ status: 'قيد الإرسال', updated_at: new Date().toISOString() })
        .eq('campaign_id', campaignId)
        .eq('organization_id', organizationId)
        .eq('status', 'جاهزة')
        .lt('updated_at', staleBefore)

      const { data: queuedRows, error: queueError } = await admin
        .from('campaign_messages')
        .select('id, customer_id, message_body, attempts, status')
        .eq('campaign_id', campaignId)
        .eq('organization_id', organizationId)
        .eq('channel', channel)
        .eq('status', 'قيد الإرسال')
        .order('queued_at', { ascending: true })
        .limit(20)
      if (queueError) throw queueError

      if (!queuedRows?.length) {
        await admin.from('campaigns').update({
          status: 'مكتملة',
          completed_at: new Date().toISOString(),
          last_run_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', campaignId).eq('organization_id', organizationId).neq('status', 'ملغاة')
        return json(res, 200, { message: 'لا توجد رسائل جاهزة للإرسال.', sent: 0, failed: 0, remaining: 0 })
      }

      const claimedRows: any[] = []
      for (const row of queuedRows as any[]) {
        const { data: claimed, error: claimError } = await admin
          .from('campaign_messages')
          .update({
            status: 'جاهزة',
            attempts: Number(row.attempts || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('organization_id', organizationId)
          .eq('campaign_id', campaignId)
          .eq('id', row.id)
          .eq('status', 'قيد الإرسال')
          .select('id, customer_id, message_body, attempts')
          .maybeSingle()

        if (claimError) throw claimError
        if (claimed) claimedRows.push(claimed)
      }

      if (!claimedRows.length) return json(res, 409, { message: 'الحملة قيد التنفيذ بالفعل. حاول التحديث بعد لحظات.' })

      const customerIds = [...new Set(claimedRows.map((row: any) => row.customer_id).filter(Boolean))]
      const { data: customers, error: customersError } = await admin
        .from('customers')
        .select('id, name, company, phone, marketing_opt_in')
        .eq('organization_id', organizationId)
        .in('id', customerIds)
      if (customersError) throw customersError
      const customerMap = new Map((customers || []).map((customer: any) => [String(customer.id), customer]))

      async function markMessage(id: string, status: string, patch: Record<string, unknown> = {}) {
        const now = new Date().toISOString()
        const { error } = await admin.from('campaign_messages').update({
          status,
          updated_at: now,
          ...(status === 'تم الإرسال' ? { sent_at: now } : {}),
          ...(status === 'فشلت' ? { failed_at: now } : {}),
          ...patch,
        }).eq('id', id).eq('organization_id', organizationId)
        if (error) throw error
      }

      function decryptMetaToken(value: any) {
        if (!value?.iv || !value?.tag || !value?.data) throw new Error('Meta access token غير متاح.')
        const seed = process.env.META_TOKEN_ENCRYPTION_KEY || process.env.META_APP_SECRET
        if (!seed) throw new Error('إعداد تشفير Meta غير موجود.')
        const key = createHash('sha256').update(seed).digest()
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(String(value.iv), 'base64'))
        decipher.setAuthTag(Buffer.from(String(value.tag), 'base64'))
        return Buffer.concat([decipher.update(Buffer.from(String(value.data), 'base64')), decipher.final()]).toString('utf8')
      }

      async function metaPost(path: string, token: string, body: unknown) {
        const response = await fetch('https://graph.facebook.com/' + (process.env.META_GRAPH_API_VERSION || 'v23.0') + path, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.error?.message || 'Meta رفض الإرسال.')
        return payload
      }

      async function metaGet(path: string, token: string) {
        const response = await fetch('https://graph.facebook.com/' + (process.env.META_GRAPH_API_VERSION || 'v23.0') + path, {
          headers: { Authorization: 'Bearer ' + token },
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.error?.message || 'Meta رفض طلب البيانات.')
        return payload
      }

      let token = ''
      let whatsappWabaId = ''
      let whatsappSubscriptionValues: string[] = []
      let pageId = ''
      let instagramBusinessId = ''

      if (channel === 'whatsapp') {
        const { data: integration, error: integrationError } = await admin
          .from('integrations')
          .select('config,metadata,connected,status')
          .eq('organization_id', organizationId)
          .eq('provider', 'whatsapp')
          .maybeSingle()
        if (integrationError) throw integrationError
        if (!integration?.connected || integration.status !== 'connected') throw new Error('WhatsApp غير متصل.')
        token = decryptMetaToken(integration.config?.access_token)
        whatsappWabaId = String(integration.metadata?.waba_id || '')

        const { data: subscription } = await admin
          .from('subscriptions')
          .select('plan_id, expires_at, plan, organizations(name), plans(name)')
          .eq('organization_id', organizationId)
          .order('expires_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle()

        if (subscription?.expires_at) {
          const expiry = new Date(String(subscription.expires_at) + 'T00:00:00')
          const today = new Date()
          const days = Math.max(0, Math.ceil((expiry.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000))
          const day = String(expiry.getDate()).padStart(2, '0')
          const month = String(expiry.getMonth() + 1).padStart(2, '0')
          const year = expiry.getFullYear()
          const organizationName = String((subscription as any)?.organizations?.name || 'Dragon Media SaaS')
          const planName = String((subscription as any)?.plans?.name || (subscription as any)?.plan || 'الباقة الحالية')
          whatsappSubscriptionValues = [
            organizationName,
            planName,
            days === 1 ? 'يوم واحد' : days + ' يوم',
            day + '/' + month + '/' + year,
          ]
        }
      } else {
        const { data: integration, error: integrationError } = await admin
          .from('integrations')
          .select('config,metadata,connected,status')
          .eq('organization_id', organizationId)
          .eq('provider', 'facebook')
          .maybeSingle()
        if (integrationError) throw integrationError
        if (!integration?.connected || integration.status !== 'connected') throw new Error('اتصال Facebook غير جاهز. اربط Facebook أولاً.')
        token = decryptMetaToken(integration.config?.access_token)
        pageId = String(integration.metadata?.facebook_page_id || '')
        if (!pageId) throw new Error('Facebook Page ID غير موجود.')
        if (channel === 'instagram') {
          const page = await metaGet('/' + encodeURIComponent(pageId) + '?fields=instagram_business_account', token)
          instagramBusinessId = String(page?.instagram_business_account?.id || '')
          if (!instagramBusinessId) throw new Error('لا يوجد Instagram Business مرتبط بصفحة Facebook المتصلة.')
        }
      }

      async function loadApprovedTemplate(name: string, language: string) {
        if (!whatsappWabaId) throw new Error('WhatsApp WABA ID غير موجود.')
        const data = await metaGet('/' + encodeURIComponent(whatsappWabaId) + '/message_templates?limit=100', token)
        const templates = Array.isArray(data?.data) ? data.data : []
        return templates.find((item: any) =>
          String(item?.name || '') === name &&
          String(item?.language || '') === language &&
          String(item?.status || '').toUpperCase() === 'APPROVED'
        ) || null
      }

      function buildTemplateComponents(template: any, customer: any, messageBody: string) {
        const components: any[] = []
        const isSubscriptionReminder = String(template?.name || '') === 'subscription_expiry_reminder'
        const values = isSubscriptionReminder && whatsappSubscriptionValues.length
          ? whatsappSubscriptionValues
          : [
              String(customer?.name ?? ''),
              String(customer?.company ?? ''),
              String(messageBody || ''),
              String(customer?.phone ?? ''),
            ]

        for (const component of Array.isArray(template?.components) ? template.components : []) {
          const type = String(component?.type || '').toUpperCase()
          const text = String(component?.text || '')
          const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)]

          if ((type === 'HEADER' || type === 'BODY') && matches.length) {
            const parameters = matches.map((match: RegExpMatchArray) => {
              const index = Math.max(1, Number(match[1])) - 1
              return { type: 'text', text: values[index] ?? '' }
            })
            components.push({ type: type.toLowerCase(), parameters })
          }

          if (type === 'BUTTONS' && Array.isArray(component?.buttons)) {
            component.buttons.forEach((button: any, buttonIndex: number) => {
              const buttonUrl = String(button?.url || '')
              const urlMatches = [...buttonUrl.matchAll(/\{\{(\d+)\}\}/g)]
              if (String(button?.type || '').toUpperCase() === 'URL' && urlMatches.length) {
                components.push({
                  type: 'button',
                  sub_type: 'url',
                  index: String(buttonIndex),
                  parameters: [{
                    type: 'text',
                    text: `campaign-${String(customer?.id || 'test')}`,
                  }],
                })
              }
            })
          }
        }

        return components
      }

      let sent = 0
      let failed = 0

      for (const row of claimedRows as any[]) {
        try {
          const customer = customerMap.get(String(row.customer_id))
          if (!customer || customer.marketing_opt_in !== true) {
            await markMessage(row.id, 'تم التخطي', { skipped_at: new Date().toISOString(), skipped_reason: 'العميل غير مشترك في الرسائل التسويقية.' })
            continue
          }

          let recipient = ''
          let conversation: any = null
          if (channel === 'whatsapp') {
            recipient = String(customer.phone || '').replace(/[^0-9]/g, '')
            if (!recipient) throw new Error('رقم WhatsApp غير موجود للعميل.')
          } else {
            const { data: conversationRows, error: conversationError } = await admin
              .from('conversations')
              .select('id,metadata,channel,last_message_at')
              .eq('organization_id', organizationId)
              .eq('customer_id', customer.id)
              .in('channel', channel === 'messenger' ? ['facebook', 'messenger'] : ['instagram'])
              .order('last_message_at', { ascending: false })
              .limit(1)
            if (conversationError) throw conversationError
            conversation = conversationRows?.[0]
            recipient = String(conversation?.metadata?.external_user_id || conversation?.metadata?.instagram_user_id || conversation?.metadata?.facebook_user_id || '')
            if (!recipient) throw new Error('لا يوجد معرّف محادثة صالح لهذه القناة للعميل.')

            // Campaign eligibility: Meta's standard Messenger/Instagram Send API only allows
            // ordinary messages while the customer's messaging window is open.
            // Skip stale recipients before calling Meta so campaigns do not
            // repeatedly fail with a policy error.
            const lastInboundAt = conversation?.last_message_at ? new Date(String(conversation.last_message_at)).getTime() : 0
            const messagingWindowMs = 24 * 60 * 60 * 1000
            if (!lastInboundAt || Date.now() - lastInboundAt > messagingWindowMs) {
              await markMessage(row.id, 'تم التخطي', {
                skipped_at: new Date().toISOString(),
                skipped_reason: 'انتهت نافذة مراسلة Messenger المسموح بها من Meta (24 ساعة من آخر تفاعل للعميل).',
              })
              continue
            }
          }

          let payload: any
          let externalId = ''

          if (channel === 'whatsapp') {
            const phoneNumberId = String((await admin.from('integrations').select('metadata').eq('organization_id', organizationId).eq('provider', 'whatsapp').maybeSingle()).data?.metadata?.phone_number_id || '')
            if (!phoneNumberId) throw new Error('WhatsApp Phone Number ID غير موجود.')

            if (campaign.template_name) {
              const language = String(campaign.template_language || 'ar')
              const approvedTemplate = await loadApprovedTemplate(String(campaign.template_name), language)
              if (!approvedTemplate) {
                throw new Error('قالب WhatsApp غير موجود أو غير معتمد من Meta بنفس الاسم واللغة.')
              }

              const templateDefinition = Array.isArray(approvedTemplate.components) ? approvedTemplate.components : []
              const { error: templateSyncError } = await admin
                .from('campaigns')
                .update({ template_components: templateDefinition, updated_at: new Date().toISOString() })
                .eq('id', campaignId)
                .eq('organization_id', organizationId)
              if (templateSyncError) throw templateSyncError

              const components = buildTemplateComponents(
                approvedTemplate,
                customer,
                String(row.message_body || '')
              )

              payload = {
                messaging_product: 'whatsapp',
                to: recipient,
                type: 'template',
                template: {
                  name: campaign.template_name,
                  language: { code: language },
                  ...(components.length ? { components } : {}),
                },
              }
            } else {
              payload = {
                messaging_product: 'whatsapp',
                to: recipient,
                type: 'text',
                text: { preview_url: false, body: String(row.message_body || '') },
              }
            }
            const result = await metaPost('/' + encodeURIComponent(phoneNumberId) + '/messages', token, payload)
            externalId = String(result?.messages?.[0]?.id || '')
          } else if (channel === 'messenger') {
            const result = await metaPost('/' + encodeURIComponent(pageId) + '/messages', token, {
              recipient: { id: recipient },
              message: { text: String(row.message_body || '') },
            })
            externalId = String(result?.message_id || result?.messages?.[0]?.id || '')
          } else {
            const result = await metaPost('/' + encodeURIComponent(instagramBusinessId) + '/messages', token, {
              recipient: { id: recipient },
              message: { text: String(row.message_body || '') },
            })
            externalId = String(result?.message_id || result?.messages?.[0]?.id || '')
          }

          await markMessage(row.id, 'تم الإرسال', {
            external_id: externalId || null,
            error_message: null,
          })
          if (externalId) {
            const { data: pendingDelivery } = await admin.from('meta_delivery_events').select('occurred_at').eq('organization_id', organizationId).eq('channel', 'messenger').eq('external_id', externalId).eq('state', 'delivered').maybeSingle()
            if (pendingDelivery) await markMessage(row.id, 'تم التسليم', { delivered_at: pendingDelivery.occurred_at, updated_at: pendingDelivery.occurred_at })
          }
          sent++
        } catch (error) {
          const message = error instanceof Error ? error.message : 'فشل الإرسال.'
          await markMessage(row.id, 'فشلت', { error_message: message })
          failed++
        }
      }

      const { count: remaining } = await admin
        .from('campaign_messages')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('organization_id', organizationId)
        .eq('status', 'قيد الإرسال')

      const newStatus = (remaining || 0) > 0 ? 'قيد الإرسال' : (failed > 0 ? 'مكتملة مع أخطاء' : 'مكتملة')
      await admin.from('campaigns').update({
        status: newStatus,
        started_at: campaign.started_at || new Date().toISOString(),
        completed_at: (remaining || 0) > 0 ? null : new Date().toISOString(),
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', campaignId).eq('organization_id', organizationId)

      return json(res, 200, {
        message: `تم إرسال الدفعة: ${sent}، فشل: ${failed}، المتبقي: ${remaining || 0}.`,
        sent,
        failed,
        remaining: remaining || 0,
      })
    }

    return json(res, 400, { message: 'إجراء غير معروف.' })
  } catch (error) {
    console.error('campaign-run error', error)
    const message =
      error instanceof Error
        ? error.message
        : (error && typeof error === 'object' && 'message' in error)
          ? String((error as any).message)
          : 'تعذر تنفيذ الحملة.'
    return json(res, 500, { message })
  }
}
