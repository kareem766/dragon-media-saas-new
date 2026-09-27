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

  if (req.method === 'GET' && req.query?.messages) {
    const ticketId = Array.isArray(req.query.messages)
      ? req.query.messages[0]
      : req.query.messages

    const { data: messages, error: messagesError } = await admin
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Admin ticket messages query error:', messagesError)
      res.status(500).json({
        error: 'تعذر تحميل رسائل التذكرة.',
        details: messagesError.message,
      })
      return
    }

    res.status(200).json({
      messages: messages ?? [],
    })

    return
  }

  if (req.method === 'GET') {
    // Keep the ticket query independent from the organization relationship.
    // A relationship error must never hide existing support tickets.
    const { data: rows, error: rowsError } = await admin
      .from('support_tickets')
      .select('*')
      .order('updated_at', { ascending: false })

    if (rowsError) {
      console.error('Admin tickets query error:', rowsError)
      res.status(500).json({
        error: 'تعذر تحميل تذاكر الدعم.',
        details: rowsError.message,
      })
      return
    }

    const tickets = rows ?? []
    const organizationIds = Array.from(
      new Set(
        tickets
          .map((ticket: any) => ticket.organization_id)
          .filter(Boolean),
      ),
    )

    const { data: organizations, error: organizationsError } =
      organizationIds.length
        ? await admin
            .from('organizations')
            .select('id, name')
            .in('id', organizationIds)
        : { data: [], error: null }

    if (organizationsError) {
      console.error(
        'Admin ticket organizations lookup error:',
        organizationsError,
      )
    }

    const organizationMap = new Map(
      (organizations ?? []).map((organization: any) => [
        organization.id,
        organization,
      ]),
    )

    const enrichedTickets = tickets.map((ticket: any) => ({
      ...ticket,
      organizations:
        organizationMap.get(ticket.organization_id) ?? null,
    }))

    res.status(200).json({
      tickets: enrichedTickets,
    })

    return
  }

  if (req.method === 'POST') {
    const {
      action,
      ticketId,
      message,
      status,
    } = req.body || {}

    if (action === 'reply' && message) {
      await admin
        .from('support_ticket_messages')
        .insert({
          ticket_id: ticketId,
          sender_id: authData.user.id,
          sender_type: 'admin',
          message,
        })

      await admin
        .from('support_tickets')
        .update({
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketId)

      res.status(200).json({
        success: true,
      })

      return
    }

    if (action === 'status' && status) {
      await admin
        .from('support_tickets')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketId)

      res.status(200).json({
        success: true,
      })

      return
    }

    res.status(400).json({
      error: 'إجراء غير معروف',
    })

    return
  }

  res.status(405).json({
    error: 'الطريقة غير مسموحة',
  })
}
