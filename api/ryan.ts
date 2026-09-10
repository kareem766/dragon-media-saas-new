import { createClient } from '@supabase/supabase-js'

const tools = [
  {
    functionDeclarations: [
      {
        name: 'create_lead',
        description:
          'إنشاء عميل محتمل جديد في نظام CRM عند إبداء عميل اهتمامه بخدمات أو منتجات الشركة',
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
              description: 'مصدر التواصل، مثل واتساب أو فيسبوك أو الموقع',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'create_deal',
        description:
          'إنشاء صفقة بيعية جديدة في مسار المبيعات عندما يوافق العميل مبدئيًا على شراء خدمة أو منتج معين',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: {
              type: 'STRING',
              description: 'عنوان الصفقة، مثل اسم الخدمة أو المنتج المطلوب',
            },
            value: {
              type: 'NUMBER',
              description: 'القيمة التقديرية للصفقة بالجنيه المصري إن ذُكرت',
            },
            customer_name: {
              type: 'STRING',
              description: 'اسم العميل المرتبط بالصفقة إن كان موجودًا في النظام كعميل',
            },
          },
          required: ['title'],
        },
      },
      {
        name: 'book_appointment',
        description:
          'حجز موعد للعميل عندما يطلب حجز استشارة أو موعد لخدمة معينة',
        parameters: {
          type: 'OBJECT',
          properties: {
            customer_name: {
              type: 'STRING',
              description: 'اسم العميل',
            },
            service_name: {
              type: 'STRING',
              description: 'اسم الخدمة المطلوب حجز موعد لها',
            },
            date: {
              type: 'STRING',
              description: 'تاريخ الموعد بصيغة YYYY-MM-DD',
            },
            time: {
              type: 'STRING',
              description: 'وقت الموعد بصيغة HH:MM بنظام 24 ساعة',
            },
          },
          required: ['date', 'time'],
        },
      },
      {
        name: 'request_human_handoff',
        description:
          'تحويل المحادثة لموظف بشري عندما يطلب العميل صراحة التحدث مع شخص حقيقي، أو عندما يكون الطلب معقدًا جدًا ولا يمكنك التعامل معه بثقة',
        parameters: {
          type: 'OBJECT',
          properties: {
            customer_name: {
              type: 'STRING',
              description: 'اسم العميل إن كان معروفًا',
            },
            reason: {
              type: 'STRING',
              description: 'سبب طلب التحويل باختصار',
            },
          },
          required: ['reason'],
        },
      },
    ],
  },
]

async function runFunction(
  client: any,
  name: string,
  args: any
) {
  if (name === 'create_lead') {
    const { error } = await client.rpc('ai_create_lead', {
      p_name: args.name,
      p_phone: args.phone || null,
      p_company: args.company || null,
      p_source: args.source || 'RYAN AI',
    })

    return { error }
  }

  if (name === 'create_deal') {
    const { error } = await client.rpc('ai_create_deal', {
      p_title: args.title,
      p_value: args.value || 0,
      p_customer_name: args.customer_name || null,
    })

    return { error }
  }

  if (name === 'book_appointment') {
    const { error } = await client.rpc('ai_book_appointment', {
      p_customer_name: args.customer_name || null,
      p_service_name: args.service_name || null,
      p_date: args.date,
      p_time: args.time,
    })

    return { error }
  }

  if (name === 'request_human_handoff') {
    const { error } = await client.rpc('ai_request_handoff', {
      p_customer_name: args.customer_name || null,
      p_reason: args.reason,
    })

    return { error }
  }

  return {
    error: {
      message: 'أداة غير معروفة',
    },
  }
}

async function getOrganization(
  client: any,
  userId: string
) {
  const { data, error } = await client
    .from('users')
    .select('organization_id, full_name, email')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data?.organization_id) {
    throw new Error('الحساب غير مرتبط بشركة')
  }

  return data
}

