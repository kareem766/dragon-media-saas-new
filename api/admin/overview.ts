import { createClient } from '@supabase/supabase-js'

export default async function handler(req: any, res: any) {
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
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
  const { data: authData } = await userClient.auth.getUser()
  if (!authData?.user) {
    res.status(401).json({ error: 'غير مصرح' })
    return
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: callerRow } = await admin
    .from('users')
    .select('is_platform_admin')
    .eq('id', authData.user.id)
    .single()

  if (!callerRow?.is_platform_admin) {
    res.status(403).json({ error: 'هذه الصفحة مخصصة لمدير المنصة فقط' })
    return
  }

  const [orgsRes, usersRes, leadsRes, customersRes, dealsRes] = await Promise.all([
    admin.from('organizations').select('id, name, business_type, plan, created_at').order('created_at', { ascending: false }),
    admin.from('users').select('id, organization_id'),
    admin.from('leads').select('id, organization_id'),
    admin.from('customers').select('id, organization_id'),
    admin.from('deals').select('id, organization_id, value'),
  ])

  const orgs = orgsRes.data ?? []
  const users = usersRes.data ?? []
  const leads = leadsRes.data ?? []
  const customers = customersRes.data ?? []
  const deals = dealsRes.data ?? []

  const organizations = orgs.map(o => ({
    id: o.id,
    name: o.name,
    business_type: o.business_type,
    plan: o.plan,
    created_at: o.created_at,
    usersCount: users.filter(u => u.organization_id === o.id).length,
    leadsCount: leads.filter(l => l.organization_id === o.id).length,
    customersCount: customers.filter(c => c.organization_id === o.id).length,
    dealsValue: deals.filter(d => d.organization_id === o.id).reduce((s, d) => s + Number(d.value ?? 0), 0),
  }))

  res.status(200).json({
    totals: {
      organizations: orgs.length,
      users: users.length,
      leads: leads.length,
      customers: customers.length,
      dealsValue: deals.reduce((s, d) => s + Number(d.value ?? 0), 0),
    },
    organizations,
  })
}
