import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticate, db, encryptSecret, requestBaseUrl, sha256, telegramApi, text } from '../_server/telegram'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  try {
    const auth = await authenticate(req)
    if (!auth) return res.status(401).json({ error: 'Unauthorized.' })

    const token = text(req.body?.bot_token, 300)
    if (!token || !/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) {
      return res.status(400).json({ error: 'أدخل Bot Token صحيح من BotFather.' })
    }

    const me = await telegramApi(token, 'getMe')
    const bot = me.result
    const baseUrl = requestBaseUrl(req)
    if (!baseUrl) return res.status(500).json({ error: 'تعذر تحديد عنوان Preview الحالي.' })

    const webhookUrl = `${baseUrl}/api/telegram/webhook`
    const webhookSecret = cryptoRandomSecret()
    await telegramApi(token, 'setWebhook', {
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ['message'],
      drop_pending_updates: false,
    })

    const client = auth.client
    const { data: existing } = await client.from('integrations').select('id').eq('organization_id', auth.organizationId).eq('provider', 'telegram').maybeSingle()
    const record = {
      organization_id: auth.organizationId,
      provider: 'telegram',
      connected: true,
      status: 'connected',
      config: { access_token: encryptSecret(token), webhook_secret: encryptSecret(webhookSecret) },
      metadata: {
        provider: 'telegram',
        bot_id: String(bot.id),
        bot_username: bot.username || null,
        bot_name: bot.first_name || null,
        webhook_url: webhookUrl,
        webhook_secret_hash: sha256(webhookSecret),
        webhook_configured: true,
      },
      connected_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      error_message: null,
      updated_at: new Date().toISOString(),
    }

    const result = existing?.id
      ? await client.from('integrations').update(record).eq('id', existing.id).select('id,provider,connected,status,metadata,connected_at,last_verified_at').single()
      : await client.from('integrations').insert(record).select('id,provider,connected,status,metadata,connected_at,last_verified_at').single()

    if (result.error) throw result.error

    return res.status(200).json({ connected: true, integration: result.data })
  } catch (error: any) {
    console.error('Telegram connect failed', error)
    return res.status(400).json({ error: error?.message || 'تعذر ربط Telegram.' })
  }
}

function cryptoRandomSecret() {
  return require('node:crypto').randomBytes(32).toString('hex')
}