async function getOrCreateCustomer(
  client: any,
  organizationId: string,
  user: {
    full_name?: string | null
    email?: string | null
  }
) {
  const email = user.email?.trim() || null
  const name =
    user.full_name?.trim() ||
    user.email?.split('@')[0] ||
    'عميل RYAN'

  if (email) {
    const { data: existing, error: lookupError } = await client
      .from('customers')
      .select('id, name, company, phone, email')
      .eq('organization_id', organizationId)
      .eq('email', email)
      .limit(1)
      .maybeSingle()

    if (lookupError) {
      throw new Error(lookupError.message)
    }

    if (existing) {
      return existing
    }
  }

  const { data: created, error: createError } = await client
    .from('customers')
    .insert({
      organization_id: organizationId,
      name,
      email,
      source: 'RYAN AI',
      notes: 'تم إنشاء العميل تلقائيًا من محادثة RYAN.',
    })
    .select('id, name, company, phone, email')
    .single()

  if (createError) {
    throw new Error(createError.message)
  }

  return created
}

async function getOrCreateConversation(
  client: any,
  organizationId: string,
  customerId: string,
  conversationId?: string | null
) {
  if (conversationId) {
    const { data, error } = await client
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
      .eq('id', conversationId)
      .eq('organization_id', organizationId)
      .eq('customer_id', customerId)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    if (data) {
      return data
    }
  }

  const { data: existing, error: existingError } = await client
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
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)
    .eq('channel', 'website')
    .eq('status', 'open')
    .order('created_at', {
      ascending: false,
    })
    .limit(1)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existing) {
    return existing
  }

  const { data: created, error: createError } = await client
    .from('conversations')
    .insert({
      organization_id: organizationId,
      customer_id: customerId,
      channel: 'website',
      handled_by: 'ai',
      status: 'open',
      subject: 'محادثة RYAN AI',
      unread_count: 0,
      metadata: {
        source: 'ryan',
        interface: 'ryan-dashboard',
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
    throw new Error(createError.message)
  }

  return created
}

async function insertMessage(
  client: any,
  conversationId: string,
  senderType: 'customer' | 'ai',
  content: string,
  metadata: Record<string, unknown> = {}
) {
  const { data, error } = await client
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: senderType,
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
    throw new Error(error.message)
  }

  return data
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({
      error: 'الطريقة غير مسموحة',
    })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!apiKey || !supabaseUrl || !supabaseAnonKey) {
    res.status(500).json({
      error: 'الإعدادات غير مكتملة على السيرفر',
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

  if (!message || typeof message !== 'string') {
    res.status(400).json({
      error: 'الرسالة مطلوبة',
    })
    return
  }

  if (!accessToken) {
    res.status(401).json({
      error: 'يجب تسجيل الدخول',
    })
    return
  }

  const client = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  )

  try {
    const {
      data: authData,
      error: authError,
    } = await client.auth.getUser()

    if (authError || !authData?.user) {
      res.status(401).json({
        error: 'جلسة الدخول غير صالحة',
      })
      return
    }

    const dbUser = await getOrganization(
      client,
      authData.user.id
    )

    const organizationId = dbUser.organization_id

    const customer = await getOrCreateCustomer(
      client,
      organizationId,
      {
        full_name:
          dbUser.full_name ||
          authData.user.user_metadata?.full_name ||
          null,
        email:
          dbUser.email ||
          authData.user.email ||
          null,
      }
    )

    const conversation = await getOrCreateConversation(
      client,
      organizationId,
      customer.id,
      conversationId
    )

    if (conversation.handled_by === 'human') {
      res.status(409).json({
        error:
          'تم تحويل هذه المحادثة إلى موظف بشري بالفعل.',
        conversationId: conversation.id,
        handoff: true,
      })
      return
    }

    await insertMessage(
      client,
      conversation.id,
      'customer',
      message.trim(),
      {
        source: 'ryan-dashboard',
        user_id: authData.user.id,
      }
    )

    let knowledgeText = ''

    const {
      data: kb,
    } = await client
      .from('knowledge_base')
      .select('title, content')
      .limit(15)

    if (kb && kb.length > 0) {
      knowledgeText =
        '\n\nمعلومات عن الشركة يجب استخدامها عند الرد. لا تخترع معلومات غير موجودة فيها:\n' +
        kb
          .map(
            (item: any) =>
              `- ${item.title}: ${item.content}`
          )
          .join('\n')
    }

    const today = new Date()
      .toISOString()
      .slice(0, 10)

    const systemPrompt = `
أنت "ريان"، موظف مبيعات وخدمة عملاء ذكي يعمل داخل نظام إدارة العملاء لصالح شركة ${
      companyName || 'الشركة'
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
- لا تخترع أسعارًا أو خدمات أو وعودًا غير موجودة في قاعدة المعرفة.

النهاردة تاريخ ${today}.

عند إبداء العميل اهتمامًا حقيقيًا بخدمة أو منتج:
استخدم create_lead لتسجيل العميل في CRM.

عند الموافقة المبدئية على شراء خدمة أو منتج:
استخدم create_deal.

عند طلب حجز موعد:
استخدم book_appointment.
إذا كان التاريخ أو الوقت غير واضح، اسأل العميل عنه أولًا.

عند طلب التحدث مع موظف بشري:
استخدم request_human_handoff فورًا.
بعد تنفيذ التحويل، أخبر العميل باختصار أن فريقًا حقيقيًا سيتواصل معه، ولا تحاول مواصلة البيع.

لا تطلب إذنًا قبل استخدام الأدوات.
${knowledgeText}
`

    const safeHistory = Array.isArray(history)
      ? history.slice(-20)
      : []

    const contents: any[] = [
      {
        role: 'user',
        parts: [
          {
            text: systemPrompt,
          },
        ],
      },
      {
        role: 'model',
        parts: [
          {
            text: 'تمام، فاهم دوري.',
          },
        ],
      },
      ...safeHistory,
      {
        role: 'user',
        parts: [
          {
            text: message.trim(),
          },
        ],
      },
    ]

    let response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          tools,
        }),
      }
    )

    let data = await response.json()

    if (!response.ok) {
      res.status(502).json({
        error: 'تعذر الاتصال بمحرك الذكاء الاصطناعي',
        details: data,
        conversationId: conversation.id,
      })
      return
    }

    let parts =
      data?.candidates?.[0]?.content?.parts

    let actionTaken: string | null = null

    const functionCallPart = parts?.find(
      (part: any) => part.functionCall
    )

    if (functionCallPart) {
      const {
        name,
        args,
      } = functionCallPart.functionCall

      const {
        error: functionError,
      } = await runFunction(
        client,
        name,
        args
      )

      const functionResult = functionError
        ? {
            success: false,
            error: functionError.message,
          }
        : {
            success: true,
          }

      if (!functionError) {
        actionTaken = name
      }

      if (name === 'request_human_handoff' && !functionError) {
        await client
          .from('conversations')
          .update({
            handled_by: 'human',
            status: 'pending',
            metadata: {
              ...conversation.metadata,
              handoff: true,
              handoff_reason:
                args?.reason || null,
            },
          })
          .eq('id', conversation.id)
          .eq('organization_id', organizationId)
      }

      contents.push({
        role: 'model',
        parts: [functionCallPart],
      })

      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name,
              response: functionResult,
            },
          },
        ],
      })

      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents,
            tools,
          }),
        }
      )

      data = await response.json()

      if (!response.ok) {
        res.status(502).json({
          error:
            'تم تنفيذ الإجراء لكن تعذر استلام رد Ryan النهائي',
          details: data,
          conversationId: conversation.id,
          actionTaken,
        })
        return
      }

      parts =
        data?.candidates?.[0]?.content?.parts
    }

    const reply = parts?.find(
      (part: any) => part.text
    )?.text

    if (!reply) {
      res.status(502).json({
        error:
          'لم يتم استلام رد من الذكاء الاصطناعي',
        details: data,
        conversationId: conversation.id,
        actionTaken,
      })
      return
    }

    await insertMessage(
      client,
      conversation.id,
      'ai',
      reply,
      {
        source: 'ryan',
        action: actionTaken,
      }
    )

    res.status(200).json({
      reply,
      actionTaken,
      conversationId: conversation.id,
    })
  } catch (error: any) {
    console.error('Ryan API error:', error)

    res.status(500).json({
      error:
        error?.message ||
        'حدث خطأ غير متوقع',
    })
  }
}
