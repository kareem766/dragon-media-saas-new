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
 const candidates=[model,'gemini-3.5-flash-lite','gemini-3.6-flash'].filter((v,i,a)=>v&&a.indexOf(v)===i)
 let lastError='Gemini request failed'
 for(const candidate of candidates){
  for(let attempt=0;attempt<2;attempt++){
   try{
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[...history,{role:'user',parts:[{text:current}]}],generationConfig:{maxOutputTokens:320}})})
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

async function analyzeConversation(key:string,model:string,system:string,history:Turn[],current:string){
 const candidates=[model,'gemini-3.5-flash-lite','gemini-3.6-flash'].filter((v,i,a)=>v&&a.indexOf(v)===i)
 let lastError='Gemini analysis failed'
 for(const candidate of candidates){
  try{
   const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    systemInstruction:{parts:[{text:system}]},
    contents:[...history,{role:'user',parts:[{text:current}]}],
    generationConfig:{maxOutputTokens:700,responseMimeType:'application/json'}
   })})
   const d=await r.json().catch(()=>({}))
   if(r.ok){
    const raw=text(d?.candidates?.[0]?.content?.parts?.map((p:any)=>p?.text||'').join(''),12000).replace(/^\s*\`\`\`(?:json)?\s*/i,'').replace(/\s*\`\`\`\s*$/,'')
    try{const data=obj(JSON.parse(raw));if(Object.keys(data).length)return data}catch{}
    lastError=`Gemini ${candidate} returned invalid JSON`
   }else{
    lastError=d?.error?.message||`Gemini ${r.status}`
    if(![408,429,500,502,503,504].includes(r.status))break
   }
  }catch(error:any){lastError=text(error?.message,500)||'Gemini network error'}
 }
 throw new Error(`Ryan Gemini analysis exhausted: ${lastError}`)
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
  const historyText=history.map((item:any)=>text(item?.parts?.[0]?.text,800)).join(' | ')
  const hasPreviousCapture=!!captureMeta.captured_at && captureMeta.active!==true
  // Gemini is the primary conversation-understanding engine. Do not gate lead detection with fixed keyword rules.
  const existingLeadIntent=true

  if(existingLeadIntent && !hasPreviousCapture){
    const analysisSystem=`You are Ryan's conversation understanding engine inside Dragon Media.
Read the ENTIRE conversation and understand meaning, not fixed phrases or keywords.

Return ONLY valid JSON:
{
 "lead_intent": boolean,
 "is_advertising": boolean,
 "name": string|null,
 "phone": string|null,
 "service": string|null,
 "budget": string|null,
 "goal": string|null,
 "business_activity": string|null,
 "missing": string[],
 "complete": boolean,
 "next_action": "continue"|"ask_name"|"ask_phone"|"ask_service"|"ask_budget"|"handoff",
 "reply": string
}

Rules:
- Understand Egyptian Arabic, dialect, slang, spelling variations, Arabic digits, indirect wording and natural conversation.
- Extract only information actually established by the conversation. Never invent.
- Normalize number meanings when clear: "3 الاف", "٣ آلاف", "تلات تلاف", "3000", "3k" can all mean 3000 جنيه.
- Never ask again for information already answered.
- Required baseline lead data: name, phone and service. Advertising also requires approximate budget.
- Goal and business activity are useful context but are not mandatory unless essential.
- missing contains only genuinely required missing data.
- complete is true only when all required data is present.
- reply is natural Egyptian Arabic, one or two short sentences, at most one question.
- Do not claim anything was saved, registered, booked or completed.
- If complete is false, ask only for the next missing item.
- If complete is true, reply with a brief transition and do not claim CRM capture.

CUSTOMER DATA:
Name: ${text(customer.name,120)||'غير معروف'}
Phone: ${cleanPhone(text(customer.phone,80))||'غير معروف'}
STORED LEAD STATE:
${JSON.stringify(captureMeta).slice(0,5000)}
SERVICES:
${JSON.stringify((services||[]).map((s:any)=>({name:text(s?.name,160),description:text(s?.description,500),category:text(s?.category,120)}))).slice(0,10000)}
STORED MEMORY:
${JSON.stringify(memory).slice(0,5000)}
KNOWLEDGE BASE:
${knowledgeText||'لا توجد معلومات في قاعدة المعرفة حالياً.'}
PERSONA:
${persona}`
    const a=obj(await analyzeConversation(apiKey,model,analysisSystem,history,current))
    const leadIntent=a.lead_intent===true
    // If Gemini determines this is not a lead conversation, let the normal Gemini persona answer naturally.
    if(!leadIntent){
      const system=`You are Ryan, the AI assistant inside Dragon Media.\n\nPERSONA:\n${persona}\n\nUse the complete conversation history and stored customer data. Continue naturally.\nBe warm, cheerful, confident and helpful in natural Egyptian Arabic.\nNever repeat a question already answered. Ask at most one useful question.\nKeep replies to one or two short sentences.\nNever claim data was saved, registered, booked or completed unless the application actually did it.\nNever invent company-specific facts; use the knowledge base for those.\nReturn only the customer-facing reply.\n\nCUSTOMER:\nName: ${text(customer.name,120)||'غير معروف'}\nPhone: ${cleanPhone(text(customer.phone,80))||'غير معروف'}\nSTORED MEMORY:\n${JSON.stringify(memory).slice(0,5000)}\nKNOWLEDGE BASE:\n${knowledgeText||'لا توجد معلومات في قاعدة المعرفة حالياً.'}`
      reply=await callGemini(apiKey,model,system,history,current)
    } else {
    const isAd=a.is_advertising===true
    const name=text(a.name,120)||text(captureMeta.name,120)||(looksLikeName(text(customer.name,120))?text(customer.name,120):'')
    const phone=cleanPhone(text(a.phone,80)||text(captureMeta.phone,80)||text(customer.phone,80))
    const service=text(a.service,160)||text(captureMeta.service,160)
    const budget=text(a.budget,120)||text(captureMeta.budget,120)
    const goal=text(a.goal,240)||text(captureMeta.goal,240)
    const activity=text(a.business_activity,240)||text(captureMeta.business_activity,240)
    const ready=leadIntent&&!!name&&!!phone&&!!service&&(!isAd||!!budget)
    const nextMeta={active:true,name:name||null,phone:phone||null,service:service||null,budget:budget||null,goal:goal||null,business_activity:activity||null,is_ad:isAd,stage:ready?'ready':text(a.next_action,40)||'continue'}
    if(ready){
      const notes=['بيانات تم جمعها بواسطة Ryan','الخدمة: '+service,activity?'النشاط: '+activity:'',goal?'الهدف: '+goal:'',isAd?'ميزانية الإعلان: '+budget:'','القناة: '+(conversation.channel||'غير محدد')].filter(Boolean).join(' | ')
      priceData=await capturePriceInquiry(supabase,organizationId,customer.id,name,phone,text(customer.email,160),service,notes)
      priceCaptured=true
      await supabase.from('conversations').update({metadata:{...conversationMetadata,ryan_lead_capture:{...nextMeta,active:false,captured_at:new Date().toISOString(),lead_id:priceData?.lead_id||null,customer_id:priceData?.customer_id||customer.id}},handled_by:'human',updated_at:new Date().toISOString()}).eq('id',conversationId).eq('organization_id',organizationId)
      reply='تمام، تم تسجيل بيانات حضرتك، وفريق Dragon Media هيتواصل مع حضرتك في أقرب وقت.'
    }else{
      const fallback:Record<string,string>={ask_name:'أهلاً بحضرتك، ممكن أعرف اسم حضرتك؟',ask_phone:'تمام، ممكن رقم الموبايل اللي فريق Dragon Media يقدر يتواصل مع حضرتك عليه؟',ask_service:'تمام، إيه الخدمة اللي محتاجها تحديدًا؟',ask_budget:'تمام، وميزانية الإعلان المتوقعة كام تقريبًا؟'}
      reply=text(a.reply,5000)||fallback[text(a.next_action,40)]||'تمام، قولي تفاصيل أكتر عن اللي محتاجه وهنكمل معاك.'
      await supabase.from('conversations').update({metadata:{...conversationMetadata,ryan_lead_capture:nextMeta}}).eq('id',conversationId).eq('organization_id',organizationId)
    }
    }
  }else{
    const system=`You are Ryan, the AI assistant inside Dragon Media.

PERSONA:
${persona}

Use the complete conversation history and stored customer data. Continue naturally.
Be warm, cheerful, confident and helpful in natural Egyptian Arabic.
Never repeat a question already answered. Ask at most one useful question.
Keep replies to one or two short sentences.
Never claim data was saved, registered, booked or completed unless the application actually did it.
Never invent company-specific facts; use the knowledge base for those.
Return only the customer-facing reply.

CUSTOMER:
Name: ${text(customer.name,120)||'غير معروف'}
Phone: ${cleanPhone(text(customer.phone,80))||'غير معروف'}
STORED MEMORY:
${JSON.stringify(memory).slice(0,5000)}
KNOWLEDGE BASE:
${knowledgeText||'لا توجد معلومات في قاعدة المعرفة حالياً.'}`
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
