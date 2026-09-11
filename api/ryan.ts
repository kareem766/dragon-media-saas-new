import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const MODEL =
  process.env.RYAN_GEMINI_MODEL || 'gemini-3.6-flash'

const GROQ_MODEL =
  process.env.RYAN_GROQ_MODEL || 'openai/gpt-oss-120b'

const GEMINI_TIMEOUT_MS = 25_000
const GROQ_TIMEOUT_MS = 25_000
const USAGE_TIMEOUT_MS = 2_000
const HISTORY_LIMIT = 12

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const geminiApiKey = process.env.GEMINI_API_KEY
const groqApiKey = process.env.GROQ_API_KEY

type RyanIntent =
  | 'appointment'
  | 'handoff'
  | 'deal'
  | 'lead'
  | 'general'

type RyanToolName =
  | 'create_lead'
  | 'create_deal'
  | 'book_appointment'
  | 'request_human_handoff'

type RyanHistoryItem = {
  role?: string
  sender?: string
  text?: string
  content?: string
  parts?: Array<{
    text?: string
  }>
}

type GeminiPart = {
  text?: string
  functionCall?: {
    name: string
    args?: Record<string, unknown>
  }
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[]
    }
    finishReason?: string
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
  error?: {
    code?: number
    message?: string
    status?: string
  }
}

type GroqToolCall = {
  id?: string
  type?: string
  function?: {
    name?: string
    arguments?: string
  }
}

type GroqResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
      tool_calls?: GroqToolCall[]
    }
    finish_reason?: string
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  error?: {
    message?: string
    code?: string | number
  }
}

const TOOL_DEFINITIONS = {
  create_lead: {
    name: 'create_lead',
    description: `
Create or register a genuine sales/customer-service lead in the CRM.

Use this when the customer has shown meaningful interest in Dragon Media, a service, consultation, pricing, page management, advertising, content, design, marketing, or another business need.

The purpose is to save useful customer information already collected during the conversation.

Do NOT create a lead merely because the customer said hello or asked a completely generic question.

Do NOT wait for every possible field if enough meaningful information is already available.

IMPORTANT:
- Extract information from the conversation.
- Never ask for information the customer already provided.
- Do not repeat questions unnecessarily.
- Customer name is preferred and required by the tool.
- Include phone, service, activity, goal and notes whenever known.
- This tool is NOT an appointment booking tool.
- A request such as "عايز أحجز خدمة" means genuine service interest, not an appointment.
`,
    parameters: {
      type: 'OBJECT',
      properties: {
        name: {
          type: 'STRING',
          description: 'Customer name if known',
        },
        phone: {
          type: 'STRING',
          description: 'Customer phone number if known',
        },
        service: {
          type: 'STRING',
          description: 'Service or area the customer is interested in',
        },
        activity: {
          type: 'STRING',
          description: 'Customer business/activity',
        },
        goal: {
          type: 'STRING',
          description: 'Customer goal or need',
        },
        notes: {
          type: 'STRING',
          description: 'Useful contextual notes from the conversation',
        },
      },
      required: ['name'],
    },
  },

  create_deal: {
    name: 'create_deal',
    description: `
Create a CRM deal only when the customer has clearly moved from inquiry/interest to a serious purchase or contracting intention.

Examples:
- العميل يريد التعاقد.
- العميل يقول إنه يريد شراء الخدمة.
- العميل وافق على البدء.
- العميل يطلب تنفيذ الخدمة بعد الاتفاق.

Do NOT create a deal just because the customer asked about a service or price.

Use information already available in the conversation.
Do not ask unnecessary questions only to fill optional fields.
`,
    parameters: {
      type: 'OBJECT',
      properties: {
        name: {
          type: 'STRING',
        },
        phone: {
          type: 'STRING',
        },
        service: {
          type: 'STRING',
        },
        value: {
          type: 'NUMBER',
        },
        notes: {
          type: 'STRING',
        },
      },
      required: ['name'],
    },
  },

  book_appointment: {
    name: 'book_appointment',
    description: `
Create a CRM appointment ONLY when the customer explicitly wants a real appointment, meeting, consultation meeting, scheduled call, or to meet someone from Dragon Media.

This is NOT for booking a Dragon Media service.

Do NOT use this tool when the customer simply says:
- عايز احجز خدمة
- عايز أحجز خدمة
- عايز أبدأ الخدمة
- عايز إدارة صفحات
- عايز اشتري خدمة
- عايز أعرف تفاصيل الخدمة

Those cases are normal sales/customer-service conversations and may create a lead or deal.

Use this tool only for a genuine appointment/meeting request.

Before calling the tool:
- service_name must be known.
- date must be known.
- time must be known.

If only one of date or time is missing, ask only for the missing information.

Never claim the appointment was created unless the tool succeeds.
`,
    parameters: {
      type: 'OBJECT',
      properties: {
        service_name: {
          type: 'STRING',
          description: 'Subject/purpose of the appointment or meeting',
        },
        date: {
          type: 'STRING',
          description: 'Requested appointment date',
        },
        time: {
          type: 'STRING',
          description: 'Requested appointment time',
        },
      },
      required: ['service_name', 'date', 'time'],
    },
  },

  request_human_handoff: {
    name: 'request_human_handoff',
    description: `
Transfer the conversation to a human team member when the customer explicitly asks for a real person.

Examples:
- عايز أكلم حد
- عايز أكلم موظف
- ممكن أكلم حد من الفريق؟
- عايز خدمة العملاء
- عايز حد من المبيعات
- عايز مدير
- عايز شخص حقيقي
- مش عايز أكمل مع البوت
- عايز حد يتواصل معايا

Also use it when the situation genuinely requires human intervention and Ryan cannot responsibly complete it.

Do NOT use it simply because the conversation is long.

Do NOT treat a generic service consultation as a human handoff unless the customer specifically wants a person.

After successful handoff, Ryan must tell the customer naturally that someone from the team will continue with them.
`,
    parameters: {
      type: 'OBJECT',
      properties: {
        reason: {
          type: 'STRING',
          description: 'Reason for handoff',
        },
      },
      required: ['reason'],
    },
  },
} as const

const HANDOFF_KEYWORDS = [
  'عايز حد',
  'عايز حد من الفريق',
  'عايز حد من المبيعات',
  'عايز حد من خدمة العملاء',
  'عايز موظف',
  'عايز موظف حقيقي',
  'عايز شخص',
  'عايز شخص حقيقي',
  'عايز انسان',
  'عايز إنسان',
  'عايز بني ادم',
  'عايز بني آدم',
  'اكلم حد',
  'أكلم حد',
  'اكلم شخص',
  'أكلم شخص',
  'اكلم موظف',
  'أكلم موظف',
  'اتكلم مع حد',
  'اتكلم مع شخص',
  'اتكلم مع موظف',
  'اتكلم مع الفريق',
  'أتكلم مع الفريق',
  'حد من الفريق',
  'شخص من الفريق',
  'موظف من الفريق',
  'خدمة العملاء',
  'خدمه العملاء',
  'المبيعات',
  'مندوب مبيعات',
  'مدير',
  'مش عايز بوت',
  'مش عايز البوت',
  'مش عايز اتكلم مع بوت',
  'عايز اكلم انسان',
  'عايز أكلم إنسان',
  'عايز اكلم بني ادم',
  'عايز أكلم بني آدم',
]

