import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'
import { prepareRyanMultimodal } from '../_server/admin/ryan-multimodal'

const env=(...names:string[])=>names.map(n=>process.env[n]).find(v=>v?.trim())?.trim()||''
const db=()=>createClient(env('VITE_SUPABASE_URL','SUPABASE_URL'),env('SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})
const text=(v:unknown,max=2000)=>typeof v==='string'?v.trim().slice(0,max):''
const obj=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{ }
const sameSecret=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
const cleanPhone=(v:string)=>{let x=v.replace(/[^0-9]/g,'');if(x.startsWith('00'))x=x.slice(2);if(/^01[0125]\d{8}$/.test(x))x='20'+x.slice(1);return x}
const phoneFromText=(v:string)=>{const m=v.match(/(?:\+?20\s*)?(01[0125]\s*\d{8})\b/);return m?cleanPhone(m[0]):''}
const validPhone=(v:string)=>/^(?:01[0125]\d{8}|20(10|11|12|15)\d{8})$/.test(cleanPhone(v).replace(/^\+/,''))
const nameStop=/^(?:تمام|حاضر|ماشي|اه|أه|ايوه|أيوه|السلام عليكم|السلام عليكم ورحمة الله وبركاته|وعليكم السلام|اهلا|أهلا|أهلًا|منور|ممكن|عايز|عاوز|محتاج|الخدمة|خدمة|السعر|سعر|بكام|بكم|كام|شكرا|شكراً|شكرا جدا|شكراً جداً|شكراً ليك|شكرا ليك|متشكر|العفو|تسلم|ربنا يخليك|ربنا يكرمك|تمام شكرا|تمام شكراً)$/iu
const invalidCustomerName=(v:string)=>{const x=v.trim().replace(/\\s+/g,' ');return nameStop.test(x)||/(?:ان شاء الله|إن شاء الله|شكرا|شكراً|السلام عليكم|وعليكم السلام|اهلا|أهلا|أهلًا|تحت أمرك|العفو|تمام|معلش|ممكن|عايز|عاوز|محتاج|بكام|بكم|كام|الخدمة|السعر|خصم|اشتراك|الباقات|الفريق|المكالمة|المتابعة)/iu.test(x)}
const looksLikeName=(v:string)=>{const x=v.trim().replace(/\s+/g,' ');if(!x||x.length<2||x.length>80||nameStop.test(x)||phoneFromText(x)||/[?؟!]/.test(x))return false;return /^[\p{L}][\p{L}\u064B-\u065F\s.'’-]{1,79}$/u.test(x)}
const extractName=(v:string)=>{const normalized=text(v,120).replace(/\s+/g,' ').trim();const m=normalized.match(/(?:أنا\s+اسمي|انا\s+اسمي|اسمي|my\s+name\s+is)\s+([^,،.!؟?\n]+?)(?:\s+(?:ورقمي|ورقمى|رقمي|رقمى|رقم)\b|$)/iu);if(m&&looksLikeName(m[1]))return text(m[1],120);return looksLikeName(normalized)?normalized:''}
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
 const deadline=Date.now()+45000
 const fallbackModels=allowFallback?['gemini-3.5-flash-lite','gemini-3.1-flash-lite']:[]
 const candidates=[model,...fallbackModels].filter((v,i,a)=>v&&a.indexOf(v)===i)
 let last='Gemini unavailable',errors:string[]=[]
 for(const candidate of candidates){
  for(let attempt=0;attempt<3;attempt++){
   if(Date.now()>=deadline)break
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),Math.min(12000,Math.max(1000,deadline-Date.now())))
   try{
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(candidate)+':generateContent?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({systemInstruction:{parts:[{text:system+'\
\
إخراجك يجب أن يكون JSON صالحاً فقط، بدون markdown أو أي نص خارجه.'}]},contents:[...history,{role:'user',parts:[{text:current},...currentParts]}],generationConfig:{maxOutputTokens:4096,responseMimeType:'application/json',responseSchema:{type:'object',properties:{reply:{type:'string'},action:{type:'string',enum:['continue','handoff_human','create_lead','create_task','update_customer','follow_up','schedule_appointment','create_automation']},action_data:{type:'object'},learned_name:{type:'string'},learned_phone:{type:'string'},service:{type:'string'},budget:{type:'string'},intent:{type:'string'},confidence:{type:'number'}},required:['reply','action']},...( /^gemini-3\\./i.test(candidate) ? {thinkingConfig:{thinkingLevel:'minimal'}} : {}),...( /^gemini-2\\./i.test(candidate) ? {temperature:Math.min(1,Math.max(0,Number(temperature)||0.45))} : {})}})})
    const d=await r.json().catch(()=>({}))
    if(r.ok){
     const raw=text(d?.candidates?.[0]?.content?.parts?.map((p:any)=>p?.text||'').join(''),14000)
     if(raw){try{const parsed=parseGeminiJson(raw);if(!text(parsed.reply,5000)){last=candidate+' returned JSON without reply';errors.push(candidate+': '+last+' raw='+text(raw,3000));if(attempt<2){await sleep(retryDelay(attempt));continue}break}return {plan:parsed,model:candidate}}catch{last=candidate+' returned invalid JSON';errors.push(candidate+': '+last+' raw='+text(raw,3000))}}
     else {last=candidate+' returned empty';errors.push(candidate+': '+last+' finish_reason='+(text(d?.candidates?.[0]?.finishReason,80)||'unknown')+' prompt_feedback='+text(JSON.stringify(d?.promptFeedback),1000))}
     if(attempt<2){await sleep(retryDelay(attempt));continue}
     break
    }
    last=text(d?.error?.message,500)||('Gemini HTTP '+r.status);errors.push(candidate+' ['+r.status+']: '+last+' | '+text(JSON.stringify(d),1800))
    if(transientStatus(r.status)&&attempt<2){await sleep(retryDelay(attempt));continue}
    break
   }catch(e:any){
    last=e?.name==='AbortError'?candidate+' request timed out':text(e?.message,500)||last;errors.push(candidate+': '+last)
    if(attempt<2){await sleep(retryDelay(attempt));continue}
    break
   }finally{clearTimeout(timeout)}
  }
 }
 throw new Error(errors.length?errors.join(' | '):('Gemini failure: '+last))
}

async function notifyOrgAdmins(supabase:any,organizationId:string,title:string,body:string,link:string,entityType:string,entityId:string){
 const {data:admins}=await supabase.from('users').select('id').eq('organization_id',organizationId).eq('active',true).or('role.eq.admin,is_platform_admin.eq.true')
 if(admins?.length)await supabase.from('notifications').insert(admins.map((u:any)=>({organization_id:organizationId,user_id:u.id,type:'ryan_action',title,body,message:body,link,entity_type:entityType,entity_id:entityId,is_read:false})))
}

async function executeAction(supabase:any,organizationId:string,customer:any,conversation:any,action:string,data:any,services:any[],messageId:string,memory:any={}){
 const d=obj(data);if(action==='continue')return {success:true}
 if(action==='handoff_human'){
  const reason=text(d.reason,500)||'العميل طلب التحدث مع موظف بشري.'
  const {data:existingReq}=await supabase.from('human_handoff_requests').select('id').eq('organization_id',organizationId).eq('conversation_id',conversation.id).eq('status','open').limit(1).maybeSingle()
  if(existingReq?.id)return {success:true,data:{handoff_id:existingReq.id,existing:true}}
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
  await notifyOrgAdmins(supabase,organizationId,'ريان سجّل عميل محتمل',`تم تسجيل ${name} كعميل محتمل جديد من ${String(conversation.channel||'ريان') === 'messenger' ? 'ماسنجر' : String(conversation.channel||'ريان')}.`,`/leads?lead=${lead.id}`,'lead',lead.id)
  return {success:true,data:{lead_id:lead.id}}
 }
 if(action==='create_task'){
  const title=text(d.title,160);if(!title)return {success:false,message:'Missing task title'}
  const actionMarker='Ryan message:'+messageId
  const {data:existingTask}=await supabase.from('tasks').select('id').eq('organization_id',organizationId).eq('customer_id',customer.id).ilike('description','%'+actionMarker+'%').limit(1).maybeSingle()
  if(existingTask?.id)return {success:true,data:{task_id:existingTask.id,existing:true}}
  const due=text(d.due_date,20),dueDate=due?new Date(due+'T23:59:59'):new Date(Date.now()+86400000)
  const {data:u}=await supabase.from('users').select('id').eq('organization_id',organizationId).eq('active',true).order('created_at').limit(1).maybeSingle()
  const {data:t,error}=await supabase.from('tasks').insert({organization_id:organizationId,title,assigned_to:u?.id||null,due_date:dueDate.toISOString().slice(0,10),priority:['عالية','متوسطة','منخفضة'].includes(text(d.priority,30))?text(d.priority,30):'متوسطة',status:'قيد التنفيذ',description:(text(d.description,1000)||'مهمة أنشأها Ryan.')+' ['+actionMarker+']',customer_id:customer.id,created_by:u?.id||null,reminder_at:d.reminder_at?text(d.reminder_at,80):null}).select('id').single()
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
  const actionMarker='Ryan message:'+messageId
  const {data:existingFollowUp}=await supabase.from('tasks').select('id').eq('organization_id',organizationId).eq('customer_id',customer.id).ilike('description','%'+actionMarker+'%').limit(1).maybeSingle()
  if(existingFollowUp?.id)return {success:true,data:{task_id:existingFollowUp.id,existing:true,follow_up_at:date.toISOString()}}
  const {data:u}=await supabase.from('users').select('id').eq('organization_id',organizationId).eq('active',true).order('created_at').limit(1).maybeSingle()
  const {data:t,error}=await supabase.from('tasks').insert({organization_id:organizationId,title:'متابعة عميل بواسطة Ryan',assigned_to:u?.id||null,due_date:date.toISOString().slice(0,10),priority:'متوسطة',status:'قيد التنفيذ',description:'متابعة أنشأها Ryan من محادثة العميل. ['+actionMarker+']',customer_id:customer.id,created_by:u?.id||null,reminder_at:date.toISOString()}).select('id').single();if(error)throw new Error(error.message);await notifyOrgAdmins(supabase,organizationId,'ريان أنشأ متابعة',`تم إنشاء متابعة للعميل ${text(customer.name,120)||'العميل'}.`,`/tasks?task=${t.id}`,'task',t.id);return {success:true,data:{task_id:t.id,follow_up_at:date.toISOString()}}
 }
 if(action==='schedule_appointment'){
  const date=text(d.appointment_date,20),time=text(d.appointment_time,20);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))return {success:false,message:'Missing appointment date/time'}
  const actionMarker='Ryan message:'+messageId
  const {data:existingAppointment}=await supabase.from('appointments').select('id').eq('organization_id',organizationId).eq('customer_id',customer.id).ilike('notes','%'+actionMarker+'%').limit(1).maybeSingle()
  if(existingAppointment?.id)return {success:true,data:{appointment_id:existingAppointment.id,existing:true,appointment_date:date,appointment_time:time}}
  const serviceName=text(d.service,160),service=services.find((s:any)=>text(s.name,160).toLowerCase()===serviceName.toLowerCase());const {data:existing}=await supabase.from('appointments').select('id').eq('organization_id',organizationId).eq('appointment_date',date).eq('appointment_time',time).eq('status','قيد الانتظار').limit(1);if(existing?.length)return {success:false,message:'Slot occupied'}
  const {data:a,error}=await supabase.from('appointments').insert({organization_id:organizationId,customer_id:customer.id,service_id:service?.id||null,appointment_date:date,appointment_time:time,status:'قيد الانتظار',notes:'تم الحجز بواسطة Ryan. ['+actionMarker+']'}).select('id').single();if(error)throw new Error(error.message);await notifyOrgAdmins(supabase,organizationId,'ريان حجز موعد',`تم حجز موعد للعميل ${text(customer.name,120)||'العميل'} يوم ${date} الساعة ${time}.`,`/appointments?appointment=${a.id}`,'appointment',a.id);return {success:true,data:{appointment_id:a.id,appointment_date:date,appointment_time:time}}
 }
 if(action==='create_automation'){
  const name=text(d.automation_name,160),hours=Math.max(1,Math.min(720,Number(d.hours)||24)),priority=['عالية','متوسطة','منخفضة'].includes(text(d.priority,30))?text(d.priority,30):'متوسطة';if(!name)return {success:false,message:'Missing automation name'}
  const {data:existingAutomation}=await supabase.from('automations').select('id,name').eq('organization_id',organizationId).eq('config->>ryan_message_id',messageId).limit(1).maybeSingle()
  if(existingAutomation?.id)return {success:true,data:{...existingAutomation,existing:true}}
  const {data:a,error}=await supabase.from('automations').insert({organization_id:organizationId,name,trigger_event:'lead_stale',config:{hours,ryan_message_id:messageId},action_type:'create_task',action_config:{title_template:'متابعة مع {name} - تم إنشاؤها بواسطة Ryan',priority},active:true}).select('id,name').single();if(error)throw new Error(error.message);await notifyOrgAdmins(supabase,organizationId,'ريان أنشأ أتمتة',`تم إنشاء الأتمتة «${name}» بواسطة Ryan.`,`/automations?automation=${a.id}`,'automation',a.id);return {success:true,data:a}
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
 const settings=obj(agent.settings),model=(/^gemini-3\./i.test(text(settings.model,100))?text(settings.model,100):'gemini-3.1-flash-lite'),temperature=Math.min(1,Math.max(0,Number(settings.temperature)||0.45)),allowFallback=settings.fallback_on_llm_failure!==false,rememberCustomer=settings.remember_customer!==false,useKnowledge=settings.use_knowledge_base!==false,crmContext=settings.crm_context!==false,noRepeatQuestions=settings.no_repeat_questions!==false,apiKey=env('GEMINI_API_KEY','GOOGLE_GEMINI_API_KEY')
 const {data:quota,error:quotaError}=await supabase.rpc('consume_ryan_message',{p_organization_id:organizationId,p_agent_id:agent.id,p_conversation_id:conversationId,p_customer_id:customer.id,p_model:model})
 if(quotaError)return res.status(500).json({error:'Failed to verify Ryan message quota',details:text(quotaError.message,500)})
 const quotaRow=Array.isArray(quota)?quota[0]:quota
 if(!quotaRow?.allowed){
  const quotaReply='رصيد رسائل Ryan في الباقة الحالية اكتمل، ومش هقدر أكمل المحادثة دلوقتي. تقدر تختار أو تجدد باقة من صفحة الباقات داخل المنصة.'
  const {data:savedQuota,error:savedQuotaError}=await supabase.from('messages').insert({conversation_id:conversationId,sender_type:'ai',content:quotaReply,metadata:{source:'ryan',ai_agent_id:agent.id,type:'quota_exhausted',plan_path:'/plans',used_messages:Number(quotaRow?.used_messages||0),total_limit:Number(quotaRow?.total_limit||0),reset_at:quotaRow?.reset_at||null}}).select('id').single()
  await supabase.from('messages').update({metadata:{...obj(incoming.metadata),ai_agent_processed_at:new Date().toISOString(),ai_agent_id:agent.id,ai_agent_quota_exhausted:true}}).eq('id',messageId).eq('conversation_id',conversationId)
  if(savedQuotaError||!savedQuota)return res.status(500).json({error:'Failed to save Ryan quota notice'})
  return res.status(200).json({ok:true,reply:quotaReply,message_id:savedQuota.id,quota_exhausted:true,plan_path:'/plans',reset_at:quotaRow?.reset_at||null})
 }
 const runId=text(quotaRow?.run_id,100)
 if(!apiKey)return res.status(500).json({error:'Gemini is not configured'})
 const historyLimit=Math.min(Math.max(Number(settings.max_history_messages)||40,1),80),knowledgeLimit=Math.min(Math.max(Number(settings.max_knowledge_items)||50,1),80)
 const [{data:messages},{data:knowledge},{data:memoryRow}]=await Promise.all([supabase.from('messages').select('id,sender_type,content,created_at').eq('conversation_id',conversationId).order('created_at',{ascending:false}).limit(historyLimit),useKnowledge?supabase.from('knowledge_base').select('title,content').eq('organization_id',organizationId).limit(knowledgeLimit):Promise.resolve({data:[] as any[]}),rememberCustomer?supabase.from('ai_agent_memory').select('memory,summary').eq('agent_id',agent.id).eq('customer_id',customer.id).maybeSingle():Promise.resolve({data:null as any})])
 const history:Turn[]=(messages||[]).reverse().filter((m:any)=>m.id!==messageId&&m.content).map((m:any)=>({role:m.sender_type==='customer'?'user':'model',parts:[{text:text(m.content,1500)}]}));const memory=rememberCustomer?obj(memoryRow?.memory):{};const knowledgeText=(knowledge||[]).map((k:any)=>`${text(k.title,150)}: ${text(k.content,1800)}`).join('\n');const persona=text(agent.persona,4000)||'موظف مصري ودود ومحترف من Dragon Media.'
const storedCustomerName=text(customer.name,120)
const isWhatsApp=String(conversation.channel||'').toLowerCase()==='whatsapp'
const rememberedExplicitName=rememberCustomer&&memory.name_source==='customer_explicit'&&looksLikeName(String(memory.name||''))?text(memory.name,120):''
const trustedCustomerName=(storedCustomerName&&!invalidCustomerName(storedCustomerName)&&looksLikeName(storedCustomerName))?storedCustomerName:(isWhatsApp?rememberedExplicitName:'')
 // Only stable, verified profile facts may cross conversation boundaries. Do not treat prior intent/budget/service as active context.
 const safeMemory=rememberCustomer?{name:isWhatsApp?rememberedExplicitName:(looksLikeName(String(memory.name||''))?text(memory.name,120):''),phone:validPhone(String(memory.phone||''))?cleanPhone(String(memory.phone)):'' ,company:text(memory.company,160),email:text(memory.email,160)}:{}
 let multimodal:any={parts:[],currentText:'',transcript:'',attachmentSummary:[]};try{multimodal=await prepareRyanMultimodal(supabase,organizationId,text(conversation.channel,40),obj(incoming.metadata),apiKey,model)}catch(e){console.error('Ryan multimodal unavailable',e)}
 const current=text(incoming.content,4000)+(multimodal.currentText||'');const currentParts=multimodal.parts||[]
 const greetingOnly=/^(?:السلام عليكم(?: ورحمة الله وبركاته)?|سلام عليكم|اهلاً|أهلاً|أهلا|اهلا|هاي|hello|hi|مساء الخير|صباح الخير|مساء النور|صباح النور)[.!؟!،,\s]*$/iu.test(current.trim());
 const explicitOldContextReference=/(?:كنت\s+(?:كلمت|بتكلم|بتواصل|طلبت|سألت)|كلمتكم\s+قبل|المرة\s+اللي\s+فاتت|الطلب\s+القديم|الخدمة\s+القديمة|نكمل\s+(?:الطلب|الموضوع)|بخصوص\s+(?:الطلب|الخدمة|الحملة)\s+اللي)/iu.test(current.trim());
 const effectiveHistory=greetingOnly?[]:history
 const language=text(agent.language,40)||'ar-EG';const emojiMode=['none','light','limited'].includes(text(settings.emoji_mode,20))?text(settings.emoji_mode,20):'none';const emojiInstruction=emojiMode==='none'?'لا تستخدم أي إيموجي.':emojiMode==='limited'?'استخدم إيموجي واحداً فقط عند الحاجة وبشكل طبيعي.':'يمكن استخدام إيموجي خفيف وطبيعي عند ملاءمته، بدون مبالغة.';const languageInstruction=/^(ar-EG|egyptian_arabic)$/iu.test(language)?'استخدم العربية المصرية الطبيعية.':/^ar$/iu.test(language)?'استخدم العربية الواضحة.':'استخدم اللغة المحددة في إعداد Ryan بشكل طبيعي.';
 const system=`أنت ${text(agent.name,80)||'Ryan'}، موظف Dragon Media الذكي. أنت ليس chatbot بأسئلة ثابتة؛ أنت موظف يفهم العميل وسياق كلامه وينفذ طلباته داخل المنصة. ${languageInstruction} ${emojiInstruction} في بداية المحادثة كن ودوداً وطبيعياً مثل موظف مبيعات مصري حقيقي: رحّب بالعميل بحرارة، وإذا كان اسمه معروفاً استخدم صيغة محترمة مثل «يا أستاذ [الاسم]»، ثم اعرض المساعدة بصياغة طبيعية مثل «أقدر أساعدك إزاي النهارده؟ أنا في خدمتك، اتفضل 😊»؛ لا تجعلها جملة محفوظة حرفياً، بل غيّر الصياغة بشكل طبيعي حسب السياق. لا تبدأ كل محادثة بنفس الجملة ولا تقفز مباشرة لسؤال عن الخدمة. لا تسأل سؤالاً سبق أن أجابه العميل. سؤال واحد فقط عند الحاجة. اجعل الرد الافتراضي قصيراً وطبيعياً: جملة أو جملتان فقط، إلا إذا كان العميل يحتاج شرحاً فعلياً. لا تستخدم عبارات تسويقية عامة أو مبالغات مثل «واثق إننا هنعمل شغل ممتاز» أو «أفضل قيمة» لمجرد إنهاء الرسالة. لا تكرر عرض المساعدة في نهاية كل رد إذا لم تكن هناك حاجة. لا تضف معلومات أو وعوداً غير موجودة في قاعدة المعرفة. افهم كل رسالة بالنسبة للمحادثة الحالية فقط. هوية العميل وبياناته الأساسية الموثوقة مثل الاسم ورقم الهاتف يمكن تذكرها بين المحادثات، لكن الخدمة أو الطلب أو الميزانية أو الهدف أو المكان أو حالة المتابعة من محادثة قديمة تظل معلومات تاريخية وليست الطلب الحالي. لا تستخدم أي طلب قديم كأنه الطلب الحالي لمجرد أن نفس العميل عاد. إذا بدأت محادثة جديدة بتحية أو بطلب جديد، ابدأ نية العميل من الصفر. لا تذكر خدمة أو ميزانية أو حملة أو متابعة قديمة إلا إذا أشار العميل إليها صراحة في الرسالة الحالية. اعتبر إجابة العميل المختصرة جواباً للسؤال السابق عندما يكون ذلك منطقياً داخل المحادثة الحالية. لا تكرر السؤال بسبب اختلاف الصياغة. إذا اكتملت البيانات الأساسية، انتقل طبيعياً للخطوة التالية بدلاً من إعادة التأهيل من البداية. تعامل مع الاعتراضات والأسئلة السعرية باحتراف وارجع لقاعدة المعرفة قبل الرد. إذا طلب العميل إجراءً داخل المنصة، اختر الأداة المناسبة ونفذها؛ الأدوات وسيلة لتنفيذ قرارك وليست شخصية Ryan. لو سألت العميل عن اسمه ثم رد بكلمة أو اسم قصير صالح مثل «كريم»، فافهمه فوراً على أنه اسم العميل حتى لو لم يقل «أنا اسمي». احفظ الاسم واستخدمه لاحقاً بنفس الكتابة المحفوظة تماماً، بدون اختصار أو تغيير أو تخمين أو اقتطاع للاسم. لا تخلط بين اسم العميل واسم حساب WhatsApp أو اسم الملف الشخصي. إذا كان الاسم الموثوق في CRM هو «كريم»، يجب أن تناديه «كريم» وليس «كر» أو أي صيغة مختصرة. لا تخترع أي معلومة تخص Dragon Media؛ استخدم Knowledge Base كمصدر الحقيقة. ${explicitOldContextReference?'العميل أشار في رسالته الحالية إلى سياق سابق؛ يمكنك استرجاعه فقط بقدر ما يخدم ما طلبه الآن.':'لا يوجد في الرسالة الحالية ما يسمح باسترجاع طلب قديم؛ تعامل مع أي خدمة أو ميزانية قديمة كبيانات تاريخية فقط.'}
PERSONA: ${persona}
${crmContext?`CUSTOMER: name=${trustedCustomerName||'غير معروف'}, phone=${cleanPhone(text(customer.phone,80))||'غير معروف'}, email=${text(customer.email,160)||'غير معروف'}, company=${text(customer.company,160)||'غير معروف'}
VERIFIED CUSTOMER MEMORY: ${JSON.stringify(safeMemory).slice(0,3000)}
SERVICES: ${JSON.stringify(services||[]).slice(0,12000)}`:'CRM CONTEXT: disabled by Ryan settings'}
COMPANY RULES: ${text(settings.custom_rules,5000)||'لا توجد قواعد إضافية.'}
KNOWLEDGE BASE:
${knowledgeText||'لا توجد معلومات في قاعدة المعرفة حالياً.'}`
 let plan:Record<string,any>={},usedModel=model,lastError=''
 // Greeting-only messages are deterministic: never send historical context to Gemini and never let the model revive an old request.
 if(greetingOnly){
  const greetingName=trustedCustomerName
  plan={reply:greetingName?`وعليكم السلام يا أستاذ ${greetingName}، أهلاً بحضرتك. أقدر أساعدك في إيه؟`:'وعليكم السلام، أهلاً بحضرتك. أقدر أساعدك في إيه؟',action:'continue',action_data:{},confidence:1}
 } else try{const result=await callGemini(apiKey,model,system,effectiveHistory,current,currentParts,temperature,allowFallback);plan=obj(result.plan);usedModel=result.model}catch(e:any){lastError=text(e?.message,500);console.error('Ryan Gemini reliability exhausted',JSON.stringify({model:usedModel,error:lastError,conversationId,messageId}))}
 if(!plan.service&&plan.intent&&/بيع|شراء|إعلان|تسويق|إدارة صفحة|تصميم|محتوى|عقارات|وحدة|سيارة|منتج/iu.test(String(plan.intent)))plan.service=text(plan.intent,160);
 const aiUnavailable=!plan.reply
 if(aiUnavailable){
  if(runId)await supabase.from('ai_agent_runs').update({status:'failed',model:usedModel,metadata:{source:'ryan',error:lastError}}).eq('id',runId)
  console.error('Ryan Gemini unavailable after all retries',JSON.stringify({model:usedModel,error:lastError,conversationId,messageId}))
  plan={reply:'معلش، حصل تأخير بسيط في الرد. ابعتلي رسالتك تاني وهكمل مع حضرتك فوراً.',action:'continue',action_data:{},confidence:0}
 }
 const lastModelMessage=(history.slice().reverse().find((t:any)=>t.role==='model')?.parts?.[0]?.text||'').toString();const nameQuestionPending=/(?:اسم حضرتك|اسمك|اسمِك|الاسم|أسم حضرتك|أسمك)/iu.test(lastModelMessage);const hasKnownNameBeforeTurn=Boolean(trustedCustomerName);const explicitName=extractName(current)||((!hasKnownNameBeforeTurn&&nameQuestionPending&&looksLikeName(text(current,120)))?text(current,120):'');const learnedName=explicitName;const learnedPhone=cleanPhone(text(plan.learned_phone,80))||phoneFromText(current);const customerUpdates:any={};if(learnedName&&looksLikeName(learnedName)&&!invalidCustomerName(learnedName))customerUpdates.name=learnedName;if(validPhone(learnedPhone))customerUpdates.phone=learnedPhone;if(Object.keys(customerUpdates).length){customerUpdates.updated_at=new Date().toISOString();await supabase.from('customers').update(customerUpdates).eq('id',customer.id).eq('organization_id',organizationId);Object.assign(customer,customerUpdates)}
 // Hard safety guard: a new customer must be asked for their name before Ryan moves into qualification.
 // Gemini remains responsible for the wording; this only prevents it from skipping a required identity field.
 const effectiveName=isWhatsApp?(rememberedExplicitName||text(explicitName,120)):text(customer.name,120);const hasTrustedName=Boolean(effectiveName&&looksLikeName(effectiveName)&&!invalidCustomerName(effectiveName));const nameWasProvidedNow=Boolean(explicitName&&looksLikeName(explicitName)&&!invalidCustomerName(explicitName));const phoneWasProvidedNow=Boolean(phoneFromText(current)||validPhone(cleanPhone(text(plan.learned_phone,80))));
 if(!hasTrustedName&&!nameWasProvidedNow&&!aiUnavailable){
  plan.reply='اهلاً وسهلا بحضرتك يافندم ، ممكن أتشرف بأسم حضرتك';plan.action='continue';plan.action_data={};
 }
 if((hasTrustedName||nameWasProvidedNow)&&!phoneWasProvidedNow&&!aiUnavailable&&['handoff_human','create_lead'].includes(text(plan.action,60))){
  plan.reply='تمام يا فندم، ممكن أعرف رقم حضرتك للتواصل؟';plan.action='continue';plan.action_data={};
 }
 if(greetingOnly&&!aiUnavailable){plan.action='continue';plan.action_data={};}
 const normalizedAction=['continue','handoff_human','create_lead','create_task','update_customer','follow_up','schedule_appointment','create_automation'].includes(text(plan.action,60))?text(plan.action,60):'continue'; plan.action=normalizedAction; if(!text(plan.action,60))plan.action='continue'; const actionData=obj(plan.action_data);if(!text(actionData.service,160)&&text(plan.service,160))actionData.service=text(plan.service,160);if(!text(actionData.phone,80)&&validPhone(String(customer.phone||'')))actionData.phone=cleanPhone(String(customer.phone));plan.action_data=actionData;let actionResult:any={success:true};if(text(plan.action,60)!=='continue'){try{actionResult=await executeAction(supabase,organizationId,customer,conversation,text(plan.action,60),actionData,services||[],messageId,memory)}catch(e:any){console.error('Ryan action execution failed',text(plan.action,60),text(e?.message,500))
  actionResult={success:false,message:'Action execution failed'}
 }}
 let reply=text(plan.reply,5000);
 if(actionResult.success&&text(plan.action,60)!=='continue')reply=text(plan.reply,5000)||'تم تنفيذ طلب حضرتك بنجاح.'
 const previousService=text(memory.service,160),previousBudget=text(memory.budget,120),previousIntent=text(memory.intent,100);const durableMemory={name:(isWhatsApp?(rememberedExplicitName||explicitName):text(customer.name,120))||null,name_source:(isWhatsApp ? ((rememberedExplicitName||explicitName) ? 'customer_explicit' : null) : (explicitName ? 'customer_explicit' : 'crm')),phone:validPhone(String(memory.phone||''))?cleanPhone(String(memory.phone)):null,company:text(memory.company,160)||null,email:text(memory.email,160)||null,service:text(plan.service,160)||previousService||null,budget:text(plan.budget,120)||budgetFromText(current)||previousBudget||null,intent:text(plan.intent,100)||previousIntent||null,stage:(text(plan.service,160)||previousService)?'qualification':'discovery',last_question:text(plan.reply,5000).split(/[؟?]/).slice(-2).join('؟').trim()||null,last_message:current,updated_at:new Date().toISOString()};if(rememberCustomer)await supabase.from('ai_agent_memory').upsert({agent_id:agent.id,customer_id:customer.id,memory:durableMemory,summary:`${durableMemory.name||'العميل'} — ${durableMemory.service||'الخدمة غير محددة'}${durableMemory.budget?' — '+durableMemory.budget:''}`},{onConflict:'agent_id,customer_id'})
 const {data:saved,error:saveError}=await supabase.from('messages').insert({conversation_id:conversationId,sender_type:'ai',content:reply,metadata:{source:'ryan',ai_agent_id:agent.id,provider:'gemini',model:usedModel,action:text(plan.action,60)||'continue',action_success:actionResult.success,safety_fallback:aiUnavailable,billing_run_id:runId||null}}).select('id').single();if(saveError||!saved){if(runId)await supabase.from('ai_agent_runs').update({status:'failed',metadata:{source:'ryan',error:saveError?.message||'Failed to save Ryan response'}}).eq('id',runId);throw new Error(saveError?.message||'Failed to save Ryan response')}if(runId&&!aiUnavailable)await supabase.from('ai_agent_runs').update({status:'success',model:usedModel,metadata:{source:'ryan',action:text(plan.action,60)||'continue',action_success:actionResult.success}}).eq('id',runId);await supabase.from('messages').update({metadata:{...obj(incoming.metadata),ai_agent_processed_at:new Date().toISOString(),ai_agent_id:agent.id}}).eq('id',messageId).eq('conversation_id',conversationId)
 return res.status(200).json({ok:true,reply,message_id:saved.id,provider:'gemini',model:usedModel,action:text(plan.action,60)||'continue',action_success:actionResult.success,safety_fallback:aiUnavailable})
}
