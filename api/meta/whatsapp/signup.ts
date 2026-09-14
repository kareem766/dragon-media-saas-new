import type {
  VercelRequest,
  VercelResponse,
} from '@vercel/node'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export default function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader(
    'Content-Type',
    'text/html; charset=utf-8',
  )

  res.setHeader(
    'Cache-Control',
    'no-store',
  )

  if (req.method !== 'GET') {
    return res
      .status(405)
      .send('Method not allowed')
  }

  const configId =
    process.env.META_WHATSAPP_EMBEDDED_CONFIG_ID

  const appId =
    process.env.META_APP_ID

  const redirectUri =
    process.env.META_REDIRECT_URI

  const graphVersion =
    process.env.META_GRAPH_API_VERSION ||
    'v23.0'

  const state =
    typeof req.query.state === 'string'
      ? req.query.state
      : ''

  if (
    !configId ||
    !appId ||
    !redirectUri ||
    !state
  ) {
    return res.status(500).send(
      'WhatsApp Embedded Signup is not configured.',
    )
  }

  const safeConfigId =
    escapeHtml(configId)

  const safeAppId =
    escapeHtml(appId)

  const safeRedirectUri =
    escapeHtml(redirectUri)

  const safeGraphVersion =
    escapeHtml(graphVersion)

  const safeState =
    escapeHtml(state)

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />
  <title>ربط WhatsApp Business — Dragon Media</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at top, #172554 0, #020617 55%, #000 100%);
      color: #fff;
      font-family: Arial, Tahoma, sans-serif;
      padding: 24px;
    }
    .card {
      width: min(520px, 100%);
      background: rgba(15, 23, 42, 0.94);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 24px;
      padding: 36px;
      text-align: center;
      box-shadow: 0 25px 80px rgba(0,0,0,.45);
    }
    .logo {
      width: 64px;
      height: 64px;
      margin: 0 auto 20px;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #2563eb;
      font-weight: 800;
      font-size: 24px;
    }
    h1 { margin: 0 0 12px; font-size: 25px; }
    p { color: #cbd5e1; line-height: 1.8; margin: 0 0 24px; }
    button {
      width: 100%;
      border: 0;
      border-radius: 14px;
      padding: 15px 20px;
      background: #2563eb;
      color: #fff;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
    }
    button:disabled { opacity: .6; cursor: wait; }
    .status {
      margin-top: 18px;
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.7;
      white-space: pre-wrap;
    }
    .error { color: #fca5a5; }
  </style>
</head>
<body>
  <main class="card">
    <div class="logo">DM</div>
    <h1>ربط WhatsApp Business</h1>
    <p>
      سيتم فتح إعداد WhatsApp Business الرسمي من Meta.
      بعد إتمام الربط ستتم إعادة توجيهك تلقائيًا إلى Dragon Media.
    </p>
    <button id="connect">متابعة ربط WhatsApp</button>
    <div id="status" class="status">جاري تجهيز الاتصال...</div>
  </main>

  <script>
    const CONFIG_ID = ${JSON.stringify(safeConfigId)};
    const APP_ID = ${JSON.stringify(safeAppId)};
    const REDIRECT_URI = ${JSON.stringify(safeRedirectUri)};
    const GRAPH_VERSION = ${JSON.stringify(safeGraphVersion)};
    const STATE = ${JSON.stringify(safeState)};

    const statusEl = document.getElementById('status');
    const button = document.getElementById('connect');

    function setStatus(message, className = '') {
      if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'status ' + className;
      }
    }

    function launchSignup() {
      if (button) button.disabled = true;

      setStatus('جاري فتح إعداد WhatsApp الرسمي من Meta...');

      const params = new URLSearchParams({
        client_id: APP_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        state: STATE,
        config_id: CONFIG_ID,
      });

      const oauthUrl =
        'https://www.facebook.com/' +
        GRAPH_VERSION +
        '/dialog/oauth?' +
        params.toString();

      window.location.replace(oauthUrl);
    }

    if (button) {
      button.addEventListener('click', launchSignup);
    }

    setStatus('جاهز لبدء ربط WhatsApp.');
  </script>
</body>
</html>`

  return res
    .status(200)
    .send(html)
}
