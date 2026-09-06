import { createClient } from '@supabase/supabase-js'

const tools = [
  {
    functionDeclarations: [
      {
        name: 'create_lead',
        description: 'إنشاء عميل محتمل جديد في نظام CRM عند إبداء عميل اهتمامه بخدمات أو منتجات الشركة',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'اسم العميل المحتمل' },
            phone: { type: 'STRING', description: 'رقم هاتف العميل' },
            company: { type: 'STRING', description: 'اسم شركة العميل إن وجد' },
            source: { type: 'STRING', description: 'مصدر التواصل، مثل واتساب أو فيسبوك' },
          },
          required: ['name'],
        },
      },
      {
        name: 'create_deal',
        description: 'إنشاء صفقة بيعية جديدة في مسار المبيعات عندما يوافق العميل مبدئيًا على شراء خدمة أو منتج معين',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'عنوان الصفقة، مثل اسم الخدمة أو المنتج المطلوب' },
            value: { type: 'NUMBER', description: 'القيمة التقديرية للصفقة بالجنيه المصري إن ذُكرت' },
            customer_name: { type: 'STRING', description: 'اسم العميل المرتبط بالصفقة إن كان موجودًا في النظام كعميل' },
          },
          required: ['title'],
        },
      },
      {
        name: 'book_appointment',
        description: 'حجز موعد للعميل عندما يطلب حجز استشارة أو موعد لخدمة معينة',
        parameters: {
          type: 'OBJECT',
          properties: {
            customer_name: { type: 'STRING', description: 'اسم العميل' },
            service_name: { type: 'STRING', description: 'اسم الخدمة المطلوب حجز موعد لها' },
            date: { type: 'STRING', description: 'تاريخ الموعد بصيغة YYYY-MM-DD' },
            time: { type: 'STRING', description: 'وقت الموعد بصيغة HH:MM بنظام 24 ساعة' },
          },
          required: ['date', 'time'],
        },
      },
    ],
  },
]

async function runFunction(supabase: any, name: string, args: any) {
  if (name === 'create_lead') {
    const { error } = await supabase.rpc('ai_create_lead', {
      p_name: args.name, p_phone: args.phone || null, p_company: args.company || null, p_source: args.source || 'RYAN AI',
    })
    return { error }
  }
  if (name === 'create_deal') {
    const { error } = await supabase.rpc('ai_create_deal', {
      p_title: args.title, p_value: args.value || 0, p_customer_name: args.customer_name || null,
    })
    return { error }
  }
  if (name === 'book_appointment') {
    const { error } = await supabase.rpc('ai_book_appointment', {
      p_customer_name: args.customer_name || null, p_service_name: args.service_name || null, p_date: args.date, p_time: args.time,
    })
    return { error }
  }
  return { error: { message: 'أداة غير معروفة' } }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'الطريقة غير مسموحة' }); return }

  const apiKey = process.env.GEMINI_API_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!apiKey || !supabaseUrl || !supabaseAnonKey) {
    res.status(500).json({ error: 'الإعدادات غير مكتملة على السيرفر' })
    return
  }

  const { message, history, companyName, accessToken } = req.body || {}
  if (!message) { res.status(400).json({ error: 'الرسالة مطلوبة' }); return }

  const supabase = accessToken
    ? createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
    : null

  let knowledgeText = ''
  if (supabase) {
    const { data: kb } = await supabase.from('knowledge_base').select('title, content').limit(15)
    if (kb && kb.length > 0) {
      knowledgeText = '\n\nمعلومات عن الشركة يجب استخدامها عند الرد (لا تخترع معلومات غيرها عن الشركة إن وُجدت):\n' +
        kb.map((k: any) => `- ${k.title}: ${k.content}`).join('\n')
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const systemPrompt = `أنت "ريان"، موظف مبيعات وخدمة عملاء ذكي يعمل داخل نظام إدارة العملاء لصالح شركة ${companyName || 'العميل'}. تتحدث باللهجة المصرية العامية بأسلوب ودود ومحترف. تخاطب العميل بـ"حضرتك" أو "أستاذ/أستاذة". النهاردة تاريخ ${today}.
لما عميل يبدي اهتمام حقيقي أو يطلب حد يتواصل معاه، استخدم أداة create_lead لتسجيله فورًا.
لما عميل يوافق مبدئيًا على شراء خدمة أو منتج، استخدم أداة create_deal.
لما عميل يطلب حجز موعد أو استشارة، استخدم أداة book_appointment (لو التاريخ غير واضح اسأله يحدده قبل ما تستخدم الأداة).
لا تسأل العميل إذن قبل استخدام أي أداة، نفّذها مباشرة وبعدها أخبره إنك خلّصت.${knowledgeText}`

  const contents: any[] = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'تمام، فاهم دوري.' }] },
    ...(Array.isArray(history) ? history : []),
    { role: 'user', parts: [{ text: message }] },
  ]

  try {
    let response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents, tools }) }
    )
    let data = await response.json()
    let parts = data?.candidates?.[0]?.content?.parts
    let actionTaken: string | null = null

    const functionCallPart = parts?.find((p: any) => p.functionCall)
    if (functionCallPart && supabase) {
      const { name, args } = functionCallPart.functionCall
      const { error } = await runFunction(supabase, name, args)
      const functionResult = error ? { success: false, error: error.message } : { success: true }
      if (!error) actionTaken = name

      contents.push({ role: 'model', parts: [functionCallPart] })
      contents.push({ role: 'user', parts: [{ functionResponse: { name, response: functionResult } }] })

      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents, tools }) }
      )
      data = await response.json()
      parts = data?.candidates?.[0]?.content?.parts
    }

    const reply = parts?.find((p: any) => p.text)?.text
    if (!reply) { res.status(502).json({ error: 'لم يتم استلام رد من الذكاء الاصطناعي', details: data }); return }
    res.status(200).json({ reply, actionTaken })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'حدث خطأ غير متوقع' })
  }
}
