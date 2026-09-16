import { createClient } from '@supabase/supabase-js'

const PLATFORM_GUIDE = `
أنت Ryan كمساعد داخلي لمستخدم منصة Dragon Media، وليس مساعد العملاء الخارجيين.
مهمتك شرح كيفية استخدام المنصة خطوة بخطوة للمستخدم الحالي، بلغة عربية مصرية بسيطة واحترافية.

أهم أقسام المنصة ومساراتها:
- لوحة التحكم: / — نظرة عامة على الشركة والنشاط.
- CRM: /crm — العملاء، العملاء المحتملون، بياناتهم وتفاصيلهم.
- Pipeline: /pipeline — مراحل الصفقات ومتابعة فرص البيع.
- الخدمات: /services — إضافة وإدارة خدمات ومنتجات الشركة.
- الحملات: /campaigns — إدارة الحملات التسويقية عند تفعيل الميزة.
- Inbox: /inbox — المحادثات الواردة من القنوات المتصلة وتحويل المحادثة بين Ryan والموظف.
- Ryan AI: /ryan — مساعد Ryan ومحادثته الداخلية واستهلاك Ryan.
- إعدادات Ryan: /ryan/settings — الشخصية، اللغة، الذاكرة، قاعدة المعرفة وقواعد السلوك.
- قاعدة المعرفة: /ryan/knowledge — إضافة وتحديث المعلومات التي يعتمد عليها Ryan عند الرد على العملاء.
- طلبات التحويل: /ryan/handoff — متابعة المحادثات التي طلبت موظفًا بشريًا.
- الأتمتة: /automations — إعداد الأتمتة المتاحة في الخطة.
- المهام: /tasks — إدارة المهام.
- المواعيد: /appointments — متابعة المواعيد المحجوزة.
- التقارير: /reports — التقارير المتقدمة إذا كانت متاحة في الخطة.
- المستخدمون: /users — إدارة مستخدمي الشركة حسب الصلاحيات.
- الحساب: /account — بيانات الحساب الشخصي.
- الإعدادات: /settings — إعدادات الشركة والمنصة والتكاملات والإشعارات.
- Meta: /integrations/meta — ربط Facebook / Instagram / WhatsApp حسب ما هو متاح.
- الخطط: /plans — الخطط والاشتراك.
- الفوترة: /billing — حالة الاشتراك والمدفوعات.

قواعد الإجابة:
1. اشرح خطوات عملية واضحة وبالترتيب، واذكر اسم القسم أو المسار داخل المنصة.
2. إذا كان السؤال عن ميزة قد تعتمد على الخطة، وضح أن توفرها مرتبط بالخطة والصلاحيات بدل اختراع صلاحية.
3. إذا كان المستخدم جديدًا، ابدأ من أقرب خطوة عملية ولا تستخدم مصطلحات تقنية غير ضرورية.
4. إذا سأل عن شيء غير موجود في المرجع، قل إنك لا تملك تأكيدًا عليه واقترح القسم الأقرب بدل اختلاق خطوات.
5. لا تخترع أسعارًا أو حدود استخدام أو صلاحيات أو سياسات.
6. يمكنك استخدام بيانات الشركة والخدمات وقاعدة المعرفة الداخلية المرفقة، لكن لا تكشف أسرارًا أو بيانات مستخدمين آخرين.
7. لا تنفذ تغييرات إدارية حساسة من هذا المساعد في هذه المرحلة؛ دوره هنا الإرشاد وشرح طريقة التنفيذ.
8. اجعل الرد مختصرًا، منظمًا، وعمليًا. إذا كانت الخطوات كثيرة، استخدم نقاطًا مرقمة.
`

function clientForUser(accessToken: string) {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('إعدادات Supabase غير مكتملة')
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
}

