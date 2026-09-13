import type {
  VercelRequest,
  VercelResponse,
} from '@vercel/node'

import auditLogs from '../../src/server/admin/audit-logs.ts'
import financial from '../../src/server/admin/financial.ts'
import organizations from '../../src/server/admin/organizations.ts'
import overview from '../../src/server/admin/overview.ts'
import payments from '../../src/server/admin/payments.ts'
import tickets from '../../src/server/admin/tickets.ts'

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
  const route = Array.isArray(req.query?.route)
    ? req.query.route[0]
    : req.query?.route

  const routeHandler =
    handlers[String(route || '')]

  if (!routeHandler) {
    return res.status(404).json({
      error: 'Admin API route not found',
    })
  }

  try {
    return await routeHandler(req, res)
  } catch (error: unknown) {
    console.error(
      `Admin API route "${String(route || '')}" error:`,
      error
    )

    if (!res.headersSent) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'حدث خطأ في خادم الإدارة.'

      return res.status(500).json({
        error: message,
      })
    }

    return undefined
  }
}
