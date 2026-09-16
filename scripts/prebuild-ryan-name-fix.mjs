import fs from 'node:fs'
import path from 'node:path'

const file = path.resolve('api/admin/[route].ts')
let source = fs.readFileSync(file, 'utf8')

const marker = "function conversationState(history: RyanTurn[], memory: JsonMap, currentMessage: string) {"
const helper = `function explicitNameAnswer(history: RyanTurn[], currentMessage: string) {\n  const text = clean(currentMessage, 120)\n  const lastModel = history.filter((item) => item.role === 'model').at(-1)?.text || ''\n  if (!text || !/(اسمك|اسم حضرتك|اسمك بالكامل|الاسم)/i.test(lastModel)) return ''\n  if (text.length > 40 || /[0-9@+]/.test(text) || /[.!؟?،,]/.test(text)) return ''\n  const words = text.split(/\\s+/).filter(Boolean)\n  if (words.length < 1 || words.length > 3) return ''\n  return reliableName(text)\n}\n`
if (!source.includes('function explicitNameAnswer(')) {
  if (!source.includes(marker)) throw new Error('Ryan source marker not found: conversationState')
  source = source.replace(marker, helper + marker)
}

const oldMemory = "const memory = asMap(customer?.ai_memory); const memoryText = Object.entries(memory)"
const newMemory = `const memory = asMap(customer?.ai_memory); const explicitName = explicitNameAnswer(history, currentMessage); const explicitNameCaptured = !!explicitName && !reliableName(customer?.name) && !reliableName(memory.name); if (explicitNameCaptured && customer?.id && rememberCustomer) { const nextMemory = { ...memory, name: explicitName, updated_at: new Date().toISOString(), source: 'ryan' }; await supabase.from('customers').update({ ai_memory: nextMemory, updated_at: new Date().toISOString() }).eq('id', customer.id).eq('organization_id', organizationId); memory.name = explicitName } const memoryText = Object.entries(memory)`
if (source.includes(oldMemory)) {
  source = source.replace(oldMemory, newMemory)
} else if (!source.includes('const explicitNameCaptured')) {
  throw new Error('Ryan source marker not found: memory')
}

const oldFallback = "const fallback = leadCreated ? 'تمام، سجلت بيانات حضرتك، وهيتواصل معاك حد من فريق Dragon Media عشان نكمل معاك.' : currentGreetingOnly ? greetingFallback(memory, priorMeaningfulContext, timezone, history) : serviceIntent && (!customerName || customerName === 'غير معروف') ? 'تمام، عشان أسجل بيانات حضرتك في الـCRM، ممكن أعرف اسم حضرتك؟' : history.length ? 'تمام، نكمل من آخر نقطة وصلنا لها.' : 'أهلًا بيك، قولي حابب نساعدك في إيه؟'; reply = safeReply(reply, fallback)"
const newFallback = "const fallback = leadCreated ? 'تمام، سجلت بيانات حضرتك، وهيتواصل معاك حد من فريق Dragon Media عشان نكمل معاك.' : currentGreetingOnly ? greetingFallback(memory, priorMeaningfulContext, timezone, history) : explicitNameCaptured ? `تشرفت يا ${customerName}، تحب نساعدك في أنهي خدمة؟` : serviceIntent && (!customerName || customerName === 'غير معروف') ? 'تمام، عشان أسجل بيانات حضرتك في الـCRM، ممكن أعرف اسم حضرتك؟' : history.length ? 'تمام، نكمل من آخر نقطة وصلنا لها.' : 'أهلًا بيك، قولي حابب نساعدك في إيه؟'; reply = safeReply(reply, fallback)"
if (source.includes(oldFallback)) {
  source = source.replace(oldFallback, newFallback)
} else if (!source.includes('explicitNameCaptured ?')) {
  throw new Error('Ryan source marker not found: fallback')
}

fs.writeFileSync(file, source)
console.log('Ryan explicit-name flow patch applied')
