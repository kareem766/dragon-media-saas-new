import { createClient } from '@supabase/supabase-js'

const PLATFORM_GUIDE = `
أنت Ryan كمساعد داخلي لمستخدم منصة Dragon Media، وليس مساعد العملاء الخارجيين.
مهمتك شرح كيفية استخدام المنصة خطوة بخطوة للمستخدم الحالي، بلغة عربية مصرية بسيطة واحترافية.

أهم أقسام المنصة ومساراتها:
- لوحة التحكم: / — نظرة عامة على الشركة والنشاط.
- CRM: /crm — العملاء والعملاء المحتملون وبياناتهم.
- Pipeline: /pipeline — مراحل الصفقات ومتابعة فرص البيع.
- الخدمات: /services — إضافة وإدارة خدمات ومنتجات الشركة.
- الحملات: /campaigns — إدارة الحملات التسويقية.
- Inbox: /inbox — المحادثات الواردة من القنوات المتصلة.
- Ryan AI: /ryan — مساعد Ryan واستهلاك Ryan.
- إعدادات Ryan: /ryan/settings — الشخصية واللغة والذاكرة وقاعدة المعرفة.
- قاعدة المعرفة: /ryan/knowledge — معلومات الشركة التي يعتمد عليها Ryan.
- طلبات التحويل: /ryan/handoff — المحادثات المحولة لموظف.
- الأتمتة: /automations — الأتمتة المتاحة.
- المهام: /tasks — إدارة المهام.
- المواعيد: /appointments — متابعة المواعيد.
- التقارير: /reports — التقارير.
- المستخدمون: /users — إدارة مستخدمي الشركة.
- الحساب: /account — بيانات الحساب الشخصي.
- الإعدادات: /settings — إعدادات الشركة والمنصة والتكاملات.
- Meta: /integrations/meta — Facebook / Instagram / WhatsApp.
- الخطط: /plans — الخطط والاشتراك.
- الفوترة: /billing — الاشتراك والمدفوعات.

قواعد الإجابة:
1. اشرح خطوات عملية واضحة وبالترتيب واذكر القسم أو المسار.
2. لا تخترع أسعارًا أو حدود استخدام أو صلاحيات أو سياسات.
3. إذا لم تكن متأكدًا من ميزة، قل ذلك بدل اختلاقها.
4. لا تكشف أسرارًا أو بيانات مستخدمين آخرين.
5. لا تنفذ تغييرات إدارية حساسة؛ دورك الإرشاد.
6. اجعل الرد مختصرًا وعمليًا، لكن لا تختصر الخطوات المطلوبة بشكل يقطع المعنى.
7. إذا بدأت قائمة خطوات أو نقاط، أكملها كاملة حتى النهاية ولا تتوقف في منتصف خطوة.
8. لا تبدأ أو تنهي الرد بتنسيق Markdown غير مكتمل. استخدم نصًا واضحًا، ويمكن استخدام الترقيم العادي مثل 1. 2. 3. بدون رموز تنسيق غير ضرورية.
`

const env = (...names: string[]) => names.map((n) => process.env[n]).find((v) => v?.trim())?.trim() || ''
const clean = (value: unknown, max = 5000) => typeof value === 'string' ? value.trim().slice(0, max) : ''

function json(res: any, status: number, body: Record<string, unknown>) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').json(body)
}

function clientForUser(accessToken: string) {
  const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
  const key = env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')
  if (!url || !key) throw new Error('إعدادات Supabase غير مكتملة على الخادم.')
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
}

