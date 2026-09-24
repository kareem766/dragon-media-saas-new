import type {
  VercelRequest,
  VercelResponse,
} from '@vercel/node'

import { createClient } from '@supabase/supabase-js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
    })
  }

  try {
    const authHeader =
      req.headers.authorization

    const accessToken =
      authHeader?.replace(
        /^Bearer\s+/i,
        '',
      )

    const supabaseUrl =
      process.env.VITE_SUPABASE_URL

    const anonKey =
      process.env.VITE_SUPABASE_ANON_KEY

    const serviceKey =
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceKey ||
      !accessToken
    ) {
      return res.status(401).json({
        error: 'غير مصرح',
      })
    }

    const userClient =
      createClient(
        supabaseUrl,
        anonKey,
        {
          global: {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      )

    const {
      data: authData,
      error: authError,
    } =
      await userClient.auth.getUser(
        accessToken,
      )

    if (
      authError ||
      !authData?.user
    ) {
      console.error(
        'Admin overview auth error:',
        authError,
      )

      return res.status(401).json({
        error:
          'جلسة الدخول غير صالحة',
      })
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
        },
      )

    const {
      data: callerRow,
      error: callerError,
    } =
      await admin
        .from('users')
        .select(
          'is_platform_admin, active',
        )
        .eq(
          'id',
          authData.user.id,
        )
        .maybeSingle()

    if (callerError) {
      console.error(
        'Admin overview permission error:',
        callerError,
      )

      return res.status(500).json({
        error:
          'تعذر التحقق من صلاحيات مدير المنصة.',
      })
    }

    if (
      !callerRow?.is_platform_admin ||
      callerRow?.active === false
    ) {
      return res.status(403).json({
        error:
          'هذه الصفحة مخصصة لمدير المنصة فقط',
      })
    }

    const [
      orgsRes,
      usersRes,
      leadsRes,
      customersRes,
      dealsRes,
    ] =
      await Promise.all([
        admin
          .from('organizations')
          .select(
            'id, name, business_type, plan, suspended, created_at',
          )
          .order(
            'created_at',
            {
              ascending: false,
            },
          ),

        admin
          .from('users')
          .select(
            'id, organization_id',
          ),

        admin
          .from('leads')
          .select(
            'id, organization_id',
          ),

        admin
          .from('customers')
          .select(
            'id, organization_id',
          ),

        admin
          .from('deals')
          .select(
            'id, organization_id, value',
          ),
      ])

    if (orgsRes.error) {
      console.error(
        'Admin overview organizations error:',
        orgsRes.error,
      )

      return res.status(500).json({
        error:
          'تعذر تحميل بيانات الشركات.',
        details:
          orgsRes.error.message,
      })
    }

    if (usersRes.error) {
      console.error(
        'Admin overview users error:',
        usersRes.error,
      )
    }

    if (leadsRes.error) {
      console.error(
        'Admin overview leads error:',
        leadsRes.error,
      )
    }

    if (customersRes.error) {
      console.error(
        'Admin overview customers error:',
        customersRes.error,
      )
    }

    if (dealsRes.error) {
      console.error(
        'Admin overview deals error:',
        dealsRes.error,
      )
    }

    const orgs =
      orgsRes.data ?? []

    const users =
      usersRes.error
        ? []
        : usersRes.data ?? []

    const leads =
      leadsRes.error
        ? []
        : leadsRes.data ?? []

    const customers =
      customersRes.error
        ? []
        : customersRes.data ?? []

    const deals =
      dealsRes.error
        ? []
        : dealsRes.data ?? []

    const organizations =
      orgs.map(
        (organization: any) => {
          const organizationUsers =
            users.filter(
              (user: any) =>
                user.organization_id ===
                organization.id,
            )

          const organizationLeads =
            leads.filter(
              (lead: any) =>
                lead.organization_id ===
                organization.id,
            )

          const organizationCustomers =
            customers.filter(
              (customer: any) =>
                customer.organization_id ===
                organization.id,
            )

          const organizationDeals =
            deals.filter(
              (deal: any) =>
                deal.organization_id ===
                organization.id,
            )

          const dealsValue =
            organizationDeals.reduce(
              (
                sum: number,
                deal: any,
              ) =>
                sum +
                Number(
                  deal?.value ?? 0,
                ),
              0,
            )

          return {
            id: organization.id,

            name:
              organization.name ||
              'بدون اسم',

            business_type:
              organization.business_type ??
              null,

            plan:
              organization.plan ??
              null,

            suspended:
              Boolean(
                organization.suspended,
              ),

            created_at:
              organization.created_at ||
              null,

            usersCount:
              organizationUsers.length,

            leadsCount:
              organizationLeads.length,

            customersCount:
              organizationCustomers.length,

            dealsValue,
          }
        },
      )

    const totalDealsValue =
      deals.reduce(
        (
          sum: number,
          deal: any,
        ) =>
          sum +
          Number(
            deal?.value ?? 0,
          ),
        0,
      )

    return res.status(200).json({
      totals: {
        organizations:
          orgs.length,

        users:
          users.length,

        leads:
          leads.length,

        customers:
          customers.length,

        dealsValue:
          totalDealsValue,
      },

      organizations,
    })
  } catch (error: unknown) {
    console.error(
      'Admin overview unexpected error:',
      error,
    )

    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'حدث خطأ غير متوقع أثناء تحميل لوحة الإدارة.'

    if (!res.headersSent) {
      return res.status(500).json({
        error: message,
      })
    }

    return undefined
  }
}
