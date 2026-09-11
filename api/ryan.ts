import { createClient } from '@supabase/supabase-js'

const MODEL = 'gemini-3.6-flash'

const tools = [
  {
    functionDeclarations: [
      {
        name: 'create_lead',
        description:
          'إنشاء عميل محتمل جديد في نظام CRM فقط عندما يبدي العميل اهتمامًا حقيقيًا بخدمة أو منتج ولا يكون في مسار حجز موعد.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: {
              type: 'STRING',
              description: 'اسم العميل المحتمل',
            },
            phone: {
              type: 'STRING',
              description: 'رقم هاتف العميل',
            },
            company: {
              type: 'STRING',
              description: 'اسم شركة العميل إن وجد',
            },
            source: {
              type: 'STRING',
              description:
                'مصدر التواصل، مثل واتساب أو فيسبوك أو الموقع',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'create_deal',
        description:
          'إنشاء صفقة بيعية عندما يوافق العميل مبدئيًا على شراء خدمة أو منتج، وليس لمجرد الاستفسار أو طلب حجز.',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: {
              type: 'STRING',
              description:
                'عنوان الصفقة، مثل اسم الخدمة أو المنتج المطلوب',
            },
            value: {
              type: 'NUMBER',
              description:
                'القيمة التقديرية للصفقة بالجنيه المصري إن ذُكرت',
            },
            customer_name: {
              type: 'STRING',
              description:
                'اسم العميل المرتبط بالصفقة',
            },
          },
          required: ['title'],
        },
      },
      {
        name: 'book_appointment',
        description:
          'حجز موعد فقط عندما يطلب العميل حجز موعد. لا تستخدم هذه الأداة قبل معرفة الخدمة والتاريخ والوقت.',
        parameters: {
          type: 'OBJECT',
          properties: {
            customer_name: {
              type: 'STRING',
              description: 'اسم العميل',
            },
            service_name: {
              type: 'STRING',
              description:
                'اسم الخدمة المطلوب حجز موعد لها',
            },
            date: {
              type: 'STRING',
              description:
                'تاريخ الموعد بصيغة YYYY-MM-DD',
            },
            time: {
              type: 'STRING',
              description:
                'وقت الموعد بصيغة HH:MM بنظام 24 ساعة',
            },
          },
          required: [
            'service_name',
            'date',
            'time',
          ],
        },
      },
      {
        name: 'request_human_handoff',
        description:
          'تحويل المحادثة لموظف بشري عندما يطلب العميل صراحة التحدث مع شخص حقيقي أو عندما يكون الطلب معقدًا ولا يمكن التعامل معه بثقة.',
        parameters: {
          type: 'OBJECT',
          properties: {
            customer_name: {
              type: 'STRING',
              description:
                'اسم العميل إن كان معروفًا',
            },
            reason: {
              type: 'STRING',
              description:
                'سبب طلب التحويل باختصار',
            },
          },
          required: ['reason'],
        },
      },
    ],
  },
]

type FunctionResult = {
  success: boolean
  error?: string
  data?: any
}

function normalizeArabicText(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .trim()
}

function detectIntent(
  currentMessage: string,
  history: any[]
) {
  const recentHistory = Array.isArray(history)
    ? history
        .slice(-8)
        .map((item: any) =>
          typeof item?.parts?.[0]?.text === 'string'
            ? item.parts[0].text
            : typeof item?.text === 'string'
              ? item.text
              : ''
        )
        .join(' ')
    : ''

  const text = normalizeArabicText(
    `${recentHistory} ${currentMessage}`
  )

  const bookingKeywords = [
    'احجز',
    'حجز',
    'احجزلي',
    'احجز لي',
    'موعد',
    'ميعاد',
    'حجز موعد',
    'عايز احجز',
    'عاوزه احجز',
    'حابب احجز',
    'اريد حجز',
    'عايز موعد',
    'عاوزه موعد',
  ]

  const handoffKeywords = [
    'موظف',
    'موظفه',
    'خدمه عملاء',
    'خدمة عملاء',
    'شخص حقيقي',
    'حد حقيقي',
    'حد من الفريق',
    'اتكلم مع حد',
    'اتكلم مع شخص',
    'كلموني',
    'كلمني موظف',
    'بني ادم',
  ]

  const dealKeywords = [
    'اشتري',
    'شراء',
    'اتعاقد',
    'تعاقد',
    'عايز الخدمه',
    'عايز الخدمة',
    'عرض سعر',
    'عرض سعر للخدمه',
    'عرض سعر للخدمة',
    'عايز ابدأ',
    'عايز ابدأ معاكم',
  ]

  const isBooking = bookingKeywords.some(
    keyword => text.includes(normalizeArabicText(keyword))
  )

  const isHandoff = handoffKeywords.some(
    keyword => text.includes(normalizeArabicText(keyword))
  )

  const isDeal = dealKeywords.some(
    keyword => text.includes(normalizeArabicText(keyword))
  )

  if (isHandoff) {
    return 'handoff' as const
  }

  if (isBooking) {
    return 'booking' as const
  }

  if (isDeal) {
    return 'deal' as const
  }

  return 'general' as const
}

