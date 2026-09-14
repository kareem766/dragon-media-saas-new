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
    return res.status(405).send('Method not allowed')
  }

  const configId =
    process.env.META_WHATSAPP_EMBEDDED_CONFIG_ID

  const appId = process.env.META_APP_ID

  const state =
    typeof req.query.state === 'string'
      ? req.query.state
      : ''

  if (!configId || !appId || !state) {
    return res.status(500).send(
      'WhatsApp Embedded Signup is not configured.',
    )
  }

  const safeConfigId =
    escapeHtml(configId)

  const safeAppId =
    escapeHtml(appId)

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
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background:
        radial-gradient(
          circle at top,
          #172554 0,
          #020617 55%,
          #000 100%
        );
      color: #fff;
      font-family:
        Arial,
        Tahoma,
        sans-serif;
      padding: 24px;
    }

    .card {
      width: min(520px, 100%);
      background: rgba(15, 23, 42, 0.94);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 24px;
      padding: 36px;
      text-align: center;
      box-shadow:
        0 25px 80px rgba(0,0,0,.45);
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

    h1 {
      margin: 0 0 12px;
      font-size: 25px;
    }

    p {
      color: #cbd5e1;
      line-height: 1.8;
      margin: 0 0 24px;
    }

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

    button:disabled {
      opacity: .6;
      cursor: wait;
    }

    .status {
      margin-top: 18px;
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.7;
      white-space: pre-wrap;
    }

    .error {
      color: #fca5a5;
    }

    .success {
      color: #86efac;
    }
  </style>
</head>

<body>
  <main class="card">
    <div class="logo">DM</div>

    <h1>ربط WhatsApp Business</h1>

    <p>
      سيتم فتح إعداد WhatsApp Business الرسمي من Meta.
      بعد إتمام الربط سيتم حفظ بيانات الحساب تلقائيًا
      داخل Dragon Media.
    </p>

    <button id="connect">
      متابعة ربط WhatsApp
    </button>

    <div
      id="status"
      class="status"
    >
      جاري تجهيز الاتصال...
    </div>
  </main>

  <script>
    const CONFIG_ID = ${JSON.stringify(safeConfigId)};
    const APP_ID = ${JSON.stringify(safeAppId)};
    const STATE = ${JSON.stringify(safeState)};

    const statusEl =
      document.getElementById('status');

    const button =
      document.getElementById('connect');

    let completed = false;

    function setStatus(
      message,
      className = '',
    ) {
      statusEl.textContent = message;
      statusEl.className =
        'status ' + className;
    }

    async function completeSignup(
      payload,
    ) {
      if (completed) {
        return;
      }

      completed = true;

      button.disabled = true;

      setStatus(
        'جاري إكمال إعداد WhatsApp والتحقق من الحساب...',
      );

      try {
        const response =
          await fetch(
            '/api/meta/whatsapp/complete',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              credentials: 'same-origin',
              body: JSON.stringify({
                state: STATE,
                ...payload,
              }),
            },
          );

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
            'تعذر إكمال ربط WhatsApp.',
          );
        }

        setStatus(
          'تم ربط WhatsApp Business بنجاح. جاري العودة إلى Dragon Media...',
          'success',
        );

        const redirect =
          data.redirect_url ||
          '/#/settings';

        window.setTimeout(() => {
          window.location.assign(
            redirect,
          );
        }, 800);
      } catch (error) {
        completed = false;
        button.disabled = false;

        setStatus(
          error instanceof Error
            ? error.message
            : 'حدث خطأ أثناء إكمال الربط.',
          'error',
        );
      }
    }

    window.addEventListener(
      'message',
      (event) => {
        if (
          event.origin !==
          'https://www.facebook.com'
        ) {
          return;
        }

        let data = event.data;

        if (
          typeof data === 'string'
        ) {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }

        if (
          !data ||
          typeof data !== 'object'
        ) {
          return;
        }

        if (
          data.type !==
          'WA_EMBEDDED_SIGNUP'
        ) {
          return;
        }

        const eventData =
          data.data &&
          typeof data.data === 'object'
            ? data.data
            : {};

        if (
          data.event ===
            'FINISH' ||
          data.event ===
            'FINISH_ONLY_WABA' ||
          data.event ===
            'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'
        ) {
          void completeSignup({
            code:
              eventData.code ||
              data.code ||
              null,

            waba_id:
              eventData.waba_id ||
              eventData.wabaId ||
              null,

            phone_number_id:
              eventData.phone_number_id ||
              eventData.phoneNumberId ||
              null,

            business_id:
              eventData.business_id ||
              eventData.businessId ||
              null,

            event:
              data.event ||
              null,
          });

          return;
        }

        if (
          data.event === 'CANCEL'
        ) {
          completed = false;
          button.disabled = false;

          setStatus(
            'تم إلغاء عملية ربط WhatsApp.',
            'error',
          );
        }
      },
    );

    function launchSignup() {
      if (
        !window.FB ||
        typeof window.FB.login !==
          'function'
      ) {
        setStatus(
          'تعذر تحميل Facebook Login. حاول مرة أخرى.',
          'error',
        );

        return;
      }

      setStatus(
        'جاري فتح إعداد WhatsApp الرسمي من Meta...',
      );

      api/meta/whatsapp/signup.ts
        {
          config_id: CONFIG_ID,

          response_type: 'code',

          override_default_response_type:
            true,

          extras: {
            featureType:
              'whatsapp_business_app_onboarding',

            sessionInfoVersion:
              '3',
          },
        },
      );
    }

    button.addEventListener(
      'click',
      launchSignup,
    );

    window.fbAsyncInit = function() {
      window.FB.init({
        appId: APP_ID,
        cookie: true,
        xfbml: false,
        version: 'v23.0',
      });

      setStatus(
        'جاهز لبدء ربط WhatsApp.',
      );
    };

    (function(d, s, id) {
      const firstScript =
        d.getElementsByTagName(s)[0];

      if (
        d.getElementById(id)
      ) {
        return;
      }

      const script =
        d.createElement(s);

      script.id = id;

      script.src =
        'https://connect.facebook.net/en_US/sdk.js';

      firstScript.parentNode.insertBefore(
        script,
        firstScript,
      );
    })(
      document,
      'script',
      'facebook-jssdk',
    );
  </script>
</body>
</html>`

  return res.status(200).send(html)
}
