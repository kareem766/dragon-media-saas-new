import start from '../../../src/server/meta/oauth/start'
import callback from '../../../src/server/meta/oauth/callback'

const handlers: Record<string, any> = {
  start,
  callback,
}

export default async function handler(
  req: any,
  res: any
) {
  const action = Array.isArray(req.query?.action)
    ? req.query.action[0]
    : req.query?.action

  const routeHandler = handlers[String(action || '')]

  if (!routeHandler) {
    res.status(404).json({
      error: 'Meta OAuth route not found',
    })
    return
  }

  return routeHandler(req, res)
}
