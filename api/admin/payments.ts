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

  if (req.method === 'GET') {
    const { data } = await admin
      .from('payment_requests')
      .select('*, organizations(name), plans(name, price)')
      .order('created_at', { ascending: false })
    res.status(200).json({ requests: data ?? [] })
    return
  }

  if (req.method === 'POST') {
    const { action, requestId, reason } = req.body || {}
    if (action === 'approve') {
      const { data: request } = await admin.from('payment_requests').select('organization_id, plan_id').eq('id', requestId).single()
      if (!request) { res.status(404).json({ error: 'الطلب غير موجود' }); return }
      await admin.from('payment_requests').update({ status: 'approved', reviewed_by: authData.user.id, reviewed_at: new Date().toISOString() }).eq('id', requestId)
      await admin.from('subscriptions').update({
        plan_id: request.plan_id,
        status: 'active',
        renewal_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }).eq('organization_id', request.organization_id)
      res.status(200).json({ success: true })
      return
    }
    if (action === 'reject') {
      const { data: request } = await admin.from('payment_requests').select('organization_id').eq('id', requestId).single()
      if (!request) { res.status(404).json({ error: 'الطلب غير موجود' }); return }
      await admin.from('payment_requests').update({ status: 'rejected', rejection_reason: reason, reviewed_by: authData.user.id, reviewed_at: new Date().toISOString() }).eq('id', requestId)
      await admin.from('subscriptions').update({ status: 'pending_payment' }).eq('organization_id', request.organization_id)
      res.status(200).json({ success: true })
      return
    }
    res.status(400).json({ error: 'إجراء غير معروف' })
    return
  }

  res.status(405).json({ error: 'الطريقة غير مسموحة' })
}