const APPOINTMENT_KEYWORDS = [
  'مقابلة',
  'مقابله',
  'مقابلة مع',
  'مقابله مع',
  'اجتماع',
  'اجتماع مع',
  'اقابل',
  'أقابل',
  'قابل',
  'ممكن اقابل',
  'ممكن أقابل',
  'عايز اقابل',
  'عايز أقابل',
  'عايز مقابلة',
  'عايز مقابله',
  'حابب اقابل',
  'حابب أقابل',
  'موعد مقابلة',
  'ميعاد مقابلة',
  'موعد مقابله',
  'ميعاد مقابله',
  'موعد اجتماع',
  'ميعاد اجتماع',
  'موعد مع',
  'ميعاد مع',
  'موعد للقاء',
  'ميعاد للقاء',
  'مكالمة في',
  'مكالمة يوم',
  'مكالمة الساعة',
  'مكالمة الساعه',
  'اتصال في',
  'اتصال يوم',
  'اتصال الساعة',
  'اتصال الساعه',
  'حددلي معاد',
  'حدد لي معاد',
  'حددلي موعد',
  'حدد لي موعد',
  'عايز احدد معاد',
  'عايز أحدد ميعاد',
  'عايز احدد موعد',
  'عايز أحدد موعد',
]

const DEAL_KEYWORDS = [
  'عايز اتعاقد',
  'عايز أتعاقد',
  'عايز التعاقد',
  'التعاقد',
  'اتعاقد',
  'أتعاقد',
  'عايز اشتري',
  'عايز أشتري',
  'عايز شراء',
  'شراء الخدمة',
  'اشتري الخدمة',
  'أشتري الخدمة',
  'موافق ونبدأ',
  'موافق نبدأ',
  'موافق ابدأ',
  'موافق أبدأ',
  'ابدأ الخدمة',
  'أبدأ الخدمة',
  'عايز ابدأ الخدمة',
  'عايز أبدأ الخدمة',
  'عايز نبدأ الخدمة',
  'أبدأ معاكم',
  'ابدأ معاكم',
  'عايز أشتغل معاكم',
  'عايز اشتغل معاكم',
]

const LEAD_INTEREST_KEYWORDS = [
  'مهتم',
  'محتاج',
  'عايز اعرف',
  'عايز أعرف',
  'ممكن تفاصيل',
  'عايز تفاصيل',
  'عايز معلومات',
  'معلومات عن',
  'تفاصيل عن',
  'سعر',
  'السعر',
  'الاسعار',
  'الأسعار',
  'تكلفة',
  'كام',
  'إدارة الصفحات',
  'ادارة الصفحات',
  'اعلانات',
  'إعلانات',
  'محتوى',
  'تصميم',
  'تسويق',
  'خدماتكم',
  'الخدمات',
  'احجز خدمة',
  'أحجز خدمة',
  'احجز خدمه',
  'أحجز خدمه',
  'حجز خدمة',
  'حجز خدمه',
  'عايز خدمة',
  'عايز خدمه',
]

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

function containsKeyword(
  text: string,
  keywords: string[],
) {
  const normalized = normalizeArabic(text)

  return keywords.some((keyword) =>
    normalized.includes(
      normalizeArabic(keyword),
    ),
  )
}

function getHistoryItemText(
  item: RyanHistoryItem,
) {
  if (item.text) {
    return item.text
  }

  if (item.content) {
    return item.content
  }

  if (Array.isArray(item.parts)) {
    return item.parts
      .map((part) => part?.text || '')
      .join('')
      .trim()
  }

  return ''
}

function getHistoryText(
  history: RyanHistoryItem[],
  count = 8,
) {
  return history
    .slice(-count)
    .map((item) =>
      getHistoryItemText(item),
    )
    .filter(Boolean)
    .join(' ')
}

function detectIntent(
  message: string,
  history: RyanHistoryItem[] = [],
): RyanIntent {
  if (
    containsKeyword(
      message,
      HANDOFF_KEYWORDS,
    )
  ) {
    return 'handoff'
  }

  if (
    containsKeyword(
      message,
      APPOINTMENT_KEYWORDS,
    )
  ) {
    return 'appointment'
  }

  if (
    containsKeyword(
      message,
      DEAL_KEYWORDS,
    )
  ) {
    return 'deal'
  }

  if (
    containsKeyword(
      message,
      LEAD_INTEREST_KEYWORDS,
    )
  ) {
    return 'lead'
  }

  const recentHistory =
    getHistoryText(
      history,
      6,
    )

  if (
    containsKeyword(
      recentHistory,
      APPOINTMENT_KEYWORDS,
    )
  ) {
    const normalizedMessage =
      normalizeArabic(message)

    const looksLikeDateOrTime =
      /بكره|غدا|غداً|النهارده|اليوم|الاحد|الاتنين|الثلاث|الاربع|الخميس|الجمعه|السبت|الساعة|الساعه|الوقت|ميعاد|موعد|\d/.test(
        normalizedMessage,
      )

    if (looksLikeDateOrTime) {
      return 'appointment'
    }
  }

  return 'general'
}

function getToolsForIntent(
  intent: RyanIntent,
) {
  if (intent === 'appointment') {
    return [
      TOOL_DEFINITIONS.book_appointment,
      TOOL_DEFINITIONS.request_human_handoff,
    ]
  }

  if (intent === 'handoff') {
    return [
      TOOL_DEFINITIONS.request_human_handoff,
    ]
  }

  if (intent === 'deal') {
    return [
      TOOL_DEFINITIONS.create_deal,
      TOOL_DEFINITIONS.create_lead,
      TOOL_DEFINITIONS.request_human_handoff,
    ]
  }

  if (intent === 'lead') {
    return [
      TOOL_DEFINITIONS.create_lead,
      TOOL_DEFINITIONS.create_deal,
      TOOL_DEFINITIONS.request_human_handoff,
    ]
  }

  return [
    TOOL_DEFINITIONS.create_lead,
    TOOL_DEFINITIONS.create_deal,
    TOOL_DEFINITIONS.request_human_handoff,
  ]
}

function getSupabaseClient(
  accessToken: string,
) {
  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    throw new Error(
      'Supabase environment variables are missing',
    )
  }

  return createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  ) as SupabaseClient<
    any,
    'public',
    any
  >
}

async function authenticateUser(
  accessToken: string,
) {
  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    throw new Error(
      'Supabase environment variables are missing',
    )
  }

  const authClient = createClient(
    supabaseUrl,
    supabaseAnonKey,
  )

  const {
    data: { user },
    error,
  } =
    await authClient.auth.getUser(
      accessToken,
    )

  if (error || !user) {
    return null
  }

  return user
}

async function getOrganizationId(
  supabase: SupabaseClient<
    any,
    'public',
    any
  >,
  userId: string,
) {
  const {
    data,
    error,
  } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.organization_id || null
}

async function getRyanEntitlements(
  supabase: SupabaseClient<
    any,
    'public',
    any
  >,
  organizationId: string,
) {
  const {
    data,
    error,
  } = await supabase
    .from('subscriptions')
    .select(
      'id, status, plan_id, plans ( id, name, limits, features )',
    )
    .eq(
      'organization_id',
      organizationId,
    )
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(
      'Ryan entitlement error:',
      error,
    )

    return null
  }

  if (!data) {
    return null
  }

  const plan = Array.isArray(
    data.plans,
  )
    ? data.plans[0]
    : data.plans

  const limits =
    plan?.limits || {}

  const messageLimit =
    Number(
      limits.ai_messages ??
        limits.ryan_messages ??
        limits.ai_message_limit ??
        0,
    ) || 0

  const tokenLimit =
    Number(
      limits.ryan_tokens ??
        limits.ai_tokens ??
        limits.token_limit ??
        0,
    ) || 0

  return {
    subscriptionId: data.id,
    planId: data.plan_id,
    planName:
      plan?.name || null,
    messageLimit,
    tokenLimit,
  }
}

