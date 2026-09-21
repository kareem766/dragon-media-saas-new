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

// Repair the malformed nested ternary introduced by the WhatsApp-name isolation patch.
const malformedMemory = "name_source:(isWhatsApp?(rememberedExplicitName||explicitName)?'customer_explicit':null):(explicitName?'customer_explicit':'crm')"
const safeMemory = "name_source:(isWhatsApp ? ((rememberedExplicitName||explicitName) ? 'customer_explicit' : null) : (explicitName ? 'customer_explicit' : 'crm'))"
if (source.includes(malformedMemory)) {
  source = source.replace(malformedMemory, safeMemory)
  changed = true
}

// A bare customer message such as "كريم" is an explicit name when it passes the name validator.
// This prevents Ryan from asking for the name again after the customer already supplied it.
const oldExtract = "const extractName=(v:string)=>{const m=v.match(/(?:أنا\\s+اسمي|انا\\s+اسمي|اسمي|my\\s+name\\s+is)\\s+([^,،.!؟?\\n]+?)(?:\\s+(?:ورقمي|ورقمى|رقمي|رقمى|رقم)\\b|$)/iu);return m&&looksLikeName(m[1])?text(m[1],120):''}"
const newExtract = "const extractName=(v:string)=>{const normalized=text(v,120).replace(/\\s+/g,' ').trim();const m=normalized.match(/(?:أنا\\s+اسمي|انا\\s+اسمي|اسمي|my\\s+name\\s+is)\\s+([^,،.!؟?\\n]+?)(?:\\s+(?:ورقمي|ورقمى|رقمي|رقمى|رقم)\\b|$)/iu);if(m&&looksLikeName(m[1]))return text(m[1],120);return looksLikeName(normalized)?normalized:''}"
if (source.includes(oldExtract)) {
  source = source.replace(oldExtract, newExtract)
  changed = true
}

// Keep WhatsApp conversations on the explicitly supplied customer name, never the WhatsApp profile name.
const oldEffective = "const effectiveName=isWhatsApp?(rememberedExplicitName||text(explicitName,120)):text(customer.name,120)"
const newEffective = "const effectiveName=isWhatsApp?(rememberedExplicitName||text(explicitName,120)):text(customer.name,120)"
if (source.includes(oldEffective) && oldEffective !== newEffective) {
  source = source.replace(oldEffective, newEffective)
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
 // Do not hand off or create a lead before Ryan explicitly collects a contact number from the customer.
 // The WhatsApp sender number is available technically, but it is not treated as customer-confirmed contact data.
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
console.log('Ryan policy patched' + (changed ? ' + Gemini fallback normalized' : ''))
