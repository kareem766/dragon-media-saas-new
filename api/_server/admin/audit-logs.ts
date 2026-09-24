import { createClient } from '@supabase/supabase-js'

export default async function handler(req: any, res: any) {
  const authHeader = req.headers.authorization
  const accessToken = authHeader?.replace('Bearer ', '')

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey || !accessToken) {
    res.status(401).json({ error: 'غير مصرح' })
    return
  }
const { data: authData } = await admin.auth.getUser(accessToken)

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: authData, error: authError } = await admin.auth.getUser(accessToken)

  if (!authData?.user) {
    res.status(401).json({ error: 'غير مصرح' })
    return
  }
return
  }

  const { data } = await admin
    .from('audit_logs')
    .select('*, organizations(name), actor:actor_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(200)

  res.status(200).json({
    logs: data ?? [],
  })
}