async function getMonthlyUsage(
  supabase: SupabaseClient<
    any,
    'public',
    any
  >,
  organizationId: string,
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    'ryan_monthly_usage',
    {
      p_organization_id:
        organizationId,
    },
  )

  if (error) {
    console.error(
      'Ryan monthly usage error:',
      error,
    )

    return {
      messages: 0,
      tokens: 0,
    }
  }

  const row = Array.isArray(data)
    ? data[0]
    : data

  return {
    messages:
      Number(
        row?.messages ??
          row?.message_count ??
          0,
      ) || 0,

    tokens:
      Number(
        row?.tokens ??
          row?.token_count ??
          row?.total_tokens ??
          0,
      ) || 0,
  }
}

async function recordUsage(
  supabase: SupabaseClient<
    any,
    'public',
    any
  >,
  payload: {
    organizationId: string
    conversationId?: string | null
    userId?: string | null
    model: string
    eventType: string
    tokens?: number
    cost?: number
    metadata?: Record<
      string,
      unknown
    >
  },
) {
  try {
    const rpcPromise =
      supabase.rpc(
        'record_ryan_usage',
        {
          p_organization_id:
            payload.organizationId,

          p_conversation_id:
            payload.conversationId ||
            null,

          p_user_id:
            payload.userId ||
            null,

          p_model:
            payload.model,

          p_event_type:
            payload.eventType,

          p_tokens:
            payload.tokens || 0,

          p_cost:
            payload.cost || 0,

          p_metadata:
            payload.metadata || {},
        },
      )

    await Promise.race([
      rpcPromise,

      new Promise((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                'Ryan usage recording timeout',
              ),
            ),
          USAGE_TIMEOUT_MS,
        )
      }),
    ])
  } catch (error) {
    console.error(
      'Ryan usage recording error:',
      error,
    )
  }
}

function recordUsageNonBlocking(
  supabase: SupabaseClient<
    any,
    'public',
    any
  >,
  payload: Parameters<
    typeof recordUsage
  >[1],
) {
  void recordUsage(
    supabase,
    payload,
  ).catch((error) => {
    console.error(
      'Ryan background usage recording error:',
      error,
    )
  })
}

async function saveMessage(
  supabase: SupabaseClient<
    any,
    'public',
    any
  >,
  payload: {
    conversationId: string
    senderType: 'customer' | 'ai'
    content: string
    metadata?: Record<
      string,
      unknown
    >
  },
) {
  const {
    error,
  } = await supabase
    .from('messages')
    .insert({
      conversation_id:
        payload.conversationId,

      sender_type:
        payload.senderType,

      content:
        payload.content,

      ...(payload.metadata
        ? {
            metadata:
              payload.metadata,
          }
        : {}),
    })

  if (error) {
    console.error(
      'Ryan message save error:',
      error,
    )

    return false
  }

  return true
}

async function getOrCreateCustomer(
  supabase: SupabaseClient<
    any,
    'public',
    any
  >,
  organizationId: string,
  email: string,
  name?: string | null,
) {
  const normalizedEmail =
    email.trim().toLowerCase()

  const {
    data: existing,
    error: lookupError,
  } = await supabase
    .from('customers')
    .select('*')
    .eq(
      'organization_id',
      organizationId,
    )
    .eq(
      'email',
      normalizedEmail,
    )
    .order('created_at', {
      ascending: false,
    })
    .limit(1)
    .maybeSingle()

  if (lookupError) {
    throw lookupError
  }

  if (existing) {
    return existing
  }

  const {
    data,
    error,
  } = await supabase
    .from('customers')
    .insert({
      organization_id:
        organizationId,

      name:
        name ||
        normalizedEmail.split(
          '@',
        )[0] ||
        'Website Visitor',

      email:
        normalizedEmail,

      source:
        'website',
    })
    .select('*')
    .single()

  if (error) {
    const retry =
      await supabase
        .from('customers')
        .select('*')
        .eq(
          'organization_id',
          organizationId,
        )
        .eq(
          'email',
          normalizedEmail,
        )
        .order(
          'created_at',
          {
            ascending: false,
          },
        )
        .limit(1)
        .maybeSingle()

    if (
      !retry.error &&
      retry.data
    ) {
      return retry.data
    }

    throw error
  }

  return data
}

