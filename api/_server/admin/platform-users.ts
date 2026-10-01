import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const json = (res: VercelResponse, status: number, body: Record<string, unknown>) => {
  res.status(status).json(body)
}

async function getAdmin(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization || ''
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !anonKey || !serviceKey || !accessToken) {
    json(res, 401, { error: 'غير مصرح' })
    return null
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: authData, error: authError } = await userClient.auth.getUser(accessToken)
  if (authError || !authData?.user) {
    json(res, 401, { error: 'جلسة الدخول غير صالحة' })
    return null
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: caller, error: callerError } = await admin
    .from('users')
    .select('id, is_platform_admin, active')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (callerError) {
    json(res, 500, { error: 'تعذر التحقق من صلاحيات مدير المنصة.' })
    return null
  }

  if (!caller?.is_platform_admin || caller.active === false) {
    json(res, 403, { error: 'هذه الصفحة مخصصة لمدير المنصة فقط' })
    return null
  }

  return { admin, callerId: authData.user.id }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const context = await getAdmin(req, res)
  if (!context) return

  const { admin, callerId } = context

  if (req.method === 'GET') {
    const { data: users, error: usersError } = await admin
      .from('users')
      .select('id, organization_id, full_name, email, role, active, is_platform_admin, created_at')
      .order('created_at', { ascending: false })

    if (usersError) {
      console.error('Admin platform users query error:', usersError)
      return json(res, 500, { error: 'تعذر تحميل مستخدمي المنصة.' })
    }

    const organizationIds = Array.from(
      new Set((users || []).map((user: any) => user.organization_id).filter(Boolean)),
    )

    const { data: organizations, error: organizationsError } = organizationIds.length
      ? await admin.from('organizations').select('id, name').in('id', organizationIds)
      : { data: [], error: null }

    if (organizationsError) {
      console.error('Admin platform users organizations error:', organizationsError)
    }

    const organizationMap = new Map(
      (organizations || []).map((organization: any) => [organization.id, organization.name]),
    )

    return res.status(200).json({
      users: (users || []).map((user: any) => ({
        ...user,
        organization_name: user.organization_id
          ? organizationMap.get(user.organization_id) || 'شركة غير معروفة'
          : 'حساب منصة',
      })),
    })
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' })
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const userId = String(body.userId || '').trim()
  const action = String(body.action || '').trim()

  if (!userId || !['set_platform_admin', 'set_active'].includes(action)) {
    return json(res, 400, { error: 'الطلب غير صالح.' })
  }

  if (userId === callerId) {
    return json(res, 400, {
      error: 'لا يمكن تعديل حساب مدير المنصة الحالي من هذه الصفحة لتجنب فقدان الوصول.',
    })
  }

  const { data: target, error: targetError } = await admin
    .from('users')
    .select('id, organization_id, full_name, email, role, active, is_platform_admin')
    .eq('id', userId)
    .maybeSingle()

  if (targetError) {
    return json(res, 500, { error: 'تعذر قراءة الحساب المستهدف.' })
  }

  if (!target) {
    return json(res, 404, { error: 'الحساب غير موجود.' })
  }

  const nextValue = Boolean(body.value)

  if (action === 'set_platform_admin' && !nextValue && target.is_platform_admin) {
    const { count, error: countError } = await admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('is_platform_admin', true)
      .eq('active', true)

    if (countError) {
      return json(res, 500, { error: 'تعذر التحقق من عدد مديري المنصة النشطين.' })
    }

    if ((count || 0) <= 1) {
      return json(res, 409, {
        error: 'لا يمكن إزالة آخر مدير منصة نشط. يجب الاحتفاظ بمدير منصة نشط واحد على الأقل.',
      })
    }
  }

  if (action === 'set_active' && !nextValue && target.active && target.is_platform_admin) {
    const { count, error: countError } = await admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('is_platform_admin', true)
      .eq('active', true)

    if (countError) {
      return json(res, 500, { error: 'تعذر التحقق من عدد مديري المنصة النشطين.' })
    }

    if ((count || 0) <= 1) {
      return json(res, 409, {
        error: 'لا يمكن إيقاف آخر مدير منصة نشط. فعّل مدير منصة آخر أولًا.',
      })
    }
  }

  const updates =
    action === 'set_platform_admin'
      ? { is_platform_admin: nextValue }
      : { active: nextValue }

  const { data: updated, error: updateError } = await admin
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('id, organization_id, full_name, email, role, active, is_platform_admin, created_at')
    .single()

  if (updateError || !updated) {
    console.error('Admin platform user update error:', updateError)
    return json(res, 500, { error: 'تعذر حفظ التعديل.' })
  }

  const { error: auditError } = await admin.from('audit_logs').insert({
    actor_id: callerId,
    organization_id: target.organization_id || null,
    action: action === 'set_platform_admin'
      ? 'admin_change_platform_admin_access'
      : 'admin_change_user_active_status',
    entity: 'users',
    entity_id: target.id,
    old_value: {
      active: target.active,
      is_platform_admin: target.is_platform_admin,
    },
    new_value: {
      active: updated.active,
      is_platform_admin: updated.is_platform_admin,
    },
    details: {
      source: 'admin_platform_users',
      target_email: target.email,
    },
  })

  if (auditError) {
    console.error('Admin platform users audit error:', auditError)
    return json(res, 500, {
      error: 'تم حفظ التعديل، لكن تعذر تسجيل العملية في سجل التدقيق.',
    })
  }

  return res.status(200).json({ success: true, user: updated })
}
