import type { VercelRequest, VercelResponse } from '@vercel/node'
import callback from '../../_server/meta/facebook/callback'
import send from '../../_server/meta/facebook/send'
import start from '../../_server/meta/facebook/start'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = Array.isArray(req.query.action) ? req.query.action[0] : String(req.query.action || '')
  if (action === 'callback') return callback(req, res)
  if (action === 'send') return send(req, res)
  if (action === 'start') return start(req, res)
  return res.status(404).json({ error: 'Facebook route not found.' })
}
