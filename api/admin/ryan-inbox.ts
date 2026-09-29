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
const invalidCustomerName=(v:string)=>{const x=v.trim().replace(/\\s+/g,' ');return nameStop.test(x)||/(?:^عميل$|^العميل$|بقولك|قولك|ايه يا ريان|إيه يا ريان|يا ريان|ريان|ان شاء الله|إن شاء الله|شكرا|شكراً|السلام عليكم|وعليكم السلام|اهلا|أهلا|أهلًا|تحت أمرك|العفو|تمام|معلش|ممكن|عايز|عاوز|محتاج|بكام|بكم|كام|الخدمة|السعر|خصم|اشتراك|الباقات|الفريق|المكالمة|المتابعة|لو سمحت|من فضلك|ياريت|اه ياريت|أه ياريت)/iu.test(x)}
const FEMALE_ARABIC_NAMES=new Set('آية|اية|إسراء|اسراء|أسماء|اسماء|أميرة|اميرة|إيمان|ايمان|إيناس|اناس|ابتسام|ابتهال|انتصار|انجي|إنجي|بسنت|بسمة|بسمله|بتول|براءة|تهاني|جنى|جودي|جويرية|جيهان|حبيبة|حنان|حنين|داليا|دعاء|دينا|رانيا|راندا|رحاب|رنا|ريم|ريهام|روان|رؤى|رشا|سارة|سما|سمر|سلمى|سماح|سحر|شيماء|صفاء|ضحى|عبير|علا|غادة|غادة|فرح|فاطمة|فريدة|كارمن|كريمة|لارا|ليلى|مريم|مها|منة|منة الله|مي|ميار|ميادة|ميرنا|ميرفت|ندى|نهى|نور|نورهان|نورا|هبة|هدى|هنا|هند|يارا|ياسمين|ياسمينا|زينب'.split('|').map(v=>v.toLocaleLowerCase('ar-EG')));
const MALE_ARABIC_NAMES=new Set('أحمد|احمد|آدم|ادم|إسلام|اسلام|إياد|اياد|إيهاب|ايهاب|أيمن|ايمن|باسم|باسل|بلال|تامر|حاتم|حازم|حسام|حسن|حسين|خالد|رامي|رائد|سامح|سامر|سامي|سيف|شادي|شريف|طارق|عادل|عاطف|عمر|عمرو|علاء|علي|فادي|كريم|كمال|محمود|محمد|مصطفى|مصطفي|معاذ|مروان|معتز|منير|مهند|ناجي|نبيل|نور|هاني|هشام|وائل|وليد|ياسر|يحيى|يوسف|زياد|زيين|زين'.split('|').map(v=>v.toLocaleLowerCase('ar-EG')));
const inferCustomerGender=(name:string)=>{const n=text(name,120).split(/\s+/)[0].replace(/[ًٌٍَُِّْـ]/g,'').toLocaleLowerCase('ar-EG');if(FEMALE_ARABIC_NAMES.has(n))return 'female';if(MALE_ARABIC_NAMES.has(n))return 'male';return 'unknown' as const};
const looksLikeName=(v:string)=>{const x=v.trim().replace(/\s+/g,' ');if(!x||x.length<2||x.length>80||nameStop.test(x)||phoneFromText(x)||/[?؟!]/.test(x))return false;return /^[\p{L}][\p{L}\u064B-\u065F\s.'’-]{1,79}$/u.test(x)}
const extractName=(v:string)=>{const normalized=text(v,120).replace(/\s+/g,' ').trim();const m=normalized.match(/(?:أنا\s+اسمي|انا\s+اسمي|اسمي|my\s+name\s+is)\s+([^,،.!؟?\n]+?)(?:\s+(?:ورقمي|ورقمى|رقمي|رقمى|رقم)\b|$)/iu);if(m&&looksLikeName(m[1]))return text(m[1],120);return ''}
const isNameReplacementRequest=(v:string)=>/(?:عايز|عاوز|محتاج|ممكن|ينفع|لو سمحت)?\s*(?:أغير|اغير|تغيير|تعديل|بدل|استبدل|استبدال)\s*(?:اسمي|الاسم|اسمى)|(?:عايز|عاوز|محتاج|ممكن|لو سمحت)\s*(?:أبدل|ابدّل|ابدل)\s*(?:اسمي|الاسم|اسمى)|(?:مش|مش عايز)\s*(?:الاسم|اسمي)\s*(?:ده|دا|الحالي)|(?:بدل|استبدل)\s*(?:الاسم|اسمي)/iu.test(text(v,300))
const extractReplacementName=(v:string)=>{const normalized=text(v,300).replace(/\s+/g,' ').trim();const patterns=[/(?:أغير|اغير|تغيير|تعديل|بدل|استبدل|استبدال)\s*(?:اسمي|الاسم|اسمى)\s*(?:إلى|الى|لـ|ل|:)?\s*([^,،.!؟?]+?)(?:\s*$|\s+(?:بدل|من)\b)/iu,/(?:اسمي|الاسم|اسمى)\s*(?:يبقى|يكون|هو)\s*([^,،.!؟?]+)$/iu,/(?:عايز|عاوز|محتاج)\s*(?:أبدل|ابدّل|ابدل)\s*(?:اسمي|الاسم|اسمى)\s*(?:بـ|ب|إلى|الى)?\s*([^,،.!؟?]+)$/iu];for(const p of patterns){const m=normalized.match(p);if(m&&looksLikeName(m[1]))return text(m[1],120)}return ''}
const DEFAULT_RYAN_PERSONA='موظف خدمة عملاء ومبيعات مصري، إنساني وودود وخفيف الدم، ذكي في فهم السياق، دافئ في التعامل، مختصر بدون جفاف، ويحوّل كل محادثة لخطوة مفيدة للعميل بدون أسلوب روبوتي أو استجواب آلي.'
const DEFAULT_RYAN_SETTINGS={use_knowledge_base:true,remember_customer:true,max_history_messages:40,max_knowledge_items:50,emoji_mode:'light',custom_rules:'',fallback_on_llm_failure:true,no_repeat_questions:true,crm_context:true}
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
 const fallbackModels=allowFallback?['gemini-3.5-flash-lite','gemini-2.5-flash','gemini-2.5-flash-lite']:[]
 const candidates=[model,...fallbackModels].filter((v,i,a)=>v&&a.indexOf(v)===i)
 let last='Gemini unavailable',errors:string[]=[]
 for(const candidate of candidates){
  for(let attempt=0;attempt<3;attempt++){
   if(Date.now()>=deadline)break
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),Math.min(12000,Math.max(1000,deadline-Date.now())))
   try{
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(candidate)+':generateContent?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({systemInstruction:{parts:[{text:system+'\
\
إخراجك يجب أن يكون JSON صالحاً فقط، بدون markdown أو أي نص خارجه.'}]},contents:[...history,{role:'user',parts:[{text:current},...currentParts]}],generationConfig:{maxOutputTokens:4096,responseMimeType:'application/json',responseSchema:{type:'object',properties:{reply:{type:'string'},action:{type:'string',enum:['continue','handoff_human','create_lead','create_task','update_customer','follow_up','schedule_appointment','create_automation']},action_data:{type:'object'},customer_identity:{type:'object',properties:{name:{type:'string'},confidence:{type:'number'},source:{type:'string',enum:['explicit','answer_to_name_question','correction','none']}},required:['name','confidence','source']},learned_name:{type:'string'},learned_phone:{type:'string'},service:{type:'string'},activity:{type:'string'},goal:{type:'string'},budget:{type:'string'},intent:{type:'string'},confidence:{type:'number'}},required:['reply','action','customer_identity']},...( /^gemini-3\\./i.test(candidate) ? {thinkingConfig:{thinkingLevel:'minimal'}} : {}),...( /^gemini-2\\./i.test(candidate) ? {temperature:Math.min(1,Math.max(0,Number(temperature)||0.45))} : {})}})})
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

async function ensureRyanLead(supabase:any,organizationId:string,customer:any,conversation:any,service:string,budget:string){
 const name=text(customer.name,120),phone=cleanPhone(text(customer.phone,80)),normalizedService=text(service,160),normalizedBudget=text(budget,120),source=text(conversation.channel,40)||'ريان';
 if(!customer?.id)return null;
 // لا ننشئ Lead لمجرد بدء المحادثة؛ يجب اكتمال بيانات التأهيل الأساسية أولاً.
 if(!name||!looksLikeName(name)||invalidCustomerName(name)||!validPhone(phone)||!normalizedService)return null;
 // خدمة الإعلانات لا تكتمل بدون الميزانية.
 if(/(?:إعلان|إعلانات|اعلان|اعلانات|ads|advertis)/iu.test(normalizedService)&&!normalizedBudget)return null;
 const {data:existing,error:lookupError}=await supabase.from('leads').select('id,name,phone,notes').eq('organization_id',organizationId).eq('customer_id',customer.id).is('deleted_at',null).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(lookupError)throw new Error(lookupError.message);
 const budgetText=budget?' الميزانية الحالية: '+budget+'.':'';
 const serviceText=service?' الخدمة: '+service+'.':'';
 const notes=('تم تسجيل العميل بواسطة Ryan من '+source+'.'+serviceText+budgetText).trim();
 if(existing?.id){
  const updates:any={name,phone:phone||null};
  if(service||budget)updates.notes=notes;
  await supabase.from('leads').update(updates).eq('id',existing.id).eq('organization_id',organizationId);
  return existing.id;
 }
 const {data:lead,error}=await supabase.from('leads').insert({organization_id:organizationId,name,phone:phone||null,source,status:'جديد',notes,lead_score:50,customer_id:customer.id}).select('id').single();
 if(error)throw new Error(error.message);
 await notifyOrgAdmins(supabase,organizationId,'ريان سجّل عميل محتمل','تم تسجيل '+name+' كعميل محتمل جديد من '+source+'.','/leads?lead='+lead.id,'lead',lead.id);
 return lead.id;
}

async function notifyOrgAdmins(supabase:any,organizationId:string,title:string,body:string,link:string,entityType:string,entityId:string){
 const {data:admins}=await supabase.from('users').select('id').eq('organization_id',organizationId).eq('active',true).or('role.eq.admin,is_platform_admin.eq.true')
 if(admins?.length)await supabase.from('notifications').insert(admins.map((u:any)=>({organization_id:organizationId,user_id:u.id,type:'ryan_action',title,body,message:body,link,entity_type:entityType,entity_id:entityId,is_read:false})))
}

async function notifyImageHandoff(supabase:any,organizationId:string,customer:any,conversation:any){
 const channel=text(conversation.channel,40)||'ريان';
 const channelNames:Record<string,string>={whatsapp:'واتساب',messenger:'ماسنجر',instagram:'إنستجرام',facebook:'فيسبوك',web:'الموقع'};
 const channelLabel=channelNames[channel.toLowerCase()]||channel;
 const {data:existing}=await supabase.from('human_handoff_requests').select('id').eq('organization_id',organizationId).eq('conversation_id',conversation.id).eq('status','open').limit(1).maybeSingle();
 if(existing?.id)return {handoffId:existing.id,created:false};
 const customerName=text(customer?.name,120)||'العميل';
 const {data:req,error}=await supabase.from('human_handoff_requests').insert({organization_id:organizationId,customer_name:customerName,reason:'العميل أرسل صورة ويحتاج إلى تدخل بشري.',status:'open',conversation_id:conversation.id}).select('id').single();
 if(error)throw new Error(error.message);
 const {error:updateError}=await supabase.from('conversations').update({handled_by:'human',status:'open',updated_at:new Date().toISOString()}).eq('id',conversation.id).eq('organization_id',organizationId);
 if(updateError)throw new Error(updateError.message);
 await notifyOrgAdmins(supabase,organizationId,'تدخل بشري مطلوب — العميل أرسل صورة','العميل '+customerName+' أرسل صورة عبر '+channelLabel+'. يرجى تدخل موظف بشري ومتابعة المحادثة.','/handoff-requests?request='+req.id,'handoff',req.id);
 return {handoffId:req.id,created:true};
}


function isRyanUrgentRequest(message:string){
 const x=text(message,1200).replace(/\s+/g,' ').trim();
 return /(?:مستعجل|مستعجلة|عاجل|عاجلة|ضروري|ضرورية|بسرعة|بأسرع وقت|في أسرع وقت|حالاً|حالا|النهارده|اليوم|اتصلوا بيا|يتصلوا بيا|حد يكلمني|حد يتواصل معايا|الفريق يتواصل معايا|الفريق يكلمني|عايز الفريق يكلمني|عاوز الفريق يكلمني|محتاج الفريق يكلمني|محتاج حد يكلمني|عايز حد يكلمني|عاوز حد يكلمني|ضروري حد يكلمني)/iu.test(x);
}
function formatRyanNote(timestamp:string,channel:string,content:string,urgent:boolean){
 const channelNames:Record<string,string>={whatsapp:'واتساب',messenger:'ماسنجر',instagram:'إنستجرام',facebook:'فيسبوك',web:'الموقع'};
 const label=channelNames[channel.toLowerCase()]||channel||'Ryan';
 const date=new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Cairo'}).format(new Date(timestamp));
 const clean=text(content,180).replace(/\\s+/g,' ').replace(/\\n/g,' ').replace(/\\r/g,' ').trim();
 const short=clean.length>140?clean.slice(0,137).trimEnd()+'...':clean;
 return '• '+date+' — '+label+(urgent?' — استعجال':'')+': '+short;
}
const normalizeRyanNotes=(notes:string)=>{
 const normalized=notes.replace(/\\\\n/g,'\\n').replace(/\\r?\\n/g,'\\n');
 return normalized.split('\\n').map(line=>{
  const m=line.match(/^\[([^\]]+)\]\s+\[([^\]]+)\]\s+(.*)$/);
  if(!m)return line;
  const urgent=/^\[استعجال\]\s*/.test(m[3]);
  return formatRyanNote(m[1],m[2],m[3].replace(/^\[استعجال\]\s*/,''),urgent);
 }).join('\\n').trim();
}

async function recordRyanCustomerMessage(supabase:any,organizationId:string,customer:any,conversation:any,messageId:string,message:string){
 const content=text(message,4000);
 if(!customer?.id||!content)return {recorded:false,urgent:false};
 const {data:existing}=await supabase.from('crm_activities').select('id,metadata').eq('organization_id',organizationId).eq('entity_type','customer').eq('entity_id',customer.id).eq('activity_type','ryan_message').contains('metadata',{ryan_message_id:messageId}).limit(1).maybeSingle();
 if(existing?.id)return {recorded:false,urgent:Boolean(existing.metadata?.urgent)};
 const urgent=isRyanUrgentRequest(content);
 const channel=text(conversation.channel,40)||'ريان';
 const timestamp=new Date().toISOString();
 const description='رسالة عميل عبر Ryan ('+channel+'): '+content;
 const {error:activityError}=await supabase.from('crm_activities').insert({
  organization_id:organizationId,entity_type:'customer',entity_id:customer.id,activity_type:'ryan_message',
  title:urgent?'رسالة عميل — استعجال':'رسالة عميل عبر Ryan',description,metadata:{ryan_message_id:messageId,channel,urgent},created_at:timestamp
 });
 if(activityError)throw new Error(activityError.message);
 await notifyOrgAdmins(
  supabase,organizationId,
  urgent?'استعجال من عميل عبر Ryan':'Ryan سجّل ملاحظة جديدة',
  urgent
   ? 'العميل '+(text(customer.name,120)||'العميل')+' طلب أن يتواصل معه الفريق بشكل عاجل. الرسالة: '+content
   : 'تمت إضافة ملاحظة جديدة من محادثة '+(channel)+' للعميل '+(text(customer.name,120)||'العميل')+'.',
  '/crm/customer/'+customer.id,
  urgent?'ryan_urgent':'ryan_note',
  customer.id
 );
 return {recorded:true,urgent};
}
async function appendRyanCustomerUpdateNote(supabase:any,organizationId:string,customer:any,conversation:any,details:any,urgent:boolean){
 if(!customer?.id)return;
 const channel=(text(conversation.channel,40)||'ryan').toLowerCase();
 const service=text(details?.service,160)||'غير محددة';
 const activity=text(details?.activity,160)||'غير محدد';
 const goal=text(details?.goal,200)||text(details?.intent,200)||'غير محدد';
 const budget=text(details?.budget,120)||'غير محددة';
 const note='بيانات تم جمعها بواسطة Ryan | الخدمة: '+service+' | النشاط: '+activity+' | الهدف: '+goal+' | ميزانية الإعلان: '+budget+' | القناة: '+channel+(urgent?' | استعجال':'');
 const {data:latest}=await supabase.from('customers').select('notes').eq('id',customer.id).eq('organization_id',organizationId).maybeSingle();
 const previousNotes=normalizeRyanNotes(text(latest?.notes,10000));
 const notes=(previousNotes?previousNotes+'\\n':'')+note;
 const {error}=await supabase.from('customers').update({notes:notes.slice(-12000),updated_at:new Date().toISOString()}).eq('id',customer.id).eq('organization_id',organizationId);
 if(error)throw new Error(error.message);
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
  const updates:any={};const name=text(d.name,120),phone=cleanPhone(text(d.phone,80)),email=text(d.email,160),company=text(d.company,160),verifiedReplacement=text(d.__verified_name_replacement,120)
  if(verifiedReplacement&&looksLikeName(verifiedReplacement)&&!invalidCustomerName(verifiedReplacement))updates.name=verifiedReplacement;if(validPhone(phone))updates.phone=phone;if(email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))updates.email=email;if(company)updates.company=company
  if(!Object.keys(updates).length)return {success:false,message:'No verified fields'}
  updates.updated_at=new Date().toISOString();const {error}=await supabase.from('customers').update(updates).eq('id',customer.id).eq('organization_id',organizationId);if(error)throw new Error(error.message);return {success:true,data:updates}
 } if(action==='follow_up'){
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
 const {data:incoming}=await supabase.from('messages').select('id,conversation_id,sender_type,content,metadata,created_at').eq('id',messageId).eq('conversation_id',conversationId).maybeSingle();if(!incoming||incoming.sender_type!=='customer')return res.status(200).json({ok:true,skipped:true})
 const {data:conversation}=await supabase.from('conversations').select('id,organization_id,customer_id,channel,handled_by,metadata').eq('id',conversationId).eq('organization_id',organizationId).maybeSingle();if(!conversation||conversation.handled_by==='human')return res.status(200).json({ok:true,skipped:true})
 const channelMetadata=obj(conversation.metadata);
 let {data:customer}=await supabase.from('customers').select('id,name,phone,email,company,notes').eq('id',conversation.customer_id).eq('organization_id',organizationId).maybeSingle()
 const [{data:agentRow},{data:services}]=await Promise.all([supabase.from('ai_agents').select('id,name,persona,language,settings').eq('organization_id',organizationId).eq('name','Ryan').eq('active',true).maybeSingle(),supabase.from('services').select('id,name,description,category').eq('organization_id',organizationId).order('name').limit(100)])
 // Meta conversations can outlive a customer row after manual CRM cleanup. Re-create the customer from the stable channel identifier instead of returning 409.
 if(!customer){
  const channel=String(conversation.channel||'').toLowerCase()
  const metadata=obj(conversation.metadata)
  const externalId=text(channel==='instagram'?metadata.instagram_user_id:metadata.facebook_psid,200)
  if(externalId){
   const {data:createdCustomer,error:createCustomerError}=await supabase.from('customers').insert({organization_id:organizationId,name:'عميل جديد',phone:null,source:channel==='instagram'?'instagram':'messenger'}).select('id,name,phone,email,company,notes').single()
   if(createCustomerError) return res.status(500).json({error:'Failed to restore customer for Ryan',details:text(createCustomerError.message,500)})
   customer=createdCustomer
   const {error:conversationRepairError}=await supabase.from('conversations').update({customer_id:customer.id,updated_at:new Date().toISOString()}).eq('id',conversationId).eq('organization_id',organizationId)
   if(conversationRepairError) return res.status(500).json({error:'Failed to repair Ryan conversation',details:text(conversationRepairError.message,500)})
   console.warn('Ryan repaired conversation with missing customer',{organizationId,conversationId,customerId:customer.id,channel})
  } else {
   return res.status(409).json({error:'Customer is not configured'})
  }
 }
 const {data:claimed,error:claimError}=await supabase.rpc('claim_ryan_message',{p_message_id:messageId,p_conversation_id:conversationId});if(claimError)return res.status(500).json({error:'Failed to claim incoming message',details:text(claimError.message,500)});if(!claimed)return res.status(200).json({ok:true,skipped:true})
 let agent:any=agentRow
if(!agent){
 const {data:createdAgent,error:createAgentError}=await supabase.from('ai_agents').insert({organization_id:organizationId,name:'Ryan',persona:DEFAULT_RYAN_PERSONA,language:'ar-EG',active:true,settings:DEFAULT_RYAN_SETTINGS}).select('id,name,persona,language,settings').single()
 if(createAgentError){
  const {data:existingAgent}=await supabase.from('ai_agents').select('id,name,persona,language,settings').eq('organization_id',organizationId).eq('name','Ryan').eq('active',true).maybeSingle()
  agent=existingAgent
 }else agent=createdAgent
}
if(!agent)return res.status(409).json({error:'Ryan agent could not be initialized'})
 const settings=obj(agent.settings),model=(/^gemini-3\./i.test(text(settings.model,100))?text(settings.model,100):'gemini-3.1-flash-lite'),temperature=Math.min(1,Math.max(0,Number(settings.temperature)||0.45)),allowFallback=settings.fallback_on_llm_failure!==false,rememberCustomer=settings.remember_customer!==false,useKnowledge=settings.use_knowledge_base!==false,crmContext=settings.crm_context!==false,noRepeatQuestions=settings.no_repeat_questions!==false,apiKey=env('GEMINI_API_KEY','GOOGLE_GEMINI_API_KEY')
 const incomingMetadata=obj(incoming.metadata);
 const attachmentCandidates=[incomingMetadata.attachments,incomingMetadata.files,incomingMetadata.media,incomingMetadata.file,incomingMetadata.attachment];
 const imageAttachment=attachmentCandidates.flatMap((value:any)=>Array.isArray(value)?value:[value]).filter(Boolean).some((attachment:any)=>{
  const a=obj(attachment);
  const mime=text(a.mime_type||a.mimeType,120).toLowerCase();
  const type=text(a.type,80).toLowerCase();
  const url=text(a.url||a.media_url||a.mediaUrl||a.download_url,5000).toLowerCase();
  return /^image\//i.test(mime)||type==='image'||/\.(?:png|jpe?g|webp|heic|heif|gif|avif)(?:[?#]|$)/i.test(url);
 });
 if(imageAttachment){
  try{
   const handoff=await notifyImageHandoff(supabase,organizationId,customer,conversation);
   const imageReply='وصلت الصورة، وهخلي موظف من الفريق يتابع مع حضرتك.';
   const {data:savedImage,error:savedImageError}=await supabase.from('messages').insert({conversation_id:conversationId,sender_type:'ai',content:imageReply,metadata:{source:'ryan',type:'image_handoff',human_handoff:true,handoff_id:handoff.handoffId}}).select('id').single();
   if(savedImageError||!savedImage)throw new Error(savedImageError?.message||'Failed to save image handoff reply');
   await supabase.from('messages').update({metadata:{...incomingMetadata,ai_agent_processed_at:new Date().toISOString(),image_handoff:true,handoff_id:handoff.handoffId}}).eq('id',messageId).eq('conversation_id',conversationId);
   return res.status(200).json({ok:true,reply:imageReply,message_id:savedImage.id,action:'handoff_human',image_handoff:true,handoff_id:handoff.handoffId});
  }catch(e:any){
   console.error('Ryan image handoff failed',text(e?.message,500));
   return res.status(500).json({error:'Failed to create human handoff for image',details:text(e?.message,500)});
  }
 }
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
 const history:Turn[]=(messages||[]).reverse().filter((m:any)=>m.id!==messageId&&m.content).map((m:any)=>({role:m.sender_type==='customer'?'user':'model',parts:[{text:text(m.content,1500)}]}));const memory=rememberCustomer?obj(memoryRow?.memory):{};const knowledgeText=(knowledge||[]).map((k:any)=>`${text(k.title,150)}: ${text(k.content,1800)}`).join('\n');const persona=text(agent.persona,4000)||'موظف مصري ودود ومحترف.'
 const pageBrandName=text(channelMetadata.facebook_page_name,160)||text(channelMetadata.instagram_business_name,160)||text(channelMetadata.instagram_username,160)||''
 const brandName=pageBrandName||'الصفحة'
const storedCustomerName=text(customer.name,120)
const isWhatsApp=String(conversation.channel||'').toLowerCase()==='whatsapp'
const rememberedExplicitName=rememberCustomer&&memory.name_source==='customer_explicit'&&looksLikeName(String(memory.name||''))?text(memory.name,120):''
const trustedCustomerName=(storedCustomerName&&!invalidCustomerName(storedCustomerName)&&looksLikeName(storedCustomerName))?storedCustomerName:(isWhatsApp?rememberedExplicitName:'')
 // Only stable, verified profile facts may cross conversation boundaries. Do not treat prior intent/budget/service as active context.
 const safeMemory=rememberCustomer?{name:isWhatsApp?rememberedExplicitName:(looksLikeName(String(memory.name||''))?text(memory.name,120):''),phone:validPhone(String(memory.phone||''))?cleanPhone(String(memory.phone)):'' ,company:text(memory.company,160),email:text(memory.email,160)}:{}
 let multimodal:any={parts:[],currentText:'',transcript:'',attachmentSummary:[],transcriptionFailed:false};try{multimodal=await prepareRyanMultimodal(supabase,organizationId,text(conversation.channel,40),obj(incoming.metadata),apiKey,model)}catch(e){console.error('Ryan multimodal unavailable',e)}
 let current=text(incoming.content,4000)+(multimodal.currentText||'');
 if(multimodal.transcriptionFailed){current+='\n[تنبيه داخلي: العميل أرسل رسالة صوتية لكن تعذر استخراج النص منها. لا تكرر أي رد سابق ولا تتظاهر بفهم محتوى الصوت. اطلب من العميل إعادة إرسال الفويس بوضوح أو كتابة الرسالة.]'}const currentParts=multimodal.parts||[]
 if(currentParts.some((p:any)=>p?.inlineData?.mimeType?.startsWith('image/'))){current+='\n[تنبيه: توجد صورة مرفقة في هذه الرسالة. حلّل الصورة نفسها أولاً وأجب عن محتواها مباشرة، ولا تقل إنك لا تستطيع رؤية الصور.]'}
 console.log('Ryan voice diagnostic: multimodal prepared',{conversationId,messageId,channel:text(conversation.channel,40),attachmentCount:Array.isArray(obj(incoming.metadata).attachments)?obj(incoming.metadata).attachments.length:0,partCount:currentParts.length,transcriptPresent:Boolean(multimodal.transcript),transcriptLength:text(multimodal.transcript,5000).length,attachmentSummary:multimodal.attachmentSummary||[]});
 if(multimodal.transcript)console.log('Ryan voice diagnostic: transcript injected into Ryan prompt',{conversationId,messageId,transcriptLength:text(multimodal.transcript,5000).length})
 let messageRecord:any={recorded:false,urgent:false};
 try{
  messageRecord=await recordRyanCustomerMessage(supabase,organizationId,customer,conversation,messageId,current);
 }catch(e:any){
  console.error('Ryan customer note/notification failed',text(e?.message,500));
 }

 const greetingOnly=/^(?:السلام عليكم(?: ورحمة الله وبركاته)?|سلام عليكم|اهلاً|أهلاً|أهلا|اهلا|هاي|hello|hi|مساء الخير|صباح الخير|مساء النور|صباح النور)[.!؟!،,\s]*$/iu.test(current.trim());
 const explicitOldContextReference=/(?:كنت\s+(?:كلمت|بتكلم|بتواصل|طلبت|سألت)|كلمتكم\s+قبل|المرة\s+اللي\s+فاتت|الطلب\s+القديم|الخدمة\s+القديمة|نكمل\s+(?:الطلب|الموضوع)|بخصوص\s+(?:الطلب|الخدمة|الحملة)\s+اللي)/iu.test(current.trim());
 const effectiveHistory=greetingOnly?[]:history
 const language=text(agent.language,40)||'ar-EG';const emojiMode=['none','light','limited'].includes(text(settings.emoji_mode,20))?text(settings.emoji_mode,20):'light';const emojiInstruction=emojiMode==='none'?'لا تستخدم أي إيموجي.':emojiMode==='limited'?'استخدم إيموجي واحداً فقط عند الحاجة وبشكل طبيعي.':'يمكن استخدام إيموجي خفيف وطبيعي عند ملاءمته، بدون مبالغة.';const languageInstruction=/^(ar-EG|egyptian_arabic)$/iu.test(language)?'استخدم العربية المصرية الطبيعية.':/^ar$/iu.test(language)?'استخدم العربية الواضحة.':'استخدم اللغة المحددة في إعداد Ryan بشكل طبيعي.';
 const isMetaCommentSource=String(obj(incoming.metadata).source||'')==='meta_comment';
 const postContext=text(obj(incoming.metadata).post_context,5000);
 const metaCommentInstruction=isMetaCommentSource?`هذه رسالة واردة من تعليق على منشور في Facebook/Instagram. التعليق الحالي هو: «${text(incoming.content,800)}». ${postContext?`محتوى المنشور الذي علق عليه العميل: «${postContext}».`: 'لم يصل محتوى المنشور؛ لا تخترع تفاصيل غير موجودة.'} افهم محتوى المنشور أولاً، ثم أجب على طلب العميل مباشرة بناءً على المنشور وقاعدة المعرفة. إذا كان التعليق «تفاصيل» أو «عايز تفاصيل» أو ما يشبه ذلك، قدّم له تفاصيل المنشور أو شرح الخدمة/العرض المذكور فيه، ثم اسأله سؤالاً واحداً فقط إذا كان ذلك ضرورياً لاستكمال المحادثة. لا تقل «شفت تعليق حضرتك» ولا «بخصوص تعليق حضرتك» ولا تشرح للعميل أنك تعالج تعليقاً؛ ادخل مباشرة في الإجابة الطبيعية.`:'';
 const customerGender=inferCustomerGender(trustedCustomerName);
 const genderInstruction=customerGender==='female'
  ? 'العميلة مؤنث بشكل موثوق من الاسم/البيانات: خاطبها بصيغة مؤنثة طبيعية عند الحاجة، مثل «حضرتك» مع أفعال وصفات مؤنثة، ولا تستخدم ألقاباً مبالغاً فيها.'
  : customerGender==='male'
    ? 'العميل مذكر بشكل موثوق من الاسم/البيانات: خاطبه بصيغة مذكرة طبيعية عند الحاجة، مع «حضرتك» أو اسمه، بدون مبالغة في الألقاب.'
    : 'نوع العميل غير مؤكد: استخدم صياغة محايدة ولا تخمّن النوع من الاسم وحده.';
 const system=`أنت ${text(agent.name,80)||'Ryan'}، موظف خدمة العملاء والمبيعات الذكي الخاص بـ ${brandName}. أنت تمثل النشاط/الصفحة المتصلة بهذه المحادثة، وليس Dragon Media إلا إذا كان اسم النشاط نفسه Dragon Media. هدفك أن يشعر العميل أنه يتحدث مع إنسان حقيقي محبوب وذكي، وليس روبوتاً يطرح أسئلة محفوظة.

أسلوبك الأساسي: مصري طبيعي، خفيف الدم وودود ومحترم، دافئ بدون تصنع، سريع الفهم، وتدخل في صلب كلام العميل. رد على النقطة التي قالها العميل أولاً، ثم اسأل سؤالاً واحداً فقط إذا كان السؤال ضرورياً للخطوة التالية. لا تحول الحوار إلى استبيان. افهم العامية المصرية، الاختصارات والأخطاء الإملائية، وخذ معنى الرسالة من السياق وليس من الكلمات منفردة.

${languageInstruction}
${emojiInstruction}
${genderInstruction}

استخدم «يا فندم» أحياناً عندما تكون طبيعية في السياق، لكن لا تكررها في كل رسالة. استخدم اسم العميل عندما يكون موثوقاً، وبنفس الكتابة المحفوظة دون اختصار. إذا كان العميل/العميلة معروف النوع من الاسم الموثوق أو من كلامه الصريح، استخدم صيغة المذكر أو المؤنث المناسبة. إذا لم يكن النوع مؤكداً، التزم بالحياد ولا تخمّن. لا تستخدم «يا غالي»، «يا أستاذ»، «يا مدام»، «يا حبيبتي» كقوالب ثابتة.

التعاطف والمواقف الاجتماعية: إذا ذكر العميل مناسبة سعيدة مثل فرح أو خطوبة أو زفاف أو عيد ميلاد أو مناسبة خاصة، تفاعل إنسانياً قبل سؤال الخدمة؛ مثال طبيعي: «مبروك مقدماً يا فندم 😊🤍» ثم أكمل بسؤال مفيد متعلق بما يحتاجه. لا تكرر المثال حرفياً في كل مناسبة؛ غيّر الصياغة حسب الموقف. لو العميل متضايق أو مستعجل، اعترف بذلك باختصار وتعامل معه مباشرة. المزاح يكون خفيفاً فقط عندما يناسب الموقف، ولا تمزح مع شكوى أو موقف حساس.

الإيموجي: استخدمها فقط عندما تضيف إحساساً حقيقياً للرسالة، عادة 0-2 في الرد، مثل 😊🤍❤️🎉، وخصوصاً في التهنئة أو الترحيب أو التفاعل الودود. لا تضع إيموجي بعد كل جملة ولا تجعل الرسالة طفولية. إذا كانت المناسبة رسمية أو العميل جاداً، قللها.

مصادر الحقيقة: بيانات الصفحة المتصلة، SERVICES، COMPANY RULES، وKNOWLEDGE BASE هي المصدر الأول لأي معلومة تخص النشاط أو الخدمة أو السعر أو المواعيد أو العروض أو السياسات. استخدمها فعلياً ولا تتجاهلها. إذا لم توجد المعلومة، قل ذلك بشكل طبيعي واطلب من العميل ما يلزم أو وجّه لموظف بشري؛ لا تخترع سعراً أو عرضاً أو موعداً أو سياسة. لا تذكر معلومات عامة من النموذج كأنها معلومة مؤكدة عن الشركة.

لا تبدأ كل محادثة بنفس الجملة. لا تقل «كيف يمكنني مساعدتك؟» كقالب محفوظ. لا تسأل سؤالاً سبق أن أجاب عنه العميل، ولا تطلب اسمه إذا كان موثوقاً لديك. إذا قال العميل «أنا كريم» أو أجاب باسم قصير بعد سؤال الاسم، اعتبره اسمه واحفظه. إذا عاد العميل في محادثة جديدة، لا تعتبر الخدمة أو الميزانية أو الهدف القديم هو الطلب الحالي إلا إذا أشار إليه الآن. الذاكرة الشخصية الموثوقة مثل الاسم والهاتف يمكن استخدامها، لكن تفاصيل الطلب القديم تاريخية.

لا تدّعي تنفيذ حجز أو موعد أو تسجيل أو تأكيد أو إرسال أو متابعة إلا إذا نفذت أداة فعلية ونجحت. لا تخترع مواعيد أو توافر. عند سؤال السعر استخدم السعر الموجود في SERVICES/KNOWLEDGE BASE. بعد اكتمال البيانات انتقل للخطوة العملية المناسبة بشكل طبيعي، ولا تعيد التأهيل من الصفر.

إذا كانت الرسالة تعليقاً على منشور، افهم محتوى المنشور والرسالة الحالية أولاً وأجب مباشرة بدون قول «شفت تعليق حضرتك» أو شرح آلية العمل. إذا قال «تفاصيل»، قدم تفاصيل ما هو موجود فعلاً في المنشور/قاعدة المعرفة، ثم سؤالاً واحداً عند الحاجة.

PERSONA: ${persona}
${crmContext?`CUSTOMER: name=${trustedCustomerName||'غير معروف'}, gender=${customerGender}, phone=${cleanPhone(text(customer.phone,80))||'غير معروف'}, email=${text(customer.email,160)||'غير معروف'}, company=${text(customer.company,160)||'غير معروف'}
VERIFIED CUSTOMER MEMORY: ${JSON.stringify(safeMemory).slice(0,3000)}
SERVICES: ${JSON.stringify(services||[]).slice(0,12000)}`:'CRM CONTEXT: disabled by Ryan settings'}
COMPANY RULES: ${text(settings.custom_rules,5000)||'لا توجد قواعد إضافية.'}
KNOWLEDGE BASE:
${knowledgeText||'لا توجد معلومات في قاعدة المعرفة حالياً.'}
${metaCommentInstruction}
${explicitOldContextReference?'العميل أشار في رسالته الحالية إلى سياق سابق؛ استخدمه فقط بقدر ما يخدم طلبه الحالي.':'لا يوجد في الرسالة الحالية ما يسمح باسترجاع طلب قديم؛ تعامل مع أي خدمة أو ميزانية قديمة كبيانات تاريخية فقط.'}`

 let plan:Record<string,any>={},usedModel=model,lastError=''
 // Greeting-only messages are deterministic: never send historical context to Gemini and never let the model revive an old request.
 if(greetingOnly){
  const greetingName=trustedCustomerName
  plan={reply:greetingName?`وعليكم السلام ${greetingName}، أهلاً وسهلاً بحضرتك. أقدر أساعدك في إيه؟`:'وعليكم السلام، أهلاً وسهلاً بحضرتك. أقدر أساعدك في إيه؟',action:'continue',action_data:{},confidence:1}
 } else try{const result=await callGemini(apiKey,model,system,effectiveHistory,current,currentParts,temperature,allowFallback);plan=obj(result.plan);usedModel=result.model}catch(e:any){lastError=text(e?.message,500);console.error('Ryan Gemini reliability exhausted',JSON.stringify({model:usedModel,error:lastError,conversationId,messageId}))}
 if(!plan.service&&plan.intent&&/بيع|شراء|إعلان|تسويق|إدارة صفحة|تصميم|محتوى|عقارات|وحدة|سيارة|منتج/iu.test(String(plan.intent)))plan.service=text(plan.intent,160);
 const aiUnavailable=!plan.reply
 if(aiUnavailable){
  if(runId)await supabase.from('ai_agent_runs').update({status:'failed',model:usedModel,metadata:{source:'ryan',error:lastError}}).eq('id',runId)
  console.error('Ryan Gemini unavailable after all retries',JSON.stringify({model:usedModel,error:lastError,conversationId,messageId}))
  plan={reply:'معلش، حصل تأخير بسيط في الرد. ابعتلي رسالتك تاني وهكمل مع حضرتك فوراً.',action:'continue',action_data:{},confidence:0}
 }
 const lastModelMessage=(history.slice().reverse().find((t:any)=>t.role==='model')?.parts?.[0]?.text||'').toString();const nameQuestionPending=/(?:اسم حضرتك|اسمك|اسمِك|الاسم|أسم حضرتك|أسمك)/iu.test(lastModelMessage);const hasKnownNameBeforeTurn=Boolean(trustedCustomerName);const identity=obj(plan.customer_identity);const modelIdentityName=text(identity.name,120);const modelIdentityConfidence=Math.max(0,Math.min(1,Number(identity.confidence)||0));const modelIdentitySource=text(identity.source,40);const currentNormalized=text(current,200).replace(/\s+/g,' ').trim();const modelNameAppearsInCurrent=Boolean(modelIdentityName&&currentNormalized.toLocaleLowerCase('ar-EG').includes(modelIdentityName.toLocaleLowerCase('ar-EG')));const modelNameTrusted=Boolean(modelIdentityConfidence>=0.9&&['explicit','answer_to_name_question','correction'].includes(modelIdentitySource)&&looksLikeName(modelIdentityName)&&!invalidCustomerName(modelIdentityName)&&modelNameAppearsInCurrent);const nameReplacementRequested=isNameReplacementRequest(current);const replacementName=nameReplacementRequested?extractReplacementName(current):'';const candidateName=extractName(current)||(modelNameTrusted?modelIdentityName:'')||((!hasKnownNameBeforeTurn&&nameQuestionPending&&looksLikeName(text(current,120)))?text(current,120):'');const explicitName=hasKnownNameBeforeTurn?(nameReplacementRequested&&replacementName?replacementName:''):candidateName;const learnedName=explicitName;const learnedPhone=cleanPhone(text(plan.learned_phone,80))||phoneFromText(current);const customerUpdates:any={};if(learnedName&&looksLikeName(learnedName)&&!invalidCustomerName(learnedName)&&(!hasKnownNameBeforeTurn||nameReplacementRequested))customerUpdates.name=learnedName;if(validPhone(learnedPhone))customerUpdates.phone=learnedPhone;if(Object.keys(customerUpdates).length){customerUpdates.updated_at=new Date().toISOString();await supabase.from('customers').update(customerUpdates).eq('id',customer.id).eq('organization_id',organizationId);Object.assign(customer,customerUpdates);
  // Keep any currently-open Ryan handoff synchronized with the customer's corrected CRM identity.
  if(customerUpdates.name){
   const {error:handoffSyncError}=await supabase.from('human_handoff_requests').update({customer_name:text(customer.name,120)||'العميل'}).eq('organization_id',organizationId).eq('conversation_id',conversation.id).eq('status','open');
   if(handoffSyncError)console.error('Ryan handoff name sync failed',text(handoffSyncError.message,500));
  }
}
 // Hard safety guard: a new customer must be asked for their name before Ryan moves into qualification.
 // Gemini remains responsible for the wording; this only prevents it from skipping a required identity field.
 const effectiveName=isWhatsApp?(rememberedExplicitName||text(explicitName,120)):text(customer.name,120);const hasTrustedName=Boolean(effectiveName&&looksLikeName(effectiveName)&&!invalidCustomerName(effectiveName));const nameWasProvidedNow=Boolean(explicitName&&looksLikeName(explicitName)&&!invalidCustomerName(explicitName));const phoneWasProvidedNow=Boolean(phoneFromText(current)||validPhone(cleanPhone(text(plan.learned_phone,80))));
 if(!hasTrustedName&&!nameWasProvidedNow&&!aiUnavailable&&!isMetaCommentSource){  plan.reply='أهلاً وسهلاً بحضرتك، ممكن أتشرف باسم حضرتك؟';plan.action='continue';plan.action_data={};
 }
 if((hasTrustedName||nameWasProvidedNow)&&!phoneWasProvidedNow&&!aiUnavailable&&['handoff_human','create_lead'].includes(text(plan.action,60))){
  plan.reply='تمام، ممكن أعرف رقم حضرتك للتواصل؟';plan.action='continue';plan.action_data={};
 }
 if(greetingOnly&&!aiUnavailable){plan.action='continue';plan.action_data={};}
 if(messageRecord.urgent&&text(plan.action,60)==='continue'&&!aiUnavailable){
  plan.action='handoff_human';
  plan.action_data={...obj(plan.action_data),reason:'العميل طلب استعجال وتواصل سريع من الفريق.'};
 }
 const normalizedAction=['continue','handoff_human','create_lead','create_task','update_customer','follow_up','schedule_appointment','create_automation'].includes(text(plan.action,60))?text(plan.action,60):'continue';
 plan.action=normalizedAction; if(!text(plan.action,60))plan.action='continue'; const actionData=obj(plan.action_data);if(nameReplacementRequested&&replacementName)actionData.__verified_name_replacement=replacementName;else delete actionData.__verified_name_replacement;if(!text(actionData.service,160)&&text(plan.service,160))actionData.service=text(plan.service,160);if(!text(actionData.phone,80)&&validPhone(String(customer.phone||'')))actionData.phone=cleanPhone(String(customer.phone));plan.action_data=actionData;let actionResult:any={success:true};if(text(plan.action,60)!=='continue'){try{actionResult=await executeAction(supabase,organizationId,customer,conversation,text(plan.action,60),actionData,services||[],messageId,memory)}catch(e:any){console.error('Ryan action execution failed',text(plan.action,60),text(e?.message,500))
  actionResult={success:false,message:'Action execution failed'}
 }}
 let reply=text(plan.reply,5000);
 if(!actionResult.success&&text(plan.action,60)!=='continue'){
  reply='ممكن نكمل الخطوة دي مع حضرتك، لكن محتاجة تنفيذ فعلي من النظام أو متابعة من الفريق. مش هقول لحضرتك إنها اتأكدت قبل ما يتم تنفيذها.';
  plan.action='continue';
  plan.action_data={};
 }
 if(actionResult.success&&text(plan.action,60)!=='continue')reply=text(plan.reply,5000)||'تم تنفيذ طلب حضرتك بنجاح.'
 const previousService=text(memory.service,160),previousBudget=text(memory.budget,120),previousIntent=text(memory.intent,100);const currentBudget=budgetFromText(current);const noteDetails={service:text(plan.service,160)||previousService,activity:text(plan.activity,160)||text(memory.activity,160),goal:text(plan.goal,200)||text(plan.intent,200)||previousIntent,budget:currentBudget||text(plan.budget,120)||previousBudget};try{await appendRyanCustomerUpdateNote(supabase,organizationId,customer,conversation,noteDetails,messageRecord.urgent)}catch(e:any){console.error('Ryan customer update note failed',text(e?.message,500))}if(currentBudget&&currentBudget!==previousBudget){ const budgetReply='تمام، سجلت الميزانية الجديدة '+currentBudget+' وهبني عليها المتابعة.'; if(!reply||!/ميزاني(?:ة|ه)|ميزانية/iu.test(reply))reply=budgetReply; }
const leadService=text(plan.service,160)||previousService;const leadBudget=currentBudget||text(plan.budget,120)||previousBudget;try{await ensureRyanLead(supabase,organizationId,customer,conversation,leadService,leadBudget)}catch(e:any){console.error('Ryan lead sync failed',text(e?.message,500))}
const durableMemory={name:(isWhatsApp?(explicitName||rememberedExplicitName):text(customer.name,120))||null,name_source:(isWhatsApp ? ((explicitName||rememberedExplicitName) ? 'customer_explicit' : null) : (explicitName ? 'customer_explicit' : 'crm')),phone:validPhone(learnedPhone)?cleanPhone(learnedPhone):(validPhone(String(memory.phone||''))?cleanPhone(String(memory.phone)):null),company:text(memory.company,160)||null,email:text(memory.email,160)||null,service:text(plan.service,160)||previousService||null,budget:text(plan.budget,120)||budgetFromText(current)||previousBudget||null,intent:text(plan.intent,100)||previousIntent||null,stage:(text(plan.service,160)||previousService)?'qualification':'discovery',last_question:text(plan.reply,5000).split(/[؟?]/).slice(-2).join('؟').trim()||null,last_message:current,updated_at:new Date().toISOString()};if(rememberCustomer)await supabase.from('ai_agent_memory').upsert({agent_id:agent.id,customer_id:customer.id,memory:durableMemory,summary:`${durableMemory.name||'العميل'} — ${durableMemory.service||'الخدمة غير محددة'}${durableMemory.budget?' — '+durableMemory.budget:''}`},{onConflict:'agent_id,customer_id'})
 const {data:saved,error:saveError}=await supabase.from('messages').insert({conversation_id:conversationId,sender_type:'ai',content:reply,metadata:{source:'ryan',ai_agent_id:agent.id,provider:'gemini',model:usedModel,action:text(plan.action,60)||'continue',action_success:actionResult.success,safety_fallback:aiUnavailable,billing_run_id:runId||null}}).select('id').single();if(saveError||!saved){if(runId)await supabase.from('ai_agent_runs').update({status:'failed',metadata:{source:'ryan',error:saveError?.message||'Failed to save Ryan response'}}).eq('id',runId);throw new Error(saveError?.message||'Failed to save Ryan response')}if(runId&&!aiUnavailable)await supabase.from('ai_agent_runs').update({status:'success',model:usedModel,metadata:{source:'ryan',action:text(plan.action,60)||'continue',action_success:actionResult.success}}).eq('id',runId);await supabase.from('messages').update({metadata:{...obj(incoming.metadata),ai_agent_processed_at:new Date().toISOString(),ai_agent_id:agent.id}}).eq('id',messageId).eq('conversation_id',conversationId)
 if(['messenger','facebook','instagram'].includes(String(conversation.channel||'').toLowerCase())){
  try{
   const {data:outboundSecretRow}=await supabase.from('system_secrets').select('value').eq('key','whatsapp_outbound_webhook_secret').maybeSingle()
   const outboundSecret=String(outboundSecretRow?.value||'').trim()
   if(!outboundSecret)throw new Error('Meta outbound dispatch secret is missing')
   const outboundResponse=await fetch('https://dragon-media-saas-new.vercel.app/api/meta/facebook/send',{method:'POST',headers:{'Content-Type':'application/json','x-dragon-facebook-outbound-secret':outboundSecret},body:JSON.stringify({message_id:saved.id})})
   const outboundPayload=await outboundResponse.json().catch(()=>({}))
   if(!outboundResponse.ok)throw new Error(String(outboundPayload?.error||'Meta outbound send failed'))
   console.log('Ryan Meta outbound message sent',{conversationId,channel:conversation.channel,messageId:saved.id,externalId:String(outboundPayload?.message?.external_id||outboundPayload?.external_id||'')})  }catch(outboundError:any){
   console.error('Ryan Meta outbound send failed',{conversationId,channel:conversation.channel,messageId:saved.id,error:text(outboundError?.message,500)})
   await supabase.from('messages').update({metadata:{source:'ryan',outbound_status:'failed',outbound_error:text(outboundError?.message,500)}}).eq('id',saved.id).eq('conversation_id',conversationId)
  }
 }
 return res.status(200).json({ok:true,reply,message_id:saved.id,provider:'gemini',model:usedModel,action:text(plan.action,60)||'continue',action_success:actionResult.success,safety_fallback:aiUnavailable})
}