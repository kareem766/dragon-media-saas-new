import { createClient } from '@supabase/supabase-js'

const env = (...names: string[]) =>
  names.map((name) => process.env[name]).find((value) => value && value.trim())?.trim() || ''

function json(res: any, status: number, body: unknown) {
  return res.status(status).json(body)
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' })

  try {
    const authorization = String(req.headers.authorization || '')
    const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || ''
    const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY')

    if (!bearerToken || !supabaseUrl || !serviceKey) return json(res, 401, { error: 'Unauthorized.' })

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: authData, error: authError } = await admin.auth.getUser(bearerToken)
    if (authError || !authData.user) return json(res, 401, { error: 'Unauthorized.' })

    const userId = authData.user.id
    const { data: linkedUser, error: linkedUserError } = await admin
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (linkedUserError) return json(res, 500, { error: 'تعذر التحقق من حالة الحساب.' })
    if (linkedUser) return json(res, 409, { error: 'الحساب مرتبط بمساحة عمل بالفعل.' })

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId, false)
    if (deleteError) return json(res, 500, { error: 'تعذر إلغاء الحساب غير المكتمل.' })

    return json(res, 200, { success: true })
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : 'تعذر إلغاء الحساب غير المكتمل.',
    })
  }
}
