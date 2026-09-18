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

type Turn={role:'user'|'model';parts:{text:string}[]}

const parseJson=(value:string):Record<string,any>=>{
  const cleaned=text(value,12000).replace(/^\s*\`\`\`(?:json)?\s*/i,'').replace(/\s*\`\`\`\s*$/,'').trim()
  try{
  const captureMeta=obj(conversationMetadata.ryan_lead_capture)
  const hasPreviousCapture=!!captureMeta.captured_at && captureMeta.active!==true
  const previousContext=history.map((item:any)=>text(item?.parts?.[0]?.text,1200)).join(' | ')

  const analysisSystem=`You are Ryan's conversation understanding engine inside Dragon Media.
Your job is to understand the ENTIRE conversation, not to match fixed phrases or keywords.

Return ONLY valid JSON with this exact shape:
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
- Read all prior turns plus the latest customer message before deciding anything.
- Understand meaning, not exact wording. Customers can use Egyptian Arabic, dialect, spelling variations, Arabic digits, slang, abbreviations, or indirect wording.
- Extract only information actually stated or clearly established by the conversation. Never invent a phone, name, budget, service, goal, or business.
- Normalize Arabic/English number expressions when their meaning is clear. Examples: "3 الاف", "٣ آلاف", "تلات تلاف", "3000", "3k" can mean "3000 جنيه". Do not reject a value just because the wording is different.
- If the customer has already answered a question, NEVER ask for that same information again.
- If the customer changes topic, follow the new topic while preserving useful previous context.
- lead_intent=true when the customer is genuinely interested in a Dragon Media service, wants to start, continue, buy, book, get a quote, or asks a company-specific price.
- Required baseline lead information: name, phone, service. For advertising requests, budget is also required.
- A business activity and goal are useful context but are NOT mandatory unless the conversation makes one essential to the requested service.
- missing must contain ONLY information that is genuinely absent and required for the current lead intent.
- complete=true only when all required information is present.
- next_action must match the first genuinely missing required item, otherwise "handoff".
- reply must be natural Egyptian Arabic, warm, concise, one or two short sentences, and ask at most ONE question.
- Do not claim data was saved, registered, captured, booked, or completed. The application will handle that after this analysis.
- If lead_intent=false, reply naturally to the customer's message and do not force lead questions.
- If lead_intent=true and something is missing, ask only for that missing item.
- If complete=true, reply should be a brief natural transition such as "تمام، كده عندي التفاصيل الأساسية. هنكمل معاك من هنا." Do not claim that the CRM saved anything.
- No emojis unless the customer clearly uses them and it genuinely fits.
- Never restart the conversation or invent an interruption.

CURRENT CUSTOMER DATA:
Name: ${text(customer.name,120)||'غير معروف'}
Phone: ${cleanPhone(text(customer.phone,80))||'غير معروف'}

STORED RYAN LEAD STATE:
${JSON.stringify(captureMeta).slice(0,5000)}

STORED MEMORY:
${JSON.stringify(memory).slice(0,5000)}

SERVICES:
${JSON.stringify((services||[]).map((s:any)=>({name:text(s?.name,160),description:text(s?.description,500),category:text(s?.category,120)}))).slice(0,10000)}

KNOWLEDGE BASE:
${knowledgeText||'لا توجد معلومات في قاعدة المعرفة حالياً.'}

PERSONA:
${persona}

The application will validate and save data after your analysis. Do not perform or claim that operation yourself.`

  const analysis=await analyzeConversation(apiKey,model,analysisSystem,history,current)
  const a=obj(analysis.data)
  const leadIntent=a.lead_intent===true
  const isAd=a.is_advertising===true
  const analyzedName=text(a.name,120)||text(captureMeta.name,120)||(looksLikeName(text(customer.name,120))?text(customer.name,120):'')
  const analyzedPhone=cleanPhone(text(a.phone,80)||text(captureMeta.phone,80)||text(customer.phone,80))
  const analyzedService=text(a.service,160)||text(captureMeta.service,160)
  const analyzedBudget=text(a.budget,120)||text(captureMeta.budget,120)
  const analyzedGoal=text(a.goal,240)||text(captureMeta.goal,240)
  const analyzedActivity=text(a.business_activity,240)||text(captureMeta.business_activity,240)

  const activeCapture=!hasPreviousCapture && (captureMeta.active===true || leadIntent || priceIntent(current))
  if(activeCapture){
    const missing:string[]=Array.isArray(a.missing)?a.missing.map((x:any)=>text(x,80)).filter(Boolean):[]
    const ready=leadIntent && analyzedName && analyzedPhone && analyzedService && (!isAd || analyzedBudget)
    const nextMeta={
      active:true,
      name:analyzedName||null,
      phone:analyzedPhone||null,
      service:analyzedService||null,
      budget:analyzedBudget||null,
      goal:analyzedGoal||null,
      business_activity:analyzedActivity||null,
      is_ad:isAd,
      stage:ready?'ready':text(a.next_action,40)||'continue'
    }

    if(ready){
      const notes=[
       'بيانات تم جمعها بواسطة Ryan',
       'الخدمة: '+analyzedService,
       analyzedActivity?'النشاط: '+analyzedActivity:'',
       analyzedGoal?'الهدف: '+analyzedGoal:'',
       isAd?'ميزانية الإعلان: '+analyzedBudget:'',
       'القناة: '+(conversation.channel||'غير محدد')
      ].filter(Boolean).join(' | ')
      priceData=await capturePriceInquiry(supabase,organizationId,customer.id,analyzedName,analyzedPhone,text(customer.email,160),analyzedService,notes)
      priceCaptured=true
      await supabase.from('conversations').update({
       metadata:{...conversationMetadata,ryan_lead_capture:{...nextMeta,active:false,captured_at:new Date().toISOString(),lead_id:priceData?.lead_id||null,customer_id:priceData?.customer_id||customer.id}},
       handled_by:'human',
       updated_at:new Date().toISOString()
      }).eq('id',conversationId).eq('organization_id',organizationId)
      reply='تمام، تم تسجيل بيانات حضرتك، وفريق Dragon Media هيتواصل مع حضرتك في أقرب وقت.'
    }else{
      reply=text(a.reply,5000)
      if(!reply){
       const fallback:Record<string,string>={
        ask_name:'أهلاً بحضرتك، ممكن أعرف اسم حضرتك؟',
        ask_phone:'تمام، ممكن رقم الموبايل اللي فريق Dragon Media يقدر يتواصل مع حضرتك عليه؟',
        ask_service:'تمام، إيه الخدمة اللي محتاجها تحديدًا؟',
        ask_budget:'تمام، وميزانية الإعلان المتوقعة كام تقريبًا؟'
       }
       reply=fallback[text(a.next_action,40)]||'تمام، قولي تفاصيل أكتر عن اللي محتاجه وهنكمل معاك.'
      }
      await supabase.from('conversations').update({metadata:{...conversationMetadata,ryan_lead_capture:nextMeta}}).eq('id',conversationId).eq('organization_id',organizationId)
    }
  }else{
    const system=`You are Ryan, the AI assistant inside Dragon Media.

PERSONA:
${persona}

Use the complete conversation history and stored customer data. Continue naturally and do not restart the conversation.
Be warm, cheerful, confident and genuinely helpful in natural Egyptian Arabic.
Never repeat a question that the customer has already answered.
Ask at most one useful question at a time.
Keep most replies to one or two short sentences.
Never claim that you recorded, saved, registered, booked or completed an operation unless the application actually completed it.
Never invent Dragon Media-specific facts; use the knowledge base only for company-specific facts.
For company-specific prices, never invent a price unless it is explicitly present in the knowledge base.
Do not apologize for an interruption or outage unless the conversation metadata explicitly says there was one.
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
