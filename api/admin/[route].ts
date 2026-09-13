import auditLogs from '../_server/admin/_audit-logs.ts'
import financial from '../_server/admin/_financial.ts'
import organizations from '../_server/admin/_organizations.ts'
import overview from '../_server/admin/_overview.ts'
import payments from '../_server/admin/_payments.ts'
import tickets from '../_server/admin/_tickets.ts'

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
