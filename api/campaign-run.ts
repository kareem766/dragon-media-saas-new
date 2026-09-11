import { createClient } from '@supabase/supabase-js'

type CampaignFilter = {
  status?: string
  tag?: string | null
  optedInOnly?: boolean
}

type Action =
  | 'prepare'
  | 'cancel'
  | 'retry_failed'
  | 'refresh'

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!url || !serviceKey) {
    throw new Error('إعدادات Supabase غير مكتملة.')
  }

  return createClient(url, serviceKey)
}

async function getAuthenticatedUser(req: any) {
  const authHeader = req.headers.authorization || ''

  if (!authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice('Bearer '.length)

  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return null
  }

  const client = createClient(url, anonKey)

  const {
    data: { user },
  } = await client.auth.getUser(token)

  return user
}

async function getOrganizationId(
  supabase: ReturnType<typeof getSupabase>,
  userId: string
) {
  const { data, error } = await supabase
    .from('users')
    .select('organization_id, role, active')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data || !data.organization_id || data.active === false) {
    return null
  }

  return {
    organizationId: data.organization_id,
    role: data.role,
  }
}

async function refreshCampaignStats(
  supabase: ReturnType<typeof getSupabase>,
  campaignId: string,
  organizationId: string
) {
  const { data: messages, error } = await supabase
    .from('campaign_messages')
    .select('status')
    .eq('campaign_id', campaignId)
    .eq('organization_id', organizationId)

  if (error) {
    throw error
  }

  const stats = {
    total: messages?.length || 0,
    queued: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    skipped: 0,
  }

  for (const message of messages || []) {
    switch (message.status) {
      case 'جاهزة':
      case 'قيد الإرسال':
        stats.queued++
        break

      case 'تم الإرسال':
        stats.sent++
        break

      case 'تم التسليم':
        stats.delivered++
        break

      case 'فشلت':
        stats.failed++
        break

      case 'تم التخطي':
        stats.skipped++
        break
    }
  }

  await supabase
    .from('campaigns')
    .update({
      total_recipients: stats.total,
      queued_count: stats.queued,
      sent_count: stats.sent,
      delivered_count: stats.delivered,
      failed_count: stats.failed,
      skipped_count: stats.skipped,
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .eq('organization_id', organizationId)

  return stats
}

async function prepareCampaign(
  supabase: ReturnType<typeof getSupabase>,
  campaign: any
) {
  const filter: CampaignFilter = campaign.audience_filter || {}

  let query = supabase
    .from('customers')
    .select('id, name, phone, email, status, tags, marketing_opt_in')
    .eq('organization_id', campaign.organization_id)

  if (filter.status && filter.status !== 'all') {
    query = query.eq('status', filter.status)
  }

  if (filter.optedInOnly !== false) {
    query = query.eq('marketing_opt_in', true)
  }

  const { data: customers, error } = await query

  if (error) {
    throw error
  }

  const filteredCustomers = (customers || []).filter((customer: any) => {
    if (!filter.tag) return true

    return Array.isArray(customer.tags)
      ? customer.tags.includes(filter.tag)
      : false
  })

  if (!filteredCustomers.length) {
    await supabase
      .from('campaigns')
      .update({
        status: 'جاهزة',
        total_recipients: 0,
        queued_count: 0,
        sent_count: 0,
        delivered_count: 0,
        failed_count: 0,
        skipped_count: 0,
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaign.id)
      .eq('organization_id', campaign.organization_id)

    return {
      total: 0,
      queued: 0,
      skipped: 0,
    }
  }

  const rows = filteredCustomers.map((customer: any) => ({
    organization_id: campaign.organization_id,
    campaign_id: campaign.id,
    customer_id: customer.id,
    channel: campaign.channel,
    message_body: campaign.message_body || '',
    status: 'جاهزة',
    opt_in: customer.marketing_opt_in !== false,
    queued_at: new Date().toISOString(),
    attempts: 0,
  }))

  const { error: insertError } = await supabase
    .from('campaign_messages')
    .upsert(rows, {
      onConflict: 'campaign_id,customer_id',
      ignoreDuplicates: true,
    })

  if (insertError) {
    throw insertError
  }

  await supabase
    .from('campaigns')
    .update({
      status: 'جاهزة',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaign.id)
    .eq('organization_id', campaign.organization_id)

  return refreshCampaignStats(
    supabase,
    campaign.id,
    campaign.organization_id
  )
}

async function cancelCampaign(
  supabase: ReturnType<typeof getSupabase>,
  campaign: any
) {
  const { error } = await supabase
    .from('campaign_messages')
    .update({
      status: 'تم التخطي',
      skipped_at: new Date().toISOString(),
    })
    .eq('campaign_id', campaign.id)
    .eq('organization_id', campaign.organization_id)
    .in('status', ['جاهزة', 'قيد الإرسال'])

  if (error) {
    throw error
  }

  await supabase
    .from('campaigns')
    .update({
      status: 'ملغاة',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaign.id)
    .eq('organization_id', campaign.organization_id)

  return refreshCampaignStats(
    supabase,
    campaign.id,
    campaign.organization_id
  )
}

async function retryFailed(
  supabase: ReturnType<typeof getSupabase>,
  campaign: any
) {
  const { error } = await supabase
    .from('campaign_messages')
    .update({
      status: 'جاهزة',
      error_message: null,
      failed_at: null,
      skipped_at: null,
      queued_at: new Date().toISOString(),
    })
    .eq('campaign_id', campaign.id)
    .eq('organization_id', campaign.organization_id)
    .eq('status', 'فشلت')

  if (error) {
    throw error
  }

  await supabase
    .from('campaigns')
    .update({
      status: 'جاهزة',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaign.id)
    .eq('organization_id', campaign.organization_id)

  return refreshCampaignStats(
    supabase,
    campaign.id,
    campaign.organization_id
  )
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({
      error: 'Method not allowed',
    })
    return
  }

  try {
    const user = await getAuthenticatedUser(req)

    if (!user) {
      res.status(401).json({
        error: 'غير مصرح.',
      })
      return
    }

    const supabase = getSupabase()

    const organization = await getOrganizationId(
      supabase,
      user.id
    )

    if (!organization) {
      res.status(403).json({
        error: 'لا يمكن تحديد المؤسسة.',
      })
      return
    }

    const {
      campaignId,
      action = 'prepare',
      audienceFilter,
    } = req.body || {}

    if (!campaignId) {
      res.status(400).json({
        error: 'campaignId مطلوب.',
      })
      return
    }

    const { data: campaign, error: campaignError } =
      await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq(
          'organization_id',
          organization.organizationId
        )
        .maybeSingle()

    if (campaignError) {
      throw campaignError
    }

    if (!campaign) {
      res.status(404).json({
        error: 'الحملة غير موجودة.',
      })
      return
    }

    if (
      audienceFilter &&
      action === 'prepare'
    ) {
      await supabase
        .from('campaigns')
        .update({
          audience_filter: audienceFilter,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaign.id)
        .eq(
          'organization_id',
          organization.organizationId
        )

      campaign.audience_filter = audienceFilter
    }

    let result

    switch (action as Action) {
      case 'prepare':
        result = await prepareCampaign(
          supabase,
          campaign
        )
        break

      case 'cancel':
        result = await cancelCampaign(
          supabase,
          campaign
        )
        break

      case 'retry_failed':
        result = await retryFailed(
          supabase,
          campaign
        )
        break

      case 'refresh':
        result = await refreshCampaignStats(
          supabase,
          campaign.id,
          organization.organizationId
        )
        break

      default:
        res.status(400).json({
          error: 'عملية غير مدعومة.',
        })
        return
    }

    res.status(200).json({
      success: true,
      message:
        action === 'prepare'
          ? 'تم تجهيز جمهور الحملة والرسائل بنجاح.'
          : action === 'cancel'
            ? 'تم إلغاء الحملة وتخطي الرسائل غير المرسلة.'
            : action === 'retry_failed'
              ? 'تمت إعادة تجهيز الرسائل الفاشلة.'
              : 'تم تحديث إحصائيات الحملة.',
      stats: result,
    })
  } catch (error: any) {
    console.error('campaign-run error', error)

    res.status(500).json({
      error:
        error?.message ||
        'حدث خطأ أثناء تنفيذ الحملة.',
    })
  }
}
