import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js'

type QueueAction =
  | 'stats'
  | 'retry_failed'
  | 'cancel'
  | 'refresh'

type AdminClient = SupabaseClient<any, 'public', any>

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
  const accessToken = authorization?.replace(
    /^Bearer\s+/i,
    ''
  )

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL

  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY

  const serviceKey =
    process.env.SUPABASE_SERVICE_KEY

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
    error: authError,
  } =
    await userClient.auth.getUser()

  if (
    authError ||
    !authData.user
  ) {
    return null
  }

  const admin =
    createClient(
      supabaseUrl,
      serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    ) as AdminClient

  const {
    data: userRow,
    error: userError,
  } =
    await admin
      .from('users')
      .select(
        'id, organization_id, role, active'
      )
      .eq(
        'id',
        authData.user.id
      )
      .maybeSingle()

  if (
    userError ||
    !userRow?.organization_id ||
    userRow.active === false
  ) {
    return null
  }

  return {
    admin,
    user: userRow,
  }
}

async function getCampaign(
  admin: AdminClient,
  campaignId: string,
  organizationId: string
) {
  const {
    data,
    error,
  } =
    await admin
      .from('campaigns')
      .select(`
        id,
        organization_id,
        name,
        channel,
        status,
        message_body,
        total_recipients,
        queued_count,
        sent_count,
        delivered_count,
        failed_count,
        last_run_at
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

  if (error) {
    throw new Error(
      'تعذر تحميل الحملة'
    )
  }

  if (!data) {
    throw new Error(
      'الحملة غير موجودة'
    )
  }

  return data
}

async function getStats(
  admin: AdminClient,
  campaignId: string
) {
  const {
    data,
    error,
  } =
    await admin
      .from('campaign_messages')
      .select(
        'id, status, error_message, sent_at, opened_at'
      )
      .eq(
        'campaign_id',
        campaignId
      )

  if (error) {
    throw new Error(
      'تعذر تحميل رسائل الحملة'
    )
  }

  const rows = data ?? []

  const queued =
    rows.filter(
      (row: any) =>
        row.status === 'جاهزة' ||
        row.status === 'قيد الإرسال'
    ).length

  const sent =
    rows.filter(
      (row: any) =>
        row.status === 'تم الإرسال'
    ).length

  const delivered =
    rows.filter(
      (row: any) =>
        row.status === 'تم التسليم'
    ).length

  const failed =
    rows.filter(
      (row: any) =>
        row.status === 'فشلت'
    ).length

  const skipped =
    rows.filter(
      (row: any) =>
        row.status === 'تم التخطي'
    ).length

  return {
    total: rows.length,
    queued,
    sent,
    delivered,
    failed,
    skipped,
  }
}

async function syncCampaignStats(
  admin: AdminClient,
  campaignId: string,
  organizationId: string
) {
  const stats =
    await getStats(
      admin,
      campaignId
    )

  const {
    error,
  } =
    await admin
      .from('campaigns')
      .update({
        total_recipients:
          stats.total,

        queued_count:
          stats.queued,

        sent_count:
          stats.sent,

        delivered_count:
          stats.delivered,

        failed_count:
          stats.failed,

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

  if (error) {
    throw new Error(
      'تعذر تحديث إحصائيات الحملة'
    )
  }

  return stats
}

async function writeAuditLog(
  admin: AdminClient,
  organizationId: string,
  actorId: string,
  action: string,
  campaignId: string,
  details: Record<string, unknown>
) {
  await admin
    .from('audit_logs')
    .insert({
      actor_id: actorId,
      organization_id:
        organizationId,
      action,
      entity: 'campaign',
      entity_id: campaignId,
      details,
    })
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

  const caller =
    await getCaller(req)

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
    String(
      user.organization_id
    )

  const campaignId =
    String(
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

  let campaign

  try {
    campaign =
      await getCampaign(
        admin,
        campaignId,
        organizationId
      )
  } catch (error) {
    return errorResponse(
      res,
      404,
      error instanceof Error
        ? error.message
        : 'الحملة غير موجودة'
    )
  }

  const {
    data: subscriptionActive,
    error: subscriptionError,
  } =
    await admin.rpc(
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

  // ==========================================
  // GET — statistics
  // ==========================================

  if (req.method === 'GET') {
    try {
      const stats =
        await syncCampaignStats(
          admin,
          campaignId,
          organizationId
        )

      return res.status(200).json({
        success: true,

        campaign: {
          id: campaign.id,
          name: campaign.name,
          channel:
            campaign.channel,
          status:
            campaign.status,
        },

        stats,
      })
    } catch (error) {
      return errorResponse(
        res,
        500,
        error instanceof Error
          ? error.message
          : 'تعذر تحميل الإحصائيات'
      )
    }
  }

  const action =
    (req.body?.action ??
      'stats') as QueueAction

  // ==========================================
  // POST — refresh stats
  // ==========================================

  if (
    action === 'stats' ||
    action === 'refresh'
  ) {
    try {
      const stats =
        await syncCampaignStats(
          admin,
          campaignId,
          organizationId
        )

      return res.status(200).json({
        success: true,
        status:
          campaign.status,
        stats,
      })
    } catch (error) {
      return errorResponse(
        res,
        500,
        error instanceof Error
          ? error.message
          : 'تعذر تحديث الإحصائيات'
      )
    }
  }

  // ==========================================
  // Retry failed messages
  // ==========================================

  if (
    action ===
    'retry_failed'
  ) {
    if (
      ![
        'فشلت',
        'مسودة',
        'جاهزة للإرسال',
        'قيد التجهيز',
      ].includes(
        campaign.status
      )
    ) {
      return errorResponse(
        res,
        409,
        'لا يمكن إعادة محاولة الحملة بالحالة الحالية'
      )
    }

    const {
      data: failedMessages,
      error: failedError,
    } =
      await admin
        .from('campaign_messages')
        .select(
          'id, customer_id, status'
        )
        .eq(
          'campaign_id',
          campaignId
        )
        .eq(
          'status',
          'فشلت'
        )

    if (failedError) {
      return errorResponse(
        res,
        500,
        'تعذر تحميل الرسائل الفاشلة'
      )
    }

    const rows =
      failedMessages ?? []

    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        retried: 0,
        message:
          'لا توجد رسائل فاشلة لإعادة المحاولة.',
      })
    }

    const {
      error: retryError,
    } =
      await admin
        .from('campaign_messages')
        .update({
          status: 'جاهزة',
          error_message: null,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'campaign_id',
          campaignId
        )
        .eq(
          'status',
          'فشلت'
        )

    if (retryError) {
      return errorResponse(
        res,
        500,
        'تعذر إعادة تجهيز الرسائل الفاشلة'
      )
    }

    const {
      error:
        campaignUpdateError,
    } =
      await admin
        .from('campaigns')
        .update({
          status:
            'جاهزة للإرسال',
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

    if (
      campaignUpdateError
    ) {
      return errorResponse(
        res,
        500,
        'تعذر تحديث حالة الحملة'
      )
    }

    const stats =
      await syncCampaignStats(
        admin,
        campaignId,
        organizationId
      )

    await writeAuditLog(
      admin,
      organizationId,
      user.id,
      'campaign_retry_failed_messages',
      campaignId,
      {
        retried:
          rows.length,
      }
    )

    return res.status(200).json({
      success: true,
      retried:
        rows.length,
      status:
        'جاهزة للإرسال',
      stats,
      message:
        `تم إعادة تجهيز ${rows.length} رسالة فاشلة للإرسال.`,
    })
  }

  // ==========================================
  // Cancel campaign queue
  // ==========================================

  if (
    action === 'cancel'
  ) {
    if (
      [
        'مكتملة',
        'ملغاة',
      ].includes(
        campaign.status
      )
    ) {
      return errorResponse(
        res,
        409,
        'الحملة بالفعل منتهية أو ملغاة'
      )
    }

    const {
      data: cancellable,
      error:
        cancellableError,
    } =
      await admin
        .from('campaign_messages')
        .select(
          'id, status'
        )
        .eq(
          'campaign_id',
          campaignId
        )
        .in(
          'status',
          [
            'جاهزة',
            'قيد الإرسال',
          ]
        )

    if (cancellableError) {
      return errorResponse(
        res,
        500,
        'تعذر تحميل الرسائل القابلة للإلغاء'
      )
    }

    const rows =
      cancellable ?? []

    if (rows.length > 0) {
      const {
        error:
          cancelMessagesError,
      } =
        await admin
          .from('campaign_messages')
          .update({
            status:
              'تم التخطي',

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'campaign_id',
            campaignId
          )
          .in(
            'status',
            [
              'جاهزة',
              'قيد الإرسال',
            ]
          )

      if (
        cancelMessagesError
      ) {
        return errorResponse(
          res,
          500,
          'تعذر إلغاء رسائل الحملة'
        )
      }
    }

    const {
      error:
        cancelCampaignError,
    } =
      await admin
        .from('campaigns')
        .update({
          status:
            'ملغاة',

          queued_count: 0,

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

    if (
      cancelCampaignError
    ) {
      return errorResponse(
        res,
        500,
        'تعذر إلغاء الحملة'
      )
    }

    const stats =
      await syncCampaignStats(
        admin,
        campaignId,
        organizationId
      )

    await writeAuditLog(
      admin,
      organizationId,
      user.id,
      'campaign_cancelled',
      campaignId,
      {
        skipped:
          rows.length,
      }
    )

    return res.status(200).json({
      success: true,

      cancelled:
        rows.length,

      status:
        'ملغاة',

      stats,

      message:
        rows.length > 0
          ? `تم إلغاء الحملة وتخطي ${rows.length} رسالة لم يتم إرسالها.`
          : 'تم إلغاء الحملة.',
    })
  }

  return errorResponse(
    res,
    400,
    'إجراء غير معروف'
  )
}
