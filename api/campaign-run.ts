import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

type AudienceFilter = {
  status?: 'all' | 'نشط' | 'غير نشط'
  tag?: string
}

function errorResponse(
  res: VercelResponse,
  status: number,
  error: string
) {
  return res.status(status).json({
    success: false,
    error,
  })
}

async function getCaller(req: VercelRequest) {
  const authorization = req.headers.authorization
  const accessToken = authorization?.replace(/^Bearer\s+/i, '')

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (
    !accessToken ||
    !supabaseUrl ||
    !anonKey ||
    !serviceKey
  ) {
    return null
  }

  const userClient = createClient(
    supabaseUrl,
    anonKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  )

  const {
    data: authData,
  } = await userClient.auth.getUser()

  if (!authData.user) {
    return null
  }

  const admin = createClient(
    supabaseUrl,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  const {
    data: userRow,
  } = await admin
    .from('users')
    .select(
      'id, organization_id, role, active'
    )
    .eq('id', authData.user.id)
    .maybeSingle()

  if (
    !userRow?.organization_id ||
    userRow.active === false
  ) {
    return null
  }

  return {
    admin,
    user: userRow,
    authUser: authData.user,
  }
}

function renderContent(
  template: string,
  customer: {
    name: string
    company: string | null
  }
) {
  return template
    .replace(
      /\{name\}/g,
      customer.name || 'العميل'
    )
    .replace(
      /\{company\}/g,
      customer.company || ''
    )
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (
    !['GET', 'POST'].includes(
      req.method ?? ''
    )
  ) {
    res.setHeader(
      'Allow',
      'GET, POST'
    )

    return errorResponse(
      res,
      405,
      'Method not allowed'
    )
  }

  const caller = await getCaller(req)

  if (!caller) {
    return errorResponse(
      res,
      401,
      'غير مصرح'
    )
  }

  const {
    admin,
    user,
  } = caller

  const organizationId =
    user.organization_id as string

  const campaignId = String(
    req.query.campaignId ??
    req.body?.campaignId ??
    ''
  )

  if (!campaignId) {
    return errorResponse(
      res,
      400,
      'معرّف الحملة مطلوب'
    )
  }

  const {
    data: campaign,
    error: campaignError,
  } = await admin
    .from('campaigns')
    .select(`
      id,
      organization_id,
      name,
      channel,
      message_body,
      audience_filter,
      status,
      scheduled_at
    `)
    .eq(
      'id',
      campaignId
    )
    .eq(
      'organization_id',
      organizationId
    )
    .maybeSingle()

  if (campaignError) {
    return errorResponse(
      res,
      500,
      'تعذر تحميل الحملة'
    )
  }

  if (!campaign) {
    return errorResponse(
      res,
      404,
      'الحملة غير موجودة'
    )
  }

  const {
    data: subscriptionActive,
    error: subscriptionError,
  } = await admin.rpc(
    'subscription_is_active',
    {
      p_organization_id:
        organizationId,
    }
  )

  if (
    subscriptionError ||
    subscriptionActive !== true
  ) {
    return errorResponse(
      res,
      403,
      'الاشتراك غير نشط'
    )
  }

  // ============================================
  // GET — campaign statistics
  // ============================================

  if (req.method === 'GET') {
    const {
      data: messages,
      error: messagesError,
    } = await admin
      .from('campaign_messages')
      .select(`
        id,
        customer_id,
        status,
        sent_at,
        opened_at,
        error_message,
        content
      `)
      .eq(
        'campaign_id',
        campaignId
      )

    if (messagesError) {
      return errorResponse(
        res,
        500,
        'تعذر تحميل إحصائيات الحملة'
      )
    }

    const list = messages ?? []

    return res.status(200).json({
      success: true,
      campaign,
      stats: {
        total: list.length,

        queued: list.filter(
          m =>
            m.status === 'جاهزة' ||
            m.status === 'قيد الإرسال'
        ).length,

        sent: list.filter(
          m =>
            m.status === 'تم الإرسال'
        ).length,

        delivered: list.filter(
          m =>
            m.status === 'تم التسليم'
        ).length,

        failed: list.filter(
          m =>
            m.status === 'فشلت'
        ).length,

        skipped: list.filter(
          m =>
            m.status === 'تم التخطي'
        ).length,
      },
    })
  }

  // ============================================
  // POST — prepare audience
  // ============================================

  if (
    !campaign.message_body?.trim()
  ) {
    return errorResponse(
      res,
      400,
      'أضف نص الرسالة قبل تجهيز الحملة'
    )
  }

  if (
    ![
      'مسودة',
      'مجدولة',
      'قيد التجهيز',
      'جاهزة للإرسال',
    ].includes(
      campaign.status
    )
  ) {
    return errorResponse(
      res,
      409,
      'لا يمكن تجهيز الحملة بالحالة الحالية'
    )
  }

  const filter =
    (req.body?.audienceFilter ??
      campaign.audience_filter ??
      {}) as AudienceFilter

  const status =
    filter.status ?? 'نشط'

  const tag =
    filter.tag?.trim()

  let customerQuery = admin
    .from('customers')
    .select(`
      id,
      name,
      company,
      phone,
      email,
      status,
      tags
    `)
    .eq(
      'organization_id',
      organizationId
    )
    .eq(
      'marketing_opt_in',
      true
    )

  if (status !== 'all') {
    customerQuery =
      customerQuery.eq(
        'status',
        status
      )
  }

  if (tag) {
    customerQuery =
      customerQuery.contains(
        'tags',
        [tag]
      )
  }

  const {
    data: customers,
    error: customersError,
  } = await customerQuery

  if (customersError) {
    return errorResponse(
      res,
      500,
      'تعذر تحميل جمهور الحملة'
    )
  }

  const recipients =
    (customers ?? []).filter(
      customer => {
        if (
          campaign.channel ===
          'email'
        ) {
          return Boolean(
            customer.email
          )
        }

        if (
          campaign.channel ===
          'whatsapp'
        ) {
          return Boolean(
            customer.phone
          )
        }

        return Boolean(
          customer.phone ||
          customer.email
        )
      }
    )

  await admin
    .from('campaigns')
    .update({
      status: 'قيد التجهيز',

      audience_filter: {
        ...filter,
        optedInOnly: true,
      },

      total_recipients:
        recipients.length,

      queued_count: 0,
      sent_count: 0,
      delivered_count: 0,
      failed_count: 0,

      last_run_at:
        new Date().toISOString(),
    })
    .eq(
      'id',
      campaignId
    )
    .eq(
      'organization_id',
      organizationId
    )

  const rows =
    recipients.map(
      customer => ({
        campaign_id:
          campaignId,

        customer_id:
          customer.id,

        content:
          renderContent(
            campaign.message_body as string,
            customer
          ),

        status:
          'جاهزة',

        opt_in:
          true,
      })
    )

  if (rows.length > 0) {
    const {
      error: insertError,
    } = await admin
      .from('campaign_messages')
      .upsert(
        rows,
        {
          onConflict:
            'campaign_id,customer_id',
        }
      )

    if (insertError) {
      await admin
        .from('campaigns')
        .update({
          status: 'فشلت',
        })
        .eq(
          'id',
          campaignId
        )

      return errorResponse(
        res,
        500,
        'تعذر تجهيز رسائل الحملة'
      )
    }
  }

  const finalStatus =
    recipients.length > 0
      ? 'جاهزة للإرسال'
      : 'مسودة'

  const {
    error: updateError,
  } = await admin
    .from('campaigns')
    .update({
      status:
        finalStatus,

      queued_count:
        recipients.length,

      total_recipients:
        recipients.length,

      last_run_at:
        new Date().toISOString(),
    })
    .eq(
      'id',
      campaignId
    )
    .eq(
      'organization_id',
      organizationId
    )

  if (updateError) {
    return errorResponse(
      res,
      500,
      'تعذر تحديث حالة الحملة'
    )
  }

  await admin
    .from('audit_logs')
    .insert({
      actor_id:
        user.id,

      organization_id:
        organizationId,

      action:
        'campaign_audience_prepared',

      entity:
        'campaign',

      entity_id:
        campaignId,

      new_value: {
        recipients:
          recipients.length,

        channel:
          campaign.channel,

        audience_filter: {
          ...filter,
          optedInOnly:
            true,
        },
      },

      details: {
        phase:
          'phase4_campaign_engine',

        delivery_deferred_to_integrations:
          true,
      },
    })

  return res.status(200).json({
    success: true,

    campaignId,

    status:
      finalStatus,

    recipients:
      recipients.length,

    message:
      recipients.length > 0
        ? 'تم تجهيز جمهور الحملة ورسائلها بنجاح. الإرسال الخارجي سيتم بعد تفعيل موصل القناة.'
        : 'لم يتم العثور على عملاء مؤهلين وفق شروط الجمهور الحالية.',
  })
}