async function getOrCreateConversation(
  supabase: SupabaseClient<
    any,
    'public',
    any
  >,
  organizationId: string,
  customerId: string,
  conversationId?: string | null,
) {
  if (conversationId) {
    const {
      data,
      error,
    } = await supabase
      .from('conversations')
      .select('*')
      .eq(
        'id',
        conversationId,
      )
      .eq(
        'organization_id',
        organizationId,
      )
      .eq(
        'customer_id',
        customerId,
      )
      .eq(
        'channel',
        'website',
      )
      .maybeSingle()

    if (error) {
      throw error
    }

    if (data) {
      return data
    }
  }

  const {
    data,
    error,
  } = await supabase
    .from('conversations')
    .insert({
      organization_id:
        organizationId,

      customer_id:
        customerId,

      channel:
        'website',

      status:
        'open',

      handled_by:
        'ai',
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

async function runFunction(
  supabase: SupabaseClient<
    any,
    'public',
    any
  >,
  functionName: RyanToolName,
  args: Record<string, unknown>,
  organizationId: string,
  conversationId: string,
  userId: string,
) {
  if (
    functionName ===
    'create_lead'
  ) {
    const {
      data,
      error,
    } = await supabase.rpc(
      'ai_create_lead',
      {
        p_organization_id:
          organizationId,

        p_conversation_id:
          conversationId,

        p_name:
          String(
            args.name || '',
          ),

        p_phone:
          args.phone
            ? String(args.phone)
            : null,

        p_service:
          args.service
            ? String(args.service)
            : null,

        p_activity:
          args.activity
            ? String(args.activity)
            : null,

        p_goal:
          args.goal
            ? String(args.goal)
            : null,

        p_notes:
          args.notes
            ? String(args.notes)
            : null,

        p_created_by:
          userId,
      },
    )

    if (error) {
      throw error
    }

    return {
      success: true,
      type: 'lead',
      data,
    }
  }

  if (
    functionName ===
    'create_deal'
  ) {
    const {
      data,
      error,
    } = await supabase.rpc(
      'ai_create_deal',
      {
        p_organization_id:
          organizationId,

        p_conversation_id:
          conversationId,

        p_name:
          String(
            args.name || '',
          ),

        p_phone:
          args.phone
            ? String(args.phone)
            : null,

        p_service:
          args.service
            ? String(args.service)
            : null,

        p_value:
          Number(
            args.value || 0,
          ),

        p_notes:
          args.notes
            ? String(args.notes)
            : null,

        p_created_by:
          userId,
      },
    )

    if (error) {
      throw error
    }

    return {
      success: true,
      type: 'deal',
      data,
    }
  }

  if (
    functionName ===
    'book_appointment'
  ) {
    const serviceName =
      String(
        args.service_name ||
          '',
      ).trim()

    const date =
      String(
        args.date || '',
      ).trim()

    const time =
      String(
        args.time || '',
      ).trim()

    if (
      !serviceName ||
      !date ||
      !time
    ) {
      return {
        success: false,
        type: 'appointment',
        error:
          'Missing service_name, date, or time',
      }
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      'ai_book_appointment',
      {
        p_organization_id:
          organizationId,

        p_conversation_id:
          conversationId,

        p_service_name:
          serviceName,

        p_date:
          date,

        p_time:
          time,

        p_created_by:
          userId,
      },
    )

    if (error) {
      throw error
    }

    return {
      success: true,
      type: 'appointment',
      data,
    }
  }

  if (
    functionName ===
    'request_human_handoff'
  ) {
    const {
      data,
      error,
    } = await supabase.rpc(
      'ai_request_handoff',
      {
        p_organization_id:
          organizationId,

        p_conversation_id:
          conversationId,

        p_customer_name:
          String(
            args.customer_name ||
              '',
          ),

        p_reason:
          String(
            args.reason ||
              'Customer requested human assistance',
          ),

        p_created_by:
          userId,
      },
    )

    if (error) {
      throw error
    }

    return {
      success: true,
      type: 'handoff',
      data,
    }
  }

  throw new Error(
    `Unsupported Ryan function: ${functionName}`,
  )
}

async function fetchGemini(
  url: string,
  body: Record<string, unknown>,
) {
  const controller =
    new AbortController()

  const timeout =
    setTimeout(() => {
      controller.abort()
    }, GEMINI_TIMEOUT_MS)

  try {
    return await fetch(
      url,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          'x-goog-api-key':
            geminiApiKey || '',
        },

        body:
          JSON.stringify(body),

        signal:
          controller.signal,
      },
    )
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeJsonSchemaForOpenAI(
  schema: any,
): any {
  if (
    !schema ||
    typeof schema !== 'object'
  ) {
    return schema
  }

  if (Array.isArray(schema)) {
    return schema.map(
      normalizeJsonSchemaForOpenAI,
    )
  }

  const result: Record<
    string,
    any
  > = {}

  for (
    const [
      key,
      value,
    ] of Object.entries(schema)
  ) {
    if (
      key === 'type' &&
      typeof value === 'string'
    ) {
      result[key] =
        value.toLowerCase()
    } else {
      result[key] =
        normalizeJsonSchemaForOpenAI(
          value,
        )
    }
  }

  return result
}

function convertToolsForGroq(
  tools: any[],
) {
  return tools.map(
    (tool) => ({
      type: 'function',

      function: {
        name:
          tool.name,

        description:
          tool.description,

        parameters:
          normalizeJsonSchemaForOpenAI(
            tool.parameters,
          ),
      },
    }),
  )
}

function buildGroqMessages(
  contents: any[],
) {
  const systemText =
    contents[0]?.parts
      ?.map(
        (part: any) =>
          part?.text || '',
      )
      .join('')
      .trim() || ''

  const messages: Array<{
    role:
      | 'system'
      | 'user'
      | 'assistant'
    content: string
  }> = [
    {
      role: 'system',
      content: systemText,
    },
  ]

  /*
   * contents[1] is the artificial Gemini
   * acknowledgement message. It is intentionally
   * skipped for Groq because the system prompt already
   * contains the required behavior.
   */
  for (
    let index = 2;
    index < contents.length;
    index++
  ) {
    const item =
      contents[index]

    const text =
      item?.parts
        ?.map(
          (part: any) =>
            part?.text || '',
        )
        .join('')
        .trim() || ''

    if (!text) {
      continue
    }

    messages.push({
      role:
        item?.role ===
        'model'
          ? 'assistant'
          : 'user',

      content: text,
    })
  }

  return messages
}

async function fetchGroq(
  body: Record<string, unknown>,
) {
  if (!groqApiKey) {
    throw new Error(
      'GROQ_API_KEY is not configured',
    )
  }

  const controller =
    new AbortController()

  const timeout =
    setTimeout(() => {
      controller.abort()
    }, GROQ_TIMEOUT_MS)

  try {
    return await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          Authorization:
            `Bearer ${groqApiKey}`,
        },

        body:
          JSON.stringify(body),

        signal:
          controller.signal,
      },
    )
  } finally {
    clearTimeout(timeout)
  }
}

async function parseGroqResponseBody(
  response: Response,
): Promise<GroqResponse> {
  const text =
    await response.text()

  if (!text) {
    return {}
  }

  try {
    return JSON.parse(
      text,
    ) as GroqResponse
  } catch {
    return {
      error: {
        message: text,
      },
    }
  }
}

function normalizeGroqResponse(
  body: GroqResponse,
): GeminiResponse {
  const choice =
    body.choices?.[0]

  const message =
    choice?.message

  const parts: GeminiPart[] =
    []

  if (
    message?.content
  ) {
    parts.push({
      text:
        message.content,
    })
  }

  for (
    const toolCall of
      message?.tool_calls ||
      []
  ) {
    const name =
      toolCall.function
        ?.name

    if (!name) {
      continue
    }

    let args: Record<
      string,
      unknown
    > = {}

    try {
      const parsed =
        JSON.parse(
          toolCall.function
            ?.arguments ||
            '{}',
        )

      if (
        parsed &&
        typeof parsed ===
          'object'
      ) {
        args =
          parsed as Record<
            string,
            unknown
          >
      }
    } catch {
      args = {}
    }

    parts.push({
      functionCall: {
        name,

        args,
      },
    })
  }

  let finishReason =
    choice?.finish_reason ||
    null

  if (
    finishReason ===
    'length'
  ) {
    finishReason =
      'MAX_TOKENS'
  }

  if (
    finishReason ===
    'tool_calls'
  ) {
    finishReason = null
  }

  return {
    candidates: [
      {
        content: {
          parts,
        },

        finishReason:
          finishReason ||
          undefined,
      },
    ],

    usageMetadata: {
      promptTokenCount:
        body.usage
          ?.prompt_tokens,

      candidatesTokenCount:
        body.usage
          ?.completion_tokens,

      totalTokenCount:
        body.usage
          ?.total_tokens,
    },

    error:
      body.error
        ? {
            message:
              body.error
                .message,
          }
        : undefined,
  }
}

async function parseResponseBody(
  response: Response,
): Promise<GeminiResponse> {
  const text =
    await response.text()

  if (!text) {
    return {}
  }

  try {
    return JSON.parse(
      text,
    ) as GeminiResponse
  } catch {
    return {
      error: {
        message: text,
      },
    }
  }
}

function getGeminiErrorMessage(
  status: number,
  body: GeminiResponse,
) {
  const message =
    body?.error?.message ||
    `Gemini request failed with status ${status}`

  console.error(
    'Gemini error message:',
    message,
  )

  if (
    status === 401 ||
    status === 403
  ) {
    return 'مفتاح محرك الذكاء الاصطناعي غير صالح أو غير مصرح به.'
  }

  if (status === 404) {
    return 'موديل الذكاء الاصطناعي غير متاح حاليًا.'
  }

  if (status === 429) {
    return 'تم الوصول إلى حد استخدام محرك الذكاء الاصطناعي. حاول مرة أخرى بعد قليل.'
  }

  if (status >= 500) {
    return 'محرك الذكاء الاصطناعي غير متاح مؤقتًا. حاول مرة أخرى.'
  }

  return 'تعذر معالجة الرسالة حاليًا.'
}

