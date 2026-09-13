import type {
  VercelRequest,
  VercelResponse,
} from '@vercel/node'

const auditLogsModule = require('../../src/server/admin/audit-logs')
const financialModule = require('../../src/server/admin/financial')
const organizationsModule = require('../../src/server/admin/organizations')
const overviewModule = require('../../src/server/admin/overview')
const paymentsModule = require('../../src/server/admin/payments')
const ticketsModule = require('../../src/server/admin/tickets')

const auditLogs =
  auditLogsModule?.default ?? auditLogsModule

const financial =
  financialModule?.default ?? financialModule

const organizations =
  organizationsModule?.default ?? organizationsModule

const overview =
  overviewModule?.default ?? overviewModule

const payments =
  paymentsModule?.default ?? paymentsModule

const tickets =
  ticketsModule?.default ?? ticketsModule

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
