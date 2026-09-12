import { createClient } from '@supabase/supabase-js'

type AnyRecord = Record<string, any>

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const EMAIL_REGEX =
  /^\S+@\S+\.\S+$/

const getClients = (accessToken: string) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !anonKey || !serviceKey) {
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
    },
  )

  const admin = createClient(
    supabaseUrl,
    serviceKey,
  )

  return {
    userClient,
    admin,
  }
}

const isValidUuid = (value: string) =>
  UUID_REGEX.test(value)

const isValidEmail = (value: string) =>
  EMAIL_REGEX.test(value)

const normalizeEmail = (value: any) =>
  String(value ?? '')
    .trim()
    .toLowerCase()

const getDateString = (date: Date) =>
  date
    .toISOString()
    .slice(0, 10)

const addDays = (
  date: Date,
  days: number,
) => {
  const result = new Date(date)
  result.setDate(
    result.getDate() + days,
  )
  return result
}

const slugify = (value: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)

  return slug || `company-${Date.now()}`
}

const getUniqueSlug = async (
  admin: any,
  name: string,
  currentId?: string,
) => {
  const base = slugify(name)
  let slug = base

  for (let i = 1; i <= 50; i++) {
    const query = admin
      .from('organizations')
      .select('id')
      .eq('slug', slug)

    if (currentId) {
      query.neq(
        'id',
        currentId,
      )
    }

    const { data } =
      await query.maybeSingle()

    if (!data) {
      return slug
    }

    slug = `${base}-${i + 1}`
  }

  return `${base}-${Date.now()}`
}

const isPlatformAdmin = async (
  admin: any,
  userId: string,
) => {
  const {
    data,
    error,
  } = await admin
    .from('users')
    .select(
      'is_platform_admin, active',
    )
    .eq(
      'id',
      userId,
    )
    .maybeSingle()

  if (error) {
    console.error(
      'platform admin check error:',
      error.message,
    )

    return false
  }

  return Boolean(
    data?.is_platform_admin &&
      data?.active !== false,
  )
}

const writeAudit = async (
  admin: any,
  payload: AnyRecord,
) => {
  const {
    error,
  } = await admin
    .from('audit_logs')
    .insert(payload)

  if (error) {
    console.error(
      'organization audit log error:',
      error.message,
    )

    return false
  }

  return true
}

const deleteAuthUser = async (
  admin: any,
  userId: string,
) => {
  const {
    error,
  } =
    await admin.auth.admin.deleteUser(
      userId,
    )

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  return {
    success: true,
  }
}

const findAuthUserByEmail = async (
  admin: any,
  email: string,
) => {
  const normalizedEmail =
    normalizeEmail(email)

  if (!normalizedEmail) {
    return null
  }

  const {
    data,
    error,
  } =
    await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

  if (error) {
    throw new Error(
      `تعذر التحقق من حساب Auth: ${error.message}`,
    )
  }

  return (
    data?.users?.find(
      (user: AnyRecord) =>
        normalizeEmail(
          user.email,
        ) === normalizedEmail,
    ) ?? null
  )
}

const validateOrganizationId = (
  organizationId: string,
) =>
  Boolean(
    organizationId &&
      isValidUuid(
        organizationId,
      ),
  )

const validatePlanId = (
  planId: string,
) =>
  Boolean(
    planId &&
      isValidUuid(
        planId,
      ),
  )

/**
 * Remove all foreign-key references to a company user
 * before deleting the Supabase Auth user.
 */
const detachUserReferences = async (
  admin: any,
  userId: string,
) => {
  const operations: Array<{
    table: string
    column: string
  }> = [
    {
      table: 'leads',
      column: 'assigned_to',
    },
    {
      table: 'deals',
      column: 'owner_id',
    },
    {
      table: 'conversations',
      column: 'assigned_user_id',
    },
    {
      table: 'tasks',
      column: 'assigned_to',
    },
    {
      table: 'notifications',
      column: 'user_id',
    },
  ]

  for (
    const operation of operations
  ) {
    const {
      error,
    } = await admin
      .from(operation.table)
      .update({
        [operation.column]: null,
      })
      .eq(
        operation.column,
        userId,
      )

    if (error) {
      return {
        success: false,
        error:
          `تعذر تنظيف ارتباط المستخدم من ${operation.table}: ${error.message}`,
      }
    }
  }

  return {
    success: true,
  }
}

