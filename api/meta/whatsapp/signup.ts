import type { VercelRequest, VercelResponse } from '@vercel/node'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'
const REDIRECT_URI = 'https://dragon-media-saas-new.vercel.app/api/meta/whatsapp/signup'

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed')
  }

  const configId = process.env.META_WHATSAPP_EMBEDDED_CONFIG_ID
  const appId = process.env.META_APP_ID
  const state = typeof req.query.state === 'string' ? req.query.state : ''
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const wabaId = typeof req.query.waba_id === 'string' ? req.query.waba_id : ''
  const phoneNumberId = typeof req.query.phone_number_id === 'string' ? req.query.phone_number_id : ''
  const businessId = typeof req.query.business_id === 'string' ? req.query.business_id : ''

  if (code) {
    const params = new URLSearchParams({ state, code })
    if (wabaId) params.set('waba_id', wabaId)
    if (phoneNumberId) params.set('phone_number_id', phoneNumberId)
    if (businessId) params.set('business_id', businessId)
    return res.redirect(303, `/api/meta/whatsapp/complete?${params.toString()}`)
  }

  if (!configId || !appId) {
    return res.status(500).send('WhatsApp Embedded Signup is not configured.')
  }

  if (!state) {
    return res.status(400).send('Missing OAuth state.')
  }

  // Use Meta's explicit OAuth dialog instead of FB.login().
  // FB.login() can internally choose a redirect_uri that is not
  // controllable by the application, which causes OAuth error 36008.
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    config_id: configId,
    state,
  })

  const authUrl = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`
  return res.redirect(302, authUrl)
}
