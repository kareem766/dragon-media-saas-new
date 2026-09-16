import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') return res.status(405).send('Method not allowed')

  const configId = process.env.META_WHATSAPP_EMBEDDED_CONFIG_ID
  const appId = process.env.META_APP_ID
  const graphVersion = process.env.META_GRAPH_API_VERSION || 'v23.0'
  const queryState = typeof req.query.state === 'string' ? req.query.state : ''
  const completeUrl = '/api/meta/whatsapp/complete'
  const redirectUri = 'https://dragon-media-saas-new.vercel.app/api/meta/whatsapp/signup'

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
    <p>سيتم فتح عملية Embedded Signup الرسمية من Meta. بعد إتمام الربط سيتم حفظ بيانات الحساب ورقم WhatsApp في Dragon Media.</p>
    <button id="connect" disabled>فتح ربط WhatsApp</button>
    <div id="status" class="status">جاري تجهيز خدمة Meta...</div>
  </main>
  <script src="https://connect.facebook.net/en_US/sdk.js"></script>
  <script>
    const APP_ID = ${JSON.stringify(appId)};
    const CONFIG_ID = ${JSON.stringify(configId)};
    const GRAPH_VERSION = ${JSON.stringify(graphVersion)};
    const STATE = ${JSON.stringify(queryState)};
    const COMPLETE_URL = ${JSON.stringify(completeUrl)};
    const REDIRECT_URI = ${JSON.stringify(redirectUri)};

    const statusEl = document.getElementById('status');
    const button = document.getElementById('connect');

    let signupData = { waba_id: null, phone_number_id: null, business_id: null };
    let completed = false;

    function setStatus(message, className = '') {
      statusEl.textContent = message;
      statusEl.className = 'status ' + className;
    }

    function parseMessageData(raw) {
      if (typeof raw !== 'string') return raw;
      try { return JSON.parse(raw); } catch { return null; }
    }

    function captureSignupMessage(event) {
      if (event.origin !== 'https://www.facebook.com') return;

      const payload = parseMessageData(event.data);
      if (!payload || payload.type !== 'WA_EMBEDDED_SIGNUP') return;

      const data = payload.data || {};
      if (data.waba_id) signupData.waba_id = String(data.waba_id);
      if (data.phone_number_id) signupData.phone_number_id = String(data.phone_number_id);
      if (data.business_id) signupData.business_id = String(data.business_id);

      if (payload.event === 'ERROR') {
        setStatus('Meta أبلغت عن خطأ أثناء إعداد WhatsApp. يمكنك إغلاق النافذة وإعادة المحاولة.', 'error');
      }

      if (payload.event === 'FINISH') {
        setStatus('تم إنهاء إعداد WhatsApp في Meta. جاري إكمال الربط وحفظ البيانات...');
      }
    }

    window.addEventListener('message', captureSignupMessage);

    function completeSignup(code) {
      if (completed) return;
      completed = true;

      const params = new URLSearchParams({ state: STATE, code, redirect_uri: REDIRECT_URI });
      if (signupData.waba_id) params.set('waba_id', signupData.waba_id);
      if (signupData.phone_number_id) params.set('phone_number_id', signupData.phone_number_id);
      if (signupData.business_id) params.set('business_id', signupData.business_id);

      fetch(COMPLETE_URL + '?' + params.toString(), { method: 'POST', credentials: 'same-origin' })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok || !data.success) {
            throw new Error(data.error || 'تعذر إكمال ربط WhatsApp.');
          }
          if (data.connected) {
            setStatus('تم ربط WhatsApp Business بنجاح. يمكنك العودة إلى Dragon Media.', 'success');
          } else {
            throw new Error('تمت مصادقة Meta لكن لم يتم العثور على رقم WhatsApp.');
          }
        })
        .catch((error) => {
          completed = false;
          setStatus(error?.message || 'تعذر إكمال ربط WhatsApp.', 'error');
          button.disabled = false;
        });
    }

    function launchSignup() {
      if (!STATE) {
        setStatus('تعذر التحقق من جلسة الربط. أعد المحاولة من الإعدادات.', 'error');
        return;
      }

      if (typeof window.FB === 'undefined') {
        setStatus('تعذر تحميل خدمة Meta. تحقق من الاتصال بالإنترنت ثم أعد المحاولة.', 'error');
        return;
      }

      button.disabled = true;
      setStatus('جاري فتح Embedded Signup من Meta...');

      window.FB.login(function(response) {
        const code = response?.authResponse?.code;
        if (!code) {
          completed = false;
          button.disabled = false;
          setStatus('لم تُرجع Meta رمز إتمام الربط. إذا أغلقت نافذة Meta أعد المحاولة.', 'error');
          return;
        }
        completeSignup(String(code));
      }, {
        config_id: CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        redirect_uri: REDIRECT_URI,
        extras: {
          setup: {},
          sessionInfoVersion: '3'
        }
      });
    }

    window.fbAsyncInit = function() {
      window.FB.init({
        appId: APP_ID,
        cookie: true,
        xfbml: true,
        version: GRAPH_VERSION
      });
      button.disabled = false;
      button.addEventListener('click', launchSignup);
      setStatus('جاهز لبدء ربط WhatsApp.');
    };

    if (window.FB) {
      window.fbAsyncInit();
    }
  </script>
</body>
</html>`

  return res.status(200).send(html)
}
