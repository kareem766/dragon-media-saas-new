import type { VercelRequest, VercelResponse } from '@vercel/node'

const META_WHATSAPP_REDIRECT_URI = 'https://dragon-media-saas-new.vercel.app/api/meta/oauth/callback'

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') return res.status(405).send('Method not allowed')

  const configId = process.env.META_WHATSAPP_EMBEDDED_CONFIG_ID
  const appId = process.env.META_APP_ID
  const graphVersion = process.env.META_GRAPH_API_VERSION || 'v23.0'
  const queryState = typeof req.query.state === 'string' ? req.query.state : ''

  if (!configId || !appId) {
    return res.status(500).send('WhatsApp Embedded Signup is not configured.')
  }

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
    <p>سيتم فتح عملية الربط الرسمية من Meta. بعد إتمامها ستعود تلقائيًا إلى Dragon Media.</p>
    <button id="connect" disabled>فتح ربط WhatsApp</button>
    <div id="status" class="status">جاري تجهيز خدمة Meta...</div>
  </main>
  <script>
    const APP_ID = ${JSON.stringify(appId)};
    const CONFIG_ID = ${JSON.stringify(configId)};
    const GRAPH_VERSION = ${JSON.stringify(graphVersion)};
    const REDIRECT_URI = ${JSON.stringify(META_WHATSAPP_REDIRECT_URI)};
    const STATE = ${JSON.stringify(queryState)};

    const statusEl = document.getElementById('status');
    const button = document.getElementById('connect');

    function setStatus(message, className = '') {
      statusEl.textContent = message;
      statusEl.className = 'status ' + className;
    }

    function launchSignup() {
      if (!STATE) {
        setStatus('تعذر التحقق من جلسة الربط. أعد المحاولة من الإعدادات.', 'error');
        return;
      }

      button.disabled = true;
      setStatus('جاري فتح عملية الربط الرسمية من Meta...');

      // Manual OAuth keeps the redirect_uri explicit and identical in both
      // the authorization request and the server-side token exchange.
      const params = new URLSearchParams({
        client_id: APP_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        config_id: CONFIG_ID,
        state: STATE,
        override_default_response_type: 'true',
      });

      window.location.replace(
        'https://www.facebook.com/' + GRAPH_VERSION + '/dialog/oauth?' + params.toString()
      );
    }

    button.disabled = false;
    button.addEventListener('click', launchSignup);
    setStatus('جاهز لبدء ربط WhatsApp.');
  </script>
</body>
</html>`

  return res.status(200).send(html)
}
