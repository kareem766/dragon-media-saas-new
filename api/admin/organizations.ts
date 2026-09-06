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

  if (req.method !== 'POST') { res.status(405).json({ error: 'الطريقة غير مسموحة' }); return }

  const { action, organizationId } = req.body || {}
  if (action !== 'suspend' && action !== 'activate') { res.status(400).json({ error: 'إجراء غير معروف' }); return }

  const { data: before } = await admin.from('organizations').select('suspended').eq('id', organizationId).single()
  const newSuspended = action === 'suspend'

  await admin.from('organizations').update({ suspended: newSuspended }).eq('id', organizationId)
  await admin.from('audit_logs').insert({
    actor_id: authData.user.id,
    organization_id: organizationId,
    action: action === 'suspend' ? 'suspend_organization' : 'activate_organization',
    entity: 'organizations',
    entity_id: organizationId,
    old_value: { suspended: before?.suspended },
    new_value: { suspended: newSuspended },
  })

  res.status(200).json({ success: true })
}
