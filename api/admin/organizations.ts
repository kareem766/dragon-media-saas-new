import { createClient } from '@supabase/supabase-js'

const getClients = (accessToken: string) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return null
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })

  const admin = createClient(supabaseUrl, serviceKey)

  return {
    userClient,
    admin,
  }
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
      query.neq('id', currentId)
    }

    const { data } = await query.maybeSingle()

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
  const { data } = await admin
    .from('users')
    .select('is_platform_admin, active')
    .eq('id', userId)
    .maybeSingle()

  return Boolean(
    data?.is_platform_admin &&
    data?.active !== false,
  )
}

const writeAudit = async (
  admin: any,
  payload: Record<string, unknown>,
) => {
  const { error } = await admin
    .from('audit_logs')
    .insert(payload)

  if (error) {
    console.error(
      'organization audit log error:',
      error.message,
    )
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

  const clients = getClients(accessToken)

  if (!clients) {
    res.status(500).json({
      error: 'إعدادات الخادم غير مكتملة',
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
  } = await userClient.auth.getUser()

  if (
    authError ||
    !authData?.user
  ) {
    res.status(401).json({
      error: 'جلسة الدخول غير صالحة',
    })
    return
  }

  if (
    !(await isPlatformAdmin(
      admin,
      authData.user.id,
    ))
  ) {
    res.status(403).json({
      error:
        'هذه الصفحة مخصصة لمدير المنصة فقط',
    })
    return
  }

  /*
   * GET
   */
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
      .order('created_at', {
        ascending: false,
      })

    if (error) {
      res.status(500).json({
        error: error.message,
      })
      return
    }

    const orgs =
      organizations ?? []

    const ids = orgs.map(
      (org: any) => org.id,
    )

    const [
      usersRes,
      customersRes,
      leadsRes,
      subscriptionsRes,
    ] = await Promise.all([
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

    const result = orgs.map(
      (org: any) => {
        const orgUsers =
          users.filter(
            (u: any) =>
              u.organization_id ===
              org.id,
          )

        const companyAdmin =
          orgUsers.find(
            (u: any) =>
              u.role === 'admin',
          ) ??
          orgUsers.find(
            (u: any) =>
              u.role !==
              'super_admin',
          )

        const orgSubscriptions =
          subscriptions
            .filter(
              (s: any) =>
                s.organization_id ===
                org.id,
            )
            .sort(
              (
                a: any,
                b: any,
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
              (c: any) =>
                c.organization_id ===
                org.id,
            ).length,

          leads_count:
            leads.filter(
              (l: any) =>
                l.organization_id ===
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
            subscription?.plans?.name ??
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

  /*
   * POST
   */

  if (req.method !== 'POST') {
    res.status(405).json({
      error: 'الطريقة غير مسموحة',
    })
    return
  }

  const body =
    req.body ?? {}

  const action =
    body.action

  /*
   * SUSPEND / ACTIVATE
   */

  if (
    action === 'suspend' ||
    action === 'activate'
  ) {
    const organizationId =
      String(
        body.organizationId ||
          '',
      )

    if (!organizationId) {
      res.status(400).json({
        error:
          'معرّف الشركة مطلوب',
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

    const { error } =
      await admin
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
        error: error.message,
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

  /*
   * CREATE
   */

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
      String(
        body.email || '',
      )
        .trim()
        .toLowerCase()

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
        ? String(body.planId)
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

    if (
      !/^\S+@\S+\.\S+$/.test(
        email,
      )
    ) {
      res.status(400).json({
        error:
          'البريد الإلكتروني غير صالح',
      })
      return
    }

    let plan: any = null

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

    const slug =
      await getUniqueSlug(
        admin,
        name,
      )

    const {
      data: organization,
      error: organizationError,
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
          phone || null,

        address:
          address || null,

        logo_url:
          logoUrl || null,

        plan:
          plan?.name ??
          'أساسي',

        suspended: false,
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

    /*
     * REAL SUPABASE AUTH ACCOUNT
     */

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

    /*
     * PUBLIC USER PROFILE
     */

    const {
      error: profileError,
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

        role: 'admin',

        active: true,

        is_platform_admin:
          false,
      })

    if (profileError) {
      await admin.auth.admin.deleteUser(
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
          profileError.message,
      })

      return
    }

    /*
     * SUBSCRIPTION
     */

    let subscription:
      | any
      | null = null

    if (plan) {
      const renewalDate =
        new Date()

      renewalDate.setDate(
        renewalDate.getDate() +
          30,
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
            renewalDate
              .toISOString()
              .slice(
                0,
                10,
              ),
        })
        .select(
          `
          id,
          plan_id,
          plan,
          status,
          renewal_date
          `,
        )
        .single()

      if (
        subscriptionError
      ) {
        await admin.auth.admin.deleteUser(
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
            subscriptionError.message,
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
            phone || null,

          address:
            address || null,

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

        role: 'admin',
      },

      subscription,
    })

    return
  }

  /*
   * UPDATE
   */

  if (action === 'update') {
    const organizationId =
      String(
        body.organizationId ||
          '',
      )

    if (!organizationId) {
      res.status(400).json({
        error:
          'معرّف الشركة مطلوب',
      })
      return
    }

    const {
      data: before,
      error: findError,
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
      Record<string, any> = {}

    const fields = [
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
        updates[
          column
        ] =
          String(
            body[input] ??
              '',
          ).trim() ||
          null
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
      data: updated,
      error: updateError,
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
      !updated
    ) {
      res.status(500).json({
        error:
          updateError?.message ||
          'تعذر تحديث الشركة',
      })
      return
    }

    /*
     * Sync Company Admin profile
     */

    const {
      data: companyAdmin,
    } = await admin
      .from('users')
      .select(
        'id, email',
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

    if (
      companyAdmin
    ) {
      const profileUpdates:
        Record<string, any> =
        {}

      if (
        body.managerName !==
        undefined
      ) {
        profileUpdates.full_name =
          String(
            body.managerName ||
              '',
          ).trim()
      }

      if (
        body.email !==
        undefined
      ) {
        const newEmail =
          String(
            body.email ||
              '',
          )
            .trim()
            .toLowerCase()

        if (
          newEmail &&
          newEmail !==
            companyAdmin.email
        ) {
          const {
            error:
              authUpdateError,
          } =
            await admin.auth.admin.updateUserById(
              companyAdmin.id,
              {
                email:
                  newEmail,
              },
            )

          if (
            authUpdateError
          ) {
            res.status(400).json({
              error:
                `تعذر تحديث بريد المستخدم: ${authUpdateError.message}`,
            })
            return
          }

          profileUpdates.email =
            newEmail
        }
      }

      if (
        Object.keys(
          profileUpdates,
        ).length
      ) {
        await admin
          .from('users')
          .update(
            profileUpdates,
          )
          .eq(
            'id',
            companyAdmin.id,
          )
      }
    }

    /*
     * Optional plan change
     */

    if (
      body.planId
    ) {
      const planId =
        String(
          body.planId,
        )

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

      await admin
        .from('organizations')
        .update({
          plan:
            plan.name,
        })
        .eq(
          'id',
          organizationId,
        )

      const renewalDate =
        new Date()

      renewalDate.setDate(
        renewalDate.getDate() +
          30,
      )

      const {
        data:
          currentSubscription,
      } = await admin
        .from('subscriptions')
        .select('id')
        .eq(
          'organization_id',
          organizationId,
        )
        .order(
          'renewal_date',
          {
            ascending: false,
            nullsFirst: false,
          },
        )
        .limit(1)
        .maybeSingle()

      if (
        currentSubscription?.id
      ) {
        await admin
          .from('subscriptions')
          .update({
            plan_id:
              plan.id,

            plan:
              plan.name,

            status:
              'active',

            renewal_date:
              renewalDate
                .toISOString()
                .slice(
                  0,
                  10,
                ),
          })
          .eq(
            'id',
            currentSubscription.id,
          )
      } else {
        await admin
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
              renewalDate
                .toISOString()
                .slice(
                  0,
                  10,
                ),
          })
      }
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
        },
      },
    )

    res.status(200).json({
      success: true,
      organization:
        updated,
    })

    return
  }

  /*
   * DELETE
   */

  if (action === 'delete') {
    const organizationId =
      String(
        body.organizationId ||
          '',
      )

    if (!organizationId) {
      res.status(400).json({
        error:
          'معرّف الشركة مطلوب',
      })
      return
    }

    const {
      data: organization,
    } = await admin
      .from('organizations')
      .select(
        'id, name, email',
      )
      .eq(
        'id',
        organizationId,
      )
      .single()

    if (!organization) {
      res.status(404).json({
        error:
          'الشركة غير موجودة',
      })
      return
    }

    /*
     * Don't allow accidental
     * deletion of the platform owner org.
     */

    const {
      data: platformUsers,
    } = await admin
      .from('users')
      .select('id')
      .eq(
        'organization_id',
        organizationId,
      )
      .eq(
        'is_platform_admin',
        true,
      )

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
    } = await admin
      .from('users')
      .select('id')
      .eq(
        'organization_id',
        organizationId,
      )

    const userIds =
      (orgUsers ?? [])
        .map(
          (user: any) =>
            user.id,
        )
        .filter(Boolean)

    /*
     * Remove Auth users first.
     */

    for (
      const userId of userIds
    ) {
      const {
        error:
          authDeleteError,
      } =
        await admin.auth.admin.deleteUser(
          userId,
        )

      if (
        authDeleteError
      ) {
        res.status(500).json({
          error:
            `تعذر حذف حساب المستخدم: ${authDeleteError.message}`,
        })
        return
      }
    }

    /*
     * Organizations have
     * cascading tenant relations
     * in the current schema.
     */

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

    await writeAudit(
      admin,
      {
        actor_id:
          authData.user.id,

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
        },
      },
    )

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
