import type { VercelRequest, VercelResponse } from '@vercel/node'

import auditLogs from '../../src/server/admin/audit-logs'
import financial from '../../src/server/admin/financial'
import organizations from '../../src/server/admin/organizations'
import overview from '../../src/server/admin/overview'
import payments from '../../src/server/admin/payments'
import tickets from '../../src/server/admin/tickets'

type Handler = (
  req: VercelRequest,
  res: VercelResponse
) => unknown | Promise<unknown>

const handlers: Record<string, Handler> = {
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
  const route = Array.isArray(req.query?.route)
    ? req.query.route[0]
    : req.query?.route

  const routeName = String(route || '')
  const routeHandler = handlers[routeName]

  if (!routeHandler) {
    res.status(404).json({
      error: 'Admin API route not found',
    })
    return
  }

  try {
    return await routeHandler(req, res)
  } catch (error) {
    console.error(
      `Admin API route "${routeName}" failed:`,
      error
    )

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
      })
    }
  }
}
