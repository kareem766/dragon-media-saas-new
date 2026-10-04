import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const success = String(req.query.success || '').toLowerCase() === 'true'
  const pending = String(req.query.pending || '').toLowerCase() === 'true'
  const status = success ? 'success' : pending ? 'pending' : 'failed'
  return res.redirect(302, `/#/billing?paymob_status=${status}`)
}
