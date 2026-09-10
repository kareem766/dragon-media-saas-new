import { createClient } from '@supabase/supabase-js'

const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1)

const startOfYear = (date: Date) =>
  new Date(date.getFullYear(), 0, 1)

const startOfPreviousMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() - 1, 1)

const endOfPreviousMonth = (date: Date) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    0,
    23,
    59,
    59,
    999
  )

const endOfDay = (date: Date) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  )

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = req.headers.authorization

  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceKey ||
    !accessToken
  ) {
    res.status(401).json({ error: 'غير مصرح' })
    return
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
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  const {
    data: authData,
    error: authError,
  } = await userClient.auth.getUser(accessToken)

  if (authError || !authData?.user) {
    res.status(401).json({ error: 'غير مصرح' })
    return
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
    data: callerRow,
    error: callerError,
  } = await admin
    .from('users')
    .select('is_platform_admin')
    .eq('id', authData.user.id)
    .single()

  if (
    callerError ||
    !callerRow?.is_platform_admin
  ) {
    res.status(403).json({
      error:
        'هذه الصفحة مخصصة لمدير المنصة فقط',
    })
    return
  }

  const url = new URL(
    req.url,
    `http://${req.headers.host || 'localhost'}`
  )

  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const method = url.searchParams.get('method')

  let paymentQuery = admin
    .from('admin_financial_payments')
    .select(`
      payment_id,
      amount,
      method,
      paid_at,
      invoice_id,
      organization_id,
      subscription_id
    `)
    .order('paid_at', {
      ascending: false,
    })

  if (from) {
    paymentQuery = paymentQuery.gte(
      'paid_at',
      `${from}T00:00:00`
    )
  }

  if (to) {
    paymentQuery = paymentQuery.lte(
      'paid_at',
      `${to}T23:59:59.999`
    )
  }

  if (method && method !== 'all') {
    paymentQuery = paymentQuery.eq(
      'method',
      method
    )
  }

  const {
    data: payments,
    error: paymentsError,
  } = await paymentQuery

  if (paymentsError) {
    res.status(500).json({
      error: 'تعذر تحميل البيانات المالية',
    })
    return
  }

  /*
   * payment_id هو الهوية الأساسية للمعاملة.
   * أي تكرار لنفس المعاملة يتم تجاهله.
   */
  const uniquePayments = Array.from(
    new Map(
      (payments ?? []).map(
        (payment: any) => [
          payment.payment_id,
          payment,
        ]
      )
    ).values()
  )

  const organizationIds = [
    ...new Set(
      uniquePayments
        .map(
          (payment: any) =>
            payment.organization_id
        )
        .filter(Boolean)
    ),
  ]

  const invoiceIds = [
    ...new Set(
      uniquePayments
        .map(
          (payment: any) =>
            payment.invoice_id
        )
        .filter(Boolean)
    ),
  ]

  const [
    { data: organizations },
    { data: invoices },
  ] = await Promise.all([
    organizationIds.length
      ? admin
          .from('organizations')
          .select('id, name')
          .in(
            'id',
            organizationIds
          )
      : Promise.resolve({
          data: [],
        }),

    invoiceIds.length
      ? admin
          .from('invoices')
          .select(`
            id,
            status,
            amount,
            subscription_id,
            subscriptions (
              plan_id,
              plans (
                id,
                name
              )
            )
          `)
          .in(
            'id',
            invoiceIds
          )
      : Promise.resolve({
          data: [],
        }),
  ])

  const organizationMap =
    new Map(
      (organizations ?? []).map(
        (organization: any) => [
          organization.id,
          organization.name,
        ]
      )
    )

  const invoiceMap =
    new Map(
      (invoices ?? []).map(
        (invoice: any) => [
          invoice.id,
          invoice,
        ]
      )
    )

  const transactions =
    uniquePayments.map(
      (payment: any) => {
        const invoice =
          invoiceMap.get(
            payment.invoice_id
          )

        const subscription =
          Array.isArray(
            invoice?.subscriptions
          )
            ? invoice?.subscriptions[0]
            : invoice?.subscriptions

        const plan =
          Array.isArray(
            subscription?.plans
          )
            ? subscription?.plans[0]
            : subscription?.plans

        return {
          ...payment,

          organization_name:
            organizationMap.get(
              payment.organization_id
            ) ?? '—',

          invoice_status:
            invoice?.status ?? '—',

          plan_id:
            plan?.id ??
            subscription?.plan_id ??
            null,

          plan_name:
            plan?.name ?? '—',
        }
      }
    )

  const totalRevenue =
    transactions.reduce(
      (
        sum: number,
        payment: any
      ) =>
        sum +
        Number(
          payment.amount ?? 0
        ),
      0
    )

  const transactionCount =
    transactions.length

  const averageTransaction =
    transactionCount > 0
      ? totalRevenue /
        transactionCount
      : 0

  /*
   * Revenue by payment method
   */
  const byMethodMap =
    new Map()

  /*
   * Revenue by plan
   */
  const byPlanMap =
    new Map()

  for (const payment of transactions) {
    const methodKey =
      payment.method || 'unknown'

    const methodItem =
      byMethodMap.get(
        methodKey
      ) ?? {
        method: methodKey,
        count: 0,
        revenue: 0,
      }

    methodItem.count += 1
    methodItem.revenue += Number(
      payment.amount ?? 0
    )

    byMethodMap.set(
      methodKey,
      methodItem
    )

    const planKey =
      payment.plan_id || 'unknown'

    const planItem =
      byPlanMap.get(
        planKey
      ) ?? {
        plan_id:
          payment.plan_id,
        plan_name:
          payment.plan_name ||
          'غير محددة',
        count: 0,
        revenue: 0,
      }

    planItem.count += 1
    planItem.revenue += Number(
      payment.amount ?? 0
    )

    byPlanMap.set(
      planKey,
      planItem
    )
  }

  /*
   * Revenue lifecycle
   */
  const now = new Date()

  const monthStart =
    startOfMonth(now)

  const previousMonthStart =
    startOfPreviousMonth(now)

  const previousMonthEnd =
    endOfPreviousMonth(now)

  const yearStart =
    startOfYear(now)

  const threeDaysFromNow =
    endOfDay(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 3
      )
    )

  /*
   * Load all approved financial
   * transactions for lifecycle
   * calculations.
   */
  const {
    data: allPaymentRows,
    error: allPaymentsError,
  } = await admin
    .from('admin_financial_payments')
    .select(`
      payment_id,
      amount,
      paid_at,
      method,
      invoice_id,
      organization_id,
      subscription_id
    `)
    .order('paid_at', {
      ascending: false,
    })

  if (allPaymentsError) {
    res.status(500).json({
      error:
        'تعذر تحميل ملخص الإيرادات',
    })
    return
  }

  const uniqueAllPayments =
    Array.from(
      new Map(
        (allPaymentRows ?? []).map(
          (payment: any) => [
            payment.payment_id,
            payment,
          ]
        )
      ).values()
    )

  const sumBetween = (
    start: Date,
    end: Date
  ) =>
    uniqueAllPayments.reduce(
      (
        sum: number,
        payment: any
      ) => {
        const paidAt =
          new Date(
            payment.paid_at
          )

        if (
          paidAt >= start &&
          paidAt <= end
        ) {
          return (
            sum +
            Number(
              payment.amount ?? 0
            )
          )
        }

        return sum
      },
      0
    )

  const monthRevenue =
    sumBetween(
      monthStart,
      endOfDay(now)
    )

  const previousMonthRevenue =
    sumBetween(
      previousMonthStart,
      previousMonthEnd
    )

  const yearRevenue =
    sumBetween(
      yearStart,
      endOfDay(now)
    )

  const currentMonthCount =
    uniqueAllPayments.filter(
      (payment: any) => {
        const date =
          new Date(
            payment.paid_at
          )

        return (
          date >= monthStart &&
          date <= endOfDay(now)
        )
      }
    ).length

  const previousMonthCount =
    uniqueAllPayments.filter(
      (payment: any) => {
        const date =
          new Date(
            payment.paid_at
          )

        return (
          date >=
            previousMonthStart &&
          date <=
            previousMonthEnd
        )
      }
    ).length

  const revenueChangePercent =
    previousMonthRevenue > 0
      ? (
          (
            monthRevenue -
            previousMonthRevenue
          ) /
          previousMonthRevenue
        ) *
        100
      : monthRevenue > 0
        ? 100
        : 0

  /*
   * Subscription lifecycle
   */
  const {
    data: subscriptions,
    error:
      subscriptionsError,
  } = await admin
    .from('subscriptions')
    .select(`
      id,
      organization_id,
      plan_id,
      status,
      renewal_date,
      plans (
        id,
        name,
        price,
        currency
      )
    `)

  if (subscriptionsError) {
    res.status(500).json({
      error:
        'تعذر تحميل حالة الاشتراكات',
    })
    return
  }

  const activeStatuses =
    new Set([
      'active',
      'trialing',
    ])

  const activeSubscriptions =
    (subscriptions ?? []).filter(
      (subscription: any) =>
        activeStatuses.has(
          subscription.status
        )
    ).length

  const expiringSubscriptions =
    (subscriptions ?? []).filter(
      (subscription: any) => {
        if (
          !activeStatuses.has(
            subscription.status
          ) ||
          !subscription.renewal_date
        ) {
          return false
        }

        const renewal =
          new Date(
            `${subscription.renewal_date}T23:59:59`
          )

        return (
          renewal >= now &&
          renewal <=
            threeDaysFromNow
        )
      }
    ).length

  const expiredSubscriptions =
    (subscriptions ?? []).filter(
      (subscription: any) =>
        subscription.status ===
        'expired'
    ).length

  /*
   * Invoice lifecycle
   */
  const {
    data: invoiceRows,
    error: invoiceError,
  } = await admin
    .from('invoices')
    .select(`
      id,
      amount,
      status,
      due_date,
      organization_id,
      subscription_id
    `)

  if (invoiceError) {
    res.status(500).json({
      error:
        'تعذر تحميل ملخص الفواتير',
    })
    return
  }

  const invoiceTotals =
    (invoiceRows ?? []).reduce(
      (
        totals: any,
        invoice: any
      ) => {
        const amount =
          Number(
            invoice.amount ?? 0
          )

        totals.total += amount

        if (
          invoice.status ===
            'مدفوعة' ||
          invoice.status ===
            'paid'
        ) {
          totals.paid += amount
        } else {
          totals.pending += amount
        }

        return totals
      },
      {
        total: 0,
        paid: 0,
        pending: 0,
      }
    )

  res.status(200).json({
    summary: {
      totalRevenue,
      transactionCount,
      averageTransaction,

      monthRevenue,
      previousMonthRevenue,
      yearRevenue,

      currentMonthCount,
      previousMonthCount,

      revenueChangePercent,
    },

    lifecycle: {
      activeSubscriptions,
      expiringSubscriptions,
      expiredSubscriptions,

      invoices:
        invoiceTotals,
    },

    byMethod:
      Array.from(
        byMethodMap.values()
      ).sort(
        (a: any, b: any) =>
          b.revenue -
          a.revenue
      ),

    byPlan:
      Array.from(
        byPlanMap.values()
      ).sort(
        (a: any, b: any) =>
          b.revenue -
          a.revenue
      ),

    transactions,
  })
}