function getToolsForIntent(intent: ReturnType<typeof detectIntent>) {
  if (intent === 'handoff') {
    return [
      {
        functionDeclarations: [
          tools[0].functionDeclarations[3],
        ],
      },
    ]
  }

  if (intent === 'booking') {
    return [
      {
        functionDeclarations: [
          tools[0].functionDeclarations[2],
        ],
      },
    ]
  }

  if (intent === 'deal') {
    return [
      {
        functionDeclarations: [
          tools[0].functionDeclarations[1],
        ],
      },
    ]
  }

  return tools
}

async function runFunction(
  client: any,
  name: string,
  args: any
): Promise<FunctionResult> {
  try {
    if (name === 'create_lead') {
      const { data, error } = await client.rpc(
        'ai_create_lead',
        {
          p_name: args?.name,
          p_phone: args?.phone || null,
          p_company: args?.company || null,
          p_source: args?.source || 'RYAN AI',
        }
      )

      if (error) {
        console.error(
          'Ryan create_lead RPC error:',
          error
        )

        return {
          success: false,
          error: error.message,
        }
      }

      return {
        success: true,
        data,
      }
    }

    if (name === 'create_deal') {
      const { data, error } = await client.rpc(
        'ai_create_deal',
        {
          p_title: args?.title,
          p_value:
            typeof args?.value === 'number'
              ? args.value
              : Number(args?.value || 0),
          p_customer_name:
            args?.customer_name || null,
        }
      )

      if (error) {
        console.error(
          'Ryan create_deal RPC error:',
          error
        )

        return {
          success: false,
          error: error.message,
        }
      }

      return {
        success: true,
        data,
      }
    }

    if (name === 'book_appointment') {
      if (
        !args?.service_name ||
        !args?.date ||
        !args?.time
      ) {
        return {
          success: false,
          error:
            'بيانات الحجز غير مكتملة',
        }
      }

      const { data, error } = await client.rpc(
        'ai_book_appointment',
        {
          p_customer_name:
            args?.customer_name || null,
          p_service_name:
            args?.service_name,
          p_date:
            args?.date,
          p_time:
            args?.time,
        }
      )

      if (error) {
        console.error(
          'Ryan book_appointment RPC error:',
          error
        )

        return {
          success: false,
          error: error.message,
        }
      }

      return {
        success: true,
        data,
      }
    }

    if (name === 'request_human_handoff') {
      const { data, error } = await client.rpc(
        'ai_request_handoff',
        {
          p_customer_name:
            args?.customer_name || null,
          p_reason:
            args?.reason,
        }
      )

      if (error) {
        console.error(
          'Ryan request_human_handoff RPC error:',
          error
        )

        return {
          success: false,
          error: error.message,
        }
      }

      return {
        success: true,
        data,
      }
    }

    return {
      success: false,
      error: 'أداة غير معروفة',
    }
  } catch (error: any) {
    console.error(
      `Ryan tool "${name}" exception:`,
      error
    )

    return {
      success: false,
      error:
        error?.message ||
        'حدث خطأ أثناء تنفيذ الإجراء',
    }
  }
}

function getToolSuccessReply(
  toolNames: string[],
  argsList: any[]
) {
  const names = new Set(toolNames)

  if (names.has('request_human_handoff')) {
    return 'تمام، حولت المحادثة للفريق المختص وهيتواصل مع حضرتك في أقرب وقت.'
  }

  if (names.has('book_appointment')) {
    const appointmentIndex =
      toolNames.indexOf('book_appointment')

    const appointmentArgs =
      argsList[appointmentIndex] || {}

    const service =
      appointmentArgs?.service_name

    const date =
      appointmentArgs?.date

    const time =
      appointmentArgs?.time

    if (service && date && time) {
      return `تمام، تم تسجيل حجز ${service} يوم ${date} الساعة ${time}.`
    }

    return 'تمام، تم تسجيل الموعد بنجاح.'
  }

  if (names.has('create_deal')) {
    return 'تمام، تم تسجيل الصفقة في نظام المبيعات.'
  }

  if (names.has('create_lead')) {
    return 'تمام، سجلت بيانات حضرتك عندنا في الـCRM.'
  }

  return 'تمام، تم تنفيذ الطلب بنجاح.'
}

