import { readFileSync, writeFileSync } from 'node:fs'

const path = 'api/admin/ryan-inbox.ts'
let source = readFileSync(path, 'utf8')

let changed = false
const oldFallback = "const fallbackModels=allowFallback?['gemini-3.5-flash-lite']:[]"
const newFallback = "const fallbackModels=allowFallback?['gemini-3.1-flash-lite']:[]"
if (source.includes(oldFallback)) {
  source = source.replace(oldFallback, newFallback)
  changed = true
}

const malformedMemory = "name_source:(isWhatsApp?(rememberedExplicitName||explicitName)?'customer_explicit':null):(explicitName?'customer_explicit':'crm')"
const safeMemory = "name_source:(isWhatsApp ? ((rememberedExplicitName||explicitName) ? 'customer_explicit' : null) : (explicitName ? 'customer_explicit' : 'crm'))"
if (source.includes(malformedMemory)) {
  source = source.replace(malformedMemory, safeMemory)
  changed = true
}

// Explicit name extraction: direct statements and a bare answer such as "كريم".
const oldExtract = "const extractName=(v:string)=>{const m=v.match(/(?:أنا\\s+اسمي|انا\\s+اسمي|اسمي|my\\s+name\\s+is)\\s+([^,،.!؟?\\n]+?)(?:\\s+(?:ورقمي|ورقمى|رقمي|رقمى|رقم)\\b|$)/iu);return m&&looksLikeName(m[1])?text(m[1],120):''}"
const newExtract = "const extractName=(v:string)=>{const normalized=text(v,120).replace(/\\s+/g,' ').trim();const m=normalized.match(/(?:أنا\\s+اسمي|انا\\s+اسمي|اسمي|my\\s+name\\s+is)\\s+([^,،.!؟?\\n]+?)(?:\\s+(?:ورقمي|ورقمى|رقمي|رقمى|رقم)\\b|$)/iu);if(m&&looksLikeName(m[1]))return text(m[1],120);return looksLikeName(normalized)?normalized:''}"
if (source.includes(oldExtract)) {
  source = source.replace(oldExtract, newExtract)
  changed = true
}

// If Ryan's previous message asked for the customer's name, a short valid Arabic name by itself is an explicit answer.
const oldExplicit = "const explicitName=extractName(current);const learnedName=explicitName;const learnedPhone=cleanPhone(text(plan.learned_phone,80))||phoneFromText(current);"
const newExplicit = "const lastModelMessage=(history.slice().reverse().find((t:any)=>t.role==='model')?.parts?.[0]?.text||'').toString();const nameQuestionPending=/(?:اسم حضرتك|اسمك|اسمِك|الاسم|أسم حضرتك|أسمك)/iu.test(lastModelMessage);const explicitName=extractName(current)||((nameQuestionPending&&looksLikeName(text(current,120)))?text(current,120):'');const learnedName=explicitName;const learnedPhone=cleanPhone(text(plan.learned_phone,80))||phoneFromText(current);"
if (source.includes(oldExplicit)) {
  source = source.replace(oldExplicit, newExplicit)
  changed = true
}

// Tell Gemini how to interpret conversational replies and maintain customer identity.
const oldPrompt = "لو العميل قال اسمه احفظه واستخدمه لاحقاً بنفس الكتابة المحفوظة تماماً، بدون اختصار أو تغيير أو تخمين أو اقتطاع للاسم."
const newPrompt = "لو سألت العميل عن اسمه ثم رد بكلمة أو اسم قصير صالح مثل «كريم»، فافهمه فوراً على أنه اسم العميل حتى لو لم يقل «أنا اسمي». احفظ الاسم واستخدمه لاحقاً بنفس الكتابة المحفوظة تماماً، بدون اختصار أو تغيير أو تخمين أو اقتطاع للاسم. لا تخلط بين اسم العميل واسم حساب WhatsApp أو اسم الملف الشخصي."
if (source.includes(oldPrompt)) {
  source = source.replace(oldPrompt, newPrompt)
  changed = true
}

const marker = `// Hard safety guard: a new customer must be asked for their name before Ryan moves into qualification.`
if (source.includes(marker)) {
  if (changed) writeFileSync(path, source, 'utf8')
  process.exit(0)
}

const old = `const effectiveName=text(customer.name,120);const hasTrustedName=effectiveName&&looksLikeName(effectiveName)&&!invalidCustomerName(effectiveName);const nameWasProvidedNow=Boolean(explicitName&&looksLikeName(explicitName)&&!invalidCustomerName(explicitName));
 if(!hasTrustedName&&!nameWasProvidedNow&&!aiUnavailable){
  plan.reply='ممكن أعرف اسم حضرتك الأول؟';plan.action='continue';plan.action_data={};
 }
 let actionResult:any={success:true};`

const replacement = `const effectiveName=text(customer.name,120);const hasTrustedName=effectiveName&&looksLikeName(effectiveName)&&!invalidCustomerName(effectiveName);const nameWasProvidedNow=Boolean(explicitName&&looksLikeName(explicitName)&&!invalidCustomerName(explicitName));
 const phoneWasProvidedNow=Boolean(phoneFromText(current));
 if(!hasTrustedName&&!nameWasProvidedNow&&!aiUnavailable){
  plan.reply='اهلاً وسهلا بحضرتك يافندم ، ممكن أتشرف بأسم حضرتك';plan.action='continue';plan.action_data={};
 }
 if((hasTrustedName||nameWasProvidedNow)&&!phoneWasProvidedNow&&!aiUnavailable&&['handoff_human','create_lead'].includes(text(plan.action,60))){
  plan.reply='تمام يا فندم، ممكن أعرف رقم حضرتك للتواصل؟';plan.action='continue';plan.action_data={};
 }
 let actionResult:any={success:true};`

if (source.includes(replacement)) {
  if (changed) writeFileSync(path, source, 'utf8')
  process.exit(0)
}
if (!source.includes(old)) throw new Error('Target Ryan policy block not found; refusing to patch')
source = source.replace(old, replacement)
writeFileSync(path, source, 'utf8')
console.log('Ryan policy patched' + (changed ? ' + conversational name understanding' : ''))
