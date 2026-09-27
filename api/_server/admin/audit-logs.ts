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
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })

  const { data: authData } = await userClient.auth.getUser()

  if (!authData?.user) {
    res.status(401).json({ error: 'غير مصرح' })
    return
  }

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: callerRow } = await admin
    .from('users')
    .select('is_platform_admin, active')
    .eq('id', authData.user.id)
    .single()

  if (!callerRow?.is_platform_admin || callerRow.active === false) {
    res.status(403).json({
      error: 'هذه الصفحة مخصصة لمدير المنصة فقط',
    })
    return
  }

  // Fetch the audit rows first. Do not let an optional PostgREST
  // relationship turn a populated activity log into an empty response.
  const { data: rows, error: rowsError } = await admin
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (rowsError) {
    console.error('Admin audit logs query error:', rowsError)
    res.status(500).json({
      error: 'تعذر تحميل سجل النشاط.',
      details: rowsError.message,
    })
    return
  }

  const logs = rows ?? []
  const organizationIds = Array.from(
    new Set(
      logs
        .map((row: any) => row.organization_id)
        .filter(Boolean),
    ),
  )
  const actorIds = Array.from(
    new Set(
      logs
        .map((row: any) => row.actor_id)
        .filter(Boolean),
    ),
  )

  const [organizationsRes, actorsRes] = await Promise.all([
    organizationIds.length
      ? admin
          .from('organizations')
          .select('id, name')
          .in('id', organizationIds)
      : Promise.resolve({ data: [], error: null }),
    actorIds.length
      ? admin
          .from('users')
          .select('id, full_name')
          .in('id', actorIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (organizationsRes.error) {
    console.error('Admin audit organizations lookup error:', organizationsRes.error)
  }
  if (actorsRes.error) {
    console.error('Admin audit actors lookup error:', actorsRes.error)
  }

  const organizations = new Map(
    (organizationsRes.data ?? []).map((row: any) => [row.id, row]),
  )
  const actors = new Map(
    (actorsRes.data ?? []).map((row: any) => [row.id, row]),
  )

  const enrichedLogs = logs.map((row: any) => ({
    ...row,
    organizations: organizations.get(row.organization_id) ?? null,
    actor: actors.get(row.actor_id) ?? null,
  }))

  res.status(200).json({
    logs: enrichedLogs,
  })
}
