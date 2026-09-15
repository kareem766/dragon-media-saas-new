import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'

import auditLogs from '../_server/admin/audit-logs.js'
import financial from '../_server/admin/financial.js'
import organizations from '../_server/admin/organizations.js'
import overview from '../_server/admin/overview.js'
import payments from '../_server/admin/payments.js'
import tickets from '../_server/admin/tickets.js'

type Handler = (
  req: VercelRequest,
  res: VercelResponse,
) => unknown | Promise<unknown>

const handlers: Record<string, Handler> = {
  'audit-logs': auditLogs,
  financial,
  organizations,
  overview,
  payments,
  tickets,
}

const RYAN_TOOLS = [
  {
    name: 'create_lead',
    description: 'Create a genuine CRM lead when the customer shows meaningful service interest. Do not use for greetings or generic questions. Use information already known.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING' }, phone: { type: 'STRING' }, service: { type: 'STRING' },
        activity: { type: 'STRING' }, goal: { type: 'STRING' }, notes: { type: 'STRING' },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_deal',
    description: 'Create a CRM deal only when the customer clearly intends to buy, start, or contract. Do not create a deal for a price question alone.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING' }, phone: { type: 'STRING' }, service: { type: 'STRING' },
        value: { type: 'NUMBER' }, notes: { type: 'STRING' },
      },
      required: ['name'],
    },
  },
  {
    name: 'book_appointment',
    description: 'Book only a real meeting, consultation, scheduled call, or appointment. A request to book/buy/start a service is not an appointment. Requires service_name, date and time.',
    parameters: {
      type: 'OBJECT',
      properties: { service_name: { type: 'STRING' }, date: { type: 'STRING' }, time: { type: 'STRING' } },
      required: ['service_name', 'date', 'time'],
    },
  },
  {
    name: 'request_human_handoff',
    description: 'Transfer to a human when the customer explicitly asks for an employee, sales, customer service, manager, or real person.',
    parameters: {
      type: 'OBJECT',
      properties: { reason: { type: 'STRING' } },
      required: ['reason'],
    },
  },
]