function buildSystemPrompt(
  companyName: string,
  knowledge: Array<
    Record<string, unknown>
  >,
) {
  const knowledgeText =
    knowledge
      .map((item) => {
        const title =
          String(
            item.title || '',
          )

        const content =
          String(
            item.content ||
              item.body ||
              item.text ||
              '',
          )

        return `${title}: ${content}`
      })
      .filter(Boolean)
      .join('\n')

  return `
أنت Ryan، موظف خدمة عملاء ومبيعات حقيقي داخل شركة ${
    companyName ||
    'الشركة'
  }.

مهمتك أن تتصرف كموظف مصري محترف يتعامل مع عميل حقيقي، وليس chatbot يعمل بنظام أسئلة ثابت.

========================
أسلوب المحادثة
========================

* تحدث باللهجة المصرية الطبيعية والمحترمة.
* كن ودودًا واحترافيًا.
* اجعل الرد غالبًا جملة أو جملتين.
* اسأل سؤالًا واحدًا فقط عندما تحتاج معلومة.
* لا تكرر نفس السؤال إذا كان العميل أجاب عنه بالفعل.
* لا تبدأ المحادثة من جديد بعد كل رسالة.
* حافظ على سياق المحادثة بالكامل.
* لا تستخدم نفس تركيب الجملة في كل رد.
* لا تحول الحوار إلى استبيان.
* لا تستخدم إيموجي.
* لا تستخدم "يافندم" أو "أستاذ" بشكل مبالغ فيه.
* لا تقل إنك ذكاء اصطناعي إلا إذا سُئلت مباشرة.
* لا تخترع أسعارًا أو خدمات أو عروضًا أو مواعيد.
* لا تدعي تنفيذ أي شيء إلا إذا نجحت الأداة فعلًا.

========================
افهم العميل أولًا
========================

لا تتعامل مع المحادثة كـ Flow ثابت.

افهم كلام العميل.
استخرج المعلومات التي قالها بالفعل.
احتفظ بها.
اسأل فقط عن أهم معلومة ناقصة.

مثال:

العميل:
"أنا أحمد وعندي شركة ملابس وعايز إدارة صفحات"

أنت تعرف:
الاسم = أحمد
النشاط = شركة ملابس
الخدمة = إدارة صفحات

لا تسأل عن هذه المعلومات مرة أخرى.

========================
حجز الخدمة
========================

كلمة "حجز" لا تعني Appointment تلقائيًا.

إذا قال العميل:
"عايز احجز خدمة"

فهذا يعني غالبًا أنه يريد الخدمة أو يريد بدء الإجراءات.

لا تطلب منه تاريخًا أو وقتًا.

تعامل معه كعميل مهتم:
- افهم الخدمة المطلوبة.
- اجمع بياناته طبيعيًا.
- يمكن تسجيل Lead عندما توجد معلومات مفيدة واهتمام حقيقي.
- إذا أصبح لديه قصد شراء أو تعاقد واضح، يمكن إنشاء Deal.

========================
Appointment / مقابلة
========================

Appointment مختلف تمامًا عن طلب الخدمة.

استخدم Appointment فقط عندما يطلب العميل:
- مقابلة.
- اجتماع.
- لقاء.
- موعد مع شخص.
- مكالمة محددة بموعد.
- استشارة في موعد محدد.
- مقابلة مع الفريق.

مثال:

العميل:
"ممكن أقابل حد من الفريق؟"

الرد:
"أكيد، تحب المقابلة تكون إمتى؟"

إذا قال:
"الأحد الساعة 2"

استخدم المعلومات الموجودة.

لا تسأل عن التاريخ مرة أخرى.

إذا التاريخ موجود والوقت ناقص:
اسأل عن الوقت فقط.

إذا الوقت موجود والتاريخ ناقص:
اسأل عن التاريخ فقط.

لا تنشئ Appointment إلا عندما تكون:
service_name
date
time

موجودة.

========================
التدخل البشري
========================

إذا طلب العميل شخصًا حقيقيًا أو موظفًا أو خدمة العملاء أو المبيعات أو مديرًا أو أحد أفراد الفريق، استخدم request_human_handoff.

أمثلة:

"عايز أكلم حد"
"ممكن حد من المبيعات يكلمني؟"
"عايز خدمة العملاء"
"عايز موظف"
"عايز حد من الفريق"
"مش عايز أكمل مع البوت"

في هذه الحالة لا تحاول تحويل الطلب إلى Appointment.

نفذ Human Handoff.

بعد نجاح الأداة فقط أخبر العميل أن أحد أفراد الفريق سيكمل معه.

========================
Lead / CRM
========================

هدف Ryan هو جمع معلومات مفيدة بطريقة طبيعية.

يمكن جمع:
* الاسم.
* رقم الهاتف.
* النشاط.
* الخدمة المطلوبة.
* الهدف.
* الميزانية إذا ذكرها العميل.
* رابط الصفحة أو الموقع إذا ذكره.
* أي تفاصيل مهمة.

لا تسأل كل هذه المعلومات مرة واحدة.

اجمع المعلومات من كلام العميل.

إذا ظهر اهتمام حقيقي بالخدمة وكان الاسم معروفًا والمعلومات مفيدة، استخدم create_lead.

لا تنشئ Lead لمجرد:
"السلام عليكم"
أو سؤال عام جدًا بدون اهتمام.

========================
Deal
========================

استخدم create_deal فقط عندما يكون هناك قصد شراء أو تعاقد واضح.

مثال:
"أنا موافق ونبدأ."
"عايز أتعاقد."
"عايز أشتري الخدمة."

مجرد السؤال عن السعر أو الخدمة لا يعني Deal.

========================
قاعدة المعرفة
========================

لا تخترع أي معلومة غير موجودة في قاعدة المعرفة أو المحادثة.

معلومات الشركة:
${
    knowledgeText ||
    'لا توجد معلومات إضافية متاحة حاليًا.'
  }

========================
القاعدة الأهم
========================

لا تسأل العميل عن معلومة قالها بالفعل.

لا تعيد تشغيل الحوار من البداية.

لا تحول كل رسالة إلى سؤال.

لا تطلب تاريخ ووقت لمجرد أن العميل قال "حجز خدمة".

لا تنشئ Appointment إلا لطلب مقابلة/اجتماع/مكالمة فعلية.

إذا طلب العميل تدخلًا بشريًا، استخدم Human Handoff.

افهم السياق أولًا ثم تصرف كموظف حقيقي.
`
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (
    req.method !== 'POST'
  ) {
    return res
      .status(405)
      .json({
        error:
          'Method not allowed',
      })
  }

  /*
   * At least one AI provider must be configured.
   *
   * Gemini is the primary provider.
   * Groq is the fallback provider.
   */
  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    (!geminiApiKey &&
      !groqApiKey)
  ) {
    return res
      .status(500)
      .json({
        error:
          'Ryan configuration is incomplete',
      })
  }

  const {
    message,
    history = [],
    companyName = '',
    conversationId = null,
  } = req.body || {}

  const authorizationHeader =
    req.headers.authorization ||
    req.headers.Authorization

  const headerAccessToken =
    typeof authorizationHeader ===
      'string' &&
    authorizationHeader.startsWith(
      'Bearer ',
    )
      ? authorizationHeader
          .slice(7)
          .trim()
      : ''

  const bodyAccessToken =
    typeof req.body?.accessToken ===
      'string'
      ? req.body.accessToken.trim()
      : ''

  const accessToken =
    headerAccessToken ||
    bodyAccessToken

  if (
    !message ||
    typeof message !==
      'string'
  ) {
    return res
      .status(400)
      .json({
        error:
          'Message is required',
      })
  }

  if (
    !accessToken ||
    typeof accessToken !==
      'string'
  ) {
    return res
      .status(401)
      .json({
        error:
          'Authentication required',
      })
  }

  try {
    const user =
      await authenticateUser(
        accessToken,
      )

    if (!user) {
      return res
        .status(401)
        .json({
          error:
            'جلسة المستخدم غير صالحة. سجل الدخول مرة أخرى.',
        })
    }

    const supabase =
      getSupabaseClient(
        accessToken,
      )

    const organizationId =
      await getOrganizationId(
        supabase,
        user.id,
      )

    if (!organizationId) {
      return res
        .status(403)
        .json({
          error:
            'لم يتم العثور على الشركة الخاصة بالحساب.',
        })
    }

    let safeHistory: RyanHistoryItem[] =
      Array.isArray(history)
        ? history
            .filter(
              (item) =>
                item &&
                typeof item ===
                  'object',
            )
            .map((item) => ({
              ...item,
              text:
                getHistoryItemText(
                  item,
                ),
            }))
            .filter(
              (item) =>
                String(
                  item.text || '',
                ).trim() !== '',
            )
            .slice(
              -HISTORY_LIMIT,
            )
        : []

    const normalizedCurrentMessage =
      message.trim()

    if (
      safeHistory.length > 0
    ) {
      const lastItem =
        safeHistory[
          safeHistory.length - 1
        ]

      const lastText =
        String(
          lastItem?.text ||
            '',
        ).trim()

      const isLastUserMessage =
        lastItem?.role ===
          'user' ||
        lastItem?.sender ===
          'user' ||
        lastItem?.sender ===
          'customer'

      if (
        isLastUserMessage &&
        normalizeArabic(
          lastText,
        ) ===
          normalizeArabic(
            normalizedCurrentMessage,
          )
      ) {
        safeHistory =
          safeHistory.slice(
            0,
            -1,
          )
      }
    }

    const intent =
      detectIntent(
        normalizedCurrentMessage,
        safeHistory,
      )

    const customer =
      await getOrCreateCustomer(
        supabase,
        organizationId,
        user.email ||
          `user-${user.id}@website.local`,
        user.user_metadata
          ?.full_name ||
          user.user_metadata
            ?.name ||
          null,
      )

    const conversation =
      await getOrCreateConversation(
        supabase,
        organizationId,
        customer.id,
        conversationId,
      )

    await saveMessage(
      supabase,
      {
        conversationId:
          conversation.id,

        senderType:
          'customer',

        content:
          normalizedCurrentMessage,
      },
    )

    if (
      conversation.handled_by ===
      'human'
    ) {
      return res
        .status(200)
        .json({
          reply:
            'المحادثة حاليًا مع أحد أفراد الفريق وسيتم الرد عليك قريبًا.',

          conversationId:
            conversation.id,

          actionTaken:
            'request_human_handoff',

          handoff: true,
        })
    }

    const [
      entitlements,
      usage,
    ] = await Promise.all([
      getRyanEntitlements(
        supabase,
        organizationId,
      ),

      getMonthlyUsage(
        supabase,
        organizationId,
      ),
    ])

    if (
      entitlements?.messageLimit &&
      usage.messages >=
        entitlements.messageLimit
    ) {
      return res
        .status(429)
        .json({
          error:
            'تم استهلاك حد رسائل Ryan لهذا الشهر.',

          conversationId:
            conversation.id,
        })
    }

    if (
      entitlements?.tokenLimit &&
      usage.tokens >=
        entitlements.tokenLimit
    ) {
      return res
        .status(429)
        .json({
          error:
            'تم استهلاك حد Ryan الشهري.',

          conversationId:
            conversation.id,
        })
    }

    const {
      data: knowledgeRows,
      error:
        knowledgeError,
    } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq(
        'organization_id',
        organizationId,
      )
      .limit(15)

    if (knowledgeError) {
      console.error(
        'Ryan knowledge base error:',
        knowledgeError,
      )
    }

    const systemPrompt =
      buildSystemPrompt(
        companyName,
        knowledgeRows || [],
      )

    const contents = [
      {
        role: 'user',

        parts: [
          {
            text:
              systemPrompt,
          },
        ],
      },

      {
        role: 'model',

        parts: [
          {
            text:
              'فهمت. هتعامل مع العميل كموظف خدمة عملاء ومبيعات حقيقي، وهحافظ على سياق المحادثة وأفرق بين طلب الخدمة والمقابلة والتدخل البشري.',
          },
        ],
      },

      ...safeHistory
        .map((item) => {
          const text =
            getHistoryItemText(
              item,
            )

          if (!text) {
            return null
          }

          return {
            role:
              item.role ===
                'assistant' ||
              item.role ===
                'model' ||
              item.sender ===
                'model' ||
              item.sender ===
                'assistant' ||
              item.sender ===
                'ai'
                ? 'model'
                : 'user',

            parts: [
              {
                text:
                  String(text),
              },
            ],
          }
        })
        .filter(Boolean),

      {
        role: 'user',

        parts: [
          {
            text:
              normalizedCurrentMessage,
          },
        ],
      },
    ]

    const allowedTools =
      getToolsForIntent(
        intent,
      )

    /*
     * --------------------------------------------------
     * AI PROVIDER ROUTING
     * --------------------------------------------------
     *
     * Primary:
     *   Gemini
     *
     * Fallback:
     *   Groq
     *
     * Gemini will fallback to Groq when:
     *   - request timeout/network failure
     *   - 408
     *   - 429
     *   - 5xx
     *
     * We intentionally do NOT fallback for:
     *   - 401
     *   - 403
     *   - 404
     *   - other permanent 4xx errors
     *
     * This prevents hiding configuration/model errors.
     */

    let body: GeminiResponse = {}
    let aiProvider:
      | 'gemini'
      | 'groq' = 'gemini'

    let activeModel = MODEL

    let response:
      | Response
      | null = null

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

    let shouldFallbackToGroq =
      false

    /*
     * --------------------------------------------------
     * GEMINI PRIMARY
     * --------------------------------------------------
     */

    if (geminiApiKey) {
      try {
        response =
          await fetchGemini(
            geminiUrl,
            {
              contents,

              tools: [
                {
                  functionDeclarations:
                    allowedTools,
                },
              ],

              generationConfig: {
                maxOutputTokens:
                  512,
              },
            },
          )
      } catch (error: any) {
        const isAbort =
          error?.name ===
            'AbortError' ||
          String(
            error?.message ||
              '',
          )
            .toLowerCase()
            .includes(
              'abort',
            )

        console.error(
          'Ryan Gemini fetch error:',
          {
            error:
              error?.message,

            name:
              error?.name,

            model:
              MODEL,

            organizationId,

            conversationId:
              conversation.id,

            intent,

            timeout:
              isAbort,
          },
        )

        recordUsageNonBlocking(
          supabase,
          {
            organizationId,

            conversationId:
              conversation.id,

            userId:
              user.id,

            model:
              MODEL,

            eventType:
              'error',

            metadata: {
              source:
                'gemini_fetch',

              provider:
                'gemini',

              timeout:
                isAbort,
            },
          },
        )

        /*
         * Any network/timeout problem is eligible
         * for Groq fallback.
         */
        shouldFallbackToGroq =
          true
      }
    } else {
      /*
       * Gemini key is not configured.
       * If Groq exists, use it directly.
       */
      shouldFallbackToGroq =
        true
    }

    /*
     * --------------------------------------------------
     * GEMINI HTTP RESPONSE
     * --------------------------------------------------
     */

    if (
      response &&
      !response.ok
    ) {
      body =
        await parseResponseBody(
          response,
        )

      console.error(
        'Ryan Gemini API error:',
        {
          status:
            response.status,

          statusText:
            response.statusText,

          model:
            MODEL,

          organizationId,

          conversationId:
            conversation.id,

          intent,

          body,
        },
      )

      const fallbackEligible =
        response.status ===
          408 ||
        response.status ===
          429 ||
        response.status >=
          500

      /*
       * Record the Gemini error for audit/usage
       * visibility.
       */
      recordUsageNonBlocking(
        supabase,
        {
          organizationId,

          conversationId:
            conversation.id,

          userId:
            user.id,

          model:
            MODEL,

          eventType:
            'error',

          metadata: {
            source:
              'gemini_api',

            provider:
              'gemini',

            status:
              response.status,

            statusText:
              response.statusText,

            error:
              body?.error ||
              null,
          },
        },
      )

      shouldFallbackToGroq =
        fallbackEligible

      /*
       * Clear the Gemini response so the Groq
       * fallback can replace it.
       */
      if (
        shouldFallbackToGroq
      ) {
        response = null
        body = {}
      }
    } else if (
      response
    ) {
      /*
       * Gemini succeeded.
       */
      body =
        await parseResponseBody(
          response,
        )

      if (
        body.error &&
        !body.candidates?.length
      ) {
        console.error(
          'Ryan Gemini returned an error body:',
          body,
        )

        shouldFallbackToGroq =
          true

        recordUsageNonBlocking(
          supabase,
          {
            organizationId,

            conversationId:
              conversation.id,

            userId:
              user.id,

            model:
              MODEL,

            eventType:
              'error',

            metadata: {
              source:
                'gemini_response',

              provider:
                'gemini',

              error:
                body.error,
            },
          },
        )

        response = null
        body = {}
      }
    }

    /*
     * --------------------------------------------------
     * GROQ FALLBACK
     * --------------------------------------------------
     */

    if (
      shouldFallbackToGroq &&
      groqApiKey
    ) {
      try {
        const groqMessages =
          buildGroqMessages(
            contents,
          )

        const groqTools =
          convertToolsForGroq(
            allowedTools as any[],
          )

        const groqResponse =
          await fetchGroq({
            model:
              GROQ_MODEL,

            messages:
              groqMessages,

            tools:
              groqTools,

            tool_choice:
              'auto',

            temperature:
              0.4,

            max_tokens:
              512,
          })

        const groqBody =
          await parseGroqResponseBody(
            groqResponse,
          )

        if (
          !groqResponse.ok
        ) {
          console.error(
            'Ryan Groq API error:',
            {
              status:
                groqResponse.status,

              statusText:
                groqResponse.statusText,

              model:
                GROQ_MODEL,

              organizationId,

              conversationId:
                conversation.id,

              intent,

              body:
                groqBody,
            },
          )

          recordUsageNonBlocking(
            supabase,
            {
              organizationId,

              conversationId:
                conversation.id,

              userId:
                user.id,

              model:
                GROQ_MODEL,

              eventType:
                'error',

              metadata: {
                source:
                  'groq_api',

                provider:
                  'groq',

                status:
                  groqResponse.status,

                statusText:
                  groqResponse.statusText,

                error:
                  groqBody?.error ||
                  null,
              },
            },
          )

          /*
           * Both providers failed.
           */
          return res
            .status(503)
            .json({
              error:
                'محرك الذكاء الاصطناعي غير متاح مؤقتًا. حاول مرة أخرى بعد قليل.',

              conversationId:
                conversation.id,
            })
        }

        body =
          normalizeGroqResponse(
            groqBody,
          )

        aiProvider =
          'groq'

        activeModel =
          GROQ_MODEL

        response =
          groqResponse

        console.log(
          'Ryan switched to Groq fallback:',
          {
            provider:
              aiProvider,

            model:
              activeModel,

            organizationId,

            conversationId:
              conversation.id,

            intent,
          },
        )
      } catch (error: any) {
        const isAbort =
          error?.name ===
            'AbortError' ||
          String(
            error?.message ||
              '',
          )
            .toLowerCase()
            .includes(
              'abort',
            )

        console.error(
          'Ryan Groq fallback error:',
          {
            error:
              error?.message,

            name:
              error?.name,

            model:
              GROQ_MODEL,

            organizationId,

            conversationId:
              conversation.id,

            intent,

            timeout:
              isAbort,
          },
        )

        recordUsageNonBlocking(
          supabase,
          {
            organizationId,

            conversationId:
              conversation.id,

            userId:
              user.id,

            model:
              GROQ_MODEL,

            eventType:
              'error',

            metadata: {
              source:
                'groq_fetch',

              provider:
                'groq',

              timeout:
                isAbort,
            },
          },
        )

        return res
          .status(503)
          .json({
            error:
              'محرك الذكاء الاصطناعي غير متاح مؤقتًا. حاول مرة أخرى بعد قليل.',

            conversationId:
              conversation.id,
          })
      }
    }

    /*
     * If Gemini failed permanently and there is no Groq
     * fallback, preserve the original Gemini error.
     */
    if (
      !response &&
      !shouldFallbackToGroq
    ) {
      return res
        .status(502)
        .json({
          error:
            getGeminiErrorMessage(
              502,
              body,
            ),

          conversationId:
            conversation.id,
        })
    }

    /*
     * If Gemini failed with a fallback-eligible error
     * but Groq is not configured, return the original
     * Gemini-facing error.
     */
    if (
      !response &&
      shouldFallbackToGroq &&
      !groqApiKey
    ) {
      return res
        .status(503)
        .json({
          error:
            'محرك الذكاء الاصطناعي غير متاح مؤقتًا. حاول مرة أخرى بعد قليل.',

          conversationId:
            conversation.id,
        })
    }

    /*
     * --------------------------------------------------
     * AI RESPONSE PROCESSING
     * --------------------------------------------------
     */

    const usageMetadata =
      body.usageMetadata ||
      {}

    const promptTokens =
      Number(
        usageMetadata.promptTokenCount ??
          0,
      ) || 0

    const outputTokens =
      Number(
        usageMetadata.candidatesTokenCount ??
          0,
      ) || 0

    const totalTokens =
      Number(
        usageMetadata.totalTokenCount ??
          promptTokens +
            outputTokens,
      ) || 0

    const candidate =
      body.candidates?.[0]

    const finishReason =
      candidate?.finishReason ||
      null

    const parts =
      candidate?.content?.parts ||
      []

    const functionCalls =
      parts
        .map(
          (part) =>
            part.functionCall,
        )
        .filter(
          Boolean,
        ) as Array<{
        name: string
        args?: Record<
          string,
          unknown
        >
      }>

    const allowedToolNames =
      new Set(
        allowedTools.map(
          (tool) =>
            tool.name,
        ),
      )

    const validFunctionCalls =
      functionCalls.filter(
        (call) =>
          allowedToolNames.has(
            call.name as RyanToolName,
          ),
      )

    const successfulToolResults:
      Array<{
        name: RyanToolName
        result: any
      }> = []

    if (
      validFunctionCalls.length >
      0
    ) {
      for (
        const call of validFunctionCalls
      ) {
        const functionName =
          call.name as RyanToolName

        const args =
          call.args || {}

        if (
          intent ===
            'appointment' &&
          functionName !==
            'book_appointment' &&
          functionName !==
            'request_human_handoff'
        ) {
          console.warn(
            'Blocked sales tool during appointment intent:',
            functionName,
          )

          continue
        }

        if (
          intent ===
            'handoff' &&
          functionName !==
            'request_human_handoff'
        ) {
          console.warn(
            'Blocked non-handoff Ryan tool during handoff intent:',
            functionName,
          )

          continue
        }

        try {
          const result =
            await runFunction(
              supabase,
              functionName,
              args,
              organizationId,
              conversation.id,
              user.id,
            )

          if (
            result?.success
          ) {
            successfulToolResults.push(
              {
                name:
                  functionName,

                result,
              },
            )
          }
        } catch (
          error: any
        ) {
          console.error(
            'Ryan tool error:',
            {
              tool:
                functionName,

              error:
                error?.message,

              organizationId,

              conversationId:
                conversation.id,
            },
          )
        }
      }
    }

    /*
     * Record ONE usage event for the actual provider
     * that generated the response.
     */
    if (
      totalTokens > 0 ||
      validFunctionCalls.length === 0
    ) {
      recordUsageNonBlocking(
        supabase,
        {
          organizationId,

          conversationId:
            conversation.id,

          userId:
            user.id,

          model:
            activeModel,

          eventType:
            'message',

          tokens:
            totalTokens,

          metadata: {
            provider:
              aiProvider,

            intent,

            promptTokens,

            outputTokens,

            totalTokens,

            toolCalls:
              successfulToolResults.map(
                (item) =>
                  item.name,
              ),

            finishReason,
          },
        },
      )
    }

    /*
     * Appointment success.
     */
    const appointment =
      successfulToolResults.find(
        (item) =>
          item.name ===
          'book_appointment',
      )

    if (appointment) {
      const args =
        validFunctionCalls.find(
          (call) =>
            call.name ===
            'book_appointment',
        )?.args || {}

      const serviceName =
        String(
          args.service_name ||
            'المقابلة',
        )

      const date =
        String(
          args.date ||
            '',
        )

      const time =
        String(
          args.time ||
            '',
        )

      const reply =
        date && time
          ? `تمام، سجلت لك ${serviceName} يوم ${date} الساعة ${time}.`
          : `تمام، سجلت لك الموعد.`

      await saveMessage(
        supabase,
        {
          conversationId:
            conversation.id,

          senderType:
            'ai',

          content:
            reply,

          metadata: {
            action_taken:
              'book_appointment',

            provider:
              aiProvider,
          },
        },
      )

      return res
        .status(200)
        .json({
          reply,

          conversationId:
            conversation.id,

          actionTaken:
            'book_appointment',

          usage: {
            promptTokens,

            outputTokens,

            totalTokens,

            provider:
              aiProvider,

            model:
              activeModel,
          },
        })
    }

    /*
     * Human handoff success.
     */
    const handoff =
      successfulToolResults.find(
        (item) =>
          item.name ===
          'request_human_handoff',
      )

    if (handoff) {
      const reply =
        'أكيد، هحوّل المحادثة لحد من الفريق ويتابع معاك.'

      await saveMessage(
        supabase,
        {
          conversationId:
            conversation.id,

          senderType:
            'ai',

          content:
            reply,

          metadata: {
            action_taken:
              'request_human_handoff',

            status:
              'open',

            provider:
              aiProvider,
          },
        },
      )

      return res
        .status(200)
        .json({
          reply,

          conversationId:
            conversation.id,

          actionTaken:
            'request_human_handoff',

          handoff:
            true,

          usage: {
            promptTokens,

            outputTokens,

            totalTokens,

            provider:
              aiProvider,

            model:
              activeModel,
          },
        })
    }

    /*
     * Deal success.
     */
    const deal =
      successfulToolResults.find(
        (item) =>
          item.name ===
          'create_deal',
      )

    if (deal) {
      const reply =
        'تمام، سجلت طلبك وهنتابع معاك بخصوص الخدمة والتفاصيل.'

      await saveMessage(
        supabase,
        {
          conversationId:
            conversation.id,

          senderType:
            'ai',

          content:
            reply,

          metadata: {
            action_taken:
              'create_deal',

            provider:
              aiProvider,
          },
        },
      )

      return res
        .status(200)
        .json({
          reply,

          conversationId:
            conversation.id,

          actionTaken:
            'create_deal',

          usage: {
            promptTokens,

            outputTokens,

            totalTokens,

            provider:
              aiProvider,

            model:
              activeModel,
          },
        })
    }

    /*
     * Lead success.
     */
    const lead =
      successfulToolResults.find(
        (item) =>
          item.name ===
          'create_lead',
      )

    if (lead) {
      const reply =
        'تمام، سجلت بياناتك وهنتابع معاك بخصوص طلبك.'

      await saveMessage(
        supabase,
        {
          conversationId:
            conversation.id,

          senderType:
            'ai',

          content:
            reply,

          metadata: {
            action_taken:
              'create_lead',

            provider:
              aiProvider,
          },
        },
      )

      return res
        .status(200)
        .json({
          reply,

          conversationId:
            conversation.id,

          actionTaken:
            'create_lead',

          usage: {
            promptTokens,

            outputTokens,

            totalTokens,

            provider:
              aiProvider,

            model:
              activeModel,
          },
        })
    }

    const rawText =
      parts
        .map(
          (part) =>
            part.text ||
            '',
        )
        .join('')
        .trim()

    if (
      finishReason ===
        'MAX_TOKENS' ||
      !rawText
    ) {
      const fallbackReply =
        intent === 'appointment'
          ? 'أكيد، تحب المقابلة تكون إمتى؟'
          : intent === 'handoff'
            ? 'أكيد، هحوّل المحادثة لحد من الفريق ويتابع معاك.'
            : 'تمام، احكيلي تفاصيل طلبك وأنا أساعدك.'

      await saveMessage(
        supabase,
        {
          conversationId:
            conversation.id,

          senderType:
            'ai',

          content:
            fallbackReply,

          metadata: {
            fallback:
              true,

            finish_reason:
              finishReason ||
              'EMPTY_RESPONSE',

            provider:
              aiProvider,

            model:
              activeModel,
          },
        },
      )

      return res
        .status(200)
        .json({
          reply:
            fallbackReply,

          conversationId:
            conversation.id,

          usage: {
            promptTokens,

            outputTokens,

            totalTokens,

            provider:
              aiProvider,

            model:
              activeModel,
          },
        })
    }

    const reply =
      rawText ||
      'تمام، قولي تفاصيل أكتر وأنا أساعدك.'

    await saveMessage(
      supabase,
      {
        conversationId:
          conversation.id,

        senderType:
          'ai',

        content:
          reply,

        metadata: {
          provider:
            aiProvider,

          model:
            activeModel,
        },
      },
    )

    return res
      .status(200)
      .json({
        reply,

        conversationId:
          conversation.id,

        usage: {
          promptTokens,

          outputTokens,

          totalTokens,

          provider:
            aiProvider,

          model:
            activeModel,
        },
      })
  } catch (error: any) {
    console.error(
      'Ryan handler error:',
      {
        message:
          error?.message,

        stack:
          error?.stack,
      },
    )

    return res
      .status(500)
      .json({
        error:
          'حصل خطأ غير متوقع أثناء معالجة الرسالة.',
      })
  }
}
