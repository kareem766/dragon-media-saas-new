import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'

const env=(...names:string[])=>names.map(n=>process.env[n]).find(v=>v?.trim())?.trim()||''
const db=()=>createClient(env('VITE_SUPABASE_URL','SUPABASE_URL'),env('SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})
const text=(v:unknown,max=2000)=>typeof v==='string'?v.trim().slice(0,max):''
const obj=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{}
const sameSecret=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
const priceIntent=(value:string)=>/(السعر|سع(?:ر|رة)|تكلف(?:ة|ه)|بكام|بكم|كام|الفلوس|الفلوس كام|التكلفه|التكلفة|price|cost|pricing|how much)/iu.test(value)
const cleanPhone=(value:string)=>value.replace(/[^0-9+]/g,'').trim()
const phoneFromText=(value:string)=>{const m=value.match(/(?:\+?20\s*)?(01[0125]\s*\d{8})\b/);return m?cleanPhone(m[0]):''}

const budgetFromText=(value:string)=>{
 const v=value.replace(/[,،]/g,' ')
 const m=v.match(/(?:ميزاني(?:ة|ه)|ميزانيه|budget|بميزاني(?:ة|ه))[^0-9]{0,20}([0-9]{2,7}(?:\.[0-9]+)?)/iu) || v.match(/([0-9]{2,7}(?:\.[0-9]+)?)\s*(?:جنيه|ج|EGP|الف|ألف)/iu)
 if(!m)return ''
 const raw=String(m[1]).trim(),n=Number(raw)
 return Number.isFinite(n)?String(n)+' جنيه':raw
}
const serviceFromText=(value:string,services:any[])=>{
 const v=value.trim().toLowerCase()
 for(const service of services){
  const name=text(service?.name,160)
  if(name && v.includes(name.toLowerCase()))return name
 }
 const aliases:[RegExp,string][]=[
  [/(?:إعلان|اعلان|اعلانات|إعلانات|حملة اعلانية|حملة إعلانية|ads|advertising)/iu,'الإعلانات'],
  [/(?:سوشيال|سوشيال ميديا|إدارة صفحات|ادارة صفحات|إدارة السوشيال|ادارة السوشيال)/iu,'إدارة السوشيال ميديا'],
  [/(?:محتوى|كونتنت|content|تصميم|جرافيك|جرافيك ديزاين)/iu,'المحتوى والتصميم'],
  [/(?:موقع|ويب سايت|website|متجر|متجر إلكتروني|متجر الكتروني)/iu,'المواقع والمتاجر'],
 ]
 for(const [re,name] of aliases)if(re.test(v))return name
 return ''
}
const salesIntent=(value:string)=>/(?:عايز|عاوز|محتاج|محتاجة|عايزه|عاوزة|مهتم|محتاجين|نبدأ|نبداء|ابدأ|ابدء|اشتغل|شغل|خدمة|خدمات|إعلان|اعلان|حملة|تصميم|محتوى|سوشيال|صفحة|صفحات|تسويق|ماركتنج|website|موقع|متجر)/iu.test(value)
const nameStopWords=/^(?:عايز|عاوز|عاوزه|عايزه|محتاج|محتاجة|ممكن|قولي|قولى|قول|اعرف|أعرف|عايز\s+اعرف|عاوز\s+اعرف|السعر|سعر|تكلفة|التكلفة|التكلفه|بكام|بكم|كام|فلوس|الإعلان|اعلان|إعلان|اعمل|نعمل|خدمة|خدمات|حملة|الحملة|تفاصيل|معلومات|ممكنة|هل|هو|هي|ايه|إيه|ازاي|إزاي|عاوزين|نريد|اريد|أريد|اه|أه|ايوه|أيوه|تمام|حاضر|ماشي|نعم|yes|ok)$/iu
const isPlaceholderName=(value:string)=>{const v=value.trim();return !v||/^(?:عميل جديد|غير معروف|unknown|whatsapp\s*\d+|facebook\s*\d+)$/iu.test(v)}
const looksLikeName=(value:string)=>{const v=value.trim().replace(/\s+/g,' ');if(isPlaceholderName(v)||phoneFromText(v))return false;if(v.length<2||v.length>80)return false;if(/https?:\/\//i.test(v)||/[?؟]/.test(v))return false;const words=v.split(' ').filter(Boolean);if(words.length>4)return false;if(words.some(w=>nameStopWords.test(w)))return false;return /^[\p{L}][\p{L}\u064B-\u065F\s.'’-]{1,79}$/u.test(v)}
const extractNameFromMessage=(value:string)=>{
 const v=value.trim().replace(/\s+/g,' ')
 const explicit=v.match(/(?:^|\s)(?:أنا\s+اسمي|انا\s+اسمي|اسمي|my\s+name\s+is)\s+(.+?)(?:\s+(?:ورقمي|ورقمى|رقمي|رقمى|رقم|و)?\s*(?:01[0125]\s*\d{8}|\+?20\s*01[0125]\s*\d{8})\b|$)/iu)
 if(explicit&&looksLikeName(explicit[1]))return text(explicit[1],120)
 const withoutPhone=v.replace(/(?:\+?20\s*)?01[0125]\s*\d{8}/g,' ').replace(/\s+/g,' ').trim()
 if(looksLikeName(withoutPhone))return text(withoutPhone,120)
 return ''
}
type Turn={role:'user'|'model';parts:{text:string}[]}

async function callGemini(key:string,model:string,system:string,history:Turn[],current:string){
 const candidates=[model,'gemini-3.6-flash','gemini-2.5-flash-lite','gemini-2.0-flash'].filter((v,i,a)=>v&&a.indexOf(v)===i)
 let lastError='Gemini request failed'
 for(const candidate of candidates){
  for(let attempt=0;attempt<2;attempt++){
   try{
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[...history,{role:'user',parts:[{text:current}]}],generationConfig:{maxOutputTokens:700}})})
    const d=await r.json().catch(()=>({}))
    if(r.ok){
     const reply=text(d?.candidates?.[0]?.content?.parts?.map((p:any)=>p?.text||'').join(''),5000)
     if(reply)return reply
     lastError=`Gemini ${candidate} returned an empty response`
    }else{
     lastError=d?.error?.message||`Gemini ${r.status}`
     const retryable=r.status===429||r.status===408||r.status===500||r.status===502||r.status===503||r.status===504
     if(!retryable)break
    }
   }catch(error:any){
    lastError=text(error?.message,500)||'Gemini network error'
   }
   if(attempt===0)await new Promise(resolve=>setTimeout(resolve,350))
  }
 }
 throw new Error(`Ryan Gemini fallback exhausted: ${lastError}`)
}

