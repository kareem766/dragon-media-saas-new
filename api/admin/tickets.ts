import { createClient } from '@supabase/supabase-js'

export default async function handler(req: any, res: any) {
  const authHeader = req.headers.authorization
  const accessToken = authHeader?.replace('Bearer ', '')

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !anonKey || !serviceKey || !accessToken) { res.status(401).json({ error: 'غير مصرح' }); return }

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
  const { data: authData } = await userClient.auth.getUser()
  if (!authData?.user) { res.status(401).json({ error: 'غير مصرح' }); return }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: callerRow } = await admin.from('users').select('is_platform_admin').eq('id', authData.user.id).single()
  if (!callerRow?.is_platform_admin) { res.status(403).json({ error: 'هذه الصفحة مخصصة لمدير المنصة فقط' }); return }

  if (req.method === 'GET' && req.query?.messages) {
    const { data } = await admin.from('support_ticket_messages').select('*').eq('ticket_id', req.query.messages).order('created_at', { ascending: true })
    res.status(200).json({ messages: data ?? [] })
    return
  }

  if (req.method === 'GET') {
    const { data: tickets } = await admin.from('support_tickets').select('*, organizations(name)').order('updated_at', { ascending: false })
    res.status(200).json({ tickets: tickets ?? [] })
    return
  }

  if (req.method === 'POST') {
    const { action, ticketId, message, status } = req.body || {}
    if (action === 'reply' && message) {
      await admin.from('support_ticket_messages').insert({ ticket_id: ticketId, sender_id: authData.user.id, sender_type: 'admin', message })
      await admin.from('support_tickets').update({ status: 'pending', updated_at: new Date().toISOString() }).eq('id', ticketId)
      res.status(200).json({ success: true })
      return
    }
    if (action === 'status' && status) {
      await admin.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', ticketId)
      res.status(200).json({ success: true })
      return
    }
    res.status(400).json({ error: 'إجراء غير معروف' })
    return
  }

  res.status(405).json({ error: 'الطريقة غير مسموحة' })
}