const deleteOrganizationData = async (
  admin: any,
  organizationId: string,
) => {
  const {
    data: conversations,
    error:
      conversationsReadError,
  } = await admin
    .from('conversations')
    .select('id')
    .eq(
      'organization_id',
      organizationId,
    )

  if (conversationsReadError) {
    return {
      success: false,
      error:
        `تعذر قراءة المحادثات: ${conversationsReadError.message}`,
    }
  }

  const conversationIds =
    (conversations ?? [])
      .map(
        (item: AnyRecord) =>
          item.id,
      )
      .filter(Boolean)

  if (conversationIds.length) {
    const {
      error,
    } = await admin
      .from('messages')
      .delete()
      .in(
        'conversation_id',
        conversationIds,
      )

    if (error) {
      return {
        success: false,
        error:
          `تعذر حذف الرسائل: ${error.message}`,
      }
    }
  }

  const {
    data: campaigns,
    error:
      campaignsReadError,
  } = await admin
    .from('campaigns')
    .select('id')
    .eq(
      'organization_id',
      organizationId,
    )

  if (campaignsReadError) {
    return {
      success: false,
      error:
        `تعذر قراءة الحملات: ${campaignsReadError.message}`,
    }
  }

  const campaignIds =
    (campaigns ?? [])
      .map(
        (item: AnyRecord) =>
          item.id,
      )
      .filter(Boolean)

  if (campaignIds.length) {
    const {
      error,
    } = await admin
      .from('campaign_messages')
      .delete()
      .in(
        'campaign_id',
        campaignIds,
      )

    if (error) {
      return {
        success: false,
        error:
          `تعذر حذف رسائل الحملات: ${error.message}`,
      }
    }
  }

  const {
    data: subscriptions,
    error:
      subscriptionsReadError,
  } = await admin
    .from('subscriptions')
    .select('id')
    .eq(
      'organization_id',
      organizationId,
    )

  if (subscriptionsReadError) {
    return {
      success: false,
      error:
        `تعذر قراءة الاشتراكات: ${subscriptionsReadError.message}`,
    }
  }

  const subscriptionIds =
    (subscriptions ?? [])
      .map(
        (item: AnyRecord) =>
          item.id,
      )
      .filter(Boolean)

  if (subscriptionIds.length) {
    const {
      data: invoices,
      error:
        invoicesReadError,
    } = await admin
      .from('invoices')
      .select('id')
      .in(
        'subscription_id',
        subscriptionIds,
      )

    if (invoicesReadError) {
      return {
        success: false,
        error:
          `تعذر قراءة الفواتير: ${invoicesReadError.message}`,
      }
    }

    const invoiceIds =
      (invoices ?? [])
        .map(
          (item: AnyRecord) =>
            item.id,
        )
        .filter(Boolean)

    if (invoiceIds.length) {
      const {
        error,
      } = await admin
        .from('payments')
        .delete()
        .in(
          'invoice_id',
          invoiceIds,
        )

      if (error) {
        return {
          success: false,
          error:
            `تعذر حذف المدفوعات: ${error.message}`,
        }
      }

      const {
        error:
          invoiceDeleteError,
      } = await admin
        .from('invoices')
        .delete()
        .in(
          'id',
          invoiceIds,
        )

      if (invoiceDeleteError) {
        return {
          success: false,
          error:
            `تعذر حذف الفواتير: ${invoiceDeleteError.message}`,
        }
      }
    }
  }

  const simpleTables = [
    'campaigns',
    'conversations',
    'ai_agents',
    'tasks',
    'appointments',
    'notifications',
    'integrations',
    'leads',
    'deals',
    'services',
    'contacts',
    'pipeline_stages',
    'customers',
    'roles',
    'subscriptions',
  ]

  for (
    const table of simpleTables
  ) {
    const {
      error,
    } = await admin
      .from(table)
      .delete()
      .eq(
        'organization_id',
        organizationId,
      )

    if (error) {
      return {
        success: false,
        error:
          `تعذر حذف بيانات ${table}: ${error.message}`,
      }
    }
  }

  return {
    success: true,
  }
}

