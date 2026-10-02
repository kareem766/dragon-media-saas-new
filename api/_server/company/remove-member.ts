import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const json = (res: VercelResponse, status: number, body: Record<string, unknown>) =>
  res.status(status).json(body)

export default async function removeMember(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  const accessToken = String(req.headers.authorization || '').replace(/^Bearer\\s+/i, '').trim()
  const supabaseUrl = String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
  const serviceKey = String(
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ''
  ).trim()

  if (!accessToken || !supabaseUrl || !serviceKey) {
    console.error('[remove-member] configuration/auth header missing', {
      hasAccessToken: Boolean(accessToken),
      accessTokenLength: accessToken.length,
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceKey: Boolean(serviceKey),
    })
    return json(res, 500, { error: 'تعذر التحقق من جلسة تسجيل الدخول. حاول مرة أخرى.' })
  }

  const targetUserId = String(req.body?.user_id || '').trim()
  if (!targetUserId) return json(res, 400, { error: 'معرف الموظف مطلوب' })

  // Verify the caller's access token with the service client. This avoids
  // depending on the browser publishable/anon key for a sensitive company
  // management action and keeps authorization checks server-side.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: authData, error: authError } = await admin.auth.getUser(accessToken)
  if (authError || !authData.user) {
    console.error('[remove-member] token verification failed', {
      message: authError?.message || 'no user returned',
      status: authError?.status || null,
      code: authError?.code || null,
      accessTokenLength: accessToken.length,
    })
    return json(res, 401, { error: 'انتهت جلسة تسجيل الدخول' })
  }

  const actorId = authData.user.id

  const { data: actor, error: actorError } = await admin
    .from('users')
    .select('id, organization_id, role, active, is_platform_admin')
    .eq('id', actorId)
    .maybeSingle()

  if (actorError || !actor) return json(res, 403, { error: 'لا يمكن التحقق من صلاحيات الحساب' })
  if (!actor.organization_id || actor.active === false || actor.is_platform_admin) {
    return json(res, 403, { error: 'غير مصرح لك بإدارة موظفي الشركة' })
  }
  if (actor.role !== 'super_admin') {
    return json(res, 403, { error: 'فقط صاحب الشركة يستطيع إزالة الموظفين' })
  }
  if (targetUserId === actorId) {
    return json(res, 400, { error: 'لا يمكنك إزالة حسابك من الشركة' })
  }

  const { data: target, error: targetError } = await admin
    .from('users')
    .select('id, organization_id, full_name, email, role, active, is_platform_admin')
    .eq('id', targetUserId)
    .maybeSingle()

  if (targetError || !target) return json(res, 404, { error: 'الموظف غير موجود' })
  if (target.organization_id !== actor.organization_id) {
    return json(res, 403, { error: 'لا يمكنك إزالة موظف من شركة أخرى' })
  }
  if (target.is_platform_admin || target.role === 'super_admin') {
    return json(res, 403, { error: 'لا يمكن إزالة صاحب الشركة أو مدير المنصة من خلال هذه العملية' })
  }

  const { error: updateError } = await admin
    .from('users')
    .update({ organization_id: null, active: false })
    .eq('id', targetUserId)
    .eq('organization_id', actor.organization_id)

  if (updateError) {
    console.error('[remove-member] update failed', updateError)
    return json(res, 500, { error: 'تعذر إزالة الموظف. حاول مرة أخرى.' })
  }

  const { error: auditError } = await admin
    .from('audit_logs')
    .insert({
      actor_id: actorId,
      organization_id: actor.organization_id,
      action: 'remove',
      entity: 'user',
      entity_id: targetUserId,
      resource_type: 'team_member',
      resource_id: targetUserId,
      resource_name: target.full_name,
      old_value: {
        organization_id: actor.organization_id,
        active: target.active,
        role: target.role,
      },
      new_value: {
        organization_id: null,
        active: false,
      },
      details: {
        action_ar: 'إزالة موظف من الشركة',
        email: target.email,
      },
    })

  if (auditError) {
    console.error('[remove-member] audit log failed', auditError)
  }

  return json(res, 200, {
    success: true,
    message: 'تمت إزالة الموظف من الشركة بنجاح',
    user_id: targetUserId,
  })
}
