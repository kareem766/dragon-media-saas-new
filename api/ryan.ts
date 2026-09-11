import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const MODEL =
  process.env.RYAN_GEMINI_MODEL || 'gemini-3.6-flash'

const GEMINI_TIMEOUT_MS = 25_000
const USAGE_TIMEOUT_MS = 2_000
const HISTORY_LIMIT = 12

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const geminiApiKey = process.env.GEMINI_API_KEY

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

const TOOL_DEFINITIONS = {
  create_lead: {
    name: 'create_lead',
    description:
      `
Create or register a genuine sales/customer-service lead in the CRM.

Use this when the customer has shown meaningful interest in Dragon Media, a service, consultation, pricing, page management, advertising, content, design, marketing, or another business need.

IMPORTANT:
- "عايز احجز خدمة" means the customer wants to start/request a service. It does NOT mean an appointment.
- This tool is NOT an appointment booking tool.
- Do NOT ask for a date or time for a normal service request.
- Extract information from the conversation.
- Do not ask for information that the customer already provided.
- Do not repeat questions unnecessarily.
- The customer name is preferred, but do not invent it.
- Include service, activity, goal and notes whenever they are known.
- If phone is known, include it.
- Do not create a lead merely because the customer said hello or asked a completely generic question.
- Do not create a lead simply because a name was provided.
- Create the lead when there is genuine business/service interest and useful customer information can be recorded.
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
    description:
      `
Create a CRM deal only when the customer has clearly moved from inquiry/interest to a serious purchase or contracting intention.

Examples:
- العميل يريد التعاقد.
- العميل يقول إنه يريد شراء الخدمة.
- العميل وافق على البدء.
- العميل يطلب تنفيذ الخدمة بعد الاتفاق.

Do NOT create a deal just because the customer:
- asked about a service
- asked about price
- asked for details
- said they are interested

Use the information already available in the conversation.

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
    description:
      `
Create a CRM appointment ONLY when the customer explicitly wants a real appointment, meeting, consultation meeting, scheduled call, or to meet someone from Dragon Media.

This is NOT for normal service requests.

Do NOT use this tool when the customer says:
- عايز احجز خدمة
- عايز أبدأ الخدمة
- عايز إدارة صفحات
- عايز اشتري خدمة
- عايز استشارة
- ممكن تفاصيل الاستشارة
- عايز أعرف عن الاستشارة

Those are normal sales/service conversations unless the customer explicitly asks for a scheduled meeting, appointment, or call.

Use this tool only when there is a genuine appointment/meeting request.

Examples:
- ممكن أقابل حد من الفريق؟
- عايز أحدد ميعاد مقابلة.
- ممكن اجتماع يوم الأحد؟
- عايز مكالمة مع حد من المبيعات الساعة 5.
- عايز أحجز موعد استشارة.

Before calling the tool, service_name, date and time must be known.

The service_name should describe the subject/purpose of the meeting, such as:
- استشارة تسويقية
- مقابلة لمناقشة إدارة الصفحات
- اجتماع بخصوص الإعلانات
- مكالمة مع فريق المبيعات

Never claim the appointment was created unless the tool succeeds.
`,
    parameters: {
      type: 'OBJECT',
      properties: {
        service_name: {
          type: 'STRING',
          description:
            'Subject/purpose of the appointment or meeting',
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
      required: [
        'service_name',
        'date',
        'time',
      ],
    },
  },

  request_human_handoff: {
    name: 'request_human_handoff',
    description:
      `
Transfer the conversation to a human team member when the customer explicitly asks for human assistance.

Use this when the customer asks for:
- موظف
- مسؤول
- مدير
- حد من الفريق
- حد من المبيعات
- خدمة العملاء
- شخص حقيقي
- شخص من الشركة
- حد يكلمني
- حد يتواصل معايا
- عايز أكلم حد
- عايز حد من الفريق
- عايز أكلم مسؤول
- عايز أكلم المدير

Also use it when the situation genuinely requires human intervention and Ryan cannot responsibly complete it.

Do not use it simply because the conversation is long.

Do not use it just because the customer asks a difficult but answerable question.
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
  'موظف',
  'موظفه',
  'خدمة عملاء',
  'خدمه عملاء',
  'حد من الفريق',
  'حد من الشركة',
  'حد من الشركه',
  'حد من المبيعات',
  'مسؤول',
  'مسئول',
  'مسؤولة',
  'مسئوله',
  'المدير',
  'مدير',
  'اتكلم مع شخص',
  'اتكلم مع حد',
  'اكلم شخص',
  'اكلم حد',
  'اكلم موظف',
  'اكلم مسؤول',
  'اكلم المدير',
  'كلموني',
  'كلمني حد',
  'حد يكلمني',
  'حد يتواصل معايا',
  'حد يتواصل معي',
  'يتواصل معايا',
  'يتواصل معي',
  'بني آدم',
  'بني ادم',
  'بنيادمي',
  'شخص حقيقي',
  'موظف حقيقي',
  'عايز حد',
  'عاوز حد',
  'عايز موظف',
  'عاوز موظف',
  'عايز مسؤول',
  'عاوز مسؤول',
  'عايز مدير',
  'عاوز مدير',
  'ممكن حد يكلمني',
  'ممكن حد يتصل',
  'ممكن موظف يكلمني',
]

const APPOINTMENT_KEYWORDS = [
  'مقابلة',
  'مقابله',
  'اجتماع',
  'اجتماع مع',
  'اقابل',
  'أقابل',
  'قابل',
  'مقابله مع',
  'مقابلة مع',
  'موعد مع',
  'ميعاد مع',
  'موعد مع حد',
  'ميعاد مع حد',
  'موعد مقابلة',
  'ميعاد مقابلة',
  'موعد اجتماع',
  'ميعاد اجتماع',
  'ممكن اقابل',
  'ممكن أقابل',
  'عايز اقابل',
  'عايز أقابل',
  'عايز مقابلة',
  'عايز مقابله',
  'حابب اقابل',
  'حابب أقابل',
  'حددلي معاد',
  'حدد لي معاد',
  'حددلي موعد',
  'حدد لي موعد',
  'احجز موعد',
  'احجزلي موعد',
  'احجز لي موعد',
  'حجز موعد',
  'حجز مقابلة',
  'حجز مقابله',
  'موعد استشارة',
  'ميعاد استشارة',
  'احجز استشارة',
  'حجز استشارة',
  'جلسة استشارة',
  'مكالمة مع الفريق',
  'مكالمة مع المبيعات',
  'مكالمة مع حد',
  'مكالمة مع موظف',
  'مكالمة محددة',
]

const DEAL_KEYWORDS = [
  'شراء',
  'اشتري',
  'عايز اشتري',
  'عاوز اشتري',
  'عايز أشتري',
  'عاوز أشتري',
  'عايز الخدمة',
  'عاوز الخدمة',
  'اتعاقد',
  'التعاقد',
  'عايز اتعاقد',
  'عايز أتعاقد',
  'عاوز اتعاقد',
  'عاوز أتعاقد',
  'نبدأ',
  'ابدأ',
  'أبدأ',
  'ابدأ الخدمة',
  'أبدأ الخدمة',
  'عايز ابدأ',
  'عايز أبدأ',
  'عاوز ابدأ',
  'عاوز أبدأ',
  'ابدأ معاكم',
  'نبدأ معاكم',
  'عايز نبدأ',
  'موافق ونبدأ',
  'موافق ابدأ',
  'موافق نبدأ',
]

const LEAD_INTEREST_KEYWORDS = [
  'مهتم',
  'محتاج',
  'محتاجين',
  'عايز اعرف',
  'عايز أعرف',
  'عاوز اعرف',
  'عاوز أعرف',
  'ممكن تفاصيل',
  'عايز تفاصيل',
  'عاوز تفاصيل',
  'عايز معلومات',
  'عاوز معلومات',
  'معلومات عن',
  'تفاصيل عن',
  'سعر',
  'الاسعار',
  'الأسعار',
  'السعر',
  'تكلفة',
  'كام',
  'إدارة الصفحات',
  'ادارة الصفحات',
  'إدارة السوشيال',
  'ادارة السوشيال',
  'ادارة السوشيال ميديا',
  'إدارة السوشيال ميديا',
  'اعلانات',
  'إعلانات',
  'اعلان',
  'إعلان',
  'محتوى',
  'تصميم',
  'تسويق',
  'خدماتكم',
  'الخدمات',
  'الخدمة',
  'خدمتكم',
  'عايز خدمة',
  'عاوز خدمة',
  'عايز احجز خدمة',
  'عاوز احجز خدمة',
  'عايز أحجز خدمة',
  'عاوز أحجز خدمة',
  'عايز ابدأ خدمة',
  'عاوز ابدأ خدمة',
  'عايز أبدأ خدمة',
  'عاوز أبدأ خدمة',
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
  /*
   * Explicit human request always wins.
   */
  if (
    containsKeyword(
      message,
      HANDOFF_KEYWORDS,
    )
  ) {
    return 'handoff'
  }

  /*
   * Explicit appointment/meeting request.
   *
   * IMPORTANT:
   * Normal service "booking" is NOT an appointment.
   */
  if (
    containsKeyword(
      message,
      APPOINTMENT_KEYWORDS,
    )
  ) {
    return 'appointment'
  }

  /*
   * Explicit purchase/contract intent.
   */
  if (
    containsKeyword(
      message,
      DEAL_KEYWORDS,
    )
  ) {
    return 'deal'
  }

  /*
   * Genuine service/business interest.
   */
  if (
    containsKeyword(
      message,
      LEAD_INTEREST_KEYWORDS,
    )
  ) {
    return 'lead'
  }

  /*
   * Continue appointment context only if the previous
   * conversation clearly contains an explicit appointment
   * request.
   *
   * We intentionally do NOT treat any "موعد/ميعاد/ساعة"
   * word in history as enough.
   */
  const recentHistory =
    getHistoryText(
      history,
      8,
    )

  const hasRecentAppointmentRequest =
    containsKeyword(
      recentHistory,
      APPOINTMENT_KEYWORDS,
    )

  if (
    hasRecentAppointmentRequest
  ) {
    const normalizedMessage =
      normalizeArabic(message)

    const looksLikeDateOrTime =
      /بكره|غدا|غداً|النهارده|اليوم|الاحد|الاتنين|الثلاث|الاربع|الخميس|الجمعه|السبت|الساعة|الساعه|\d/.test(
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

        p_reason:
          String(
            args.reason ||
              'Customer requested human assistance',
          ),

        p_requested_by:
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

مهمتك ليست أن تكون chatbot أو أن تمشي العميل في خطوات ثابتة.

تصرف كموظف مصري محترف يتحدث مع عميل حقيقي.

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
* لا تقل "تمام، تحب..." في كل رسالة.
* لا تستخدم إيموجي.
* لا تستخدم "يافندم" أو "أستاذ" بشكل مبالغ فيه.
* لا تقل إنك ذكاء اصطناعي إلا إذا سُئلت مباشرة.
* لا تخترع أسعارًا أو خدمات أو عروضًا أو مواعيد.
* لا تدعي تنفيذ أي شيء إلا إذا نجحت الأداة فعلًا.

========================
أنت موظف وليس Flow
========================

لا تتعامل مع المحادثة كالتالي:

سؤال 1
ثم سؤال 2
ثم سؤال 3

بدلًا من ذلك:

افهم ما قاله العميل.
استخرج المعلومات الموجودة بالفعل.
احتفظ بها في سياق المحادثة.
اسأل فقط عن أهم معلومة ناقصة.

إذا قال العميل أكثر من معلومة في رسالة واحدة، استخدم كل المعلومات.

مثال:

العميل:
"أنا أحمد وعندي شركة ملابس وعايز إدارة صفحات"

أنت تعرف بالفعل:
الاسم = أحمد
النشاط = شركة ملابس
الخدمة = إدارة صفحات

لا تسأل عن هذه المعلومات مرة أخرى.

يمكنك أن تسأل عن الهدف أو أي معلومة ضرورية أخرى فقط.

========================
مهم جدًا: معنى "الحجز"
========================

لا تعتبر كلمة "حجز" وحدها موعدًا.

إذا قال العميل:
"عايز احجز خدمة"

فهذا يعني غالبًا أنه يريد طلب/بدء الخدمة.

لا تسأل عن التاريخ أو الوقت.

لا تستخدم book_appointment.

تعامل معه كعميل مهتم بالخدمة واجمع بياناته بشكل طبيعي وسجل Lead عندما تكون هناك معلومات مفيدة واهتمام حقيقي.

نفس الشيء مع:
"عايز أحجز إدارة صفحات"
"عايز أحجز خدمة إعلانات"
"عايز أبدأ معاكم"
"عايز أطلب الخدمة"

هذه ليست Appointment.

========================
Lead / CRM
========================

هدف Ryan الأساسي هو جمع معلومات مفيدة عن العميل بطريقة طبيعية.

المعلومات الممكن جمعها:

* الاسم.
* رقم الهاتف.
* النشاط.
* الخدمة المطلوبة.
* الهدف.
* الميزانية إذا ذكرها العميل.
* رابط الصفحة أو الموقع إذا ذكره العميل.
* أي تفاصيل مهمة أخرى.

لا تحول الحوار إلى استبيان.

لا تسأل كل هذه الأسئلة مرة واحدة.

اجمع المعلومات من كلام العميل.

إذا قال العميل:
"أنا أحمد وعندي محل ملابس وعايز إدارة صفحات"

لا تسأله عن اسمه أو نشاطه أو الخدمة مرة أخرى.

إذا كان هناك اهتمام حقيقي، استخدم create_lead عندما يكون لديك اسم ومعلومات مفيدة عن الطلب.

لا تنشئ Lead لمجرد:
"السلام عليكم"
أو سؤال عام جدًا بدون اهتمام حقيقي.

========================
Deal
========================

استخدم create_deal فقط عندما يظهر قصد شراء أو تعاقد واضح.

مثل:

"أنا موافق ونبدأ."
"عايز أتعاقد."
"عايز أشتري الخدمة."
"ابدأوا معايا."

مجرد السؤال عن السعر أو الخدمة لا يعني Deal.

========================
Appointment / مقابلة
========================

استخدم Appointment فقط عندما يطلب العميل لقاءً أو موعدًا فعليًا.

مثل:

* مقابلة.
* اجتماع.
* موعد مع شخص من الفريق.
* مقابلة مع موظف.
* استشارة في موعد محدد.
* مكالمة مجدولة.
* اجتماع مع المبيعات.
* موعد استشارة.

مثال:

العميل:
"ممكن أقابل حد من الفريق؟"

Ryan:
"أكيد، تحب المقابلة تكون إمتى؟"

إذا قال:
"الأحد الساعة 2"

فالتاريخ والوقت أصبحا معروفين.

لا تسأل عنهما مرة أخرى.

إذا كانت المعلومة الناقصة هي التاريخ فقط، اسأل عن التاريخ فقط.

إذا كانت المعلومة الناقصة هي الوقت فقط، اسأل عن الوقت فقط.

لا تستخدم book_appointment إلا عندما يكون:
service_name
و date
و time
موجودين.

مهم:
"عايز استشارة"
وحدها ليست Appointment.

لكن:
"عايز أحجز موعد استشارة"
أو
"عايز استشارة يوم الأحد الساعة 3"

هي Appointment.

========================
Human Handoff
========================

إذا طلب العميل شخصًا حقيقيًا أو موظفًا أو مسؤولًا أو مديرًا أو أحد أفراد الفريق، استخدم request_human_handoff.

أمثلة:

"عايز أكلم حد."
"ممكن حد من الفريق يكلمني؟"
"عايز أكلم مسؤول."
"خليني أكلم المدير."
"ممكن موظف من المبيعات يتواصل معايا؟"
"عايز خدمة العملاء."

بعد نجاح الأداة فقط أخبر العميل أن المحادثة تم تحويلها.

لا تقل إنه تم التحويل إذا فشلت الأداة.

إذا طلب العميل إنسانًا بشكل صريح، لا تحاول إقناعه بأن تكمل أنت بدلًا منه.

========================
ترتيب الأولويات
========================

إذا طلب العميل تدخلًا بشريًا بشكل صريح:
Human Handoff له الأولوية.

إذا طلب مقابلة أو اجتماعًا فعليًا:
Appointment.

إذا أظهر نية شراء أو تعاقد واضحة:
Deal.

إذا أظهر اهتمامًا حقيقيًا بخدمة:
Lead.

إذا لم يكن هناك أي من ذلك:
استمر كمحادثة خدمة عملاء طبيعية.

========================
المعلومات وقاعدة المعرفة
========================

لا تخترع أي معلومة غير موجودة في قاعدة المعرفة أو المحادثة.

معلومات الشركة:
${
    knowledgeText ||
    'لا توجد معلومات إضافية متاحة حاليًا.'
  }

========================
قواعد مهمة جدًا
========================

لا تسأل العميل عن معلومة قالها بالفعل.

لا تعيد تشغيل الحوار من البداية.

لا تحول كل رسالة إلى سؤال جديد.

لا تطلب التاريخ والوقت لمجرد أن العميل قال "حجز".

لا تنشئ Appointment لمجرد أن العميل يريد خدمة.

لا تنشئ Deal لمجرد أن العميل سأل عن السعر.

لا تنشئ Lead لمجرد التحية.

لا تستخدم الأدوات بشكل آلي إذا لم يكن استخدامها منطقيًا.

افهم السياق أولًا ثم رد كموظف حقيقي.
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

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !geminiApiKey
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
    typeof authorizationHeader === 'string' &&
    authorizationHeader.startsWith('Bearer ')
      ? authorizationHeader.slice(7).trim()
      : ''

  const bodyAccessToken =
    typeof req.body?.accessToken === 'string'
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
    /*
     * Authenticate first.
     */
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

    /*
     * Organization comes from the authenticated
     * user's database record.
     */
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

    /*
     * Normalize history.
     */
    const safeHistory: RyanHistoryItem[] =
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

    const intent =
      detectIntent(
        message,
        safeHistory,
      )

    /*
     * Customer first.
     */
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

    /*
     * Conversation.
     */
    const conversation =
      await getOrCreateConversation(
        supabase,
        organizationId,
        customer.id,
        conversationId,
      )

    /*
     * Always save the customer's current message.
     */
    await saveMessage(
      supabase,
      {
        conversationId:
          conversation.id,

        senderType:
          'customer',

        content:
          message,
      },
    )

    /*
     * If a human is already handling the conversation,
     * do not let Ryan answer it.
     */
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

    /*
     * Entitlements and usage.
     */
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

    /*
     * Knowledge Base is organization scoped.
     */
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

    /*
     * Build Gemini conversation.
     */
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
              'فهمت. هتعامل مع العميل كموظف خدمة عملاء ومبيعات حقيقي، وهحافظ على سياق المحادثة من غير تكرار أو تحويل كل طلب خدمة لموعد.',
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
              message,
          },
        ],
      },
    ]

    const allowedTools =
      getToolsForIntent(
        intent,
      )

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

    let response: Response

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

            timeout:
              isAbort,
          },
        },
      )

      return res
        .status(504)
        .json({
          error:
            isAbort
              ? 'محرك الذكاء الاصطناعي استغرق وقتًا أطول من المتوقع. حاول مرة أخرى.'
              : 'تعذر الاتصال بمحرك الذكاء الاصطناعي.',

          conversationId:
            conversation.id,
        })
    }

    const body =
      await parseResponseBody(
        response,
      )

    if (!response.ok) {
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

      const frontendStatus =
        response.status >=
        500
          ? 502
          : response.status

      return res
        .status(
          frontendStatus,
        )
        .json({
          error:
            getGeminiErrorMessage(
              response.status,
              body,
            ),

          conversationId:
            conversation.id,
        })
    }

    const usageMetadata =
      body.usageMetadata ||
      {}

    const promptTokens =
      Number(
        usageMetadata.promptTokenCount ||
          0,
      )

    const outputTokens =
      Number(
        usageMetadata.candidatesTokenCount ||
          0,
      )

    const totalTokens =
      Number(
        usageMetadata.totalTokenCount ||
          promptTokens +
            outputTokens,
      )

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

    /*
     * Execute tools.
     *
     * No second Gemini request.
     */
    if (
      validFunctionCalls.length >
      0
    ) {
      const successfulToolResults:
        Array<{
          name: RyanToolName
          result: any
        }> = []

      for (
        const call of validFunctionCalls
      ) {
        const functionName =
          call.name as RyanToolName

        const args =
          call.args || {}

        /*
         * Appointment intent can ONLY create
         * an appointment or handoff.
         */
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

        /*
         * Handoff intent can ONLY call handoff.
         */
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

        /*
         * Record actual AI tool usage.
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
              'tool_call',

            tokens:
              totalTokens,

            metadata: {
              tool:
                functionName,

              intent,
            },
          },
        )

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
            'message',

          tokens:
            totalTokens,

          metadata: {
            intent,

            toolCalls:
              successfulToolResults.map(
                (item) =>
                  item.name,
              ),
          },
        },
      )

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
                'pending',
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
          'تمام، سجلت طلب التعاقد وهنتابع معاك بالتفاصيل.'

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
          'تمام، سجلت بياناتك عندنا وهنتابع معاك بخصوص طلبك.'

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
          })
      }
    }

    /*
     * Normal text response.
     */
    const rawText =
      parts
        .map(
          (part) =>
            part.text ||
            '',
        )
        .join('')
        .trim()

    /*
     * Never return partial/cut-off text.
     */
    if (
      finishReason ===
        'MAX_TOKENS' ||
      !rawText
    ) {
      let fallbackReply =
        'تمام، احكيلي تفاصيل طلبك وأنا أساعدك.'

      if (
        intent ===
        'appointment'
      ) {
        fallbackReply =
          'أكيد، تحب المقابلة تكون إمتى؟'
      } else if (
        intent ===
        'handoff'
      ) {
        fallbackReply =
          'أكيد، هحوّل المحادثة لحد من الفريق يتابع معاك.'
      } else if (
        intent ===
        'lead'
      ) {
        fallbackReply =
          'تمام، قولي اسمك وابدأ معاك من هنا.'
      }

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
            'message',

          tokens:
            totalTokens,

          metadata: {
            intent,

            finishReason:
              finishReason ||
              'EMPTY_RESPONSE',

            fallback:
              true,
          },
        },
      )

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
          },
        })
    }

    /*
     * Normal Ryan response.
     */
    const reply =
      rawText ||
      'تمام، قولي تفاصيل أكتر وأنا أساعدك.'

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
          'message',

        tokens:
          totalTokens,

        metadata: {
          intent,

          finishReason,
        },
      },
    )

    await saveMessage(
      supabase,
      {
        conversationId:
          conversation.id,

        senderType:
          'ai',

        content:
          reply,
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
