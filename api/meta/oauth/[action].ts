import type { VercelRequest, VercelResponse } from '@vercel/node'

import start from '../../../src/server/meta/oauth/start'
import callback from '../../../src/server/meta/oauth/callback'

type Handler = (
  req: VercelRequest,
  res: VercelResponse
) => unknown | Promise<unknown>

const handlers: Record<string, Handler> = {
  start,
  callback,
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const action = Array.isArray(req.query?.action)
    ? req.query.action[0]
    : req.query?.action

  const actionName = String(action || '')
  const routeHandler = handlers[actionName]

  if (!routeHandler) {
    res.status(404).json({
      error: 'Meta OAuth route not found',
    })
    return
  }

  try {
    return await routeHandler(req, res)
  } catch (error) {
    console.error(
      `Meta OAuth route "${actionName}" failed:`,
      error
    )

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
      })
    }
  }
}