function getToolFailureReply(
  toolNames: string[],
  errors: string[]
) {
  console.error(
    'Ryan tool execution failures:',
    {
      toolNames,
      errors,
    }
  )

  if (
    toolNames.includes(
      'request_human_handoff'
    )
  ) {
    return 'حصلت مشكلة بسيطة أثناء تحويل المحادثة للفريق المختص. حاول مرة تانية من فضلك.'
  }

  if (
    toolNames.includes(
      'book_appointment'
    )
  ) {
    return 'حصلت مشكلة أثناء تسجيل الموعد. ممكن نحاول مرة تانية؟'
  }

  if (
    toolNames.includes(
      'create_deal'
    )
  ) {
    return 'حصلت مشكلة أثناء تسجيل الصفقة. ممكن نحاول مرة تانية؟'
  }

  if (
    toolNames.includes(
      'create_lead'
    )
  ) {
    return 'حصلت مشكلة أثناء تسجيل بيانات العميل. ممكن نحاول مرة تانية؟'
  }

  return 'حصلت مشكلة أثناء تنفيذ الطلب. ممكن نحاول مرة تانية؟'
}

async function getOrganization(
  client: any,
  userId: string
) {
  const { data, error } = await client
    .from('users')
    .select(
      'organization_id, full_name, email'
    )
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data?.organization_id) {
    throw new Error(
      'الحساب غير مرتبط بشركة'
    )
  }

  return data
}

async function getRyanEntitlements(
  client: any,
  organizationId: string
) {
  const {
    data: subscription,
    error: subscriptionError,
  } = await client
    .from('subscriptions')
    .select(`
      id,
      organization_id,
      plan,
      status,
      renewal_date,
      plan_id,
      plans (
        id,
        name,
        limits,
        status
      )
    `)
    .eq(
      'organization_id',
      organizationId
    )
    .eq('status', 'active')
    .order('renewal_date', {
      ascending: false,
    })
    .limit(1)
    .maybeSingle()

  if (subscriptionError) {
    throw new Error(
      subscriptionError.message
    )
  }

  const plan = subscription?.plans as
    | {
        id?: string
        name?: string
        limits?:
          | Record<string, unknown>
          | null
        status?: string
      }
    | null
    | undefined

  const limits =
    plan?.limits &&
    typeof plan.limits === 'object'
      ? plan.limits
      : {}

  const aiMessagesRaw =
    limits.ai_messages ??
    limits.ryan_messages ??
    limits.ai_message_limit

  const ryanTokensRaw =
    limits.ryan_tokens ??
    limits.ai_tokens ??
    limits.token_limit

  const aiMessages =
    typeof aiMessagesRaw === 'number'
      ? Math.max(
          0,
          Math.floor(aiMessagesRaw)
        )
      : null

  const ryanTokens =
    typeof ryanTokensRaw === 'number'
      ? Math.max(
          0,
          Math.floor(ryanTokensRaw)
        )
      : null

  return {
    subscriptionId:
      subscription?.id || null,

    planId:
      plan?.id ||
      subscription?.plan_id ||
      null,

    planName:
      plan?.name ||
      subscription?.plan ||
      'الخطة الحالية',

    aiMessages,
    ryanTokens,

    renewalDate:
      subscription?.renewal_date ||
      null,
  }
}

async function getMonthlyUsage(
  client: any,
  organizationId: string
) {
  const {
    data,
    error,
  } = await client.rpc(
    'ryan_monthly_usage',
    {
      p_organization_id:
        organizationId,
    }
  )

  if (error) {
    throw new Error(error.message)
  }

  const row = Array.isArray(data)
    ? data[0]
    : data

  return {
    inputTokens: Number(
      row?.input_tokens || 0
    ),

    outputTokens: Number(
      row?.output_tokens || 0
    ),

    totalTokens: Number(
      row?.total_tokens || 0
    ),

    estimatedCost: Number(
      row?.estimated_cost || 0
    ),

    messageCount: Number(
      row?.message_count || 0
    ),
  }
}

