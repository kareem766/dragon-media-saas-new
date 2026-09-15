import type { VercelRequest, VercelResponse } from '@vercel/node'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') return res.status(405).send('Method not allowed')

  const configId = process.env.META_WHATSAPP_EMBEDDED_CONFIG_ID
  const appId = process.env.META_APP_ID
  const graphVersion = process.env.META_GRAPH_API_VERSION || 'v23.0'
  const state = typeof req.query.state === 'string' ? req.query.state : ''
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const error = typeof req.query.error === 'string' ? req.query.error : ''
  const errorDescription = typeof req.query.error_description === 'string' ? req.query.error_description : ''
  const returnedState = typeof req.query.state === 'string' ? req.query.state : state

  if (!configId || !appId) {
    return res.status(500).send('WhatsApp OAuth is not configured.')
  }

  // OAuth callback: Meta returns the authorization code to this same endpoint.
  // The server-side complete endpoint performs the secure code exchange.
  if (code && returnedState) {
    const payload = JSON.stringify({ state: returnedState, code })
    const safePayload = escapeHtml(payload)
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تأكيد ربط WhatsApp — Dragon Media</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#020617;color:#fff;font-family:Arial,Tahoma,sans-serif;padding:24px}.card{width:min(520px,100%);background:#0f172a;border:1px solid #334155;border-radius:24px;padding:36px;text-align:center}.status{color:#cbd5e1;line-height:1.8}.error{color:#fca5a5}</style></head><body><main class="card"><h1>جاري تأكيد ربط WhatsApp</h1><p id="status" class="status">جاري تأكيد الحساب مع Meta...</p><script>const payload=${safePayload};(async()=>{try{const r=await fetch('/api/meta/whatsapp/complete',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},cache:'no-store',body:payload});const t=r.headers.get('content-type')||'';const d=t.includes('application/json')?await r.json().catch(()=>null):{error:await r.text().catch(()=>null)};if(!r.ok)throw new Error(d?.error||'تعذر إكمال ربط WhatsApp.');document.getElementById('status').textContent='تم ربط WhatsApp بنجاح. جارٍ العودة إلى الإعدادات...';setTimeout(()=>location.replace('/#/settings?tab=إعدادات%20واتساب&meta=success'),500)}catch(e){document.getElementById('status').textContent=e instanceof Error?e.message:'تعذر إكمال ربط WhatsApp.';document.getElementById('status').className='status error'}})();</script></main></body></html>`
    return res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(html)
  }

  if (error) {
    const message = escapeHtml(errorDescription || error || 'تم إلغاء أو رفض ربط WhatsApp من Meta.')
    return res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>فشل ربط WhatsApp</title></head><body style="font-family:Arial,Tahoma,sans-serif;background:#020617;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px"><main style="max-width:520px;background:#0f172a;border:1px solid #334155;border-radius:24px;padding:32px;text-align:center"><h1>تعذر ربط WhatsApp</h1><p style="color:#fca5a5;line-height:1.8">${message}</p><p style="color:#94a3b8">يمكنك إغلاق هذه الصفحة والعودة إلى إعدادات Dragon Media.</p></main></body></html>`)
  }

  if (!state) {
    return res.status(400).send('Missing OAuth state.')
  }

  const redirectUri = `${new URL(req.url || '/', `https://${req.headers.host}`).origin}/api/meta/whatsapp/signup`
  const extras = JSON.stringify({ setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' })
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    config_id: configId,
    response_type: 'code',
    override_default_response_type: 'true',
    state,
    extras,
  })

  const oauthUrl = `https://www.facebook.com/${graphVersion}/dialog/oauth?${params.toString()}`
  return res.redirect(302, oauthUrl)
}