async function capturePriceInquiry(supabase:any,organizationId:string,customerId:string,name:string,phone:string,email:string,service:string,notes:string){
 const {data,error}=await supabase.rpc('ryan_capture_price_inquiry',{p_organization_id:organizationId,p_customer_id:customerId||null,p_name:name||null,p_phone:phone||null,p_email:email||null,p_company:null,p_service:service||null,p_notes:notes||null,p_source:'ryan'})
 if(error)throw new Error(error.message)
 return data?.[0]||null
}

export default async function main(req:VercelRequest,res:VercelResponse){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'})
 const supabase=db();const secret=text(req.headers['x-ryan-inbox-secret'],300)
 const {data:secretRow}=await supabase.from('system_secrets').select('value').eq('key','ai_agent_inbox_secret').maybeSingle()
 if(!secret||!secretRow?.value||!sameSecret(secret,String(secretRow.value)))return res.status(401).json({error:'Unauthorized'})
 const body=obj(req.body),organizationId=text(body.organization_id,100),conversationId=text(body.conversation_id,100),messageId=text(body.message_id,100)
 if(!organizationId||!conversationId||!messageId)return res.status(400).json({error:'Missing agent identifiers'})
 const {data:claimed,error:claimError}=await supabase.rpc('claim_ryan_message',{p_message_id:messageId,p_conversation_id:conversationId})
 if(claimError) return res.status(500).json({error:'Failed to claim incoming message',details:text(claimError.message,500)})
 if(!claimed)return res.status(200).json({ok:true,skipped:true,reason:'already_processing_or_processed'})
 const {data:incomingAfterClaim}=await supabase.from('messages').select('id,conversation_id,sender_type,content,metadata').eq('id',messageId).eq('conversation_id',conversationId).maybeSingle()
 if(!incomingAfterClaim||incomingAfterClaim.sender_type!=='customer')return res.status(200).json({ok:true,skipped:true})
 const incoming=obj(incomingAfterClaim)
 const incomingMetadata=obj(incomingAfterClaim.metadata)
 const {data:conversation}=await supabase.from('conversations').select('id,organization_id,customer_id,channel,handled_by,metadata').eq('id',conversationId).eq('organization_id',organizationId).maybeSingle()
 if(!conversation||conversation.handled_by==='human')return res.status(200).json({ok:true,skipped:true})
 const [{data:customer},{data:services},{data:agent}]=await Promise.all([
  supabase.from('customers').select('id,name,phone,email,company,notes').eq('id',conversation.customer_id).eq('organization_id',organizationId).maybeSingle(),
  supabase.from('services').select('name,description,category').eq('organization_id',organizationId).order('name').limit(80),
  supabase.from('ai_agents').select('id,name,persona,language,settings').eq('organization_id',organizationId).eq('name','Ryan').eq('active',true).maybeSingle()
 ])
 if(!customer||!agent)return res.status(409).json({error:'Ryan agent is not configured'})
 const settings=obj(agent.settings),model=text(settings.model,100)||'gemini-3.6-flash',apiKey=env('GEMINI_API_KEY','GOOGLE_GEMINI_API_KEY')
 if(!apiKey)return res.status(500).json({error:'Gemini is not configured'})
 const historyLimit=Math.min(Math.max(Number(settings.max_history_messages)||80,1),80),knowledgeLimit=Math.min(Math.max(Number(settings.max_knowledge_items)||50,1),50)
 const [{data:messages},{data:knowledge},{data:memoryRow}]=await Promise.all([
  supabase.from('messages').select('id,sender_type,content,created_at').eq('conversation_id',conversationId).order('created_at',{ascending:false}).limit(historyLimit),
  settings.use_knowledge_base===false?Promise.resolve({data:[] as any[]}):supabase.from('knowledge_base').select('title,content').eq('organization_id',organizationId).limit(knowledgeLimit),
  supabase.from('ai_agent_memory').select('memory,summary').eq('agent_id',agent.id).eq('customer_id',customer.id).maybeSingle()
 ])
 const previous=(messages||[]).reverse().filter((m:any)=>m.id!==messageId&&m.content)
 const history:Turn[]=previous.map((m:any)=>({role:m.sender_type==='customer'?'user':'model',parts:[{text:text(m.content,1500)}]}))
 const memory=obj(memoryRow?.memory),knowledgeText=(knowledge||[]).map((x:any)=>`${text(x.title,150)}: ${text(x.content,2000)}`).join('\n')
 const persona=text(agent.persona,3000)||'مساعد ذكي محترف يتحدث باللهجة المصرية.',current=text(incoming.content,3000)
 const conversationMetadata=obj(conversation.metadata)
 const pendingPriceInquiry=conversationMetadata.ryan_price_inquiry===true
 let priceCaptured=false
 let priceData:any=null
 let reply=''


 try{
  const captureMeta=obj(conversationMetadata.ryan_lead_capture)
  const historyText=history.map((item:any)=>text(item?.content,800)).join(' | ')
  const hasPreviousCapture=!!captureMeta.captured_at && captureMeta.active!==true
  const currentSalesIntent=salesIntent(current)
  const historicalSalesIntent=salesIntent(historyText)
  const leadContext=(captureMeta.active===true ? (historicalSalesIntent || currentSalesIntent || pendingPriceInquiry || priceIntent(current) || captureMeta.service || captureMeta.name || captureMeta.phone || captureMeta.budget) : (currentSalesIntent || pendingPriceInquiry || priceIntent(current)))
  const activeCapture=!hasPreviousCapture && (captureMeta.active===true || !!leadContext)
  const parsedName=extractNameFromMessage(current) || extractNameFromMessage(historyText)
  const parsedPhone=phoneFromText(current) || phoneFromText(historyText)
  const parsedService=serviceFromText(current,services||[]) || serviceFromText(historyText,services||[])
  const parsedBudget=budgetFromText(current) || budgetFromText(historyText)

  if(activeCapture){
    const collectedName=text(captureMeta.name,120) || parsedName || (looksLikeName(text(customer.name,120)) ? text(customer.name,120) : '')
    const collectedPhone=cleanPhone(text(captureMeta.phone,80) || parsedPhone || text(customer.phone,80))
    const collectedService=text(captureMeta.service,160) || parsedService
    const isAd=/(?:إعلان|اعلان|إعلانات|اعلانات|حملة إعلانية|حملة اعلانية|ads|advertising)/iu.test(collectedService) || /(?:إعلان|اعلان|حملة)/iu.test(current) || /(?:إعلان|اعلان|حملة)/iu.test(historyText)
    const collectedBudget=text(captureMeta.budget,120) || parsedBudget
    const existingGoal=text(captureMeta.goal,240)
    const goalFromText=/(?:هدف|عايز أوصل|عاوز أوصل|الهدف|محتاج أوصل|الغرض)/iu.test(current) ? text(current,240) : ''
    const collectedGoal=existingGoal || goalFromText
    const nextMeta={active:true,name:collectedName||null,phone:collectedPhone||null,service:collectedService||null,budget:collectedBudget||null,goal:collectedGoal||null,is_ad:isAd,stage:!collectedName?'name':!collectedPhone?'phone':!collectedService?'service':(isAd&&!collectedBudget?'budget':'ready')}

    if(!collectedName) reply='أهلاً بحضرتك، ممكن أعرف اسم حضرتك؟'
    else if(!collectedPhone) reply='تمام، ممكن رقم الموبايل اللي فريق Dragon Media يقدر يتواصل مع حضرتك عليه؟'
    else if(!collectedService) reply='تمام، إيه الخدمة اللي محتاجها تحديدًا؟'
    else if(isAd&&!collectedBudget) reply='تمام، وميزانية الإعلان المتوقعة كام تقريبًا؟'
    else{
      const notes=['بيانات تم جمعها بواسطة Ryan','الخدمة: '+collectedService,collectedGoal?'الهدف: '+collectedGoal:'',isAd?'ميزانية الإعلان: '+collectedBudget:'','القناة: '+(conversation.channel||'غير محدد')].filter(Boolean).join(' | ')
      priceData=await capturePriceInquiry(supabase,organizationId,customer.id,collectedName,collectedPhone,text(customer.email,160),collectedService,notes)
      priceCaptured=true
      await supabase.from('conversations').update({metadata:{...conversationMetadata,ryan_lead_capture:{...nextMeta,active:false,captured_at:new Date().toISOString(),lead_id:priceData?.lead_id||null,customer_id:priceData?.customer_id||customer.id}},handled_by:'human',updated_at:new Date().toISOString()}).eq('id',conversationId).eq('organization_id',organizationId)
      reply='تمام، تم تسجيل بيانات حضرتك، وفريق Dragon Media هيتواصل مع حضرتك في أقرب وقت.'
    }
    if(!priceCaptured) await supabase.from('conversations').update({metadata:{...conversationMetadata,ryan_lead_capture:nextMeta}}).eq('id',conversationId).eq('organization_id',organizationId)
  }else{
    const system=`You are Ryan, the AI assistant inside Dragon Media.

PERSONA:
${persona}

IMPORTANT RESPONSE SAFETY:
- Never claim that you "recorded", "saved", "registered", "completed", "booked", or "captured" customer data unless the application has actually completed that operation.
- Never apologize for an interruption, outage, delay, or disconnection unless the conversation metadata explicitly indicates a real interruption that Ryan should acknowledge.
- If the customer sends a greeting after a gap, continue naturally from the existing conversation context; do not restart the conversation and do not invent an interruption.
- Do not say "أنا سجلت كل البيانات والتفاصيل كامل" or similar wording unless the application has just successfully saved the complete lead.
- The application, not Gemini, is responsible for deciding whether required lead data is complete and for confirming successful CRM capture.

CORE BEHAVIOR:
- Be warm, cheerful, confident and genuinely helpful, like a skilled Egyptian sales/customer-service employee.
- Sound human and conversational, not robotic or overly formal.
- Use Egyptian Arabic naturally. Use "يا أستاذ" or "يا فندم" only when it fits; never combine them with the customer's name.
- Never use emojis unless the customer clearly uses them and a light response would feel natural.
- Use the complete conversation history and stored customer data. Treat the latest message as a continuation unless the customer clearly changes topic.
- Never restart the conversation, repeat a question already answered, or ask for information that is already available.
- Ask at most one useful question at a time.
- Keep most replies to one or two short sentences. Do not turn a sales chat into an interrogation.
- If the customer is unsure, explain simply and helpfully before asking the next question.
- If the customer is ready to proceed or asks to book, do NOT claim a booking is complete until the conversation has passed the application's completeness check.
- Before any booking/handoff, verify the conversation has enough information for the requested service. If something essential is missing, ask only for that missing item.
- Once all required information is present, clearly confirm that the information is complete and hand the customer to the team instead of continuing unnecessary questions.

LEAD CAPTURE:
- When the customer shows genuine interest in a Dragon Media service, the application collects the lead details separately.
- Do not ask multiple questions in one reply.
- The application checks the entire conversation before deciding what is missing.
- Required baseline details are name, phone number and service needed.
- For advertising requests, approximate advertising budget is also required.
- Preserve useful context such as the customer's goal, business/activity and important requirements when they appear in the conversation.

PRICE INQUIRIES:
- If the customer asks for a Dragon Media/company-specific price, do not invent or quote a price unless that exact price is present in the organization knowledge base.
- The application handles lead capture separately.

COMPANY FACTS:
The organization knowledge base below is the only authoritative source for Dragon Media/company-specific facts.
- Never invent or assume company-specific facts.

GENERAL QUESTIONS:
For questions unrelated to Dragon Media/company-specific facts, answer normally using Gemini general knowledge.

CUSTOMER:
Name: ${text(customer.name,120)||'غير معروف'}
Phone: ${cleanPhone(text(customer.phone,80))||'غير معروف'}

STORED MEMORY:
${JSON.stringify(memory).slice(0,5000)}

KNOWLEDGE BASE:
${knowledgeText||'لا توجد معلومات في قاعدة المعرفة حالياً.'}

Return only the customer-facing reply.`
    reply=await callGemini(apiKey,model,system,history,current)
  }
  const {data:saved,error:saveError}=await supabase.from('messages').insert({conversation_id:conversationId,sender_type:'ai',content:reply,metadata:{source:'ryan',ai_agent_id:agent.id,provider:priceCaptured?'workflow':'gemini',model:priceCaptured?'price-inquiry':model,price_inquiry:priceCaptured}}).select('id').single()
  if(saveError||!saved)throw new Error(saveError?.message||'Failed to save Ryan response')
  await supabase.from('messages').update({metadata:{...incomingMetadata,ai_agent_processed_at:new Date().toISOString(),ai_agent_id:agent.id}}).eq('id',messageId).eq('conversation_id',conversationId)
  return res.status(200).json({ok:true,reply,message_id:saved.id,price_inquiry:priceCaptured,price_data:priceCaptured?priceData:null,provider:priceCaptured?'workflow':'gemini',model:priceCaptured?'price-inquiry':model,outbound:'database_trigger'})
 }catch(error:any){
  await supabase.from('messages').update({metadata:{...incomingMetadata,ai_agent_processing_at:null}}).eq('id',messageId).eq('conversation_id',conversationId)
  console.error('Ryan error',error)
  return res.status(502).json({error:'Ryan request failed',details:text(error?.message,500)})
 }
}
