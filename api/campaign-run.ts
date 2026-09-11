import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey);

type Action =
  | 'preview'
  | 'prepare'
  | 'cancel'
  | 'retry_failed'
  | 'refresh';

function json(res: VercelResponse, status: number, data: unknown) {
  return res.status(status).json(data);
}

async function getUser(req: VercelRequest) {
  const auth = req.headers.authorization;

  if (!auth?.startsWith('Bearer ')) {
    return null;
  }

  const token = auth.replace('Bearer ', '').trim();

  if (!token) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile?.organization_id) {
    return null;
  }

  return {
    user,
    profile,
  };
}

function normalizeFilter(input: any) {
  const filter =
    input && typeof input === 'object'
      ? input
      : {};

  return {
    status:
      typeof filter.status === 'string' &&
      filter.status.trim()
        ? filter.status.trim()
        : null,

    tag:
      typeof filter.tag === 'string' &&
      filter.tag.trim()
        ? filter.tag.trim()
        : null,

    marketing_opt_in:
      filter.marketing_opt_in === false
        ? false
        : true,
  };
}

async function getCampaign(
  campaignId: string,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getAudience(
  organizationId: string,
  filter: ReturnType<typeof normalizeFilter>,
) {
  let query = supabase
    .from('customers')
    .select(
      `
        id,
        name,
        company,
        phone,
        email,
        status,
        tags,
        marketing_opt_in
      `,
    )
    .eq('organization_id', organizationId);

  if (filter.marketing_opt_in) {
    query = query.eq('marketing_opt_in', true);
  }

  if (filter.status) {
    query = query.eq('status', filter.status);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  let customers = data ?? [];

  if (filter.tag) {
    const targetTag = filter.tag.toLowerCase();

    customers = customers.filter((customer) =>
      Array.isArray(customer.tags)
        ? customer.tags.some(
            (tag: string) =>
              typeof tag === 'string' &&
              tag.toLowerCase() === targetTag,
          )
        : false,
    );
  }

  return customers;
}

async function refreshCampaignCounts(
  campaignId: string,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from('campaign_messages')
    .select('status')
    .eq('campaign_id', campaignId)
    .eq('organization_id', organizationId);

  if (error) {
    throw error;
  }

  const rows = data ?? [];

  const counts = {
    total_recipients: rows.length,

    queued_count: rows.filter(
      (row) =>
        row.status === 'قيد الإرسال' ||
        row.status === 'queued',
    ).length,

    sent_count: rows.filter(
      (row) =>
        row.status === 'تم الإرسال' ||
        row.status === 'sent',
    ).length,

    delivered_count: rows.filter(
      (row) =>
        row.status === 'تم التسليم' ||
        row.status === 'delivered',
    ).length,

    failed_count: rows.filter(
      (row) =>
        row.status === 'فشل' ||
        row.status === 'failed',
    ).length,

    skipped_count: rows.filter(
      (row) =>
        row.status === 'تم التخطي' ||
        row.status === 'skipped',
    ).length,
  };

  const { error: updateError } = await supabase
    .from('campaigns')
    .update({
      ...counts,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .eq('organization_id', organizationId);

  if (updateError) {
    throw updateError;
  }

  return counts;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    return json(res, 405, {
      error: 'Method not allowed',
    });
  }

  try {
    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceKey
    ) {
      return json(res, 500, {
        error:
          'Campaign service environment variables are missing',
      });
    }

    const session = await getUser(req);

    if (!session) {
      return json(res, 401, {
        error: 'Unauthorized',
      });
    }

    const body = req.body ?? {};

    const action = body.action as Action;
    const campaignId = body.campaignId;

    if (!campaignId) {
      return json(res, 400, {
        error: 'campaignId is required',
      });
    }

    if (!action) {
      return json(res, 400, {
        error: 'action is required',
      });
    }

    const organizationId =
      session.profile.organization_id;

    /*
     * ---------------------------------------------------------
     * PREVIEW
     * ---------------------------------------------------------
     *
     * Preview does not require an existing campaign.
     * It can be used by future UI flows before creation.
     */
    if (action === 'preview') {
      const filter = normalizeFilter(
        body.filter ?? {},
      );

      const audience = await getAudience(
        organizationId,
        filter,
      );

      return json(res, 200, {
        success: true,
        count: audience.length,
        customers: audience.slice(0, 100),
        filter,
      });
    }

    const campaign = await getCampaign(
      campaignId,
      organizationId,
    );

    if (!campaign) {
      return json(res, 404, {
        error: 'Campaign not found',
      });
    }

    /*
     * ---------------------------------------------------------
     * PREPARE
     * ---------------------------------------------------------
     */
    if (action === 'prepare') {
      if (
        campaign.status === 'مكتملة' ||
        campaign.status === 'ملغاة'
      ) {
        return json(res, 400, {
          error:
            'This campaign can no longer be prepared',
        });
      }

      if (!campaign.message_body?.trim()) {
        return json(res, 400, {
          error:
            'Campaign message is required before preparation',
        });
      }

      const filter = normalizeFilter(
        campaign.audience_filter,
      );

      const audience = await getAudience(
        organizationId,
        filter,
      );

      const now = new Date().toISOString();

      await supabase
        .from('campaigns')
        .update({
          status: 'جارٍ التحضير',
          audience_preview_count:
            audience.length,
          last_run_at: now,
          error_message: null,
          updated_at: now,
        })
        .eq('id', campaignId)
        .eq('organization_id', organizationId);

      if (audience.length === 0) {
        const { error } = await supabase
          .from('campaigns')
          .update({
            status: 'جاهزة',
            total_recipients: 0,
            queued_count: 0,
            sent_count: 0,
            delivered_count: 0,
            failed_count: 0,
            skipped_count: 0,
            updated_at: now,
          })
          .eq('id', campaignId)
          .eq('organization_id', organizationId);

        if (error) {
          throw error;
        }

        return json(res, 200, {
          success: true,
          count: 0,
          message:
            'No eligible customers found for this campaign',
        });
      }

      const rows = audience.map(
        (customer) => ({
          campaign_id: campaignId,
          customer_id: customer.id,
          organization_id: organizationId,
          channel: campaign.channel,
          message_body:
            campaign.message_body,
          content:
            campaign.message_body,
          status: 'قيد الإرسال',
          opt_in:
            customer.marketing_opt_in === true,
          queued_at: now,
          attempts: 0,
        }),
      );

      const { error: queueError } =
        await supabase
          .from('campaign_messages')
          .upsert(rows, {
            onConflict:
              'campaign_id,customer_id',
            ignoreDuplicates: true,
          });

      if (queueError) {
        await supabase
          .from('campaigns')
          .update({
            status: 'فشل',
            error_message:
              queueError.message,
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', campaignId)
          .eq(
            'organization_id',
            organizationId,
          );

        throw queueError;
      }

      const counts =
        await refreshCampaignCounts(
          campaignId,
          organizationId,
        );

      const { error: readyError } =
        await supabase
          .from('campaigns')
          .update({
            status: 'جاهزة',
            ...counts,
            audience_preview_count:
              audience.length,
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', campaignId)
          .eq(
            'organization_id',
            organizationId,
          );

      if (readyError) {
        throw readyError;
      }

      return json(res, 200, {
        success: true,
        count: audience.length,
        counts,
      });
    }

    /*
     * ---------------------------------------------------------
     * CANCEL
     * ---------------------------------------------------------
     */
    if (action === 'cancel') {
      if (campaign.status === 'مكتملة') {
        return json(res, 400, {
          error:
            'Completed campaigns cannot be cancelled',
        });
      }

      const now =
        new Date().toISOString();

      const { error } = await supabase
        .from('campaigns')
        .update({
          status: 'ملغاة',
          cancelled_at: now,
          updated_at: now,
        })
        .eq('id', campaignId)
        .eq(
          'organization_id',
          organizationId,
        );

      if (error) {
        throw error;
      }

      return json(res, 200, {
        success: true,
      });
    }

    /*
     * ---------------------------------------------------------
     * RETRY FAILED
     * ---------------------------------------------------------
     */
    if (action === 'retry_failed') {
      const {
        data: failedMessages,
        error,
      } = await supabase
        .from('campaign_messages')
        .select('id')
        .eq(
          'campaign_id',
          campaignId,
        )
        .eq(
          'organization_id',
          organizationId,
        )
        .in('status', [
          'فشل',
          'failed',
        ]);

      if (error) {
        throw error;
      }

      const ids =
        (failedMessages ?? []).map(
          (row) => row.id,
        );

      if (ids.length > 0) {
        const {
          error: retryError,
        } = await supabase
          .from('campaign_messages')
          .update({
            status: 'قيد الإرسال',
            error_message: null,
            failed_at: null,
            queued_at:
              new Date().toISOString(),
          })
          .in('id', ids)
          .eq(
            'organization_id',
            organizationId,
          );

        if (retryError) {
          throw retryError;
        }
      }

      const counts =
        await refreshCampaignCounts(
          campaignId,
          organizationId,
        );

      await supabase
        .from('campaigns')
        .update({
          status: 'جاهزة',
          ...counts,
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', campaignId)
        .eq(
          'organization_id',
          organizationId,
        );

      return json(res, 200, {
        success: true,
        retried: ids.length,
        counts,
      });
    }

    /*
     * ---------------------------------------------------------
     * REFRESH
     * ---------------------------------------------------------
     */
    if (action === 'refresh') {
      const counts =
        await refreshCampaignCounts(
          campaignId,
          organizationId,
        );

      return json(res, 200, {
        success: true,
        counts,
      });
    }

    return json(res, 400, {
      error: `Unsupported action: ${action}`,
    });
  } catch (error: any) {
    console.error(
      'Campaign engine error:',
      error,
    );

    return json(res, 500, {
      error:
        error?.message ||
        'Unexpected campaign engine error',
    });
  }
}
