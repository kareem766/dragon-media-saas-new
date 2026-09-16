import type { VercelRequest, VercelResponse } from '@vercel/node'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'
const REDIRECT_URI = process.env.META_REDIRECT_URI || 'https://dragon-media-saas-new.vercel.app/api/meta/oauth/callback'

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') return res.status(405).send('Method not allowed')

  const configId = process.env.META_WHATSAPP_EMBEDDED_CONFIG_ID
  const appId = process.env.META_APP_ID
  const state = typeof req.query.state === 'string' ? req.query.state : ''

  if (!configId || !appId) {
    return res.status(500).json({ error: 'WhatsApp Embedded Signup is not configured.' })
  }

  if (!state) {
    return res.status(400).json({ error: 'Missing OAuth state.' })
  }

  // Use the manual OAuth dialog so the redirect_uri is explicit and identical
  // to the URI used by the server-side token exchange in oauth/callback.ts.
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    state,
    config_id: configId,
  })

  const authUrl = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`
  return res.redirect(302, authUrl)
}
