import { createClient } from '@supabase/supabase-js'

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = req.headers.authorization
  const accessToken = authHeader?.replace('Bearer ', '')

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !anonKey || !serviceKey || !accessToken) {
    res.status(401).json({ error: 'غير مصرح' })
    return
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })

  const { data: authData, error: authError } =
    await userClient.auth.getUser()

  if (authError || !authData?.user) {
    res.status(401).json({ error: 'غير مصرح' })
    return
  }

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: callerRow, error: callerError } = await admin
    .from('users')
    .select('is_platform_admin')
    .eq('id', authData.user.id)
    .single()

  if (callerError || !callerRow?.is_platform_admin) {
    res.status(403).json({
      error: 'هذه الصفحة مخصصة لمدير المنصة فقط',
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

  let query = admin
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
    .order('paid_at', { ascending: false })

  if (from) {
    query = query.gte('paid_at', `${from}T00:00:00`)
  }

  if (to) {
    query = query.lte('paid_at', `${to}T23:59:59.999`)
  }

  if (method && method !== 'all') {
    query = query.eq('method', method)
  }

  const { data: payments, error: paymentsError } = await query

  if (paymentsError) {
    res.status(500).json({
      error: 'تعذر تحميل البيانات المالية',
    })
    return
  }

  /*
   * Defensive duplicate prevention:
   * payment_id is the canonical transaction identity.
   */
  const uniquePayments = Array.from(
    new Map(
      (payments ?? []).map((payment: any) => [
        payment.payment_id,
        payment,
      ])
    ).values()
  )

  const organizationIds = [
    ...new Set(
      uniquePayments
        .map((payment: any) => payment.organization_id)
        .filter(Boolean)
    ),
  ]

  let organizations: any[] = []

  if (organizationIds.length > 0) {
    const { data: organizationsData } = await admin
      .from('organizations')
      .select('id, name')
      .in('id', organizationIds)

    organizations = organizationsData ?? []
  }

  const organizationMap = new Map(
    organizations.map((organization: any) => [
      organization.id,
      organization.name,
    ])
  )

  const transactions = uniquePayments.map((payment: any) => ({
    ...payment,
    organization_name:
      organizationMap.get(payment.organization_id) ?? '—',
  }))

  const totalRevenue = transactions.reduce(
    (sum: number, payment: any) =>
      sum + Number(payment.amount ?? 0),
    0
  )

  const transactionCount = transactions.length

  const averageTransaction =
    transactionCount > 0
      ? totalRevenue / transactionCount
      : 0

  const byMethodMap = new Map<
    string,
    {
      method: string
      count: number
      revenue: number
    }
  >()

  for (const payment of transactions) {
    const key = payment.method || 'unknown'

    const current = byMethodMap.get(key) ?? {
      method: key,
      count: 0,
      revenue: 0,
    }

    current.count += 1
    current.revenue += Number(payment.amount ?? 0)

    byMethodMap.set(key, current)
  }

  const byMethod = Array.from(byMethodMap.values()).sort(
    (a, b) => b.revenue - a.revenue
  )

  res.status(200).json({
    summary: {
      totalRevenue,
      transactionCount,
      averageTransaction,
    },
    byMethod,
    transactions,
  })
}
