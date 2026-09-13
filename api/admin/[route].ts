import auditLogs from '../../src/server/admin/audit-logs.ts'
import financial from '../../src/server/admin/financial.ts'
import organizations from '../../src/server/admin/organizations.ts'
import overview from '../../src/server/admin/overview.ts'
import payments from '../../src/server/admin/payments.ts'
import tickets from '../../src/server/admin/tickets.ts'

const handlers: Record<string, any> = {
  'audit-logs': auditLogs,
  financial,
  organizations,
  overview,
  payments,
  tickets,
}

export default async function handler(
  req: any,
  res: any
) {
  const route = Array.isArray(req.query?.route)
    ? req.query.route[0]
    : req.query?.route

  const routeHandler = handlers[String(route || '')]

  if (!routeHandler) {
    res.status(404).json({
      error: 'Admin API route not found',
    })
    return
  }

  return routeHandler(req, res)
}