function sameSecret(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function db() {
  return createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function ryanInbox(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY || (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY)) {
    return res.status(500).json({ error: 'Ryan configuration is incomplete' })
  }

  const supabase = db()
  const provided = String(req.headers['x-ryan-inbox-secret'] || '')
  const { data: secretRow } = await supabase.from('system_secrets').select('value').eq('key', 'ryan_inbox_webhook_secret').maybeSingle()
  if (!provided || !secretRow?.value || !sameSecret(provided, String(secretRow.value))) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const organizationId = String(req.body?.organization_id || '')
  const conversationId = String(req.body?.conversation_id || '')
  const messageId = String(req.body?.message_id || '')
  if (!organizationId || !conversationId || !messageId) return res.status(400).json({ error: 'Missing Ryan inbox identifiers' })

  const { data: message } = await supabase.from('messages').select('id, conversation_id, sender_type, content, metadata').eq('id', messageId).eq('conversation_id', conversationId).maybeSingle()
  if (!message || message.sender_type !== 'customer') return res.status(200).json({ ok: true, skipped: true, reason: 'invalid_message' })

  const { data: conversation } = await supabase.from('conversations').select('id, organization_id, customer_id, channel, handled_by').eq('id', conversationId).eq('organization_id', organizationId).maybeSingle()
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' })
  if (!['whatsapp', 'facebook', 'messenger', 'instagram'].includes(String(conversation.channel || ''))) return res.status(200).json({ ok: true, skipped: true, reason: 'unsupported_channel' })
  if (conversation.handled_by === 'human') return res.status(200).json({ ok: true, skipped: true, reason: 'human_handoff' })

  const metadata = message.metadata && typeof message.metadata === 'object' ? (message.metadata as Record<string, unknown>) : {}
  if (metadata.ryan_processed_at) return res.status(200).json({ ok: true, skipped: true, reason: 'already_processed' })

  const { data: customer } = await supabase.from('customers').select('id, name, phone').eq('id', conversation.customer_id).eq('organization_id', organizationId).maybeSingle()
  const { data: subscription } = await supabase.from('subscriptions').select('id, plans(limits, features)').eq('organization_id', organizationId).eq('status', 'active').limit(1).maybeSingle()
  const plan = Array.isArray(subscription?.plans) ? subscription?.plans[0] : subscription?.plans
  const features = plan?.features && typeof plan.features === 'object' ? (plan.features as Record<string, unknown>) : {}
  const limits = plan?.limits && typeof plan.limits === 'object' ? (plan.limits as Record<string, unknown>) : {}
  if (features.ryan !== true) return res.status(200).json({ ok: true, skipped: true, reason: 'feature_not_entitled' })

  const { data: usageData } = await supabase.rpc('ryan_monthly_usage', { p_organization_id: organizationId })
  const usage = Array.isArray(usageData) ? usageData[0] : usageData
  const usedMessages = Number(usage?.messages ?? usage?.message_count ?? 0) || 0
  const usedTokens = Number(usage?.tokens ?? usage?.token_count ?? 0) || 0
  const messageLimit = Number(limits.ai_messages ?? limits.ryan_messages ?? 0) || 0
  const tokenLimit = Number(limits.ryan_tokens ?? limits.ai_tokens ?? 0) || 0
  if (messageLimit && usedMessages >= messageLimit) return res.status(200).json({ ok: true, skipped: true, reason: 'message_limit' })
  if (tokenLimit && usedTokens >= tokenLimit) return res.status(200).json({ ok: true, skipped: true, reason: 'token_limit' })

  const [{ data: organization }, { data: rows }, { data: knowledge }, { data: users }] = await Promise.all([
    supabase.from('organizations').select('name').eq('id', organizationId).maybeSingle(),
    supabase.from('messages').select('sender_type, content').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(13),
    supabase.from('knowledge_base').select('title, content').eq('organization_id', organizationId).limit(15),
    supabase.from('users').select('id, role, created_at').eq('organization_id', organizationId).eq('active', true).order('created_at', { ascending: true }).limit(10),
  ])

  const owner = (users || []).find((u) => ['owner', 'admin', 'مدير عام', 'أدمن'].includes(String(u.role || ''))) || users?.[0]
  const ownerUserId = String(owner?.id || '')
  const history = (rows || []).reverse().map((row) => ({ role: row.sender_type === 'customer' ? 'user' : 'model', text: String(row.content || '') })).filter((row) => row.text.trim())
  const knowledgeText = (knowledge || []).map((item) => `${String(item.title || '')}: ${String(item.content || '')}`).filter(Boolean).join('\n')
  const companyName = String(organization?.name || 'الشركة')
  const customerName = String(customer?.name || 'غير معروف')
  const customerPhone = String(customer?.phone || 'غير معروف')
  const currentMessage = String(message.content || '').trim()
  if (!currentMessage) return res.status(200).json({ ok: true, skipped: true, reason: 'empty_message' })

  const system = `أنت Ryan، موظف مبيعات وخدمة عملاء مصري محترف وودود داخل شركة ${companyName}.\nتتعامل مع عميل حقيقي عبر قنوات المحادثة داخل Inbox، مثل WhatsApp وFacebook وMessenger وInstagram.\n\nأسلوب Ryan:\n- اتكلم بالمصرية الطبيعية، كأنك موظف حقيقي بيتكلم مع عميل، مش Chatbot.\n- خليك ودود واحترافي وفي نفس الوقت خفيف وطبيعي.\n- استخدم "يا فندم" عندما تكون مناسبة للسياق، بدون تكرارها في كل رسالة.\n- استخدم إيموجي خفيف عند ملاءمة السياق مثل ☀️ أو 👌، لكن لا تضع إيموجي في كل رد.\n- الرد غالبًا جملة واحدة أو جملتين فقط.\n- اسأل سؤالًا واحدًا فقط في الرسالة.\n- لا تعمل مقدمة طويلة.\n- لا تعيد تقديم نفسك إذا كانت المحادثة بدأت بالفعل.\n- لا تكرر نفس الترحيب أو نفس الصياغة.\n- لو العميل بدأ بتحية، رد بتحية طبيعية ومناسبة.\n- اربط ردك دائمًا بآخر شيء قاله العميل وبنشاطه أو الخدمة التي يهتم بها.\n- لا تستخدم كلامًا عامًا أو تسويقيًا محفوظًا مثل: "إحنا بنقدم حلول SaaS..." إلا إذا العميل سأل تحديدًا عن الشركة أو الخدمات.\n- لا تسرد قائمة خدمات إلا إذا العميل طلب معرفة الخدمات.\n- لا تخترع أسعارًا أو عروضًا أو مواعيد أو معلومات غير موجودة في قاعدة المعرفة.\n- لا تدعي تنفيذ أي إجراء إلا بعد نجاح الأداة.\n- لا تطلب كل بيانات العميل مرة واحدة؛ اجمعها تدريجيًا وبشكل طبيعي.\n- الهدف هو تحويل المحادثة إلى اهتمام حقيقي ثم Lead ثم فرصة بيع، بدون ضغط أو إزعاج.\n\nأمثلة على الأسلوب المطلوب:\n- إذا قال العميل "صباح الخير": "صباح النور يا فندم! ☀️ جاهز نكمل كلامنا.. تحب نبدأ في إيه؟ 👌"\n- إذا قال "عايز أعمل إعلانات للعقارات": "تمام يا فندم 👌 تحب نبدأ بتحديد نوع العقارات والمناطق اللي بتستهدفها؟"\n- إذا قال "أنا شركة عقارات وعايز عملاء": "تمام يا فندم 👌 نقدر نركز على حملات تجيبلك عملاء مهتمين بالعقارات.. تحب نبدأ بالمنطقة اللي بتستهدفها؟"\n- إذا قال "عايز أعرف الأسعار": "أكيد يا فندم 👌 تحب أعرفك بالأنسب حسب حجم شغلك وهدفك؟"\n- إذا قال "عايز أعرف خدماتكم": ابدأ بفهم احتياجه بسؤال واحد بدل قائمة طويلة.\n\nتذكّر: العميل لا يريد قراءة مقال. العميل يريد موظفًا يفهمه، يرد عليه بسرعة، ويوجهه للخطوة التالية.\n\nاسم العميل: ${customerName}\nالهاتف: ${customerPhone}\nقاعدة المعرفة:\n${knowledgeText || 'لا توجد معلومات إضافية.'}`

  const contents = [
    { role: 'user', parts: [{ text: system }] },
    { role: 'model', parts: [{ text: 'فهمت وهحافظ على سياق المحادثة وأتعامل كموظف مصري محترف.' }] },
    ...history.slice(-12).map((item) => ({ role: item.role, parts: [{ text: item.text }] })),
    { role: 'user', parts: [{ text: currentMessage }] },
  ]

  let provider = 'gemini'
  let model = process.env.RYAN_GEMINI_MODEL || 'gemini-2.5-flash'
  let aiBody: any = null

  if (process.env.GEMINI_API_KEY) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({ contents, tools: [{ functionDeclarations: RYAN_TOOLS }], generationConfig: { maxOutputTokens: 512, temperature: 0.4 } }),
        signal: controller.signal,
      })
      if (response.ok) {
        aiBody = await response.json()
      } else {
        const errorText = await response.text()
        console.error('Ryan inbox Gemini response failed', { status: response.status, model, body: errorText.slice(0, 1000) })
        aiBody = null
      }
    } catch (error) {
      console.error('Ryan inbox Gemini request failed', error)
    } finally {
      clearTimeout(timeout)
    }
  }

  if (!aiBody && process.env.GROQ_API_KEY) {
    provider = 'groq'
    model = process.env.RYAN_GROQ_MODEL || 'openai/gpt-oss-120b'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: system }, ...history.slice(-12).map((item) => ({ role: item.role === 'model' ? 'assistant' : 'user', content: item.text })), { role: 'user', content: currentMessage }],
          tools: RYAN_TOOLS.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: { type: 'object', properties: Object.fromEntries(Object.entries(tool.parameters.properties).map(([key, value]: any) => [key, { ...value, type: String(value.type).toLowerCase() }])), required: tool.parameters.required } } })),
          tool_choice: 'auto', temperature: 0.4, max_tokens: 512,
        }),
        signal: controller.signal,
      })
      if (!response.ok) return res.status(503).json({ error: 'محرك Ryan غير متاح مؤقتًا.' })
      const data = await response.json()
      const choice = data?.choices?.[0]
      aiBody = {
        candidates: [{ content: { parts: [
          ...(choice?.message?.content ? [{ text: choice.message.content }] : []),
          ...((choice?.message?.tool_calls || []).map((call: any) => ({ functionCall: { name: call?.function?.name, args: (() => { try { return JSON.parse(call?.function?.arguments || '{}') } catch { return {} } })() } }))),
        ] } }],
        usageMetadata: { totalTokenCount: Number(data?.usage?.total_tokens || 0) || 0 },
      }
    } catch (error) {
      console.error('Ryan inbox Groq request failed', error)
      return res.status(503).json({ error: 'محرك Ryan غير متاح مؤقتًا.' })
    } finally {
      clearTimeout(timeout)
    }
  }

  const parts = aiBody?.candidates?.[0]?.content?.parts || []
  if (!parts.length) return res.status(503).json({ error: 'محرك Ryan غير متاح مؤقتًا.' })

  const calls = parts.map((part: any) => part?.functionCall).filter((call: any) => RYAN_TOOLS.some((tool) => tool.name === call?.name))
  let actionTaken: string | null = null
  let reply = parts.map((part: any) => String(part?.text || '')).join('').trim()

  for (const call of calls) {
    try {
      const args = call.args || {}
      let result: any
      if (call.name === 'create_lead') result = await supabase.rpc('ai_create_lead', { p_organization_id: organizationId, p_conversation_id: conversationId, p_name: String(args.name || '').trim(), p_phone: args.phone ? String(args.phone) : null, p_service: args.service ? String(args.service) : null, p_activity: args.activity ? String(args.activity) : null, p_goal: args.goal ? String(args.goal) : null, p_notes: args.notes ? String(args.notes) : null, p_created_by: ownerUserId || null })
      else if (call.name === 'create_deal') result = await supabase.rpc('ai_create_deal', { p_organization_id: organizationId, p_conversation_id: conversationId, p_name: String(args.name || '').trim(), p_phone: args.phone ? String(args.phone) : null, p_service: args.service ? String(args.service) : null, p_value: Number(args.value || 0), p_notes: args.notes ? String(args.notes) : null, p_created_by: ownerUserId || null })
      else if (call.name === 'book_appointment') {
        const serviceName = String(args.service_name || '').trim(); const date = String(args.date || '').trim(); const time = String(args.time || '').trim()
        if (!serviceName || !date || !time) continue
        result = await supabase.rpc('ai_book_appointment', { p_organization_id: organizationId, p_conversation_id: conversationId, p_service_name: serviceName, p_date: date, p_time: time, p_created_by: ownerUserId || null })
      } else result = await supabase.rpc('ai_request_handoff', { p_organization_id: organizationId, p_conversation_id: conversationId, p_customer_name: customerName, p_reason: String(args.reason || 'Customer requested human assistance'), p_created_by: ownerUserId || null })

      if (!result?.error) {
        actionTaken = call.name
        if (call.name === 'book_appointment') reply = 'تمام، سجلت لك الموعد بنجاح.'
        else if (call.name === 'request_human_handoff') reply = 'أكيد، هحوّل المحادثة لحد من الفريق ويتابع معاك.'
        else if (call.name === 'create_deal') reply = 'تمام، سجلت طلبك وهنتابع معاك بخصوص التعاقد.'
        else if (call.name === 'create_lead') reply = 'تمام، سجلت بياناتك وهنتابع معاك بخصوص طلبك.'
      }
    } catch (error) {
      console.error('Ryan inbox tool error', error)
    }
  }

  if (!reply) reply = 'تمام، قولي تفاصيل أكتر وأنا أساعدك.'

  const { error: saveError } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_type: 'ai',
    content: reply,
    metadata: { source: 'ryan', provider, model, action_taken: actionTaken, inbound_message_id: messageId },
  })
  if (saveError) return res.status(500).json({ error: 'تعذر حفظ رد Ryan.' })

  await supabase.from('messages').update({
    metadata: { ...metadata, ryan_processed_at: new Date().toISOString(), ryan_provider: provider, ryan_model: model, ryan_action_taken: actionTaken },
  }).eq('id', messageId)

  void supabase.rpc('record_ryan_usage', {
    p_organization_id: organizationId, p_conversation_id: conversationId, p_user_id: ownerUserId || null,
    p_model: model, p_event_type: 'message', p_tokens: Number(aiBody?.usageMetadata?.totalTokenCount || 0) || 0, p_cost: 0,
    p_metadata: { source: 'whatsapp_inbox', provider, action: actionTaken, inbound_message_id: messageId },
  }).then(({ error }) => { if (error) console.error('Ryan usage record failed', error) })

  return res.status(200).json({ ok: true, reply, conversationId, actionTaken, provider, model })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const routeValue = req.query?.route
  const route = Array.isArray(routeValue) ? routeValue[0] : routeValue

  if (String(route || '') === 'ryan-inbox') {
    try {
      return await ryanInbox(req, res)
    } catch (error: unknown) {
      console.error('Ryan inbox route error:', error)
      return res.status(500).json({ error: error instanceof Error ? error.message : 'حدث خطأ أثناء تشغيل Ryan.' })
    }
  }

  const routeHandler = handlers[String(route || '')]
  if (!routeHandler) return res.status(404).json({ error: 'Admin API route not found' })

  try {
    return await routeHandler(req, res)
  } catch (error: unknown) {
    console.error(`Admin API route "${String(route || '')}" error:`, error)
    if (!res.headersSent) return res.status(500).json({ error: error instanceof Error ? error.message : typeof error === 'string' ? error : 'حدث خطأ في خادم الإدارة.' })
    return undefined
  }
}
