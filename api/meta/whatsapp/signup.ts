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
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') return res.status(405).send('Method not allowed')

  const configId = process.env.META_WHATSAPP_EMBEDDED_CONFIG_ID
  const appId = process.env.META_APP_ID
  const graphVersion = process.env.META_GRAPH_API_VERSION || 'v23.0'
  const configuredRedirectUri = process.env.META_REDIRECT_URI
  const state = typeof req.query.state === 'string' ? req.query.state : ''

  if (!configId || !appId || !configuredRedirectUri || !state) {
    return res.status(500).send('WhatsApp Embedded Signup is not configured.')
  }

  const redirectUri = configuredRedirectUri.trim()
  const safeAppId = escapeHtml(appId)
  const safeConfigId = escapeHtml(configId)
  const safeGraphVersion = escapeHtml(graphVersion)
  const safeRedirectUri = escapeHtml(redirectUri)
  const safeState = escapeHtml(state)

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ربط WhatsApp Business — Dragon Media</title>
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at top,#172554 0,#020617 55%,#000 100%);color:#fff;font-family:Arial,Tahoma,sans-serif;padding:24px}.card{width:min(520px,100%);background:rgba(15,23,42,.94);border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:36px;text-align:center;box-shadow:0 25px 80px rgba(0,0,0,.45)}.logo{width:64px;height:64px;margin:0 auto 20px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:#2563eb;font-weight:800;font-size:24px}h1{margin:0 0 12px;font-size:25px}p{color:#cbd5e1;line-height:1.8;margin:0 0 24px}button{width:100%;border:0;border-radius:14px;padding:15px 20px;background:#2563eb;color:#fff;font-size:16px;font-weight:700;cursor:pointer}button:disabled{opacity:.6;cursor:wait}.status{margin-top:18px;color:#94a3b8;font-size:14px;line-height:1.7;white-space:pre-wrap}.error{color:#fca5a5}
  </style>
</head>
<body>
  <main class="card">
    <div class="logo">DM</div>
    <h1>ربط WhatsApp Business</h1>
    <p>سيتم تحويلك إلى صفحة Meta الرسمية لإكمال الربط، ثم ستعود تلقائيًا إلى Dragon Media.</p>
    <button id="connect">ربط WhatsApp الآن</button>
    <div id="status" class="status">جاهز لبدء الربط.</div>
  </main>
  <script>
    const APP_ID = ${JSON.stringify(safeAppId)};
    const CONFIG_ID = ${JSON.stringify(safeConfigId)};
    const GRAPH_VERSION = ${JSON.stringify(safeGraphVersion)};
    const REDIRECT_URI = ${JSON.stringify(safeRedirectUri)};
    const STATE = ${JSON.stringify(safeState)};
    const button = document.getElementById('connect');
    const status = document.getElementById('status');

    try { sessionStorage.setItem('dragon_meta_whatsapp_state', STATE); } catch {}

    function start() {
      button.disabled = true;
      status.textContent = 'جاري فتح صفحة Meta الرسمية...';

      const params = new URLSearchParams({
        client_id: APP_ID,
        redirect_uri: REDIRECT_URI,
        state: STATE,
        response_type: 'code',
        override_default_response_type: 'true',
        config_id: CONFIG_ID,
        auth_type: 'rerequest',
        scope: 'business_management,whatsapp_business_management,whatsapp_business_messaging',
        extras: JSON.stringify({ sessionInfoVersion: 3 }),
      });

      // Embedded Signup requires the response-type override and session
      // metadata when launched through the OAuth redirect flow. Keep the
      // redirect URI fixed and identical to the server-side code exchange.
      window.location.assign(
        'https://www.facebook.com/' + GRAPH_VERSION + '/dialog/oauth?' + params.toString()
      );
    }

    button.addEventListener('click', start);
  </script>
</body>
</html>`

  return res.status(200).send(html)
}
