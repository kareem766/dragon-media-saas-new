import type {
  VercelRequest,
  VercelResponse,
} from '@vercel/node'

import auditLogs from '../../src/server/admin/audit-logs'
import financial from '../../src/server/admin/financial'
import organizations from '../../src/server/admin/organizations'
import overview from '../../src/server/admin/overview'
import payments from '../../src/server/admin/payments'
import tickets from '../../src/server/admin/tickets'

const handlers: Record<
  string,
  (
    req: VercelRequest,
    res: VercelResponse
  ) => unknown | Promise<unknown>
> = {
  'audit-logs': auditLogs,
  financial,
  organizations,
  overview,
  payments,
  tickets,
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const route = Array.isArray(
    req.query?.route
  )
    ? req.query.route[0]
    : req.query?.route

  const routeHandler =
    handlers[String(route || '')]

  if (!routeHandler) {
    return res.status(404).json({
      error: 'Admin API route not found',
    })
  }

  return routeHandler(req, res)
}
