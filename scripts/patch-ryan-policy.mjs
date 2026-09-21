import { readFileSync, writeFileSync } from 'node:fs'

const path = 'api/admin/ryan-inbox.ts'
const source = readFileSync(path, 'utf8')

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

if (source.includes(replacement)) process.exit(0)
if (!source.includes(old)) throw new Error('Target Ryan policy block not found; refusing to patch')
writeFileSync(path, source.replace(old, replacement), 'utf8')
console.log('Ryan policy patched')
