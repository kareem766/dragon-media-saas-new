import type { VercelRequest, VercelResponse } from '@vercel/node'
import auditLogs from '../_server/admin/audit-logs.js'
import financial from '../_server/admin/financial.js'
import organizations from '../_server/admin/organizations.js'
import overview from '../_server/admin/overview.js'
import payments from '../_server/admin/payments.js'
import tickets from '../_server/admin/tickets.js'

type Handler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>

const handlers: Record<string, Handler> = {
  'audit-logs': auditLogs,
  financial,
  organizations,
  overview,
  payments,
  tickets,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const routeValue = req.query.route
  const route = Array.isArray(routeValue) ? routeValue[0] : routeValue
  const routeHandler = handlers[String(route || '')]
  if (!routeHandler) return res.status(404).json({ error: 'Admin API route not found' })
  try {
    return await routeHandler(req, res)
  } catch (error: any) {
    console.error(`Admin route ${String(route)} failed`, error)
    if (!res.headersSent) return res.status(500).json({ error: error?.message || 'حدث خطأ في Admin API' })
    return undefined
  }
}
