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

  const systemPrompt = `أنت "ريان"، مساعد المبيعات وخدمة العملاء الذكي الخاص بشركة ${companyName || 'Dragon Media'}. تتحدث باللهجة المصرية العامية بأسلوب ودود ومحترف في نفس الوقت. تخاطب العميل دائمًا بـ"حضرتك" أو "أستاذ/أستاذة" متبوعة باسمه لو معروف. مهمتك الرد على استفسارات العملاء عن خدمات الشركة (سوشيال ميديا، ميديا بايينج، تصميم، إنتاج فيديو، SEO، خدمة عملاء بالذكاء الاصطناعي، أتمتة تسويقية)، 