function adminClient() {
  const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY')
  if (!url || !key) throw new Error('إعدادات Supabase الإدارية غير مكتملة على الخادم.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function readJson(response: Response) {
  const text = await response.text()
  try { return text ? JSON.parse(text) : {} } catch { return { raw: text } }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'الطريقة غير مسموحة' })

  try {
    const accessToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    if (!accessToken) return json(res, 401, { error: 'يجب تسجيل الدخول' })

    const userClient = clientForUser(accessToken)
    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData?.user?.id) return json(res, 401, { error: 'جلسة الدخول غير صالحة' })

    const admin = adminClient()
    const { data: user, error: userError } = await admin
      .from('users')
      .select('id, organization_id, role, active')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (userError) throw new Error(userError.message)
    if (!user?.organization_id || user.active === false) return json(res, 403, { error: 'الحساب غير مرتبط بشركة أو غير نشط' })

    const message = clean(req.body?.message)
    if (!message) return json(res, 400, { error: 'اكتب سؤالك أولًا' })

    const history = Array.isArray(req.body?.history)
      ? req.body.history.slice(-16)
        .map((item: any) => ({
          role: item?.role === 'model' ? 'assistant' : 'user',
          content: clean(item?.text, 1800),
        }))
        .filter((item: any) => item.content)
      : []

    const [{ data: organization }, { data: services }, { data: knowledge }] = await Promise.all([
      admin.from('organizations').select('name,business_type,address,phone,email,timezone').eq('id', user.organization_id).maybeSingle(),
      admin.from('services').select('name,description,category,price').eq('organization_id', user.organization_id).order('name').limit(80),
      admin.from('knowledge_base').select('title,content').eq('organization_id', user.organization_id).order('created_at', { ascending: false }).limit(50),
    ])

    const orgText = JSON.stringify(organization || {})
    const serviceText = (services || [])
      .map((s: any) => `${s.name}: ${s.description || ''} | ${s.category || ''} | السعر: ${s.price ?? 'غير محدد'}`)
      .join('\n') || 'لا توجد خدمات مسجلة.'
    const knowledgeText = (knowledge || [])
      .map((k: any) => `${k.title || 'معلومة'}: ${k.content || ''}`)
      .join('\n') || 'لا توجد قاعدة معرفة للشركة.'

    const internalPrompt = `${PLATFORM_GUIDE}

بيانات الشركة الحالية:
${orgText}

الخدمات المسجلة:
${serviceText}

قاعدة المعرفة الحالية للشركة:
${knowledgeText}

المستخدم الحالي: ${clean(authData.user.user_metadata?.full_name || authData.user.email, 200)} | الدور: ${clean(user.role, 100)}

أجب عن سؤال المستخدم الحالي مباشرة. إذا طلب خطوات تنفيذ، أعطه الخطوات بالترتيب داخل Dragon Media.
يجب أن يكون الرد مكتملًا حتى لو احتاج عدة خطوات. لا تقطع الرد بسبب الاختصار، ولا تترك خطوة أو جملة غير مكتملة. لا تستخدم Markdown معقدًا؛ الترقيم العادي مناسب.`

    let reply = ''
    let usedModel = ''
    let lastGeminiError = ''

    const geminiKey = env('GEMINI_API_KEY', 'GOOGLE_GEMINI_API_KEY')
    if (geminiKey) {
      const configured = env('RYAN_GEMINI_MODEL')
      const candidates = [configured, 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'].filter((v, i, a) => v && a.indexOf(v) === i)

      const contents = [
        { role: 'user', parts: [{ text: internalPrompt }] },
        { role: 'model', parts: [{ text: 'فهمت. سأشرح استخدام Dragon Media للمستخدم الحالي بشكل عملي وآمن.' }] },
        ...history.map((item: any) => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content }] })),
        { role: 'user', parts: [{ text: message }] },
      ]

      for (const candidate of candidates) {
        for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
          body: JSON.stringify({
            contents,
            generationConfig: {
              maxOutputTokens: 1400,
              temperature: 0.25,
            },
          }),
        })
        const data: any = await readJson(response)
        if (response.ok) {
          const candidateItem = data?.candidates?.[0]
          reply = (candidateItem?.content?.parts || [])
            .map((p: any) => String(p?.text || ''))
            .join('')
            .trim()

          const finishReason = String(candidateItem?.finishReason || '')
          if (reply && finishReason !== 'MAX_TOKENS') {
            usedModel = candidate
            break
          }

          // Gemini can legally return text with MAX_TOKENS. Retry once with a larger
          // output budget so a step-by-step answer is not returned half-finished.
          if (reply && finishReason === 'MAX_TOKENS') {
            const retryResponse = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
                body: JSON.stringify({
                  contents: [
                    ...contents,
                    {
                      role: 'user',
                      parts: [{
                        text: 'أكمل الإجابة كاملة من البداية في رد واحد، مع إنهاء جميع الخطوات والجمل وعدم ترك أي قائمة أو تنسيق غير مكتمل.'
                      }],
                    },
                  ],
                  generationConfig: {
                    maxOutputTokens: 2200,
                    temperature: 0.2,
                  },
                }),
              },
            )

            const retryData: any = await readJson(retryResponse)
            if (retryResponse.ok) {
              const retryCandidate = retryData?.candidates?.[0]
              const retryReply = (retryCandidate?.content?.parts || [])
                .map((p: any) => String(p?.text || ''))
                .join('')
                .trim()
              const retryFinishReason = String(retryCandidate?.finishReason || '')
              if (retryReply && retryFinishReason !== 'MAX_TOKENS') {
                reply = retryReply
                usedModel = candidate
                break
              }
            }
          }
        } else {
          lastGeminiError = clean(data?.error?.message || `Gemini ${response.status}`, 500)
          const retryable = [408, 429, 500, 502, 503, 504].includes(response.status)
          if (!retryable) break
        }
        if (reply) break
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 350))
        }
        if (reply) break
      }
    }

    if (!reply) {
      console.error('Ryan internal assistant Gemini unavailable', { model: env('RYAN_GEMINI_MODEL') || 'default', reason: lastGeminiError || 'no response' })
      reply = 'معلش، حصل تأخير بسيط في تشغيل Ryan. جرّب تبعت سؤالك مرة تانية، ولو المشكلة استمرت هتقدر تكمل من أقسام المنصة مباشرة.'
    }

    if (/^\s*[\[{]/.test(reply) || /functionCall|functionResponse|service_name/.test(reply)) {
      reply = 'ممكن توضّح لي إيه المهمة اللي عايز تعرف تعملها داخل Dragon Media؟'
    }

    return json(res, 200, {
      ok: true,
      reply,
      model: usedModel,
      userId: user.id,
      organizationId: user.organization_id,
    })
  } catch (error: any) {
    console.error('Ryan internal assistant error', error)
    return json(res, 200, { ok: true, reply: 'معلش، حصل تأخير بسيط في تشغيل Ryan. جرّب تبعت سؤالك مرة تانية.', model: '', userId: undefined, organizationId: undefined })
  }
}
