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

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
  const { data: authData } = await userClient.auth.getUser()
  if (!authData?.user) { res.status(401).json({ error: 'غير مصرح' }); return }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: callerRow } = await admin.from('users').select('is_platform_admin').eq('id', authData.user.id).single()
  if (!callerRow?.is_platform_admin) { res.status(403).json({ error: 'هذه الصفحة مخصصة لمدير المنصة فقط' }); return }

  const { data } = await admin
    .from('audit_logs')
    .select('*, organizations(name), actor:actor_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(200)

  res.status(200).json({ logs: data ?? [] })
}
