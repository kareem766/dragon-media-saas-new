import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'
import { prepareRyanMultimodal } from '../_server/admin/ryan-multimodal'

const env=(...names:string[])=>names.map(n=>process.env[n]).find(v=>v?.trim())?.trim()||''
const db=()=>createClient(env('VITE_SUPABASE_URL','SUPABASE_URL'),env('SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})
const text=(v:unknown,max=2000)=>typeof v==='string'?v.trim().slice(0,max):''
const obj=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{ }
const sameSecret=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
const cleanPhone=(v:string)=>v.replace(/[^0-9+]/g,'').trim()
const phoneFromText=(v:string)=>{const m=v.match(/(?:\+?20\s*)?(01[0125]\s*\d{8})\b/);return m?cleanPhone(m[0]):''}
const validPhone=(v:string)=>/^(?:01[0125]\d{8}|20(10|11|12|15)\d{8})$/.test(cleanPhone(v).replace(/^\+/,''))
const nameStop=/^(?:تمام|حاضر|ماشي|اه|أه|ايوه|أيوه|السلام عليكم|السلام عليكم ورحمة الله وبركاته|وعليكم السلام|اهلا|أهلا|أهلًا|منور|ممكن|عايز|عاوز|محتاج|الخدمة|خدمة|السعر|سعر|بكام|بكم|كام|شكرا|شكراً|العفو)$/iu
const invalidCustomerName=(v:string)=>nameStop.test(v.trim().replace(/\\s+/g,' '))
const looksLikeName=(v:string)=>{const x=v.trim().replace(/\s+/g,' ');if(!x||x.length<2||x.length>80||nameStop.test(x)||phoneFromText(x)||/[?؟!]/.test(x))return false;return /^[\p{L}][\p{L}\u064B-\u065F\s.'’-]{1,79}$/u.test(x)}
const extractName=(v:string)=>{const m=v.match(/(?:أنا\s+اسمي|انا\s+اسمي|اسمي|my\s+name\s+is)\s+([^,،.!؟?\n]+?)(?:\s+(?:ورقمي|ورقمى|رقمي|رقمى|رقم)\b|$)/iu);return m&&looksLikeName(m[1])?text(m[1],120):''}
const budgetFromText=(v:string)=>{const m=v.replace(/[,،]/g,' ').match(/(?:ميزاني(?:ة|ه)|budget)\s*(?:هي|هو|:)?\s*([0-9٠-٩][0-9٠-٩\s.,]*)/iu)||v.match(/([0-9٠-٩]+)\s*(?:جنيه|ج|EGP|الف|ألف)/iu);return m?text(m[1],60):''}

type Turn={role:'user'|'model';parts:{text:string}[]}

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
const transientStatus=(status:number)=>status===408||status===425||status===429||status>=500
const retryDelay=(attempt:number)=>Math.min(5000,600*Math.pow(2,attempt)+Math.floor(Math.random()*500))
const parseGeminiJson=(raw:string)=>{
 const clean=text(raw,14000).replace(/^\`\`\`(?:json)?/i,'').replace(/\`\`\`$/,'').trim()
 const start=clean.indexOf('{'),end=clean.lastIndexOf('}')
 return obj(JSON.parse(start>=0&&end>start?clean.slice(start,end+1):clean))
}
async function callGemini(key:string,model:string,system:string,history:Turn[],current:string,currentParts:any[]=[],temperature=0.45,allowFallback=true){
 const fallbackModels=allowFallback?['gemini-3.6-flash','gemini-3.5-flash-lite','gemini-2.5-flash']:[]
 const candidates=[model,...fallbackModels].filter((v,i,a)=>v&&a.indexOf(v)===i)
 let last='Gemini unavailable'
 for(const candidate of candidates){
  for(let attempt=0;attempt<3;attempt++){
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000)
   try{
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(candidate)+':generateContent?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({systemInstruction:{parts:[{text:system+'\
\
إخراجك يجب أن يكون JSON صالحاً فقط، بدون markdown أو أي نص خارجه.'}]},contents:[...history,{role:'user',parts:[{text:current},...currentParts]}],generationConfig:{maxOutputTokens:900,temperature:Math.min(1,Math.max(0,Number(temperature)||0.45)),responseMimeType:'application/json'}})})
    const d=await r.json().catch(()=>({}))
    if(r.ok){
     const raw=text(d?.candidates?.[0]?.content?.parts?.map((p:any)=>p?.text||'').join(''),14000)
     if(raw){try{return {plan:parseGeminiJson(raw),model:candidate}}catch{last=candidate+' returned invalid JSON'}}
     else last=candidate+' returned empty'
     if(attempt<2){await sleep(retryDelay(attempt));continue}
     break
    }
    last=text(d?.error?.message,500)||('Gemini '+r.status)
    if(transientStatus(r.status)&&attempt<2){await sleep(retryDelay(attempt));continue}
    break
   }catch(e:any){
    last=e?.name==='AbortError'?candidate+' request timed out':text(e?.message,500)||last
    if(attempt<2){await sleep(retryDelay(attempt));continue}
    break
   }finally{clearTimeout(timeout)}
  }
 }
 throw new Error(last)
}

async function notifyOrgAdmins(supabase:any,organizationId:string,title:string,body:string,link:string,entityType:string,entityId:string){
 const {data:admins}=await supabase.from('users').select('id').eq('organization_id',organizationId).eq('active',true).or('role.eq.admin,is_platform_admin.eq.true')
 if(admins?.length)await supabase.from('notifications').insert(admins.map((u:any)=>({organization_id:organizationId,user_id:u.id,type:'ryan_action',title,body,message:body,link,entity_type:entityType,entity_id:entityId,is_read:false})))
}

async function executeAction(supabase:any,organizationId:string,customer:any,conversation:any,action:string,data:any,services:any[]){
 const d=obj(data);if(action==='continue')return {success:true}
 if(action==='handoff_human'){
  const reason=text(d.reason,500)||'العميل طلب التحدث مع موظف بشري.'
  const {data:req,error}=await supabase.from('human_handoff_requests').insert({organization_id:organizationId,customer_name:text(customer.name,120)||'العميل',reason,status:'open',conversation_id:conversation.id}).select('id').single()
  if(error)throw new Error(error.message)
  const {data:updated,error:updateError}=await supabase.from('conversations').update({handled_by:'human',status:'open',updated_at:new Date().toISOString()}).eq('id',conversation.id).eq('organization_id',organizationId).select('id').single()
  if(updateError||!updated)throw new Error(updateError?.message||'Failed to handoff conversation')
  await notifyOrgAdmins(supabase,organizationId,'ريان طلب موظف بشري','العميل '+(text(customer.name,120)||'العميل')+' يحتاج تدخل موظف بشري. السبب: '+reason,'/handoff-requests?request='+req.id,'handoff',req.id)
  return {success:true,data:{handoff_id:req.id}}
 }
 if(action==='create_lead'){
  const name=text(d.name,120)||text(customer.name,120),phone=cleanPhone(text(d.phone,80))||cleanPhone(text(customer.phone,80))
  if(!name||!validPhone(phone))return {success:false,message:'Lead needs a valid name and phone'}
  const {data:existing}=await supabase.from('leads').select('id').eq('organization_id',organizationId).eq('phone',phone).is('deleted_at',null).limit(1)
  if(existing?.length)return {success:true,data:{lead_id:existing[0].id,existing:true}}
  const service=text(d.service,160),notes=text(d.notes,1000)||('تم تأهيل العميل بواسطة Ryan. الخدمة: '+(service||'غير محددة'))
  const {data:lead,error}=await supabase.from('leads').insert({organization_id:organizationId,name,phone,source:text(conversation.channel,40)||'ريان',status:'جديد',notes,lead_score:Math.max(0,Math.min(100,Number(d.lead_score)||50)),customer_id:customer.id}).select('id').single()
  if(error)throw new Error(error.message)
  return {success:true,data:{lead_id:lead.id}}
 }
 if(action==='create_task'){
  const title=text(d.title,160);if(!title)return {success:false,message:'Missing task title'}
  const due=text(d.due_date,20),dueDate=due?new Date(due+'T23:59:59'):new Date(Date.now()+86400000)
  const {data:u}=await supabase.from('users').select('id').eq('organization_id',organizationId).eq('active',true).order('created_at').limit(1).maybeSingle()
  const {data:t,error}=await supabase.from('tasks').insert({organization_id:organizationId,title,assigned_to:u?.id||null,due_date:dueDate.toISOString().slice(0,10),priority:['عالية','متوسطة','منخفضة'].includes(text(d.priority,30))?text(d.priority,30):'متوسطة',status:'قيد التنفيذ',description:text(d.description,1000)||'مهمة أنشأها Ryan.',customer_id:customer.id,created_by:u?.id||null,reminder_at:d.reminder_at?text(d.reminder_at,80):null}).select('id').single()
  if(error)throw new Error(error.message)
  await notifyOrgAdmins(supabase,organizationId,'ريان أنشأ مهمة','تم إنشاء مهمة للعميل '+(text(customer.name,120)||'العميل')+': '+title,'/tasks?task='+t.id,'task',t.id)
  return {success:true,data:{task_id:t.id}}
 }
 if(action==='update_customer'){
  const updates:any={};const name=text(d.name,120),phone=cleanPhone(text(d.phone,80)),email=text(d.email,160),company=text(d.company,160)
  if(name&&looksLikeName(name)&&!invalidCustomerName(name))updates.name=name;if(validPhone(phone))updates.phone=phone;if(email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))updates.email=email;if(company)updates.company=company
  if(!Object.keys(updates).length)return {success:false,message:'No verified fields'}
  updates.updated_at=new Date().toISOString();const {error}=await supabase.from('customers').update(updates).eq('id',customer.id).eq('organization_id',organizationId);if(error)throw new Error(error.message);return {success:true,data:updates}
 }
 if(action==='follow_up'){
  const at=text(d.follow_up_at,80),date=new Date(at);if(!at||Number.isNaN(date.getTime())||date.getTime()<=Date.now())return {success:false,message:'Invalid follow-up time'}
  const {data:u}=await supabase.from('users').select('id').eq('organization_id',organizationId).eq('active',true).order('created_at').limit(1).maybeSingle()
  const {data:t,error}=await supabase.from('tasks').insert({organization_id:organizationId,title:'متابعة عميل بواسطة Ryan',assigned_to:u?.id||null,due_date:date.toISOString().slice(0,10),priority:'متوسطة',status:'قيد التنفيذ',description:'متابعة أنشأها Ryan من محادثة العميل.',customer_id:customer.id,created_by:u?.id||null,reminder_at:date.toISOString()}).select('id').single();if(error)throw new Error(error.message);await notifyOrgAdmins(supabase,organizationId,'ريان أنشأ متابعة',`تم إنشاء متابعة للعميل ${text(customer.name,120)||'العميل'}.`,`/tasks?task=${t.id}`,'task',t.id);return {success:true,data:{task_id:t.id,follow_up_at:date.toISOString()}}
 }
 if(action==='schedule_appointment'){
  const date=text(d.appointment_date,20),time=text(d.appointment_time,20);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))return {success:false,message:'Missing appointment date/time'}
  const serviceName=text(d.service,160),service=services.find((s:any)=>text(s.name,160).toLowerCase()===serviceName.toLowerCase());const {data:existing}=await supabase.from('appointments').select('id').eq('organization_id',organizationId).eq('appointment_date',date).eq('appointment_time',time).eq('status','قيد الانتظار').limit(1);if(existing?.length)return {success:false,message:'Slot occupied'}
  const {data:a,error}=await supabase.from('appointments').insert({organization_id:organizationId,customer_id:customer.id,service_id:service?.id||null,appointment_date:date,appointment_time:time,status:'قيد الانتظار',notes:'تم الحجز بواسطة Ryan.'}).select('id').single();if(error)throw new Error(error.message);await notifyOrgAdmins(supabase,organizationId,'ريان حجز موعد',`تم حجز موعد للعميل ${text(customer.name,120)||'العميل'} يوم ${date} الساعة ${time}.`,`/appointments?appointment=${a.id}`,'appointment',a.id);return {success:true,data:{appointment_id:a.id,appointment_date:date,appointment_time:time}}
 }
 if(action==='create_automation'){
  const name=text(d.automation_name,160),hours=Math.max(1,Math.min(720,Number(d.hours)||24)),priority=['عالية','متوسطة','منخفضة'].includes(text(d.priority,30))?text(d.priority,30):'متوسطة';if(!name)return {success:false,message:'Missing automation name'}
  const {data:a,error}=await supabase.from('automations').insert({organization_id:organizationId,name,trigger_event:'lead_stale',config:{hours},action_type:'create_task',action_config:{title_template:'متابعة مع {name} - تم إنشاؤها بواسطة Ryan',priority},active:true}).select('id,name').single();if(error)throw new Error(error.message);await notifyOrgAdmins(supabase,organizationId,'ريان أنشأ أتمتة',`تم إنشاء الأتمتة «${name}» بواسطة Ryan.`,`/automations?automation=${a.id}`,'automation',a.id);return {success:true,data:a}
 }
 return {success:false,message:'Unsupported action'}
}

export default async function main(req:VercelRequest,res:VercelResponse){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'})
 const supabase=db(),secret=text(req.headers['x-ryan-inbox-secret'],300);const {data:secretRow}=await supabase.from('system_secrets').select('value').eq('key','ai_agent_inbox_secret').maybeSingle();if(!secret||!secretRow?.value||!sameSecret(secret,String(secretRow.value)))return res.status(401).json({error:'Unauthorized'})
 const body=obj(req.body),organizationId=text(body.organization_id,100),conversationId=text(body.conversation_id,100),messageId=text(body.message_id,100);if(!organizationId||!conversationId||!messageId)return res.status(400).json({error:'Missing agent identifiers'})
 const {data:claimed,error:claimError}=await supabase.rpc('claim_ryan_message',{p_message_id:messageId,p_conversation_id:conversationId});if(claimError)return res.status(500).json({error:'Failed to claim incoming message',details:text(claimError.message,500)});if(!claimed)return res.status(200).json({ok:true,skipped:true})
 const {data:incoming}=await supabase.from('messages').select('id,conversation_id,sender_type,content,metadata,created_at').eq('id',messageId).eq('conversation_id',conversationId).maybeSingle();if(!incoming||incoming.sender_type!=='customer')return res.status(200).json({ok:true,skipped:true})
 const {data:conversation}=await supabase.from('conversations').select('id,organization_id,customer_id,channel,handled_by,metadata').eq('id',conversationId).eq('organization_id',organizationId).maybeSingle();if(!conversation||conversation.handled_by==='human')return res.status(200).json({ok:true,skipped:true})
 const [{data:customer},{data:agent},{data:services}]=await Promise.all([supabase.from('customers').select('id,name,phone,email,company,notes').eq('id',conversation.customer_id).eq('organization_id',organizationId).maybeSingle(),supabase.from('ai_agents').select('id,name,persona,language,settings').eq('organization_id',organizationId).eq('name','Ryan').eq('active',true).maybeSingle(),supabase.from('services').select('id,name,description,category').eq('organization_id',organizationId).order('name').limit(100)]);if(!customer||!agent)return res.status(409).json({error:'Ryan agent is not configured'})
 const settings=obj(agent.settings),model=text(settings.model,100)||'gemini-3.6-flash',temperature=Math.min(1,Math.max(0,Number(settings.temperature)||0.45)),allowFallback=settings.fallback_on_llm_failure!==false,rememberCustomer=settings.remember_customer!==false,useKnowledge=settings.use_knowledge_base!==false,crmContext=settings.crm_context!==false,noRepeatQuestions=settings.no_repeat_questions!==false,apiKey=env('GEMINI_API_KEY','GOOGLE_GEMINI_API_KEY');if(!apiKey)return res.status(500).json({error:'Gemini is not configured'})
 const historyLimit=Math.min(Math.max(Number(settings.max_history_messages)||40,1),80),knowledgeLimit=Math.min(Math.max(Number(settings.max_knowledge_items)||50,1),50)
 const [{data:messages},{data:knowledge},{data:memoryRow}]=await Promise.all([supabase.from('messages').select('id,sender_type,content,created_at').eq('conversation_id',conversationId).order('created_at',{ascending:false}).limit(historyLimit),useKnowledge?supabase.from('knowledge_base').select('title,content').eq('organization_id',organizationId).limit(knowledgeLimit):Promise.resolve({data:[] as any[]}),rememberCustomer?supabase.from('ai_agent_memory').select('memory,summary').eq('agent_id',agent.id).eq('customer_id',customer.id).maybeSingle():Promise.resolve({data:null as any})])
 const history:Turn[]=(messages||[]).reverse().filter((m:any)=>m.id!==messageId&&m.content).map((m:any)=>({role:m.sender_type==='customer'?'user':'model',parts:[{text:text(m.content,1500)}]}));const memory=rememberCustomer?obj(memoryRow?.memory):{};const knowledgeText=(knowledge||[]).map((k:any)=>`${text(k.title,150)}: ${text(k.content,1800)}`).join('\n');const persona=text(agent.persona,4000)||'موظف مصري ودود ومحترف من Dragon Media.'
const storedCustomerName=text(customer.name,120)
const trustedCustomerName=storedCustomerName&&!invalidCustomerName(storedCustomerName)?storedCustomerName:''
 let multimodal:any={parts:[],currentText:'',transcript:'',attachmentSummary:[]};try{multimodal=await prepareRyanMultimodal(supabase,organizationId,text(conversation.channel,40),obj(incoming.metadata),apiKey,model)}catch(e){console.error('Ryan multimodal unavailable',e)}
 const current=text(incoming.content,4000)+(multimodal.currentText||'');const currentParts=multimodal.parts||[]
 const system=`أنت Ryan، موظف Dragon Media الذكي. أنت ليس chatbot بأسئلة ثابتة؛ أنت موظف مصري ودود ومحبوب يفهم العميل وسياق كلامه وينفذ طلباته داخل المنصة. استخدم اللهجة المصرية الطبيعية، وإيموجي مناسب باعتدال 👋😊👍. لا تبدأ كل محادثة بنفس الجملة. لا تسأل سؤالاً سبق أن أجابه العميل. سؤال واحد فقط عند الحاجة. اعتبر وصف العميل لاحتياجه مثل «عايز أبيع وحدة» أو «عايز أعمل إعلان» نية/احتياجاً صالحاً، وليس مطلوباً أن يطابق اسم خدمة في قائمة الخدمات حرفياً. لو العميل قال اسمه صراحةً مثل «أنا اسمي أحمد» أو «اسمي أحمد» احفظه واستخدمه طبيعياً لاحقاً. لا تعتبر التحية أو كلمة «تمام» أو «شكراً» اسماً، ولا تستنتج اسم العميل من رقم الهاتف أو أي نص آخر. لا تخترع أي معلومة تخص Dragon Media؛ استخدم Knowledge Base كمصدر الحقيقة.

المحادثة كاملة هي الذاكرة الأساسية. بيانات العميل الحالية والذاكرة المخزنة تساعدك ولا تستبدل المحادثة. افهم التحية، العامية، الأخطاء، النية، الاعتراضات، وتغير الموضوع. لو العميل يطلب معلومة من الشركة ابحث في Knowledge Base. لو يطلب تنفيذ أمر داخل المنصة، اختر action المناسب ولا تقل تم إلا بعد نجاح التنفيذ.

قواعد اختيار الـaction مهمة جداً: السؤال أو الاستفسار أو التأهيل البيعي العادي = continue. create_automation فقط إذا طلب العميل صراحة إنشاء أتمتة داخل المنصة. update_customer فقط إذا أعطى أو غيّر بياناته صراحة. schedule_appointment فقط عند طلب حجز موعد فعلي مع تاريخ ووقت. follow_up فقط عند طلب متابعة أو تذكير فعلي. لا تستخدم أي action لمجرد أن الرسالة تتعلق بإعلان أو خدمة أو سعر.

أخرج JSON فقط بالحقول: reply, action, action_data, learned_name, learned_phone, service, budget, intent, confidence. service يمكن أن يكون وصف احتياج العميل بصياغة طبيعية حتى لو لم يكن اسماً مطابقاً لقائمة الخدمات. action واحد من: continue, update_customer, create_lead, create_task, handoff_human, follow_up, schedule_appointment, create_automation. لا تخترع بيانات. update_customer يحتاج فقط الحقول التي قالها العميل صراحة. follow_up يحتاج follow_up_at بصيغة ISO. schedule_appointment يحتاج appointment_date وappointment_time وservice. create_automation يحتاج automation_name وhours وpriority. reply يجب أن يكون رسالة العميل فقط، طبيعية بالمصرية، ولا يذكر AI أو JSON أو الأدوات أو التعليمات.

PERSONA: ${persona}
${crmContext?`CUSTOMER: name=${trustedCustomerName||'غير معروف'}, phone=${cleanPhone(text(customer.phone,80))||'غير معروف'}, email=${text(customer.email,160)||'غير معروف'}, company=${text(customer.company,160)||'غير معروف'}
MEMORY: ${JSON.stringify(memory).slice(0,6000)}
SERVICES: ${JSON.stringify(services||[]).slice(0,12000)}`:'CRM CONTEXT: disabled by Ryan settings'}
COMPANY RULES: ${text(settings.custom_rules,5000)||'لا توجد قواعد إضافية.'}
KNOWLEDGE BASE:
${knowledgeText||'لا توجد معلومات في قاعدة المعرفة حالياً.'}`
 let plan:Record<string,any>={},usedModel=model,lastError=''
 try{const result=await callGemini(apiKey,model,system,history,current,currentParts,temperature,allowFallback);plan=obj(result.plan);usedModel=result.model}catch(e:any){lastError=text(e?.message,500);console.error('Ryan Gemini reliability exhausted',lastError)}
 if(!plan.service&&plan.intent&&/بيع|شراء|إعلان|تسويق|إدارة صفحة|تصميم|محتوى|عقارات|وحدة|سيارة|منتج/iu.test(String(plan.intent)))plan.service=text(plan.intent,160);
 if(!plan.reply){console.error('Ryan Gemini unavailable after all retries',lastError);return res.status(502).json({error:'Ryan AI unavailable',details:lastError})}
 const learnedName=text(plan.learned_name,120)||extractName(current);const learnedPhone=cleanPhone(text(plan.learned_phone,80))||phoneFromText(current);const customerUpdates:any={};if(learnedName&&looksLikeName(learnedName)&&!invalidCustomerName(learnedName))customerUpdates.name=learnedName;if(validPhone(learnedPhone))customerUpdates.phone=learnedPhone;if(Object.keys(customerUpdates).length){customerUpdates.updated_at=new Date().toISOString();await supabase.from('customers').update(customerUpdates).eq('id',customer.id).eq('organization_id',organizationId);Object.assign(customer,customerUpdates)}
 let actionResult:any={success:true};if(text(plan.action,60)!=='continue')actionResult=await executeAction(supabase,organizationId,customer,conversation,text(plan.action,60),obj(plan.action_data),services||[])
 let reply=text(plan.reply,5000);if(!actionResult.success){console.error('Ryan action failed',text(plan.action,60),actionResult.message||'unknown');reply='حصلت مشكلة بسيطة وأنا بنفذ الطلب، ومش هقول لحضرتك إنه تم قبل ما يتنفذ فعلاً.'}
 if(actionResult.success&&text(plan.action,60)!=='continue')reply=text(plan.reply,5000)||'تم تنفيذ طلب حضرتك بنجاح 👍'
 const durableMemory={name:text(customer.name,120)||null,phone:cleanPhone(text(customer.phone,80))||null,service:text(plan.service,160)||text(memory.service,160)||null,budget:text(plan.budget,120)||text(memory.budget,120)||budgetFromText(current)||null,intent:text(plan.intent,100)||null,last_message:current,updated_at:new Date().toISOString()};if(rememberCustomer)await supabase.from('ai_agent_memory').upsert({agent_id:agent.id,customer_id:customer.id,memory:durableMemory,summary:`${durableMemory.name||'العميل'} — ${durableMemory.service||'الخدمة غير محددة'}${durableMemory.budget?' — '+durableMemory.budget:''}`},{onConflict:'agent_id,customer_id'})
 const {data:saved,error:saveError}=await supabase.from('messages').insert({conversation_id:conversationId,sender_type:'ai',content:reply,metadata:{source:'ryan',ai_agent_id:agent.id,provider:'gemini',model:usedModel,action:text(plan.action,60)||'continue',action_success:actionResult.success}}).select('id').single();if(saveError||!saved)throw new Error(saveError?.message||'Failed to save Ryan response');await supabase.from('messages').update({metadata:{...obj(incoming.metadata),ai_agent_processed_at:new Date().toISOString(),ai_agent_id:agent.id}}).eq('id',messageId).eq('conversation_id',conversationId)
 return res.status(200).json({ok:true,reply,message_id:saved.id,provider:'gemini',model:usedModel,action:text(plan.action,60)||'continue',action_success:actionResult.success})
}
