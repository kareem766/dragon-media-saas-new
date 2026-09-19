import type { VercelRequest, VercelResponse } from '@vercel/node'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(res: VercelResponse, status: number, body: unknown) {
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

async function getOrganizationId(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: profile, error } = await admin.from('profiles').select('organization_id').eq('id', userId).maybeSingle()
  if (error) throw error
  return profile?.organization_id || null
}

function interpolate(template: string, customer: Record<string, unknown>) {
  return template
    .replaceAll('{name}', String(customer.name ?? customer.full_name ?? ''))
    .replaceAll('{company}', String(customer.company ?? customer.company_name ?? ''))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { message: 'Method not allowed' })
  if (!supabaseUrl || !serviceRoleKey) return json(res, 500, { message: 'Supabase server configuration is missing.' })

  try {
    const user = await getUser(req)
    if (!user) return json(res, 401, { message: 'يجب تسجيل الدخول أولاً.' })

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    const organizationId = await getOrganizationId(admin, user.id)
    if (!organizationId) return json(res, 403, { message: 'لم يتم العثور على مساحة العمل.' })

    const { campaignId, action } = req.body || {}
    if (!campaignId || !action) return json(res, 400, { message: 'بيانات الحملة غير مكتملة.' })

    const { data: campaign, error: campaignError } = await admin
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (campaignError) throw campaignError
    if (!campaign) return json(res, 404, { message: 'الحملة غير موجودة.' })

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
      const { error: updateError } = await admin.from('campaigns').update({ total_recipients: rows?.length || 0, queued_count: counts['قيد الإرسال'] || counts.queued || counts.pending || 0, sent_count: counts['تم الإرسال'] || counts.sent || 0, delivered_count: counts['تم التسليم'] || counts.delivered || 0, failed_count: counts['فشل'] || counts.failed || 0, skipped_count: counts['متخطى'] || counts.skipped || 0, updated_at: new Date().toISOString(), last_run_at: new Date().toISOString() }).eq('id', campaignId).eq('organization_id', organizationId)
      if (updateError) throw updateError
      return json(res, 200, { message: 'تم تحديث إحصائيات الحملة.' })
    }

    if (action === 'retry_failed') {
      const { error } = await admin.from('campaign_messages').update({ status: 'قيد الإرسال', error_message: null, failed_at: null, queued_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('campaign_id', campaignId).eq('organization_id', organizationId).eq('status', 'فشل')
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
      return json(res, 501, { message: 'تم تجهيز Queue الحملات، لكن موصل الإرسال للقناة يحتاج استخدام اتصال القناة الحالي قبل الإرسال الفعلي. لم يتم إرسال أي رسالة.' })
    }

    return json(res, 400, { message: 'إجراء غير معروف.' })
  } catch (error) {
    console.error('campaign-run error', error)
    return json(res, 500, { message: error instanceof Error ? error.message : 'تعذر تنفيذ الحملة.' })
  }
}
