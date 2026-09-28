import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const json = (res: VercelResponse, status: number, body: unknown) => res.status(status).json(body)

async function getAdmin(req: VercelRequest) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_KEY
  if (!token || !url || !anon || !service) return null

  const userClient = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: authData, error: authError } = await userClient.auth.getUser(token)
  if (authError || !authData?.user) return null

  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: caller } = await admin.from('users').select('is_platform_admin, active').eq('id', authData.user.id).maybeSingle()
  if (!caller?.is_platform_admin || caller.active === false) return null
  return { admin, userId: authData.user.id }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const access = await getAdmin(req)
  if (!access) return json(res, 403, { error: 'هذه العملية مخصصة لمدير المنصة فقط' })

  const { admin, userId } = access

  try {
    if (req.method === 'GET') {
      const { data, error } = await admin
        .from('platform_features')
        .select('feature_key,label,description,category,enabled,sort_order,updated_at')
        .order('sort_order', { ascending: true })
      if (error) return json(res, 500, { error: error.message })
      return json(res, 200, { features: data || [] })
    }

    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
      const featureKey = String(body.feature_key || '').trim()
      if (!featureKey) return json(res, 400, { error: 'معرّف الميزة مطلوب' })
      if (featureKey === 'dashboard' && body.enabled === false) {
        return json(res, 400, { error: 'لا يمكن إيقاف الرئيسية من مركز التحكم.' })
      }
      if (typeof body.enabled !== 'boolean') return json(res, 400, { error: 'حالة الميزة غير صالحة' })

      const { data: before } = await admin.from('platform_features').select('*').eq('feature_key', featureKey).maybeSingle()
      if (!before) return json(res, 404, { error: 'الميزة غير موجودة' })

      const { data: updated, error } = await admin
        .from('platform_features')
        .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
        .eq('feature_key', featureKey)
        .select('feature_key,label,description,category,enabled,sort_order,updated_at')
        .single()

      if (error) return json(res, 500, { error: error.message })

      await admin.from('audit_logs').insert({
        actor_id: userId,
        organization_id: null,
        action: 'update',
        entity: 'platform_feature',
        entity_id: featureKey,
        resource_type: 'platform_feature',
        resource_id: featureKey,
        resource_name: before.label,
        old_value: { enabled: before.enabled },
        new_value: { enabled: updated.enabled },
        details: { action_ar: updated.enabled ? 'تفعيل ميزة على مستوى المنصة' : 'إيقاف ميزة على مستوى المنصة' },
      })

      return json(res, 200, { feature: updated })
    }

    return json(res, 405, { error: 'Method not allowed' })
  } catch (error: any) {
    console.error('platform features admin error', error)
    return json(res, 500, { error: error?.message || 'حدث خطأ في إعدادات مميزات المنصة' })
  }
}
