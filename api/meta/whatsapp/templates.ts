import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createDecipheriv, createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'
const env = (...names: string[]) => names.map((name) => process.env[name]).find((value) => value && value.trim())?.trim() || ''

function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body)
}

function decryptToken(value: any) {
  if (!value?.iv || !value?.tag || !value?.data) throw new Error('WhatsApp access token is unavailable.')
  const seed = env('META_TOKEN_ENCRYPTION_KEY', 'META_APP_SECRET')
  if (!seed) throw new Error('Meta token encryption configuration is missing.')
  const key = createHash('sha256').update(seed).digest()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(String(value.iv), 'base64'))
  decipher.setAuthTag(Buffer.from(String(value.tag), 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(String(value.data), 'base64')), decipher.final()]).toString('utf8')
}

async function graph(path: string, token: string) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error?.message || `Meta Graph request failed (${response.status})`)
  return data
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' })

  try {
    const bearer = String(req.headers.authorization || '')
    const token = bearer.startsWith('Bearer ') ? bearer.slice(7).trim() : ''
    if (!token) return json(res, 401, { error: 'Unauthorized.' })

    const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY')
    if (!supabaseUrl || !serviceKey) return json(res, 500, { error: 'Server configuration is incomplete.' })

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: authData, error: authError } = await admin.auth.getUser(token)
    if (authError || !authData.user) return json(res, 401, { error: 'Unauthorized.' })

    const organizationId = String(req.query.organizationId || req.query.organization_id || '')
    if (!organizationId) return json(res, 400, { error: 'organizationId is required.' })

    const { data: member } = await admin.from('users')
      .select('id, organization_id, active, role, is_platform_admin')
      .eq('id', authData.user.id)
      .eq('organization_id', organizationId)
      .eq('active', true)
      .maybeSingle()

    if (!member) return json(res, 403, { error: 'غير مصرح لهذا الحساب.' })
    if (!member.is_platform_admin && !['owner', 'admin', 'مدير', 'مالك'].includes(String(member.role || '').toLowerCase())) {
      return json(res, 403, { error: 'عرض قوالب WhatsApp متاح للمدير فقط.' })
    }

    const { data: integration, error: integrationError } = await admin
      .from('integrations')
      .select('config, metadata')
      .eq('organization_id', organizationId)
      .eq('provider', 'whatsapp')
      .eq('connected', true)
      .maybeSingle()

    if (integrationError || !integration) return json(res, 400, { error: 'WhatsApp غير متصل.' })

    const wabaId = String(integration.metadata?.waba_id || '')
    if (!wabaId) return json(res, 400, { error: 'WABA ID غير موجود.' })

    const accessToken = decryptToken(integration.config?.access_token)
    const data = await graph(`/${encodeURIComponent(wabaId)}/message_templates?limit=100`, accessToken)

    const templates = Array.isArray(data?.data) ? data.data : []
    const approved = templates.filter((template: any) => String(template?.status || '').toUpperCase() === 'APPROVED')

    return json(res, 200, {
      ok: true,
      waba_id: wabaId,
      templates: approved.map((template: any) => ({
        id: template.id || null,
        name: template.name || '',
        language: template.language || '',
        status: template.status || '',
        category: template.category || '',
        components: Array.isArray(template.components) ? template.components : [],
      })),
      paging: data?.paging || null,
      total: approved.length,
    })
  } catch (error) {
    console.error('WhatsApp templates fetch failed', error)
    return json(res, 400, { error: error instanceof Error ? error.message : 'فشل جلب قوالب WhatsApp.' })
  }
}
