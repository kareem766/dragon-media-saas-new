import type { VercelRequest, VercelResponse } from '@vercel/node'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'

function htmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed')
  }

  const configId = process.env.META_WHATSAPP_EMBEDDED_CONFIG_ID
  const appId = process.env.META_APP_ID
  const state = typeof req.query.state === 'string' ? req.query.state : ''

  if (!configId || !appId) {
    return res.status(500).send('WhatsApp Embedded Signup is not configured.')
  }

  if (!state) {
    return res.status(400).send('Missing OAuth state.')
  }

  const safeAppId = htmlEscape(appId)
  const safeConfigId = htmlEscape(configId)
  const safeState = htmlEscape(state)

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Connect WhatsApp</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a}
    .card{width:min(92vw,440px);padding:32px;border:1px solid #e2e8f0;border-radius:18px;background:#fff;box-shadow:0 18px 50px rgba(15,23,42,.08);text-align:center}
    .spinner{width:28px;height:28px;margin:0 auto 18px;border:3px solid #cbd5e1;border-top-color:#0f172a;border-radius:50%;animation:spin .8s linear infinite}
    .button{display:none;width:100%;border:0;border-radius:12px;padding:14px 18px;background:#0f172a;color:#fff;font-size:16px;font-weight:700;cursor:pointer}
    .button:disabled{opacity:.55;cursor:not-allowed}
    .error{color:#b91c1c;white-space:pre-wrap;line-height:1.6}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <main class="card">
    <div id="spinner" class="spinner"></div>
    <h2 id="title">Connect WhatsApp</h2>
    <p id="message">Preparing Meta WhatsApp setup…</p>
    <button id="connect" class="button" type="button">Continue with Meta</button>
  </main>
<script>
(function(){
  const APP_ID = ${JSON.stringify(safeAppId)};
  const CONFIG_ID = ${JSON.stringify(safeConfigId)};
  const STATE = ${JSON.stringify(safeState)};
  let sessionData = null;
  let authResponse = null;
  let completed = false;
  let sdkReady = false;
  let loginStarted = false;

  const button = document.getElementById('connect');

  function setMessage(title, message, isError){
    document.getElementById('title').textContent = title;
    document.getElementById('message').textContent = message;
    document.getElementById('spinner').style.display = isError ? 'none' : 'block';
    if(isError) document.getElementById('message').className = 'error';
  }

  function showButton(){
    document.getElementById('spinner').style.display = 'none';
    button.style.display = 'block';
    button.disabled = !sdkReady || loginStarted;
  }

  function tryComplete(){
    if(completed || !authResponse) return;
    const accessToken = authResponse.accessToken || '';
    const code = authResponse.code || '';
    if(!accessToken && !code) return;

    completed = true;
    button.style.display = 'none';
    setMessage('Finishing connection', 'Saving your WhatsApp Business connection…', false);

    const data = {
      state: STATE,
      access_token: accessToken || undefined,
      code: code || undefined,
      waba_id: sessionData && sessionData.waba_id ? String(sessionData.waba_id) : undefined,
      phone_number_id: sessionData && sessionData.phone_number_id ? String(sessionData.phone_number_id) : undefined,
      business_id: sessionData && sessionData.business_id ? String(sessionData.business_id) : undefined
    };

    fetch('/api/meta/whatsapp/complete', {
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      credentials:'same-origin',
      body:JSON.stringify(data)
    })
    .then(async function(response){
      const body = await response.json().catch(function(){return {};});
      if(!response.ok || !body.success){
        throw new Error(body.error || 'تعذر إكمال ربط WhatsApp.');
      }
      window.location.replace('/#/settings?meta=connected&provider=whatsapp');
    })
    .catch(function(error){
      completed = false;
      setMessage('Connection failed', error && error.message ? error.message : 'تعذر إكمال ربط WhatsApp.', true);
      button.style.display = 'block';
      button.disabled = false;
      loginStarted = false;
    });
  }

  function startLogin(){
    if(!sdkReady || loginStarted) return;
    loginStarted = true;
    button.disabled = true;
    button.style.display = 'none';
    document.getElementById('spinner').style.display = 'block';
    setMessage('Connect WhatsApp', 'Opening Meta WhatsApp setup…', false);

    window.FB.login(function(response){
      if(response && response.authResponse){
        authResponse = response.authResponse;
        tryComplete();
      }else{
        loginStarted = false;
        setMessage('Connection cancelled', 'The Meta WhatsApp setup was cancelled or did not finish.', true);
        button.style.display = 'block';
        button.disabled = false;
      }
    }, {
      config_id: CONFIG_ID,
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        setup: {},
        sessionInfoVersion: '3'
      }
    });
  }

  button.addEventListener('click', startLogin);

  window.addEventListener('message', function(event){
    if(event.origin !== 'https://www.facebook.com' && event.origin !== 'https://facebook.com') return;
    try{
      const raw = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
      const data = JSON.parse(raw);
      if(data && data.type === 'WA_EMBEDDED_SIGNUP'){
        if(data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA' || data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'){
          sessionData = data.data || {};
          tryComplete();
        } else if(data.event === 'ERROR'){
          completed = true;
          setMessage('Connection failed', (data.data && data.data.error_message) || 'Meta Embedded Signup returned an error.', true);
        }
      }
    }catch(_error){
      // Ignore non-JSON bridge messages from Meta.
    }
  });

  window.fbAsyncInit = function(){
    window.FB.init({appId:APP_ID,cookie:true,xfbml:true,version:'${GRAPH_VERSION}'});
    sdkReady = true;
    setMessage('Connect WhatsApp', 'اضغط الزر لفتح إعداد WhatsApp من Meta.', false);
    showButton();
  };

  (function(d,s,id){
    if(d.getElementById(id)) return;
    const js=d.createElement(s);
    js.id=id;
    js.async=true;
    js.defer=true;
    js.crossOrigin='anonymous';
    js.src='https://connect.facebook.net/en_US/sdk.js';
    js.onload=function(){
      if(!sdkReady){
        setMessage('Connection failed', 'تعذر تحميل Meta SDK. تأكد من السماح بالنوافذ المنبثقة ثم أعد المحاولة.', true);
      }
    };
    js.onerror=function(){
      setMessage('Connection failed', 'تعذر تحميل Meta SDK. تأكد من اتصال الإنترنت ثم أعد المحاولة.', true);
    };
    const first=d.getElementsByTagName(s)[0];
    first.parentNode.insertBefore(js,first);
  })(document,'script','facebook-jssdk');
})();
</script>
</body>
</html>`

  res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(html)
}