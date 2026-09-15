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

  const graphVersion =
    process.env.META_GRAPH_API_VERSION ||
    'v23.0'

  const state =
    typeof req.query.state === 'string'
      ? req.query.state
      : ''

  if (!configId || !appId || !state) {
    return res.status(500).send(
      'WhatsApp Embedded Signup is not configured.',
    )
  }

  const safeConfigId = escapeHtml(configId)
  const safeAppId = escapeHtml(appId)
  const safeGraphVersion = escapeHtml(graphVersion)
  const safeState = escapeHtml(state)

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
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
    .success { color: #86efac; }
  </style>
</head>
<body>
  <main class="card">
    <div class="logo">DM</div>
    <h1>ربط WhatsApp Business</h1>
    <p>
      سيتم فتح نافذة الربط الرسمية من Meta.
      بعد إتمام الربط سيعود الحساب إلى Dragon Media تلقائيًا.
    </p>
    <button id="connect" disabled>فتح ربط WhatsApp</button>
    <div id="status" class="status">جاري تحميل خدمة Meta...</div>
  </main>

  <script>
    const APP_ID = ${JSON.stringify(safeAppId)};
    const CONFIG_ID = ${JSON.stringify(safeConfigId)};
    const GRAPH_VERSION = ${JSON.stringify(safeGraphVersion)};
    const STATE = ${JSON.stringify(safeState)};

    const REDIRECT_URI =
      window.location.origin + '/api/meta/whatsapp/signup';

    const statusEl = document.getElementById('status');
    const button = document.getElementById('connect');

    let sessionInfo = null;
    let authorizationCode = null;
    let submitted = false;

    function setStatus(message, className = '') {
      if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'status ' + className;
      }
    }

    function parseMessage(event) {
      if (!event.origin || !event.origin.endsWith('facebook.com')) {
        return;
      }

      let data = null;

      try {
        data = typeof event.data === 'string'
          ? JSON.parse(event.data)
          : event.data;
      } catch {
        return;
      }

      if (!data || data.type !== 'WA_EMBEDDED_SIGNUP') {
        return;
      }

      if (
        data.event === 'FINISH' ||
        data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'
      ) {
        sessionInfo = {
          waba_id: data.data?.waba_id || null,
          phone_number_id: data.data?.phone_number_id || null,
          business_id:
            data.data?.business_id ||
            data.data?.businessId ||
            null,
        };

        setStatus('تم استكمال إعداد WhatsApp. جاري تأكيد الربط...');
        submitWhenReady();
        return;
      }

      if (data.event === 'ERROR') {
        setStatus(
          data.data?.error_message ||
            'حدث خطأ أثناء إعداد WhatsApp من Meta.',
          'error',
        );
      }

      if (data.event === 'CANCEL') {
        if (!submitted) {
          if (button) button.disabled = false;
          setStatus('تم إلغاء عملية ربط WhatsApp.');
        }
      }
    }

    async function submitWhenReady() {
      if (
        submitted ||
        !authorizationCode ||
        !sessionInfo
      ) {
        return;
      }

      submitted = true;
      if (button) button.disabled = true;
      setStatus('جاري حفظ حساب WhatsApp وتفعيل استقبال الرسائل...');

      try {
        const response = await fetch(
          '/api/meta/whatsapp/complete',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            cache: 'no-store',
            body: JSON.stringify({
              state: STATE,
              code: authorizationCode,
              waba_id: sessionInfo.waba_id,
              phone_number_id: sessionInfo.phone_number_id,
              business_id: sessionInfo.business_id,
            }),
          },
        );

        const contentType =
          response.headers.get('content-type') || '';

        const data = contentType.includes('application/json')
          ? await response.json().catch(() => null)
          : { error: await response.text().catch(() => '') };

        if (!response.ok) {
          throw new Error(
            data?.error ||
              'تعذر إكمال ربط WhatsApp.',
          );
        }

        sessionStorage.removeItem('dragon_meta_whatsapp_state');
        setStatus('تم ربط WhatsApp بنجاح. جارٍ العودة إلى الإعدادات...', 'success');

        window.setTimeout(() => {
          window.location.replace('/#/settings?tab=إعدادات%20واتساب&meta=success');
        }, 700);
      } catch (error) {
        submitted = false;
        if (button) button.disabled = false;
        setStatus(
          error instanceof Error
            ? error.message
            : 'تعذر إكمال ربط WhatsApp.',
          'error',
        );
      }
    }

    function fbLoginCallback(response) {
      if (response && response.authResponse && response.authResponse.code) {
        authorizationCode = response.authResponse.code;
        setStatus('تم استلام رمز الربط من Meta. جاري إنهاء العملية...');
        submitWhenReady();
        return;
      }

      if (response && response.status === 'not_authorized') {
        setStatus('لم يتم منح صلاحية الربط من Meta.', 'error');
      } else {
        setStatus('تم إلغاء أو عدم إكمال ربط WhatsApp.', 'error');
      }

      if (button) button.disabled = false;
    }

    function launchSignup() {
      if (!window.FB || submitted) {
        return;
      }

      if (button) button.disabled = true;
      setStatus('جاري فتح نافذة WhatsApp الرسمية من Meta...');

      window.FB.login(
        fbLoginCallback,
        {
          config_id: CONFIG_ID,
          response_type: 'code',
          override_default_response_type: true,
          redirect_uri: REDIRECT_URI,
          extras: {
            setup: {},
            sessionInfoVersion: '3',
          },
        },
      );
    }

    window.addEventListener('message', parseMessage);

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: APP_ID,
        cookie: true,
        xfbml: true,
        version: GRAPH_VERSION,
      });

      if (button) {
        button.disabled = false;
        button.addEventListener('click', launchSignup);
      }

      setStatus('جاهز لبدء ربط WhatsApp.');
    };

    (function (d, s, id) {
      const firstScript = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;

      const script = d.createElement(s);
      script.id = id;
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';

      if (firstScript && firstScript.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript);
      } else {
        d.head.appendChild(script);
      }
    })(document, 'script', 'facebook-jssdk');
  </script>
</body>
</html>`

  return res.status(200).send(html)
}