async function recordUsage(
  client: any,
  params: {
    organizationId: string
    conversationId?: string | null
    userId?: string | null
    eventType?:
      | 'message'
      | 'tool_call'
      | 'error'
    inputTokens?: number
    outputTokens?: number
    estimatedCost?: number
    metadata?: Record<
      string,
      unknown
    >
  }
) {
  const {
    organizationId,
    conversationId = null,
    userId = null,
    eventType = 'message',
    inputTokens = 0,
    outputTokens = 0,
    estimatedCost = 0,
    metadata = {},
  } = params

  const { error } =
    await client.rpc(
      'record_ryan_usage',
      {
        p_organization_id:
          organizationId,

        p_conversation_id:
          conversationId,

        p_user_id:
          userId,

        p_model:
          MODEL,

        p_event_type:
          eventType,

        p_input_tokens:
          Math.max(
            0,
            Math.floor(
              Number(
                inputTokens
              ) || 0
            )
          ),

        p_output_tokens:
          Math.max(
            0,
            Math.floor(
              Number(
                outputTokens
              ) || 0
            )
          ),

        p_estimated_cost:
          Math.max(
            0,
            Number(
              estimatedCost
            ) || 0
          ),

        p_metadata:
          metadata,
      }
    )

  if (error) {
    console.error(
      'Ryan usage recording error:',
      error
    )
  }
}

function getUsageMetadata(
  data: any
) {
  const usage =
    data?.usageMetadata || {}

  return {
    inputTokens: Number(
      usage.promptTokenCount ||
        usage.inputTokenCount ||
        0
    ),

    outputTokens: Number(
      usage.candidatesTokenCount ||
        usage.outputTokenCount ||
        0
    ),

    totalTokens: Number(
      usage.totalTokenCount || 0
    ),
  }
}

function estimateCost(
  inputTokens: number,
  outputTokens: number
) {
  const inputPrice =
    Number(
      process.env
        .RYAN_GEMINI_INPUT_COST_PER_1M
    ) || 0

  const outputPrice =
    Number(
      process.env
        .RYAN_GEMINI_OUTPUT_COST_PER_1M
    ) || 0

  return (
    (inputTokens /
      1_000_000) *
      inputPrice +
    (outputTokens /
      1_000_000) *
      outputPrice
  )
}

async function getOrCreateCustomer(
  client: any,
  organizationId: string,
  user: {
    full_name?: string | null
    email?: string | null
  }
) {
  const email =
    user.email?.trim() || null

  const name =
    user.full_name?.trim() ||
    user.email?.split('@')[0] ||
    'عميل RYAN'

  if (email) {
    const {
      data: existing,
      error: lookupError,
    } = await client
      .from('customers')
      .select(
        'id, name, company, phone, email'
      )
      .eq(
        'organization_id',
        organizationId
      )
      .eq(
        'email',
        email
      )
      .limit(1)
      .maybeSingle()

    if (lookupError) {
      throw new Error(
        lookupError.message
      )
    }

    if (existing) {
      return existing
    }
  }

  const {
    data: created,
    error: createError,
  } = await client
    .from('customers')
    .insert({
      organization_id:
        organizationId,

      name,

      email,

      source: 'RYAN AI',

      notes:
        'تم إنشاء العميل تلقائيًا من محادثة RYAN.',
    })
    .select(
      'id, name, company, phone, email'
    )
    .single()

  if (createError) {
    throw new Error(
      createError.message
    )
  }

  return created
}

async function getOrCreateConversation(
  client: any,
  organizationId: string,
  customerId: string,
  conversationId?: string | null
) {
  /*
   * مهم جدًا:
   *
   * إذا أرسل الـFrontend conversationId
   * نحاول استرجاع نفس المحادثة.
   *
   * إذا لم يرسل conversationId فهذا يعني
   * أن المستخدم ضغط "محادثة جديدة".
   *
   * في هذه الحالة ممنوع البحث عن آخر محادثة
   * وإعادة استخدامها.
   */
  if (conversationId) {
    const {
      data,
      error,
    } = await client
      .from('conversations')
      .select(`
        id,
        organization_id,
        customer_id,
        channel,
        handled_by,
        assigned_user_id,
        last_message_at,
        created_at,
        status,
        subject,
        unread_count,
        metadata,
        updated_at
      `)
      .eq(
        'id',
        conversationId
      )
      .eq(
        'organization_id',
        organizationId
      )
      .eq(
        'customer_id',
        customerId
      )
      .eq(
        'channel',
        'website'
      )
      .maybeSingle()

    if (error) {
      throw new Error(
        error.message
      )
    }

    if (data) {
      return data
    }
  }

  /*
   * لا نبحث عن آخر Conversation هنا.
   *
   * كل request بدون conversationId
   * = Conversation جديدة.
   */
  const {
    data: created,
    error: createError,
  } = await client
    .from('conversations')
    .insert({
      organization_id:
        organizationId,

      customer_id:
        customerId,

      channel:
        'website',

      handled_by:
        'ai',

      status:
        'open',

      subject:
        'محادثة RYAN AI',

      unread_count:
        0,

      metadata: {
        source:
          'ryan',

        interface:
          'ryan-dashboard',
      },
    })
    .select(`
      id,
      organization_id,
      customer_id,
      channel,
      handled_by,
      assigned_user_id,
      last_message_at,
      created_at,
      status,
      subject,
      unread_count,
      metadata,
      updated_at
    `)
    .single()

  if (createError) {
    throw new Error(
      createError.message
    )
  }

  return created
}

