import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createDecipheriv, createHash } from 'node:crypto'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'
const env = (...names: string[]) => names.map((name) => process.env[name]).find((value) => value && value.trim())?.trim() || ''
function json(res: VercelResponse, status: number, body: unknown) { return res.status(status).json(body) }

function decryptToken(value: any) {
  if (!value?.iv || !value?.tag || !value?.data) throw new Error('Facebook token is not encrypted in the expected format.')
  const seed = env('META_TOKEN_ENCRYPTION_KEY', 'META_APP_SECRET')
  const key = createHash('sha256').update(seed).digest()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(String(value.iv), 'base64'))
  decipher.setAuthTag(Buffer.from(String(value.tag), 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(String(value.data), 'base64')), decipher.final()]).toString('utf8')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  try {
    const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return json(res, 500, { error: 'Supabase server configuration is incomplete.' })
    const auth = String(req.headers.authorization || '')
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
    if (!bearer) return json(res, 401, { error: 'Authentication required.' })

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: userData, error: userError } = await db.auth.getUser(bearer)
    if (userError || !userData.user) return json(res, 401, { error: 'Invalid authentication token.' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const organizationId = String(body.organizationId || '')
    const conversationId = String(body.conversationId || '')
    const recipientId = String(body.recipientId || '')
    const content = String(body.content || '').trim()
    if (!organizationId || !conversationId || !recipientId || !content) return json(res, 400, { error: 'organizationId, conversationId, recipientId and content are required.' })

    const { data: membership } = await db.from('users').select('id,organization_id,active').eq('id', userData.user.id).eq('organization_id', organizationId).maybeSingle()
    if (!membership || membership.active === false) return json(res, 403, { error: 'You are not a member of this organization.' })

    const { data: connection } = await db.from('integrations').select('config,metadata,status,connected').eq('organization_id', organizationId).eq('provider', 'facebook').maybeSingle()
    if (!connection?.connected || connection.status !== 'connected') return json(res, 422, { error: 'Facebook connection is not ready.', code: 'FACEBOOK_NOT_READY' })
    const pageId = String(connection.metadata?.facebook_page_id || '')
    if (!pageId) return json(res, 422, { error: 'Facebook Page is not configured.', code: 'FACEBOOK_PAGE_NOT_READY' })
    const pageToken = decryptToken(connection.config?.access_token)

    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${pageToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ recipient: { id: recipientId }, message: { text: content } }) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) return json(res, 502, { error: payload?.error?.message || 'Facebook Messenger send failed.', code: 'FACEBOOK_SEND_FAILED' })
    return json(res, 200, { ok: true, external_id: payload?.message_id || payload?.messages?.[0]?.id || null, page_id: pageId, recipient_id: recipientId })
  } catch (error) {
    console.error('Facebook outbound handler failed', error)
    return json(res, 500, { error: error instanceof Error ? error.message : 'Unable to send Facebook message.' })
  }
}
