import type { VercelRequest, VercelResponse } from '@vercel/node'
import createIntention from '../../_server/payments/paymob/create-intention'
import redirect from '../../_server/payments/paymob/redirect'
import webhook from '../../_server/payments/paymob/webhook'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = Array.isArray(req.query.action) ? req.query.action[0] : String(req.query.action || '')
  if (action === 'create-intention') return createIntention(req, res)
  if (action === 'redirect') return redirect(req, res)
  if (action === 'webhook') return webhook(req, res)
  return res.status(404).json({ error: 'Paymob route not found.' })
}
