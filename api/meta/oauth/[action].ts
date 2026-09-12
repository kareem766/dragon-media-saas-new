const handlerLoaders: Record<
  string,
  () => Promise<{ default: any }>
> = {
  start: () =>
    import('../../../src/server/meta/oauth/start'),

  callback: () =>
    import('../../../src/server/meta/oauth/callback'),
}

export default async function handler(
  req: any,
  res: any
) {
  const action = Array.isArray(req.query?.action)
    ? req.query.action[0]
    : req.query?.action

  const loadHandler =
    handlerLoaders[String(action || '')]

  if (!loadHandler) {
    res.status(404).json({
      error: 'Meta OAuth route not found',
    })
    return
  }

  try {
    const module = await loadHandler()
    const routeHandler = module.default

    if (typeof routeHandler !== 'function') {
      res.status(500).json({
        error: 'Meta OAuth handler is invalid',
      })
      return
    }

    return routeHandler(req, res)
  } catch (error) {
    console.error(
      'Meta OAuth handler load failed:',
      error
    )

    res.status(500).json({
      error: 'Internal server error',
    })
  }
}
