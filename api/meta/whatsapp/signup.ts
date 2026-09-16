import type { VercelRequest, VercelResponse } from '@vercel/node'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function escapeScriptJson(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

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
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at top,#172554 0,#020617 55%,#000 100%);color:#fff;font-family:Arial,Tahoma,sans-serif;padding:24px}.card{width:min(520px,100%);background:rgba(15,23,42,.94);border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:36px;text-align:center;box-shadow:0 25px 80px rgba(0,0,0,.45)}.logo{width:64px;height:64px;margin:0 auto 20px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:#2563eb;font-weight:800;font-size:24px}h1{margin:0 0 12px;font-size:25px}p{color:#cbd5e1;line-height:1.8;margin:0 0 24px}button{width:100%;border:0;border-radius:14px;padding:15px 20px;background:#2563eb;color:#fff;font-size:16px;font-weight:700;cursor:pointer}button:disabled{opacity:.6;cursor:wait}.status{margin-top:18px;color:#94a3b8;font-size:14px;line-height:1.7;white-space:pre-wrap}.error{color:#fca5a5}.success{color:#86efac}
  </style>
</head>
<body>
  <main class="card">
    <div class="logo">DM</div>
    <h1>ربط WhatsApp Business</h1>
    <p>سيتم فتح نافذة الربط الرسمية من Meta. بعد إتمام الربط سيعود الحساب إلى Dragon Media تلقائيًا.</p>
    <button id="connect" disabled>فتح ربط WhatsApp</button>
    <div id="status" class="status">جاري تحميل خدمة Meta...</div>
  </main>
  <script>
    const APP_ID = ${JSON.stringify(escapeHtml(appId))};
    const CONFIG_ID = ${JSON.stringify(escapeHtml(configId))};
    const GRAPH_VERSION = ${JSON.stringify(escapeHtml(graphVersion))};
    const QUERY_STATE = ${JSON.stringify(escapeHtml(queryState))};

    const statusEl = document.getElementById('status');
    const button = document.getElementById('connect');
    let sessionInfo = null;
    let authorizationCode = null;
    let submitted = false;
    let submitTimer = null;
    let state = QUERY_STATE || '';

    try {
      if (!state) state = sessionStorage.getItem('dragon_meta_whatsapp_state') || '';
      else sessionStorage.setItem('dragon_meta_whatsapp_state', state);
    } catch {}

    function setStatus(message, className = '') {
      statusEl.textContent = message;
      statusEl.className = 'status ' + className;
    }

    function scheduleSubmit() {
      if (submitted || !authorizationCode || !state) return;
      if (submitTimer) window.clearTimeout(submitTimer);
      submitTimer = window.setTimeout(submitWhenReady, sessionInfo ? 0 : 2000);
    }

    function parseMessage(event) {
      const origin = typeof event.origin === 'string' ? event.origin : '';
      if (!origin || !(origin === 'https://facebook.com' || origin.endsWith('.facebook.com'))) return;
      let data = null;
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
      if (!data || data.type !== 'WA_EMBEDDED_SIGNUP') return;

      if (data.event === 'FINISH' || data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
        sessionInfo = {
          waba_id: data.data?.waba_id || null,
          phone_number_id: data.data?.phone_number_id || null,
          business_id: data.data?.business_id || data.data?.businessId || null,
        };
        setStatus('تم استكمال إعداد WhatsApp. جاري تأكيد الربط...');
        scheduleSubmit();
      } else if (data.event === 'ERROR') {
        setStatus(data.data?.error_message || 'حدث خطأ أثناء إعداد WhatsApp من Meta.', 'error');
      } else if (data.event === 'CANCEL' && !submitted) {
        button.disabled = false;
        setStatus('تم إلغاء عملية ربط WhatsApp.');
      }
    }

    async function submitWhenReady() {
      if (submitted || !authorizationCode || !state) return;
      submitted = true;
      button.disabled = true;
      setStatus('جاري حفظ حساب WhatsApp وتفعيل استقبال الرسائل...');

      try {
        const params = new URLSearchParams({
          state,
          code: authorizationCode,
          waba_id: sessionInfo?.waba_id || '',
          phone_number_id: sessionInfo?.phone_number_id || '',
          business_id: sessionInfo?.business_id || '',
        });
        const response = await fetch('/api/meta/whatsapp/complete?' + params.toString(), {
          method: 'POST',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
          ? await response.json().catch(() => null)
          : { error: await response.text().catch(() => '') };
        if (!response.ok) throw new Error(data?.error || 'تعذر إكمال ربط WhatsApp.');

        try { sessionStorage.removeItem('dragon_meta_whatsapp_state'); } catch {}
        setStatus('تم ربط WhatsApp بنجاح. جارٍ العودة إلى الإعدادات...', 'success');
        window.setTimeout(() => window.location.replace('/#/settings?tab=إعدادات%20واتساب&meta=success'), 700);
      } catch (error) {
        submitted = false;
        button.disabled = false;
        setStatus(error instanceof Error ? error.message : 'تعذر إكمال ربط WhatsApp.', 'error');
      }
    }

    function fbLoginCallback(response) {
      if (response?.authResponse?.code) {
        authorizationCode = response.authResponse.code;
        setStatus('تم استلام رمز الربط من Meta. جاري إنهاء العملية...');
        scheduleSubmit();
        return;
      }
      setStatus(response?.status === 'not_authorized' ? 'لم يتم منح صلاحية الربط من Meta.' : 'تم إلغاء أو عدم إكمال ربط WhatsApp.', 'error');
      button.disabled = false;
    }

    function launchSignup() {
      if (!window.FB || submitted) return;
      if (!state) {
        setStatus('تعذر التحقق من جلسة الربط. أعد المحاولة من الإعدادات.', 'error');
        return;
      }
      button.disabled = true;
      setStatus('جاري فتح نافذة WhatsApp الرسمية من Meta...');
      // Do not pass redirect_uri here. Meta's JS SDK Embedded Signup uses its
      // own OAuth dialog redirect (facebook.com/connect/login_success.html).
      // The backend must exchange the returned code using that exact URI.
      window.FB.login(fbLoginCallback, {
        config_id: CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, sessionInfoVersion: '3' },
      });
    }

    window.addEventListener('message', parseMessage);
    window.fbAsyncInit = function () {
      window.FB.init({ appId: APP_ID, cookie: true, xfbml: true, version: GRAPH_VERSION });
      button.disabled = false;
      button.addEventListener('click', launchSignup);
      setStatus('جاهز لبدء ربط WhatsApp.');
    };

    (function(d,s,id){
      const firstScript=d.getElementsByTagName(s)[0];
      if(d.getElementById(id)) return;
      const script=d.createElement(s);
      script.id=id;
      script.async=true;
      script.defer=true;
      script.crossOrigin='anonymous';
      script.src='https://connect.facebook.net/en_US/sdk.js';
      if(firstScript&&firstScript.parentNode) firstScript.parentNode.insertBefore(script,firstScript);
      else d.head.appendChild(script);
    })(document,'script','facebook-jssdk');
  </script>
</body>
</html>`

  return res.status(200).send(html)
}
