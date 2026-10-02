import { createClient } from '@supabase/supabase-js'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'

export const env = (...names: string[]) => names.map((name) => process.env[name]).find((value) => value?.trim())?.trim() || ''
export const text = (value: unknown, max = 4000) => typeof value === 'string' ? value.trim().slice(0, max) : ''
export const obj = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}

const encryptionSeed = () => env('TELEGRAM_TOKEN_ENCRYPTION_KEY', 'META_TOKEN_ENCRYPTION_KEY', 'META_APP_SECRET', 'FACEBOOK_APP_SECRET')
const encryptionKey = () => createHash('sha256').update(encryptionSeed()).digest()

export function encryptSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') }
}

export function decryptSecret(value: unknown) {
  if (typeof value === 'string') return value
  const encrypted = obj(value)
  if (!encrypted.iv || !encrypted.tag || !encrypted.data || !encryptionSeed()) return ''
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(String(encrypted.iv), 'base64'))
    decipher.setAuthTag(Buffer.from(String(encrypted.tag), 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(String(encrypted.data), 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return ''
  }
}

export function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function db() {
  const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY')
  if (!url || !key) throw new Error('Supabase server configuration is incomplete.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function authenticate(req: VercelRequest) {
  const authorization = String(req.headers.authorization || '')
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return null
  const client = db()
  const { data } = await client.auth.getUser(token)
  if (!data?.user) return null
  const { data: membership } = await client.from('users').select('organization_id,active').eq('id', data.user.id).maybeSingle()
  if (!membership?.organization_id || membership.active === false) return null
  return { userId: data.user.id, organizationId: String(membership.organization_id), client }
}

export function requestBaseUrl(req: VercelRequest) {
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim()
  const host = forwardedHost || String(req.headers.host || '').trim()
  const protocol = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https'
  const vercelUrl = env('VERCEL_URL')
  const origin = vercelUrl ? 'https://' + vercelUrl : host ? protocol + '://' + host : ''
  return origin.replace(/\/$/, '')
}

export async function telegramApi(token: string, method: string, body?: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload?.ok !== true) {
    throw new Error(text(payload?.description, 500) || `Telegram API ${method} failed.`)
  }
  return payload
}

export async function findTelegramIntegrationBySecret(client: any, secret: string) {
  const hash = sha256(secret)
  const { data, error } = await client
    .from('integrations')
    .select('id,organization_id,config,metadata,status,connected')
    .eq('provider', 'telegram')
    .eq('connected', true)
    .filter('metadata->>webhook_secret_hash', 'eq', hash)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getTelegramToken(client: any, organizationId: string) {
  const { data, error } = await client
    .from('integrations')
    .select('config,metadata,status,connected')
    .eq('organization_id', organizationId)
    .eq('provider', 'telegram')
    .maybeSingle()
  if (error) throw error
  if (!data?.connected || data.status !== 'connected') throw new Error('Telegram connection is not ready.')
  const token = decryptSecret(obj(data.config).access_token)
  if (!token) throw new Error('Telegram bot token is not available.')
  return { integration: data, token }
}

export async function internalRyanDispatch(req: VercelRequest, organizationId: string, conversationId: string, messageId: string) {
  const secretRow = await db().from('system_secrets').select('value').eq('key', 'ai_agent_inbox_secret').maybeSingle()
  const secret = text(secretRow.data?.value, 300)
  const baseUrl = requestBaseUrl(req)
  if (!secret || !baseUrl) return
  const response = await fetch(`${baseUrl}/api/admin/ryan-inbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ryan-inbox-secret': secret },
    body: JSON.stringify({ organization_id: organizationId, conversation_id: conversationId, message_id: messageId }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(text(payload?.error, 500) || 'Ryan dispatch failed.')
  }
}
