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
    ],
  },
]

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'الطريقة غير مسموحة' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!apiKey || !supabaseUrl || !supabaseAnonKey) {
    res.status(500).json({ error: 'الإعدادات غير مكتملة على السيرفر' })
    return
  }

  const { message, history, companyName, accessToken } = req.body || {}
  if (!message) {
    res.status(400).json({ error: 'الرسالة مطلوبة' })
    return
  }

  const supabase = accessToken
    ? createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
    : null

  const systemPrompt = `أنت "ريان"، موظف مبيعات وخدمة عملاء ذكي يعمل داخل نظام إدارة العملاء لصالح شركة ${companyName || 'العميل'}. تتحدث باللهجة المصرية العامية بأسلوب ودود ومحترف. تخاطب العميل بـ"حضرتك" أو "أستاذ/أستاذة". لما عميل يبدي اهتمام حقيقي أو يطلب حد يتواصل معاه، استخدم أداة create_lead لتسجيله فورًا قبل ما ترد عليه، من غير ما تسأله إذن. بعد التسجيل أخبره إن فريق المبيعات هيتواصل معاه قريبًا.`

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
      let functionResult: any = { success: false }

      if (name === 'create_lead') {
        const { error } = await supabase.rpc('ai_create_lead', {
          p_name: args.name,
          p_phone: args.phone || null,
          p_company: args.company || null,
          p_source: args.source || 'RYAN AI',
        })
        functionResult = error ? { success: false, error: error.message } : { success: true }
        if (!error) actionTaken = 'create_lead'
      }

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
    if (!reply) {
      res.status(502).json({ error: 'لم يتم استلام رد من الذكاء الاصطناعي', details: data })
      return
    }
    res.status(200).json({ reply, actionTaken })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'حدث خطأ غير متوقع' })
  }
}
