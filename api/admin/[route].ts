import auditLogs from '../../server/admin/audit-logs'
import financial from '../../server/admin/financial'
import organizations from '../../server/admin/organizations'
import overview from '../../server/admin/overview'
import payments from '../../server/admin/payments'
import tickets from '../../server/admin/tickets'

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