async function insertMessage(
  client: any,
  conversationId: string,
  senderType:
    | 'customer'
    | 'ai',
  content: string,
  metadata: Record<
    string,
    unknown
  > = {}
) {
  const {
    data,
    error,
  } = await client
    .from('messages')
    .insert({
      conversation_id:
        conversationId,

      sender_type:
        senderType,

      content,

      metadata,
    })
    .select(`
      id,
      conversation_id,
      sender_type,
      content,
      created_at,
      metadata,
      read_at,
      delivered_at,
      external_id
    `)
    .single()

  if (error) {
    throw new Error(
      error.message
    )
  }

  return data
}

export default async function handler(
  req: any,
  res: any
) {
  if (req.method !== 'POST') {
    res.status(405).json({
      error:
        'الطريقة غير مسموحة',
    })

    return
  }

  const apiKey =
    process.env.GEMINI_API_KEY

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL

  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY

  if (
    !apiKey ||
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    res.status(500).json({
      error:
        'الإعدادات غير مكتملة على السيرفر',
    })

    return
  }

  const {
    message,
    history,
    companyName,
    accessToken,
    conversationId,
  } = req.body || {}

  if (
    !message ||
    typeof message !== 'string'
  ) {
    res.status(400).json({
      error:
        'الرسالة مطلوبة',
    })

    return
  }

  const trimmedMessage =
    message.trim()

  if (!trimmedMessage) {
    res.status(400).json({
      error:
        'الرسالة لا يمكن أن تكون فارغة',
    })

    return
  }

  if (!accessToken) {
    res.status(401).json({
      error:
        'يجب تسجيل الدخول',
    })

    return
  }

  const client = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      },
    }
  )

  let organizationId = ''

  let currentConversationId:
    | string
    | null = null

  try {
    const {
      data: authData,
      error: authError,
    } =
      await client.auth.getUser()

    if (
      authError ||
      !authData?.user
    ) {
      res.status(401).json({
        error:
          'جلسة الدخول غير صالحة',
      })

      return
    }

    const dbUser =
      await getOrganization(
        client,
        authData.user.id
      )

    if (
      !dbUser?.organization_id
    ) {
      res.status(403).json({
        error:
          'لا توجد شركة مرتبطة بهذا المستخدم',
      })

      return
    }

    organizationId =
      dbUser.organization_id as string

    const entitlements =
      await getRyanEntitlements(
        client,
        organizationId
      )

    const usage =
      await getMonthlyUsage(
        client,
        organizationId
      )

    if (
      entitlements.aiMessages !== null &&
      usage.messageCount >=
        entitlements.aiMessages
    ) {
      res.status(429).json({
        error:
          'تم الوصول إلى الحد الشهري لاستخدام Ryan في خطتك الحالية.',

        code:
          'RYAN_MONTHLY_MESSAGE_LIMIT',

        plan:
          entitlements.planName,

        limit:
          entitlements.aiMessages,

        used:
          usage.messageCount,

        conversationId:
          conversationId || null,
      })

      return
    }

    if (
      entitlements.ryanTokens !== null &&
      usage.totalTokens >=
        entitlements.ryanTokens
    ) {
      res.status(429).json({
        error:
          'تم الوصول إلى الحد الشهري لاستخدام Tokens الخاص بـ Ryan في خطتك الحالية.',

        code:
          'RYAN_MONTHLY_TOKEN_LIMIT',

        plan:
          entitlements.planName,

        limit:
          entitlements.ryanTokens,

        used:
          usage.totalTokens,

        conversationId:
          conversationId || null,
      })

      return
    }

    const customer =
      await getOrCreateCustomer(
        client,
        organizationId,
        {
          full_name:
            dbUser.full_name ||
            authData.user
              .user_metadata
              ?.full_name ||
            null,

          email:
            dbUser.email ||
            authData.user.email ||
            null,
        }
      )

    const conversation =
      await getOrCreateConversation(
        client,
        organizationId,
        customer.id,
        conversationId
      )

    currentConversationId =
      conversation.id

    if (
      conversation.handled_by ===
      'human'
    ) {
      res.status(409).json({
        error:
          'تم تحويل هذه المحادثة إلى موظف بشري بالفعل.',

        conversationId:
          conversation.id,

        handoff:
          true,
      })

      return
    }

    await insertMessage(
      client,
      conversation.id,
      'customer',
      trimmedMessage,
      {
        source:
          'ryan-dashboard',

        user_id:
          authData.user.id,
      }
    )

    let knowledgeText = ''

    const {
      data: kb,
    } =
      await client
        .from(
          'knowledge_base'
        )
        .select(
          'title, content'
        )
        .limit(15)

    if (
      kb &&
      kb.length > 0
    ) {
      knowledgeText =
        '\n\nمعلومات عن الشركة يجب استخدامها عند الرد. لا تخترع معلومات غير موجودة فيها:\n' +
        kb
          .map(
            (item: any) =>
              `- ${item.title}: ${item.content}`
          )
          .join('\n')
    }

    const today =
      new Date()
        .toISOString()
        .slice(0, 10)

    const detectedIntent =
      detectIntent(
        trimmedMessage,
        history
      )

    const allowedTools =
      getToolsForIntent(
        detectedIntent
      )

    const intentInstruction =
      detectedIntent === 'booking'
        ? `
مهم جدًا: العميل في مسار حجز.
لا تستخدم create_lead إطلاقًا في هذا المسار.
لا تستخدم create_deal لهذا الطلب.
استخدم book_appointment فقط بعد معرفة:
1. اسم الخدمة
2. التاريخ
3. الوقت
إذا كانت أي معلومة ناقصة، اسأل عن معلومة واحدة فقط في كل رسالة.
`
        : detectedIntent === 'handoff'
          ? `
مهم: العميل يريد موظفًا بشريًا.
استخدم request_human_handoff ولا تحاول تسجيل Lead أو Deal.
`
          : detectedIntent === 'deal'
            ? `
العميل يبدو في مسار شراء.
استخدم create_deal فقط إذا كان هناك موافقة مبدئية حقيقية على شراء الخدمة.
`
            : `
لا تنشئ Lead لمجرد أن العميل ذكر اسمه أو رقم هاتفه.
أنشئ Lead فقط عند وجود اهتمام تجاري واضح.
`

    const systemPrompt = `
أنت "ريان"، موظف مبيعات وخدمة عملاء ذكي يعمل داخل نظام إدارة العملاء لصالح شركة ${
      companyName ||
      'الشركة'
    }.

تتحدث باللهجة المصرية العامية بأسلوب ودود ومحترف.

قواعد أسلوبك:
- خاطب العميل بـ"حضرتك" أو "أستاذ/أستاذة" عند الحاجة.
- لا تستخدم "يافندم + اسم".
- لا تكرر تعريف نفسك في كل رسالة.
- اجعل الرد قصيرًا وطبيعيًا، غالبًا جملة واحدة أو جملتين.
- لا تستخدم emojis.
- اسأل سؤالًا واحدًا فقط في كل مرة.
- لا ترسل قوائم طويلة إلا إذا طلب العميل ذلك.
- تعامل كموظف مبيعات حقيقي وليس كروبوت.
- لا تخترع أسعارًا أو خدمات أو مواعيد أو وعودًا غير موجودة في قاعدة المعرفة.
- لا تقل إن أي إجراء تم تنفيذه إلا بعد نجاح الأداة فعلًا.

النهاردة تاريخ ${today}.

${intentInstruction}

عند وجود اهتمام تجاري واضح بخدمة أو منتج:
استخدم create_lead إذا لم يكن العميل في مسار حجز أو تحويل لموظف.

عند الموافقة المبدئية على شراء خدمة أو منتج:
استخدم create_deal.

عند طلب حجز موعد:
book_appointment لها الأولوية على create_lead وcreate_deal.

عند طلب التحدث مع موظف بشري:
استخدم request_human_handoff فورًا.
بعد تنفيذ التحويل، أخبر العميل باختصار أن فريقًا حقيقيًا سيتواصل معه، ولا تحاول مواصلة البيع.

لا تطلب إذنًا قبل استخدام الأدوات.
${knowledgeText}
`

    const safeHistory =
      Array.isArray(history)
        ? history.slice(-20)
        : []

    const contents: any[] = [
      {
        role:
          'user',

        parts: [
          {
            text:
              systemPrompt,
          },
        ],
      },

      {
        role:
          'model',

        parts: [
          {
            text:
              'تمام، فاهم دوري وقواعد المحادثة.',
          },
        ],
      },

      ...safeHistory,

      {
        role:
          'user',

        parts: [
          {
            text:
              trimmedMessage,
          },
        ],
      },
    ]

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`

    const response =
      await fetch(
        geminiUrl,
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({
              contents,

              /*
               * Intent routing:
               * booking لا يرى create_lead أصلًا.
               */
              tools:
                allowedTools,
            }),
        }
      )

    const data =
      await response.json()

    if (!response.ok) {
      const usageMetadata =
        getUsageMetadata(
          data
        )

      await recordUsage(
        client,
        {
          organizationId,

          conversationId:
            conversation.id,

          userId:
            authData.user.id,

          eventType:
            'error',

          inputTokens:
            usageMetadata.inputTokens,

          outputTokens:
            usageMetadata.outputTokens,

          estimatedCost:
            estimateCost(
              usageMetadata.inputTokens,
              usageMetadata.outputTokens
            ),

          metadata: {
            stage:
              'initial_gemini_request',

            status:
              response.status,

            intent:
              detectedIntent,
          },
        }
      )

      res.status(502).json({
        error:
          'تعذر الاتصال بمحرك الذكاء الاصطناعي',

        conversationId:
          conversation.id,
      })

      return
    }

    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalEstimatedCost = 0

    const firstUsage =
      getUsageMetadata(
        data
      )

    totalInputTokens +=
      firstUsage.inputTokens

    totalOutputTokens +=
      firstUsage.outputTokens

    totalEstimatedCost +=
      estimateCost(
        firstUsage.inputTokens,
        firstUsage.outputTokens
      )

    const parts =
      data?.candidates?.[0]
        ?.content?.parts || []

    const functionCallParts =
      parts.filter(
        (part: any) =>
          part?.functionCall?.name
      )

    let actionTaken:
      | string
      | null = null

    const successfulTools: string[] = []
    const failedTools: string[] = []
    const toolErrors: string[] = []
    const toolArgs: any[] = []

    if (
      functionCallParts.length > 0
    ) {
      for (
        const functionCallPart of
          functionCallParts
      ) {
        const functionCall =
          functionCallPart.functionCall

        const name =
          functionCall?.name

        const args =
          functionCall?.args || {}

        if (!name) {
          continue
        }

        /*
         * حماية إضافية:
         * حتى لو Gemini حاول استدعاء Tool
         * غير مسموح بها لهذا الـintent، نرفضها.
         */
        const allowedFunctionNames =
          allowedTools.flatMap(
            (tool: any) =>
              tool.functionDeclarations.map(
                (declaration: any) =>
                  declaration.name
              )
          )

        if (
          !allowedFunctionNames.includes(
            name
          )
        ) {
          console.warn(
            'Ryan blocked invalid tool for detected intent:',
            {
              intent:
                detectedIntent,
              tool:
                name,
            }
          )

          continue
        }

        toolArgs.push(args)

        await recordUsage(
          client,
          {
            organizationId,

            conversationId:
              conversation.id,

            userId:
              authData.user.id,

            eventType:
              'tool_call',

            metadata: {
              tool:
                name,

              intent:
                detectedIntent,

              args,
            },
          }
        )

        const result =
          await runFunction(
            client,
            name,
            args
          )

        if (result.success) {
          successfulTools.push(
            name
          )

          actionTaken =
            actionTaken
              ? `${actionTaken},${name}`
              : name

          if (
            name ===
            'request_human_handoff'
          ) {
            const {
              error:
                handoffUpdateError,
            } =
              await client
                .from(
                  'conversations'
                )
                .update({
                  handled_by:
                    'human',

                  status:
                    'pending',

                  metadata: {
                    ...(conversation.metadata &&
                    typeof conversation.metadata ===
                      'object'
                      ? conversation.metadata
                      : {}),

                    handoff:
                      true,

                    handoff_reason:
                      args?.reason ||
                      null,

                    handoff_requested_at:
                      new Date().toISOString(),
                  },
                })
                .eq(
                  'id',
                  conversation.id
                )
                .eq(
                  'organization_id',
                  organizationId
                )

            if (
              handoffUpdateError
            ) {
              console.error(
                'Ryan handoff update error:',
                handoffUpdateError
              )
            }
          }
        } else {
          failedTools.push(
            name
          )

          toolErrors.push(
            result.error ||
              'فشل تنفيذ الأداة'
          )
        }
      }

      if (
        successfulTools.length > 0 &&
        failedTools.length === 0
      ) {
        const reply =
          getToolSuccessReply(
            successfulTools,
            toolArgs
          )

        await recordUsage(
          client,
          {
            organizationId,

            conversationId:
              conversation.id,

            userId:
              authData.user.id,

            eventType:
              'message',

            inputTokens:
              totalInputTokens,

            outputTokens:
              totalOutputTokens,

            estimatedCost:
              totalEstimatedCost,

            metadata: {
              action:
                actionTaken,

              intent:
                detectedIntent,

              tools:
                successfulTools,

              plan:
                entitlements.planName,

              subscription_id:
                entitlements.subscriptionId,

              plan_id:
                entitlements.planId,
            },
          }
        )

        await insertMessage(
          client,
          conversation.id,
          'ai',
          reply,
          {
            source:
              'ryan',

            action:
              actionTaken,

            intent:
              detectedIntent,

            tool_results: {
              successful:
                successfulTools,

              failed:
                failedTools,
            },

            usage: {
              input_tokens:
                totalInputTokens,

              output_tokens:
                totalOutputTokens,

              total_tokens:
                totalInputTokens +
                totalOutputTokens,

              estimated_cost:
                totalEstimatedCost,
            },
          }
        )

        res.status(200).json({
          reply,

          actionTaken,

          conversationId:
            conversation.id,

          usage: {
            inputTokens:
              totalInputTokens,

            outputTokens:
              totalOutputTokens,

            totalTokens:
              totalInputTokens +
              totalOutputTokens,
          },
        })

        return
      }

      if (
        failedTools.length > 0
      ) {
        const reply =
          getToolFailureReply(
            failedTools,
            toolErrors
          )

        await recordUsage(
          client,
          {
            organizationId,

            conversationId:
              conversation.id,

            userId:
              authData.user.id,

            eventType:
              'error',

            inputTokens:
              totalInputTokens,

            outputTokens:
              totalOutputTokens,

            estimatedCost:
              totalEstimatedCost,

            metadata: {
              stage:
                'tool_execution',

              intent:
                detectedIntent,

              successfulTools,

              failedTools,

              toolErrors,
            },
          }
        )

        await insertMessage(
          client,
          conversation.id,
          'ai',
          reply,
          {
            source:
              'ryan',

            action:
              actionTaken,

            intent:
              detectedIntent,

            tool_results: {
              successful:
                successfulTools,

              failed:
                failedTools,

              errors:
                toolErrors,
            },
          }
        )

        res.status(200).json({
          reply,

          actionTaken,

          conversationId:
            conversation.id,

          toolError:
            true,
        })

        return
      }
    }

    const reply =
      parts?.find(
        (part: any) =>
          typeof part?.text ===
            'string' &&
          part.text.trim()
      )?.text?.trim()

    if (!reply) {
      await recordUsage(
        client,
        {
          organizationId,

          conversationId:
            conversation.id,

          userId:
            authData.user.id,

          eventType:
            'error',

          inputTokens:
            totalInputTokens,

          outputTokens:
            totalOutputTokens,

          estimatedCost:
            totalEstimatedCost,

          metadata: {
            stage:
              'empty_gemini_reply',

            intent:
              detectedIntent,
          },
        }
      )

      res.status(502).json({
        error:
          'لم يتم استلام رد من الذكاء الاصطناعي',

        conversationId:
          conversation.id,

        actionTaken,
      })

      return
    }

    await recordUsage(
      client,
      {
        organizationId,

        conversationId:
          conversation.id,

        userId:
          authData.user.id,

        eventType:
          'message',

        inputTokens:
          totalInputTokens,

        outputTokens:
          totalOutputTokens,

        estimatedCost:
          totalEstimatedCost,

        metadata: {
          action:
            actionTaken,

          intent:
            detectedIntent,

          plan:
            entitlements.planName,

          subscription_id:
            entitlements.subscriptionId,

          plan_id:
            entitlements.planId,
        },
      }
    )

    await insertMessage(
      client,
      conversation.id,
      'ai',
      reply,
      {
        source:
          'ryan',

        action:
          actionTaken,

        intent:
          detectedIntent,

        usage: {
          input_tokens:
            totalInputTokens,

          output_tokens:
            totalOutputTokens,

          total_tokens:
            totalInputTokens +
            totalOutputTokens,

          estimated_cost:
            totalEstimatedCost,
        },
      }
    )

    res.status(200).json({
      reply,

      actionTaken,

      conversationId:
        conversation.id,

      usage: {
        inputTokens:
          totalInputTokens,

        outputTokens:
          totalOutputTokens,

        totalTokens:
          totalInputTokens +
          totalOutputTokens,
      },
    })
  } catch (error: any) {
    console.error(
      'Ryan API error:',
      error
    )

    if (
      organizationId
    ) {
      try {
        await recordUsage(
          client,
          {
            organizationId,

            conversationId:
              currentConversationId,

            eventType:
              'error',

            metadata: {
              message:
                error?.message ||
                'unknown_error',
            },
          }
        )
      } catch (
        usageError
      ) {
        console.error(
          'Ryan error usage recording failed:',
          usageError
        )
      }
    }

    res.status(500).json({
      error:
        error?.message ||
        'حدث خطأ غير متوقع',

      conversationId:
        currentConversationId,
    })
  }
}
