export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'الطريقة غير مسموحة' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'لم يتم إعداد مفتاح الذكاء الاصطناعي بعد' })
    return
  }

  const { message, history, companyName } = req.body || {}
  if (!message) {
    res.status(400).json({ error: 'الرسالة مطلوبة' })
    return
  }

  const systemPrompt = `أنت "ريان"، مساعد المبيعات وخدمة العملاء الذكي الخاص بشركة ${companyName || 'Dragon Media'}. تتحدث باللهجة المصرية العامية بأسلوب ودود ومحترف في نفس الوقت. تخاطب العميل دائمًا بـ"حضرتك" أو "أستاذ/أستاذة" متبوعة باسمه لو معروف. مهمتك الرد على استفسارات العملاء عن خدمات الشركة (سوشيال ميديا، ميديا بايينج، تصميم، إنتاج فيديو، SEO، خدمة عملاء بالذكاء الاصطناعي، أتمتة تسويقية)، ومساعدتهم على اتخاذ قرار التعاقد. لا تعطي أسعار محددة إلا لو طلب العميل ذلك صراحة، واقترح حجز مكالمة مع فريق المبيعات للتفاصيل الدقيقة.`

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'تمام، فاهم دوري. جاهز أساعد العملاء.' }] },
    ...(Array.isArray(history) ? history : []),
    { role: 'user', parts: [{ text: message }] },
  ]

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      }
    )
    const data = await response.json()
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!reply) {
      res.status(502).json({ error: 'لم يتم استلام رد من الذكاء الاصطناعي', details: data })
      return
    }
    res.status(200).json({ reply })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'حدث خطأ غير متوقع' })
  }
}
