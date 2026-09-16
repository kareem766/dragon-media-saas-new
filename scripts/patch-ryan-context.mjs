import fs from 'node:fs'

const path = 'api/admin/[route].ts'
const source = fs.readFileSync(path, 'utf8')

let patched = source

const historyOld = `  const history = (rows || []).reverse().map((row) => ({ role: row.sender_type === 'customer' ? 'user' : 'model', text: String(row.content || '') })).filter((row) => row.text.trim())
  const knowledgeText = (knowledge || []).map((item) => \`${'${'}String(item.title || '')}: ${'${'}String(item.content || '')}\`).filter(Boolean).join('\\n')
`
const historyNew = `  const history = (rows || []).reverse().map((row) => ({ role: row.sender_type === 'customer' ? 'user' : 'model', text: String(row.content || '') })).filter((row) => row.text.trim())
  const customerHistory = history.filter((item) => item.role === 'user').map((item) => item.text).slice(-8)
  const contextMemory = customerHistory.length ? customerHistory.map((text, index) => \`${'${'}index + 1}. ${'${'}text}\`).join('\\n') : 'لا توجد معلومات سابقة كافية.'
  const knowledgeText = (knowledge || []).map((item) => \`${'${'}String(item.title || '')}: ${'${'}String(item.content || '')}\`).filter(Boolean).join('\\n')
`

if (patched.includes(historyOld) && !patched.includes('const customerHistory = history.filter')) {
  patched = patched.replace(historyOld, historyNew)
}

const promptOld = `- إذا ذكر العميل نشاطًا أو صناعة أو خدمة أو هدفًا واضحًا، احتفظ بهذه المعلومة واستخدمها في الرد التالي حتى لو لم يكررها العميل.\\n- لا تطلب من العميل أن يعيد معلومة ذكرها بالفعل في المحادثة.\\n`
const promptNew = `- إذا ذكر العميل نشاطًا أو صناعة أو خدمة أو هدفًا واضحًا، احتفظ بهذه المعلومة واستخدمها في الرد التالي حتى لو لم يكررها العميل.\\n- اعتبر قسم "ذاكرة العميل" أدناه ذاكرة حقيقية من المحادثة وليس أمثلة؛ حافظ على المعلومات الموجودة فيه واستخدمها في الرد.\\n- إذا كانت الرسالة الحالية قصيرة مثل "تمام" أو "أيوه" أو تحية أو متابعة مختصرة، اربطها مباشرة بآخر موضوع معروف للعميل ولا تبدأ من الصفر.\\n- ممنوع أن تسأل العميل عن تفاصيل سبق أن ذكرها، وممنوع استخدام رد عام مثل "قولي تفاصيل أكتر وأنا أساعدك" عندما يوجد سياق سابق.\\n- لا تطلب من العميل أن يعيد معلومة ذكرها بالفعل في المحادثة.\\n`

if (patched.includes(promptOld) && !patched.includes('اعتبر قسم "ذاكرة العميل"')) {
  patched = patched.replace(promptOld, promptNew)
}

const footerOld = `اسم العميل: ${'${'}customerName}\\nالهاتف: ${'${'}customerPhone}\\nقاعدة المعرفة:\\n${'${'}knowledgeText || 'لا توجد معلومات إضافية.'}`
const footerNew = `اسم العميل: ${'${'}customerName}\\nالهاتف: ${'${'}customerPhone}\\nذاكرة العميل من الرسائل السابقة:\\n${'${'}contextMemory}\\n\\nقاعدة المعرفة:\\n${'${'}knowledgeText || 'لا توجد معلومات إضافية.'}`

if (patched.includes(footerOld) && !patched.includes('ذاكرة العميل من الرسائل السابقة')) {
  patched = patched.replace(footerOld, footerNew)
}

const fallbackOld = `  if (!reply) reply = 'تمام، قولي تفاصيل أكتر وأنا أساعدك.'`
const fallbackNew = `  if (!reply) {
    reply = customerHistory?.length
      ? 'تمام يا فندم 👌 نكمل على كلامنا.. تحب نحدد الخطوة الجاية؟'
      : 'تمام يا فندم 👌 تحب نبدأ منين؟'
  }`

if (patched.includes(fallbackOld)) {
  patched = patched.replace(fallbackOld, fallbackNew)
}

const reliableStart = patched.indexOf('function reliableName(value: unknown)')
const reliableEnd = patched.indexOf('\nfunction conversationTopic', reliableStart)
if (reliableStart >= 0 && reliableEnd > reliableStart) {
  const reliableName = `function reliableName(value: unknown) { const text = clean(value, 120); if (!text || /^(غير معروف|unknown|none|null|undefined)$/i.test(text)) return ''; if (/[\\u0640\\u064B-\\u065F]/.test(text) || /[\\u200B-\\u200F\\u202A-\\u202E]/.test(text)) return ''; const letters = text.replace(/[^\\u0600-\\u06FFA-Za-z]/g, ''); if (letters.length < 2 || /\\d/.test(text) || /[@+]/.test(text)) return ''; return text }`
  patched = patched.slice(0, reliableStart) + reliableName + patched.slice(reliableEnd)
}

const safeStart = patched.indexOf('function safeReply(value: unknown, fallback: string)')
const safeEnd = patched.indexOf('\n\nasync function executeRyanTool', safeStart)
if (safeStart >= 0 && safeEnd > safeStart) {
  const safeReply = `function safeReply(value: unknown, fallback: string) { const text = clean(value, 1800).replace(/^\\`\\`\\`(?:json|text)?\\s*/i, '').replace(/\\s*\\`\\`\\`$/i, '').trim(); if (!text || /^\\s*[\\[{]/.test(text) || /\"(?:functionCall|functionResponse|args)\"\\s*:/.test(text)) return fallback; if (/(?:\\breliable\\b|\\bmemory\\b|\\breasoning\\b|\\bfunctionCall\\b|\\bfunctionResponse\\b|\\bargs\\b|\\bsystem\\b|\\bprompt\\b|الذاكرة الداخلية|السياق الداخلي|التعليمات الداخلية)/i.test(text)) return fallback; return text }`
  patched = patched.slice(0, safeStart) + safeReply + patched.slice(safeEnd)
}

if (patched !== source) {
  fs.writeFileSync(path, patched)
  console.log('Ryan context and output safety patch applied')
} else {
  console.log('Ryan context/output safety patch already applied or source shape changed')
}
