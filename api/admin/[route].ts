const handlerLoaders: Record<
  string,
  () => Promise<{ default: any }>
> = {
  'audit-logs': () =>
    import('../../src/server/admin/audit-logs'),

  financial: () =>
    import('../../src/server/admin/financial'),

  organizations: () =>
    import('../../src/server/admin/organizations'),

  overview: () =>
    import('../../src/server/admin/overview'),

  payments: () =>
    import('../../src/server/admin/payments'),

  tickets: () =>
    import('../../src/server/admin/tickets'),
}

export default async function handler(
  req: any,
  res: any
) {
  const route = Array.isArray(req.query?.route)
    ? req.query.route[0]
    : req.query?.route

  const loadHandler =
    handlerLoaders[String(route || '')]

  if (!loadHandler) {
    res.status(404).json({
      error: 'Admin API route not found',
    })
    return
  }

  try {
    const module = await loadHandler()
    const routeHandler = module.default

    if (typeof routeHandler !== 'function') {
      res.status(500).json({
        error: 'Admin API handler is invalid',
      })
      return
    }

    return routeHandler(req, res)
  } catch (error) {
    console.error(
      'Admin API handler load failed:',
      error
    )

    res.status(500).json({
      error: 'Internal server error',
    })
  }
}
