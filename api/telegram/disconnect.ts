import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticate, getTelegramToken, telegramApi } from '../_server/telegram'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  try {
    const auth = await authenticate(req)
    if (!auth) return res.status(401).json({ error: 'Unauthorized.' })
    const { token } = await getTelegramToken(auth.client, auth.organizationId)
    await telegramApi(token, 'deleteWebhook', { drop_pending_updates: false })
    const { error } = await auth.client
      .from('integrations')
      .update({ connected: false, status: 'disconnected', error_message: null, updated_at: new Date().toISOString() })
      .eq('organization_id', auth.organizationId)
      .eq('provider', 'telegram')
    if (error) throw error
    return res.status(200).json({ connected: false })
  } catch (error: any) {
    console.error('Telegram disconnect failed', error)
    return res.status(400).json({ error: error?.message || 'تعذر إلغاء اتصال Telegram.' })
  }
}
