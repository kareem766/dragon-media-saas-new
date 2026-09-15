import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'

const MODEL = process.env.RYAN_GEMINI_MODEL || 'gemini-3.6-flash'
const GROQ_MODEL = process.env.RYAN_GROQ_MODEL || 'openai/gpt-oss-120b'
const GEMINI_TIMEOUT_MS = 25000
const GROQ_TIMEOUT_MS = 25000
const HISTORY_LIMIT = 12

type ToolName = 'create_lead' | 'create_deal' | 'book_appointment' | 'request_human_handoff'

const TOOLS = [
  {
    name: 'create_lead',
    description:
      'Create a genuine CRM lead when the customer shows meaningful interest. Do not use for greetings or generic questions. Use information already collected; do not ask again.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING' },
        phone: { type: 'STRING' },
        service: { type: 'STRING' },
        activity: { type: 'STRING' },
        goal: { type: 'STRING' },
        notes: { type: 'STRING' },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_deal',
    description:
      'Create a CRM deal only when the customer clearly intends to buy, start, or contract. Do not create a deal for a price question alone.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING' },
        phone: { type: 'STRING' },
        service: { type: 'STRING' },
        value: { type: 'NUMBER' },
        notes: { type: 'STRING' },
      },
      required: ['name'],
    },
  },
  {
    name: 'book_appointment',
    description:
      'Book only a real meeting, consultation, call, or appointment. A request to book/buy/start a service is NOT an appointment. Requires service_name, date and time.',
    parameters: {
      type: 'OBJECT',
      properties: {
        service_name: { type: 'STRING' },
        date: { type: 'STRING' },
        time: { type: 'STRING' },
      },
      required: ['service_name', 'date', 'time'],
    },
  },
  {
    name: 'request_human_handoff',
    description:
      'Transfer to a human when the customer explicitly asks for an employee, sales, customer service, manager, or a real person, or when human intervention is genuinely required.',
    parameters: {
      type: 'OBJECT',
      properties: {
        reason: { type: 'STRING' },
      },
      required: ['reason'],
    },
  },
]

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function normalizeArabic(value: string) {
  return value
    .toLowerCase()
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getSupabaseAdmin() {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function getInternalSecret(db: ReturnType<typeof getSupabaseAdmin>) {
  const { data } = await db
    .from('system_secrets')
    .select('value')
    .eq('key', 'ryan_inbox_webhook_secret')
    .maybeSingle()
  return data?.value ? String(data.value) : ''
}

async function getOwnerUserId(
  db: ReturnType<typeof getSupabaseAdmin>,
  organizationId: string,
) {
  const { data } = await db
    .from('users')
    .select('id, role, created_at')
    .eq('organization_id', organizationId)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(10)

  const users = data || []
  const preferred = users.find((user) =>
    ['owner', 'admin', 'مدير عام', 'أدمن'].includes(String(user.role || '')),
  )
  return String((preferred || users[0])?.id || '')
}

async function getEntitlements(
  db: ReturnType<typeof getSupabaseAdmin>,
  organizationId: string,
) {
  const { data } = await db
    .from('subscriptions')
    .select('id, status, plan_id, plans(id, name, limits, features)')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const plan = Array.isArray(data.plans) ? data.plans[0] : data.plans
  const features =
    plan?.features && typeof plan.features === 'object'
      ? (plan.features as Record<string, unknown>)
      : {}
  const limits =
    plan?.limits && typeof plan.limits === 'object'
      ? (plan.limits as Record<string, unknown>)
      : {}

  return {
    enabled: features.ryan === true,
    messageLimit: Number(limits.ai_messages ?? limits.ryan_messages ?? 0) || 0,
    tokenLimit: Number(limits.ryan_tokens ?? limits.ai_tokens ?? 0) || 0,
  }
}

async function getUsage(
  db: ReturnType<typeof getSupabaseAdmin>,
  organizationId: string,
) {
  const { data } = await db.rpc('ryan_monthly_usage', {
    p_organization_id: organizationId,
  })
  const row = Array.isArray(data) ? data[0] : data
  return {
    messages: Number(row?.messages ?? row?.message_count ?? 0) || 0,
    tokens: Number(row?.tokens ?? row?.token_count ?? row?.total_tokens ?? 0) || 0,
  }
}

function recordUsage(
  db: ReturnType<typeof getSupabaseAdmin>,
  organizationId: string,
  conversationId: string,
  userId: string,
  model: string,
  tokens: number,
  metadata: Record<string, unknown>,
) {
  void db.rpc('record_ryan_usage', {
    p_organization_id: organizationId,
    p_conversation_id: conversationId,
    p_user_id: userId || null,
    p_model: model,
    p_event_type: 'message',
    p_tokens: tokens,
    p_cost: 0,
    p_metadata: metadata,
  }).then(({ error }) => {
    if (error) console.error('Ryan inbox usage record failed', error)
  })
}

async function runTool(
  db: ReturnType<typeof getSupabaseAdmin>,
  name: ToolName,
  args: Record<string, unknown>,
  organizationId: string,
  conversationId: string,
  userId: string,
) {
  if (name === 'create_lead') {
    const { data, error } = await db.rpc('ai_create_lead', {
      p_organization_id: organizationId,
      p_conversation_id: conversationId,
      p_name: String(args.name || '').trim(),
      p_phone: args.phone ? String(args.phone) : null,
      p_service: args.service ? String(args.service) : null,
      p_activity: args.activity ? String(args.activity) : null,
      p_goal: args.goal ? String(args.goal) : null,
      p_notes: args.notes ? String(args.notes) : null,
      p_created_by: userId || null,
    })
    if (error) throw error
    return { success: true, type: 'lead', data }
  }

  if (name === 'create_deal') {
    const { data, error } = await db.rpc('ai_create_deal', {
      p_organization_id: organizationId,
      p_conversation_id: conversationId,
      p_name: String(args.name || '').trim(),
      p_phone: args.phone ? String(args.phone) : null,
      p_service: args.service ? String(args.service) : null,
      p_value: Number(args.value || 0),
      p_notes: args.notes ? String(args.notes) : null,
      p_created_by: userId || null,
    })
    if (error) throw error
    return { success: true, type: 'deal', data }
  }

  if (name === 'book_appointment') {
    const serviceName = String(args.service_name || '').trim()
    const date = String(args.date || '').trim()
    const time = String(args.time || '').trim()
    if (!serviceName || !date || !time) return { success: false, type: 'appointment' }

    const { data, error } = await db.rpc('ai_book_appointment', {
      p_organization_id: organizationId,
      p_conversation_id: conversationId,
      p_service_name: serviceName,
      p_date: date,
      p_time: time,
      p_created_by: userId || null,
    })
    if (error) throw error
    return { success: true, type: 'appointment', data }
  }

  const { data, error } = await db.rpc('ai_request_handoff', {
    p_organization_id: organizationId,
    p_conversation_id: conversationId,
    p_customer_name: String(args.customer_name || ''),
    p_reason: String(args.reason || 'Customer requested human assistance'),
    p_created_by: userId || null,
  })
  if (error) throw error
  return { success: true, type: 'handoff', data }
}

function systemPrompt(
  companyName: string,
  customerName: string,
  customerPhone: string,
  knowledge: Array<Record<string, unknown>>,
) {
  const knowledgeText = knowledge
    .map((item) => `${String(item.title || '')}: ${String(item.content || item.body || item.text || '')}`)
    .filter(Boolean)
    .join('\n')

  return `أنت Ryan، موظف مبيعات وخدمة عملاء مصري محترف داخل شركة ${companyName || 'الشركة'}.

تتعامل مع عميل حقيقي على WhatsApp داخل Inbox.
- استخدم المصرية الطبيعية باحترام وبدون إيموجي.
- الرد غالبًا جملة أو جملتين.
- سؤال واحد فقط عند الحاجة.
- لا تعيد سؤالًا أجاب عنه العميل.
- لا تعيد تقديم نفسك في كل رسالة.
- لا تقل إنك AI إلا إذا سُئلت.
- لا تخترع أسعارًا أو خدمات أو مواعيد.
- لا تدّعي تنفيذ شيء إلا بعد نجاح الأداة.
- افهم سياق آخر الرسائل قبل الرد.

بيانات العميل المتاحة:
الاسم: ${customerName || 'غير معروف'}
الهاتف: ${customerPhone || 'غير معروف'}

قاعدة المعرفة:
${knowledgeText || 'لا توجد معلومات إضافية متاحة.'}

قواعد مهمة:
- "عايز أحجز خدمة" = اهتمام بالخدمة، وليس موعدًا.
- Appointment فقط لمقابلة/اجتماع/مكالمة/استشارة في موعد محدد.
- لا تستخدم Appointment إلا مع date وtime وservice_name.
- إذا طلب العميل شخصًا حقيقيًا/موظفًا/المبيعات/خدمة العملاء/مديرًا، استخدم request_human_handoff.
- إذا ظهر اهتمام حقيقي واسم العميل معروف، يمكن إنشاء Lead.
- لا تنشئ Lead لمجرد السلام أو سؤال عام جدًا.
- أنشئ Deal فقط عند نية شراء/تعاقد واضحة.
- لا تطلب كل البيانات مرة واحدة. اجمع الناقص بشكل طبيعي.
`
}

async function saveAiMessage(
  db: ReturnType<typeof getSupabaseAdmin>,
  conversationId: string,
  content: string,
  metadata: Record<string, unknown>,
) {
  const { data, error } = await db
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'ai',
      content,
      metadata: {
        source: 'ryan',
        ...metadata,
      },
    })
    .select('id')
    .single()

  if (error) throw error
  return data
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    if (
      !process.env.VITE_SUPABASE_URL ||
      !process.env.SUPABASE_SECRET_KEY ||
      (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY)
    ) {
      return res.status(500).json({ error: 'Ryan configuration is incomplete' })
    }

    const db = getSupabaseAdmin()
    const providedSecret = String(req.headers['x-ryan-inbox-secret'] || '')
    const expectedSecret = await getInternalSecret(db)

    if (!providedSecret || !expectedSecret || !safeEqual(providedSecret, expectedSecret)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const organizationId = String(req.body?.organization_id || '')
    const conversationId = String(req.body?.conversation_id || '')
    const messageId = String(req.body?.message_id || '')

    if (!organizationId || !conversationId || !messageId) {
      return res.status(400).json({ error: 'organization_id, conversation_id and message_id are required' })
    }

    const { data: message, error: messageError } = await db
      .from('messages')
      .select('id, conversation_id, sender_type, content, metadata, created_at')
      .eq('id', messageId)
      .eq('conversation_id', conversationId)
      .maybeSingle()

    if (messageError || !message) {
      return res.status(404).json({ error: 'Incoming message not found' })
    }

    if (message.sender_type !== 'customer') {
      return res.status(200).json({ ok: true, skipped: true, reason: 'not_customer_message' })
    }

    const { data: conversation, error: conversationError } = await db
      .from('conversations')
      .select('id, organization_id, customer_id, channel, handled_by, metadata')
      .eq('id', conversationId)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (conversationError || !conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    if (conversation.channel !== 'whatsapp') {
      return res.status(200).json({ ok: true, skipped: true, reason: 'not_whatsapp' })
    }

    if (conversation.handled_by === 'human') {
      return res.status(200).json({ ok: true, skipped: true, reason: 'human_handoff' })
    }

    const existingMessageMetadata =
      message.metadata && typeof message.metadata === 'object'
        ? (message.metadata as Record<string, unknown>)
        : {}

    if (existingMessageMetadata.ryan_processed_at) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'already_processed' })
    }

    await db
      .from('messages')
      .update({
        metadata: {
          ...existingMessageMetadata,
          ryan_processing_started_at: new Date().toISOString(),
        },
      })
      .eq('id', message.id)

    const { data: customer } = await db
      .from('customers')
      .select('id, name, phone')
      .eq('id', conversation.customer_id)
      .eq('organization_id', organizationId)
      .maybeSingle()

    const entitlements = await getEntitlements(db, organizationId)
    if (!entitlements?.enabled) {
      await db.from('messages').update({
        metadata: {
          ...existingMessageMetadata,
          ryan_processed_at: new Date().toISOString(),
          ryan_skipped_reason: 'feature_not_entitled',
        },
      }).eq('id', message.id)
      return res.status(200).json({ ok: true, skipped: true, reason: 'feature_not_entitled' })
    }

    const usage = await getUsage(db, organizationId)
    if (entitlements.messageLimit && usage.messages >= entitlements.messageLimit) {
      await db.from('messages').update({
        metadata: {
          ...existingMessageMetadata,
          ryan_processed_at: new Date().toISOString(),
          ryan_skipped_reason: 'message_limit',
        },
      }).eq('id', message.id)
      return res.status(200).json({ ok: true, skipped: true, reason: 'message_limit' })
    }

    if (entitlements.tokenLimit && usage.tokens >= entitlements.tokenLimit) {
      await db.from('messages').update({
        metadata: {
          ...existingMessageMetadata,
          ryan_processed_at: new Date().toISOString(),
          ryan_skipped_reason: 'token_limit',
        },
      }).eq('id', message.id)
      return res.status(200).json({ ok: true, skipped: true, reason: 'token_limit' })
    }

    const ownerUserId = await getOwnerUserId(db, organizationId)

    const [{ data: organization }, { data: historyRows }, { data: knowledgeRows }] =
      await Promise.all([
        db.from('organizations').select('name').eq('id', organizationId).maybeSingle(),
        db.from('messages').select('sender_type, content, metadata, created_at').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(HISTORY_LIMIT + 1),
        db.from('knowledge_base').select('title, content').eq('organization_id', organizationId).limit(15),
      ])

    const history = (historyRows || [])
      .reverse()
      .map((row) => ({
        role: row.sender_type === 'customer' ? 'user' : 'model',
        text: String(row.content || ''),
      }))
      .filter((item) => item.text.trim())

    const currentMessage = String(message.content || '').trim()
    if (!currentMessage) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'empty_message' })
    }

    const prompt = systemPrompt(
      String(organization?.name || 'الشركة'),
      String(customer?.name || ''),
      String(customer?.phone || ''),
      (knowledgeRows || []) as Array<Record<string, unknown>>,
    )

    const contents = [
      { role: 'user', parts: [{ text: prompt }] },
      { role: 'model', parts: [{ text: 'فهمت، هتعامل مع العميل كموظف مصري محترف وأحافظ على سياق المحادثة.' }] },
      ...history.slice(-HISTORY_LIMIT).map((item) => ({
        role: item.role,
        parts: [{ text: item.text }],
      })),
    ]

    if (contents.length > 2) {
      const last = contents[contents.length - 1]
      if (last?.role === 'user' && normalizeArabic(last.parts[0]?.text || '') === normalizeArabic(currentMessage)) {
        contents.pop()
      }
    }
    contents.push({ role: 'user', parts: [{ text: currentMessage }] })

    let provider: 'gemini' | 'groq' = 'gemini'
    let model = MODEL
    let body: any = null

    if (process.env.GEMINI_API_KEY) {
      const response = await fetchJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents,
            tools: [{ functionDeclarations: TOOLS }],
            generationConfig: { maxOutputTokens: 512, temperature: 0.4 },
          }),
        },
        GEMINI_TIMEOUT_MS,
      ).catch(() => null)

      if (response?.ok) {
        body = await response.json().catch(() => null)
      } else if (response) {
        const errorBody = await response.json().catch(() => null)
        if (![408, 429].includes(response.status) && response.status < 500) {
          console.error('Ryan inbox Gemini permanent error', {
            status: response.status,
            error: errorBody?.error?.message || null,
          })
          return res.status(502).json({ error: 'تعذر تشغيل Ryan حاليًا.' })
        }
      }
    }

    if (!body && process.env.GROQ_API_KEY) {
      provider = 'groq'
      model = GROQ_MODEL

      const groqMessages = [
        { role: 'system', content: prompt },
        ...history.slice(-HISTORY_LIMIT).map((item) => ({
          role: item.role === 'model' ? 'assistant' : 'user',
          content: item.text,
        })),
        { role: 'user', content: currentMessage },
      ]

      const response = await fetchJson(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: groqMessages,
            tools: TOOLS.map((tool) => ({
              type: 'function',
              function: {
                name: tool.name,
                description: tool.description,
                parameters: {
                  type: 'object',
                  properties: Object.fromEntries(
                    Object.entries(tool.parameters.properties).map(([key, value]: any) => [
                      key,
                      { ...value, type: String(value.type).toLowerCase() },
                    ]),
                  ),
                  required: tool.parameters.required,
                },
              },
            })),
            tool_choice: 'auto',
            temperature: 0.4,
            max_tokens: 512,
          }),
        },
        GROQ_TIMEOUT_MS,
      )

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        console.error('Ryan inbox Groq error', {
          status: response.status,
          error: errorBody?.error?.message || null,
        })
        return res.status(503).json({ error: 'محرك Ryan غير متاح مؤقتًا.' })
      }

      const groqBody = await response.json()
      const choice = groqBody?.choices?.[0]
      body = {
        candidates: [
          {
            content: {
              parts: [
                ...(choice?.message?.content ? [{ text: choice.message.content }] : []),
                ...((choice?.message?.tool_calls || []).map((call: any) => ({
                  functionCall: {
                    name: call?.function?.name,
                    args: (() => {
                      try {
                        return JSON.parse(call?.function?.arguments || '{}')
                      } catch {
                        return {}
                      }
                    })(),
                  },
                }))),
              ],
            },
            finishReason: choice?.finish_reason,
          },
        ],
        usageMetadata: {
          promptTokenCount: groqBody?.usage?.prompt_tokens || 0,
          candidatesTokenCount: groqBody?.usage?.completion_tokens || 0,
          totalTokenCount: groqBody?.usage?.total_tokens || 0,
        },
      }
    }

    if (!body?.candidates?.[0]) {
      return res.status(503).json({ error: 'محرك Ryan غير متاح مؤقتًا.' })
    }

    const candidate = body.candidates[0]
    const parts = candidate.content?.parts || []
    const allowed = new Set(TOOLS.map((tool) => tool.name))
    const calls = parts
      .map((part: any) => part?.functionCall)
      .filter((call: any) => call?.name && allowed.has(call.name)) as Array<{
        name: ToolName
        args?: Record<string, unknown>
      }>

    const usageTokens = Number(body?.usageMetadata?.totalTokenCount || 0) || 0
    let actionTaken: string | null = null
    let reply = parts.map((part: any) => String(part?.text || '')).join('').trim()

    for (const call of calls) {
      try {
        const result = await runTool(
          db,
          call.name,
          call.args || {},
          organizationId,
          conversationId,
          ownerUserId,
        )

        if (result.success) {
          actionTaken = call.name
          if (call.name === 'book_appointment') reply = 'تمام، سجلت لك الموعد بنجاح.'
          else if (call.name === 'request_human_handoff') reply = 'أكيد، هحوّل المحادثة لحد من الفريق ويتابع معاك.'
          else if (call.name === 'create_deal') reply = 'تمام، سجلت طلبك وهنتابع معاك بخصوص التعاقد.'
          else if (call.name === 'create_lead') reply = 'تمام، سجلت بياناتك وهنتابع معاك بخصوص طلبك.'
        }
      } catch (error: any) {
        console.error('Ryan inbox tool error', {
          tool: call.name,
          message: error?.message,
          organizationId,
          conversationId,
        })
      }
    }

    if (!reply) {
      reply = calls.length === 0 ? 'تمام، قولي تفاصيل أكتر وأنا أساعدك.' : 'تمام، هتابع معاك خطوة بخطوة.'
    }

    await saveAiMessage(db, conversationId, reply, {
      provider,
      model,
      action_taken: actionTaken,
      inbound_message_id: message.id,
    })

    await db
      .from('messages')
      .update({
        metadata: {
          ...existingMessageMetadata,
          ryan_processed_at: new Date().toISOString(),
          ryan_provider: provider,
          ryan_model: model,
          ryan_action_taken: actionTaken,
        },
      })
      .eq('id', message.id)

    recordUsage(
      db,
      organizationId,
      conversationId,
      ownerUserId,
      model,
      usageTokens,
      {
        source: 'whatsapp_inbox',
        provider,
        action: actionTaken,
        inbound_message_id: message.id,
      },
    )

    return res.status(200).json({
      ok: true,
      reply,
      conversationId,
      actionTaken,
      provider,
      model,
    })
  } catch (error: any) {
    console.error('Ryan inbox handler error', {
      message: error?.message,
      stack: error?.stack,
    })
    return res.status(500).json({ error: 'حصل خطأ أثناء تشغيل Ryan.' })
  }
}