function adminClient() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('إعدادات Supabase الإدارية غير مكتملة')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function clean(value: unknown, max = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'الطريقة غير مسموحة' })

  const accessToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!accessToken) return res.status(401).json({ error: 'يجب تسجيل الدخول' })

  try {
    const userClient = clientForUser(accessToken)
    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData?.user?.id) return res.status(401).json({ error: 'جلسة الدخول غير صالحة' })

    const { data: user, error: userError } = await userClient
      .from('users')
      .select('id, organization_id, role, name, email, active')
      .eq('id', authData.user.id)
      .maybeSingle()
    if (userError) throw new Error(userError.message)
    if (!user?.organization_id || user.active === false) return res.status(403).json({ error: 'الحساب غير مرتبط بشركة أو غير نشط' })

    const message = clean(req.body?.message)
    if (!message) return res.status(400).json({ error: 'اكتب سؤالك أولًا' })

    const history = Array.isArray(req.body?.history)
      ? req.body.history.slice(-16).map((item: any) => ({ role: item?.role === 'model' ? 'assistant' : 'user', content: clean(item?.text, 1800) })).filter((item: any) => item.content)
      : []

    const admin = adminClient()
    const [{ data: organization }, { data: services }, { data: knowledge }, { data: agent }] = await Promise.all([
      admin.from('organizations').select('name,business_type,address,phone,email,timezone').eq('id', user.organization_id).maybeSingle(),
      admin.from('services').select('name,description,category,price').eq('organization_id', user.organization_id).order('name').limit(80),
      admin.from('knowledge_base').select('title,content').eq('organization_id', user.organization_id).order('created_at', { ascending: false }).limit(50),
      admin.from('ai_agents').select('name,settings').eq('organization_id', user.organization_id).eq('active', true).limit(1).maybeSingle(),
    ])

    const orgText = JSON.stringify(organization || {})
    const serviceText = (services || []).map((s: any) => `${s.name}: ${s.description || ''} | ${s.category || ''} | السعر: ${s.price ?? 'غير محدد'}`).join('\n') || 'لا توجد خدمات مسجلة.'
    const knowledgeText = (knowledge || []).map((k: any) => `${k.title || 'معلومة'}: ${k.content || ''}`).join('\n') || 'لا توجد قاعدة معرفة للشركة.'
    const internalPrompt = `${PLATFORM_GUIDE}\n\nبيانات الشركة الحالية:\n${orgText}\n\nالخدمات المسجلة:\n${serviceText}\n\nقاعدة المعرفة الحالية للشركة:\n${knowledgeText}\n\nالمستخدم الحالي: ${clean(user.name || user.email, 200)} | الدور: ${clean(user.role, 100)}\n\nأجب عن سؤال المستخدم الحالي مباشرة. إذا طلب خطوات تنفيذ، أعطه الخطوات بالترتيب داخل Dragon Media.`

    const model = process.env.RYAN_GEMINI_MODEL || 'gemini-3.6-flash'
    let reply = ''
    if (process.env.GEMINI_API_KEY) {
      const contents = [
        { role: 'user', parts: [{ text: internalPrompt }] },
        { role: 'model', parts: [{ text: 'فهمت. سأشرح استخدام Dragon Media للمستخدم الحالي بشكل عملي وآمن.' }] },
        ...history.map((item: any) => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content }] })),
        { role: 'user', parts: [{ text: message }] },
      ]
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 700, temperature: 0.25 } }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error?.message || `Gemini ${response.status}`)
      reply = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => String(p?.text || '')).join('').trim()
    }

    if (!reply && process.env.GROQ_API_KEY) {
      const groqMessages = [{ role: 'system', content: internalPrompt }, ...history, { role: 'user', content: message }]
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({ model: process.env.RYAN_GROQ_MODEL || 'openai/gpt-oss-120b', messages: groqMessages, temperature: 0.25, max_tokens: 700 }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error?.message || `Groq ${response.status}`)
      reply = clean(data?.choices?.[0]?.message?.content, 5000)
    }

    if (!reply) throw new Error('خدمة Ryan غير متاحة حاليًا')
    if (/^\s*[\[{]/.test(reply) || /functionCall|functionResponse|service_name/.test(reply)) reply = 'ممكن توضّح لي إيه المهمة اللي عايز تعرف تعملها داخل Dragon Media؟'

    return res.status(200).json({ ok: true, reply, model, userId: user.id, organizationId: user.organization_id })
  } catch (error: any) {
    console.error('Ryan internal assistant error', error)
    return res.status(500).json({ error: error?.message || 'حدث خطأ أثناء تشغيل المساعد الداخلي' })
  }
}