export default async function handler(
  req: any,
  res: any,
) {
  const accessToken =
    req.headers.authorization?.replace(
      'Bearer ',
      '',
    )

  if (!accessToken) {
    res.status(401).json({
      error: 'غير مصرح',
    })
    return
  }

  const clients =
    getClients(accessToken)

  if (!clients) {
    res.status(500).json({
      error:
        'إعدادات الخادم غير مكتملة',
    })
    return
  }

  const {
    userClient,
    admin,
  } = clients

  const {
    data: authData,
    error: authError,
  } =
    await userClient.auth.getUser()

  if (
    authError ||
    !authData?.user
  ) {
    res.status(401).json({
      error:
        'جلسة الدخول غير صالحة',
    })
    return
  }

  const platformAdmin =
    await isPlatformAdmin(
      admin,
      authData.user.id,
    )

  if (!platformAdmin) {
    res.status(403).json({
      error:
        'هذه الصفحة مخصصة لمدير المنصة فقط',
    })
    return
  }

  if (req.method === 'GET') {
    const {
      data: organizations,
      error,
    } = await admin
      .from('organizations')
      .select(
        `
        id,
        name,
        slug,
        phone,
        email,
        business_type,
        suspended,
        manager_name,
        address,
        logo_url,
        plan,
        created_at
        `,
      )
      .order(
        'created_at',
        {
          ascending: false,
        },
      )

    if (error) {
      res.status(500).json({
        error: error.message,
      })
      return
    }

    const orgs =
      organizations ?? []

    const ids =
      orgs.map(
        (org: AnyRecord) =>
          org.id,
      )

    const [
      usersRes,
      customersRes,
      leadsRes,
      subscriptionsRes,
    ] =
      await Promise.all([
        ids.length
          ? admin
              .from('users')
              .select(
                `
                id,
                organization_id,
                full_name,
                email,
                role,
                active
                `,
              )
              .in(
                'organization_id',
                ids,
              )
          : Promise.resolve({
              data: [],
            }),

        ids.length
          ? admin
              .from('customers')
              .select(
                'id, organization_id',
              )
              .in(
                'organization_id',
                ids,
              )
          : Promise.resolve({
              data: [],
            }),

        ids.length
          ? admin
              .from('leads')
              .select(
                'id, organization_id',
              )
              .in(
                'organization_id',
                ids,
              )
          : Promise.resolve({
              data: [],
            }),

        ids.length
          ? admin
              .from('subscriptions')
              .select(
                `
                id,
                organization_id,
                plan_id,
                plan,
                status,
                renewal_date,
                plans(
                  id,
                  name,
                  price,
                  currency,
                  billing_cycle
                )
                `,
              )
              .in(
                'organization_id',
                ids,
              )
          : Promise.resolve({
              data: [],
            }),
      ])

    const users =
      usersRes.data ?? []

    const customers =
      customersRes.data ?? []

    const leads =
      leadsRes.data ?? []

    const subscriptions =
      subscriptionsRes.data ?? []

    const result =
      orgs.map(
        (org: AnyRecord) => {
          const orgUsers =
            users.filter(
              (user: AnyRecord) =>
                user.organization_id ===
                org.id,
            )

          const companyAdmin =
            orgUsers.find(
              (user: AnyRecord) =>
                user.role ===
                'admin',
            ) ??
            orgUsers.find(
              (user: AnyRecord) =>
                user.role !==
                'super_admin',
            )

          const orgSubscriptions =
            subscriptions
              .filter(
                (subscription: AnyRecord) =>
                  subscription.organization_id ===
                  org.id,
              )
              .sort(
                (
                  a: AnyRecord,
                  b: AnyRecord,
                ) =>
                  String(
                    b.renewal_date ??
                      '',
                  ).localeCompare(
                    String(
                      a.renewal_date ??
                        '',
                    ),
                  ),
              )

          const subscription =
            orgSubscriptions[0] ??
            null

          return {
            ...org,

            users_count:
              orgUsers.length,

            customers_count:
              customers.filter(
                (customer: AnyRecord) =>
                  customer.organization_id ===
                  org.id,
              ).length,

            leads_count:
              leads.filter(
                (lead: AnyRecord) =>
                  lead.organization_id ===
                  org.id,
              ).length,

            admin_user_id:
              companyAdmin?.id ??
              null,

            admin_name:
              companyAdmin?.full_name ??
              null,

            admin_email:
              companyAdmin?.email ??
              null,

            admin_active:
              companyAdmin?.active ??
              false,

            subscription_id:
              subscription?.id ??
              null,

            subscription_status:
              subscription?.status ??
              null,

            active_subscription:
              subscription?.status ===
              'active',

            renewal_date:
              subscription?.renewal_date ??
              null,

            plan_id:
              subscription?.plan_id ??
              null,

            plan_name:
              subscription?.plans?.[0]?.name ??
              subscription?.plan ??
              org.plan ??
              null,
          }
        },
      )

    res.status(200).json({
      organizations: result,
    })

    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({
      error:
        'الطريقة غير مسموحة',
    })
    return
  }

  const body =
    req.body ?? {}

  const action =
    body.action

  if (
    action === 'suspend' ||
    action === 'activate'
  ) {
    const organizationId =
      String(
        body.organizationId ||
          '',
      )

    if (
      !validateOrganizationId(
        organizationId,
      )
    ) {
      res.status(400).json({
        error:
          'معرّف الشركة غير صالح',
      })
      return
    }

    const {
      data: organization,
      error: findError,
    } = await admin
      .from('organizations')
      .select(
        'id, name, suspended',
      )
      .eq(
        'id',
        organizationId,
      )
      .single()

    if (
      findError ||
      !organization
    ) {
      res.status(404).json({
        error:
          'الشركة غير موجودة',
      })
      return
    }

    const suspended =
      action === 'suspend'

    const {
      error,
    } = await admin
      .from('organizations')
      .update({
        suspended,
      })
      .eq(
        'id',
        organizationId,
      )

    if (error) {
      res.status(500).json({
        error:
          `تعذر تحديث حالة الشركة: ${error.message}`,
      })
      return
    }

    await writeAudit(
      admin,
      {
        actor_id:
          authData.user.id,

        organization_id:
          organizationId,

        action:
          suspended
            ? 'suspend_organization'
            : 'activate_organization',

        entity:
          'organizations',

        entity_id:
          organizationId,

        old_value: {
          suspended:
            organization.suspended,
        },

        new_value: {
          suspended,
        },

        details: {
          source:
            'admin_organizations',
        },
      },
    )

    res.status(200).json({
      success: true,
      suspended,
    })

    return
  }

  if (action === 'create') {
    const name =
      String(
        body.name || '',
      ).trim()

    const managerName =
      String(
        body.managerName ||
          '',
      ).trim()

    const email =
      normalizeEmail(
        body.email,
      )

    const password =
      String(
        body.password || '',
      )

    const businessType =
      String(
        body.businessType ||
          '',
      ).trim()

    const phone =
      String(
        body.phone || '',
      ).trim()

    const address =
      String(
        body.address || '',
      ).trim()

    const logoUrl =
      String(
        body.logoUrl || '',
      ).trim()

    const planId =
      body.planId
        ? String(
            body.planId,
          )
        : ''

    if (
      !name ||
      !managerName ||
      !email ||
      !password
    ) {
      res.status(400).json({
        error:
          'اسم الشركة واسم المسؤول والبريد وكلمة المرور مطلوبة',
      })
      return
    }

    if (password.length < 8) {
      res.status(400).json({
        error:
          'كلمة المرور يجب ألا تقل عن 8 أحرف',
      })
      return
    }

    if (!isValidEmail(email)) {
      res.status(400).json({
        error:
          'البريد الإلكتروني غير صالح',
      })
      return
    }

    if (
      planId &&
      !validatePlanId(planId)
    ) {
      res.status(400).json({
        error:
          'معرّف الباقة غير صالح',
      })
      return
    }

    let plan:
      AnyRecord | null =
      null

    if (planId) {
      const {
        data,
        error,
      } = await admin
        .from('plans')
        .select(
          `
          id,
          name,
          price,
          yearly_price,
          currency,
          billing_cycle,
          status
          `,
        )
        .eq(
          'id',
          planId,
        )
        .single()

      if (
        error ||
        !data ||
        data.status !==
          'active'
      ) {
        res.status(400).json({
          error:
            'الباقة المحددة غير متاحة',
        })
        return
      }

      plan = data
    }

    const {
      data: existingEmail,
    } = await admin
      .from('users')
      .select('id')
      .ilike(
        'email',
        email,
      )
      .maybeSingle()

    if (existingEmail) {
      res.status(409).json({
        error:
          'يوجد مستخدم بهذا البريد الإلكتروني بالفعل',
      })
      return
    }

    let authEmailExists = false

    try {
      const authUser =
        await findAuthUserByEmail(
          admin,
          email,
        )

      authEmailExists =
        Boolean(authUser)
    } catch (error: any) {
      res.status(500).json({
        error:
          error?.message ||
          'تعذر التحقق من البريد الإلكتروني',
      })
      return
    }

    if (authEmailExists) {
      res.status(409).json({
        error:
          'يوجد حساب Auth بهذا البريد الإلكتروني بالفعل',
      })
      return
    }

    const slug =
      await getUniqueSlug(
        admin,
        name,
      )

    const {
      data: organization,
      error:
        organizationError,
    } = await admin
      .from('organizations')
      .insert({
        name,
        slug,

        business_type:
          businessType ||
          null,

        manager_name:
          managerName,

        email,

        phone:
          phone ||
          null,

        address:
          address ||
          null,

        logo_url:
          logoUrl ||
          null,

        plan:
          plan?.name ??
          'أساسي',

        suspended:
          false,
      })
      .select(
        'id, name, slug',
      )
      .single()

    if (
      organizationError ||
      !organization
    ) {
      res.status(500).json({
        error:
          organizationError?.message ||
          'تعذر إنشاء الشركة',
      })
      return
    }

    const {
      data: authUser,
      error:
        authUserError,
    } =
      await admin.auth.admin.createUser(
        {
          email,
          password,

          email_confirm:
            true,

          user_metadata: {
            full_name:
              managerName,

            organization_id:
              organization.id,

            role: 'admin',
          },
        },
      )

    if (
      authUserError ||
      !authUser?.user
    ) {
      await admin
        .from('organizations')
        .delete()
        .eq(
          'id',
          organization.id,
        )

      res.status(400).json({
        error:
          authUserError?.message ||
          'تعذر إنشاء حساب المستخدم',
      })
      return
    }

    const {
      error:
        profileError,
    } = await admin
      .from('users')
      .insert({
        id:
          authUser.user.id,

        organization_id:
          organization.id,

        full_name:
          managerName,

        email,

        role:
          'admin',

        active:
          true,

        is_platform_admin:
          false,
      })

    if (profileError) {
      await deleteAuthUser(
        admin,
        authUser.user.id,
      )

      await admin
        .from('organizations')
        .delete()
        .eq(
          'id',
          organization.id,
        )

      res.status(500).json({
        error:
          `تعذر إنشاء ملف المستخدم: ${profileError.message}`,
      })
      return
    }

    let subscription:
      AnyRecord | null =
      null

    if (plan) {
      const today =
        new Date()

      const startedAt =
        getDateString(today)

      const expiresAt =
        getDateString(
          addDays(
            today,
            30,
          ),
        )

      const {
        data,
        error:
          subscriptionError,
      } = await admin
        .from('subscriptions')
        .insert({
          organization_id:
            organization.id,

          plan_id:
            plan.id,

          plan:
            plan.name,

          status:
            'active',

          renewal_date:
            expiresAt,

          billing_cycle:
            'monthly',

          started_at:
            startedAt,

          expires_at:
            expiresAt,
        })
        .select(
          `
          id,
          plan_id,
          plan,
          status,
          renewal_date,
          billing_cycle,
          started_at,
          expires_at
          `,
        )
        .single()

      if (
        subscriptionError
      ) {
        await admin
          .from('users')
          .delete()
          .eq(
            'id',
            authUser.user.id,
          )

        await deleteAuthUser(
          admin,
          authUser.user.id,
        )

        await admin
          .from('organizations')
          .delete()
          .eq(
            'id',
            organization.id,
          )

        res.status(500).json({
          error:
            `تعذر إنشاء الاشتراك: ${subscriptionError.message}`,
        })
        return
      }

      subscription =
        data
    }

    await writeAudit(
      admin,
      {
        actor_id:
          authData.user.id,

        organization_id:
          organization.id,

        action:
          'create_organization',

        entity:
          'organizations',

        entity_id:
          organization.id,

        new_value: {
          name,

          business_type:
            businessType ||
            null,

          manager_name:
            managerName,

          email,

          phone:
            phone ||
            null,

          address:
            address ||
            null,

          plan_id:
            plan?.id ??
            null,

          plan_name:
            plan?.name ??
            null,

          subscription_id:
            subscription?.id ??
            null,
        },

        details: {
          source:
            'admin_organizations',

          auth_user_id:
            authUser.user.id,
        },
      },
    )

    res.status(201).json({
      success: true,

      organization,

      user: {
        id:
          authUser.user.id,

        email,

        full_name:
          managerName,

        role:
          'admin',
      },

      subscription,
    })

    return
  }

  if (action === 'update') {
    const organizationId =
      String(
        body.organizationId ||
          '',
      )

    if (
      !validateOrganizationId(
        organizationId,
      )
    ) {
      res.status(400).json({
        error:
          'معرّف الشركة غير صالح',
      })
      return
    }

    const {
      data: before,
      error:
        findError,
    } = await admin
      .from('organizations')
      .select(
        `
        id,
        name,
        business_type,
        manager_name,
        email,
        phone,
        address,
        logo_url,
        plan,
        suspended
        `,
      )
      .eq(
        'id',
        organizationId,
      )
      .single()

    if (
      findError ||
      !before
    ) {
      res.status(404).json({
        error:
          'الشركة غير موجودة',
      })
      return
    }

    const updates:
      AnyRecord = {}

    const fields: Array<
      [string, string]
    > = [
      [
        'name',
        'name',
      ],
      [
        'businessType',
        'business_type',
      ],
      [
        'managerName',
        'manager_name',
      ],
      [
        'email',
        'email',
      ],
      [
        'phone',
        'phone',
      ],
      [
        'address',
        'address',
      ],
      [
        'logoUrl',
        'logo_url',
      ],
    ]

    for (
      const [
        input,
        column,
      ] of fields
    ) {
      if (
        Object.prototype.hasOwnProperty.call(
          body,
          input,
        )
      ) {
        updates[column] =
          String(
            body[input] ??
              '',
          ).trim() ||
          null
      }
    }

    if (
      updates.email
    ) {
      updates.email =
        normalizeEmail(
          updates.email,
        )

      if (
        !isValidEmail(
          updates.email,
        )
      ) {
        res.status(400).json({
          error:
            'البريد الإلكتروني غير صالح',
        })
        return
      }
    }

    if (
      updates.name
    ) {
      updates.slug =
        await getUniqueSlug(
          admin,
          updates.name,
          organizationId,
        )
    }

    const {
      data: companyAdmin,
      error:
        companyAdminError,
    } = await admin
      .from('users')
      .select(
        'id, email, full_name',
      )
      .eq(
        'organization_id',
        organizationId,
      )
      .eq(
        'role',
        'admin',
      )
      .maybeSingle()

    if (companyAdminError) {
      res.status(500).json({
        error:
          `تعذر قراءة مدير الشركة: ${companyAdminError.message}`,
      })
      return
    }

    const oldOrganizationEmail =
      normalizeEmail(
        before.email,
      )

    const newOrganizationEmail =
      updates.email
        ? normalizeEmail(
            updates.email,
          )
        : oldOrganizationEmail

    const emailChanged =
      Boolean(
        companyAdmin &&
          newOrganizationEmail &&
          newOrganizationEmail !==
            normalizeEmail(
              companyAdmin.email,
            ),
      )

    if (emailChanged) {
      const {
        data: emailOwner,
      } =
        await admin
          .from('users')
          .select('id')
          .ilike(
            'email',
            newOrganizationEmail,
          )
          .neq(
            'id',
            companyAdmin.id,
          )
          .maybeSingle()

      if (emailOwner) {
        res.status(409).json({
          error:
            'البريد الإلكتروني مستخدم بالفعل في حساب آخر',
        })
        return
      }

      let authEmailUser:
        AnyRecord | null =
        null

      try {
        authEmailUser =
          await findAuthUserByEmail(
            admin,
            newOrganizationEmail,
          )
      } catch (error: any) {
        res.status(500).json({
          error:
            error?.message ||
            'تعذر التحقق من البريد الإلكتروني في Auth',
        })
        return
      }

      if (
        authEmailUser &&
        authEmailUser.id !==
          companyAdmin.id
      ) {
        res.status(409).json({
          error:
            'البريد الإلكتروني مستخدم بالفعل في حساب Auth آخر',
        })
        return
      }
    }

    /*
     * --------------------------------------------------------
     * Email synchronization
     * --------------------------------------------------------
     *
     * Update Auth first. If a later database operation fails,
     * attempt to restore the previous Auth email.
     */
    let authEmailChanged =
      false

    if (
      emailChanged &&
      companyAdmin
    ) {
      const {
        error:
          authUpdateError,
      } =
        await admin.auth.admin.updateUserById(
          companyAdmin.id,
          {
            email:
              newOrganizationEmail,
          },
        )

      if (authUpdateError) {
        res.status(400).json({
          error:
            `تعذر تحديث بريد المستخدم في Auth: ${authUpdateError.message}`,
        })
        return
      }

      authEmailChanged = true
    }

    /*
     * Update the public user profile before the organization.
     */
    if (
      companyAdmin
    ) {
      const profileUpdates:
        AnyRecord = {}

      if (
        body.managerName !==
        undefined
      ) {
        profileUpdates.full_name =
          String(
            body.managerName ??
              '',
          ).trim()
      }

      if (emailChanged) {
        profileUpdates.email =
          newOrganizationEmail
      }

      if (
        Object.keys(
          profileUpdates,
        ).length
      ) {
        const {
          error:
            profileUpdateError,
        } = await admin
          .from('users')
          .update(
            profileUpdates,
          )
          .eq(
            'id',
            companyAdmin.id,
          )

        if (
          profileUpdateError
        ) {
          if (
            authEmailChanged
          ) {
            await admin.auth.admin.updateUserById(
              companyAdmin.id,
              {
                email:
                  normalizeEmail(
                    companyAdmin.email,
                  ),
              },
            )
          }

          res.status(500).json({
            error:
              `تعذر تحديث بيانات المستخدم: ${profileUpdateError.message}`,
          })
          return
        }
      }
    }

    const {
      data: updatedBase,
      error:
        updateError,
    } = await admin
      .from('organizations')
      .update(updates)
      .eq(
        'id',
        organizationId,
      )
      .select(
        `
        id,
        name,
        slug,
        phone,
        email,
        business_type,
        suspended,
        manager_name,
        address,
        logo_url,
        plan,
        created_at
        `,
      )
      .single()

    if (
      updateError ||
      !updatedBase
    ) {
      /*
       * Roll back the profile and Auth email
       * if the organization update failed.
       */
      if (
        companyAdmin
      ) {
        const rollbackProfile:
          AnyRecord = {}

        if (emailChanged) {
          rollbackProfile.email =
            companyAdmin.email
        }

        if (
          body.managerName !==
          undefined
        ) {
          rollbackProfile.full_name =
            companyAdmin.full_name
        }

        if (
          Object.keys(
            rollbackProfile,
          ).length
        ) {
          await admin
            .from('users')
            .update(
              rollbackProfile,
            )
            .eq(
              'id',
              companyAdmin.id,
            )
        }

        if (
          authEmailChanged
        ) {
          await admin.auth.admin.updateUserById(
            companyAdmin.id,
            {
              email:
                normalizeEmail(
                  companyAdmin.email,
                ),
            },
          )
        }
      }

      res.status(500).json({
        error:
          updateError?.message ||
          'تعذر تحديث الشركة',
      })
      return
    }

    let planOverride:
      AnyRecord | null =
      null

    if (
      body.planId !==
      undefined
    ) {
      const planId =
        String(
          body.planId ||
            '',
        )

      if (
        !validatePlanId(
          planId,
        )
      ) {
        res.status(400).json({
          error:
            'معرّف الباقة غير صالح',
        })
        return
      }

      const {
        data: plan,
        error:
          planError,
      } = await admin
        .from('plans')
        .select(
          `
          id,
          name,
          price,
          yearly_price,
          currency,
          status
          `,
        )
        .eq(
          'id',
          planId,
        )
        .single()

      if (
        planError ||
        !plan ||
        plan.status !==
          'active'
      ) {
        res.status(400).json({
          error:
            'الباقة المحددة غير متاحة',
        })
        return
      }

      const today =
        new Date()

      const startedAt =
        getDateString(today)

      const expiresAt =
        getDateString(
          addDays(
            today,
            30,
          ),
        )

      const {
        data:
          currentSubscription,
        error:
          subscriptionLookupError,
      } = await admin
        .from('subscriptions')
        .select(
          `
          id,
          plan_id,
          plan,
          status,
          renewal_date,
          billing_cycle,
          started_at,
          expires_at
          `,
        )
        .eq(
          'organization_id',
          organizationId,
        )
        .order(
          'renewal_date',
          {
            ascending:
              false,
            nullsFirst:
              false,
          },
        )
        .limit(1)
        .maybeSingle()

      if (
        subscriptionLookupError
      ) {
        res.status(500).json({
          error:
            `تعذر قراءة الاشتراك الحالي: ${subscriptionLookupError.message}`,
        })
        return
      }

      if (
        currentSubscription?.id
      ) {
        const {
          error:
            subscriptionUpdateError,
        } = await admin
          .from('subscriptions')
          .update({
            plan_id:
              plan.id,

            plan:
              plan.name,

            status:
              'active',

            renewal_date:
              expiresAt,

            billing_cycle:
              'monthly',

            started_at:
              startedAt,

            expires_at:
              expiresAt,
          })
          .eq(
            'id',
            currentSubscription.id,
          )

        if (
          subscriptionUpdateError
        ) {
          res.status(500).json({
            error:
              `تعذر تحديث الاشتراك: ${subscriptionUpdateError.message}`,
          })
          return
        }

        planOverride = {
          subscription_id:
            currentSubscription.id,

          old_plan_id:
            currentSubscription.plan_id ??
            null,

          old_plan_name:
            currentSubscription.plan ??
            null,

          new_plan_id:
            plan.id,

          new_plan_name:
            plan.name,

          billing_cycle:
            'monthly',

          started_at:
            startedAt,

          expires_at:
            expiresAt,
        }
      } else {
        const {
          data:
            insertedSubscription,
          error:
            subscriptionInsertError,
        } = await admin
          .from('subscriptions')
          .insert({
            organization_id:
              organizationId,

            plan_id:
              plan.id,

            plan:
              plan.name,

            status:
              'active',

            renewal_date:
              expiresAt,

            billing_cycle:
              'monthly',

            started_at:
              startedAt,

            expires_at:
              expiresAt,
          })
          .select(
            `
            id,
            plan_id,
            plan,
            status,
            renewal_date,
            billing_cycle,
            started_at,
            expires_at
            `,
          )
          .single()

        if (
          subscriptionInsertError
        ) {
          res.status(500).json({
            error:
              `تعذر إنشاء الاشتراك: ${subscriptionInsertError.message}`,
          })
          return
        }

        planOverride = {
          subscription_id:
            insertedSubscription?.id ??
            null,

          old_plan_id:
            null,

          old_plan_name:
            null,

          new_plan_id:
            plan.id,

          new_plan_name:
            plan.name,

          billing_cycle:
            'monthly',

          started_at:
            startedAt,

          expires_at:
            expiresAt,
        }
      }

      /*
       * Keep organizations.plan synchronized with the
       * selected active plan.
       */
      const {
        error:
          organizationPlanError,
      } = await admin
        .from('organizations')
        .update({
          plan:
            plan.name,
        })
        .eq(
          'id',
          organizationId,
        )

      if (
        organizationPlanError
      ) {
        res.status(500).json({
          error:
            `تعذر تحديث باقة الشركة: ${organizationPlanError.message}`,
        })
        return
      }

      await writeAudit(
        admin,
        {
          actor_id:
            authData.user.id,

          organization_id:
            organizationId,

          action:
            'admin_override_subscription_plan',

          entity:
            'subscriptions',

          entity_id:
            planOverride.subscription_id,

          old_value: {
            plan_id:
              planOverride.old_plan_id,

            plan_name:
              planOverride.old_plan_name,
          },

          new_value: {
            plan_id:
              planOverride.new_plan_id,

            plan_name:
              planOverride.new_plan_name,

            billing_cycle:
              planOverride.billing_cycle,

            started_at:
              planOverride.started_at,

            expires_at:
              planOverride.expires_at,
          },

          details: {
            source:
              'admin_organizations',

            reason:
              'manual_platform_admin_override',
          },
        },
      )
    }

    /*
     * Re-read the organization after all changes.
     * This guarantees the response contains the new plan,
     * email, slug, and all other current values.
     */
    const {
      data: updated,
      error:
        finalOrganizationError,
    } = await admin
      .from('organizations')
      .select(
        `
        id,
        name,
        slug,
        phone,
        email,
        business_type,
        suspended,
        manager_name,
        address,
        logo_url,
        plan,
        created_at
        `,
      )
      .eq(
        'id',
        organizationId,
      )
      .single()

    if (
      finalOrganizationError ||
      !updated
    ) {
      res.status(500).json({
        error:
          finalOrganizationError?.message ||
          'تعذر قراءة بيانات الشركة بعد التحديث',
      })
      return
    }

    await writeAudit(
      admin,
      {
        actor_id:
          authData.user.id,

        organization_id:
          organizationId,

        action:
          'update_organization',

        entity:
          'organizations',

        entity_id:
          organizationId,

        old_value:
          before,

        new_value:
          updated,

        details: {
          source:
            'admin_organizations',

          email_changed:
            emailChanged,

          admin_user_id:
            companyAdmin?.id ??
            null,

          plan_override:
            Boolean(
              planOverride,
            ),
        },
      },
    )

    res.status(200).json({
      success: true,

      organization:
        updated,

      plan_override:
        planOverride,
    })

    return
  }

  if (action === 'delete') {
    const organizationId =
      String(
        body.organizationId ||
          '',
      )

    if (
      !validateOrganizationId(
        organizationId,
      )
    ) {
      res.status(400).json({
        error:
          'معرّف الشركة غير صالح',
      })
      return
    }

    const {
      data: organization,
      error:
        organizationLookupError,
    } = await admin
      .from('organizations')
      .select(
        'id, name, email, plan, suspended',
      )
      .eq(
        'id',
        organizationId,
      )
      .single()

    if (
      organizationLookupError ||
      !organization
    ) {
      res.status(404).json({
        error:
          'الشركة غير موجودة',
      })
      return
    }

    const {
      data: platformUsers,
      error:
        platformUsersError,
    } = await admin
      .from('users')
      .select('id, email')
      .eq(
        'organization_id',
        organizationId,
      )
      .eq(
        'is_platform_admin',
        true,
      )

    if (
      platformUsersError
    ) {
      res.status(500).json({
        error:
          `تعذر التحقق من مدير المنصة: ${platformUsersError.message}`,
      })
      return
    }

    if (
      platformUsers?.length
    ) {
      res.status(403).json({
        error:
          'لا يمكن حذف شركة مرتبطة بمدير المنصة',
      })
      return
    }

    const {
      data: orgUsers,
      error:
        usersLookupError,
    } = await admin
      .from('users')
      .select(
        'id, email, role',
      )
      .eq(
        'organization_id',
        organizationId,
      )

    if (
      usersLookupError
    ) {
      res.status(500).json({
        error:
          `تعذر قراءة مستخدمي الشركة: ${usersLookupError.message}`,
      })
      return
    }

    const userIds =
      (orgUsers ?? [])
        .map(
          (user: AnyRecord) =>
            user.id,
        )
        .filter(Boolean)

    const auditWritten =
      await writeAudit(
        admin,
        {
          actor_id:
            authData.user.id,

          organization_id:
            organizationId,

          action:
            'delete_organization',

          entity:
            'organizations',

          entity_id:
            organizationId,

          old_value:
            organization,

          details: {
            source:
              'admin_organizations',

            deleted_user_ids:
              userIds,

            user_count:
              userIds.length,
          },
        },
      )

    if (!auditWritten) {
      res.status(500).json({
        error:
          'تعذر تسجيل عملية الحذف في سجل التدقيق، وتم إيقاف الحذف لحماية السجل',
      })
      return
    }

    for (
      const userId of userIds
    ) {
      const detachResult =
        await detachUserReferences(
          admin,
          userId,
        )

      if (
        !detachResult.success
      ) {
        res.status(500).json({
          error:
            detachResult.error,
        })
        return
      }
    }

    const tenantDeleteResult =
      await deleteOrganizationData(
        admin,
        organizationId,
      )

    if (
      !tenantDeleteResult.success
    ) {
      res.status(500).json({
        error:
          tenantDeleteResult.error,
      })
      return
    }

    if (userIds.length) {
      const {
        error:
          publicUsersDeleteError,
      } = await admin
        .from('users')
        .delete()
        .in(
          'id',
          userIds,
        )

      if (
        publicUsersDeleteError
      ) {
        res.status(500).json({
          error:
            `تعذر حذف ملفات مستخدمي الشركة: ${publicUsersDeleteError.message}`,
        })
        return
      }
    }

    for (
      const userId of userIds
    ) {
      const authDeleteResult =
        await deleteAuthUser(
          admin,
          userId,
        )

      if (
        !authDeleteResult.success
      ) {
        res.status(500).json({
          error:
            `تعذر حذف حساب المستخدم من Auth: ${authDeleteResult.error}`,
        })
        return
      }
    }

    const {
      error:
        organizationDeleteError,
    } = await admin
      .from('organizations')
      .delete()
      .eq(
        'id',
        organizationId,
      )

    if (
      organizationDeleteError
    ) {
      res.status(500).json({
        error:
          `تعذر حذف الشركة: ${organizationDeleteError.message}`,
      })
      return
    }

    res.status(200).json({
      success: true,
    })

    return
  }

  res.status(400).json({
    error:
      'إجراء غير معروف',
  })
}
