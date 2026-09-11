import type { VercelRequest, VercelResponse } from ‘@vercel/node’
import { createClient, type SupabaseClient } from ‘@supabase/supabase-js’

const MODEL = process.env.RYAN_GEMINI_MODEL || ‘gemini-3.6-flash’

const GEMINI_TIMEOUT_MS = 25_000
const USAGE_TIMEOUT_MS = 2_000
const HISTORY_LIMIT = 12

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const geminiApiKey = process.env.GEMINI_API_KEY

type RyanIntent =
| ‘booking’
| ‘handoff’
| ‘deal’
| ‘general’

type RyanToolName =
| ‘create_lead’
| ‘create_deal’
| ‘book_appointment’
| ‘request_human_handoff’

type RyanHistoryItem = {
role?: string
sender?: string
text?: string
content?: string
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
name: ‘create_lead’,
description:
‘Create a sales lead only when the customer shows genuine interest in the company services. Never use this merely because the customer provided a name or phone number. Never use this during booking intent.’,
parameters: {
type: ‘OBJECT’,
properties: {
name: {
type: ‘STRING’,
description: ‘Customer name’,
},
phone: {
type: ‘STRING’,
description: ‘Customer phone number’,
},
service: {
type: ‘STRING’,
description: ‘Requested service’,
},
activity: {
type: ‘STRING’,
description: ‘Customer business/activity’,
},
goal: {
type: ‘STRING’,
description: ‘Customer goal’,
},
notes: {
type: ‘STRING’,
description: ‘Additional notes’,
},
},
required: [‘name’],
},
},

create_deal: {
name: ‘create_deal’,
description:
‘Create a deal only when the customer clearly wants to purchase or contract for a service.’,
parameters: {
type: ‘OBJECT’,
properties: {
name: {
type: ‘STRING’,
},
phone: {
type: ‘STRING’,
},
service: {
type: ‘STRING’,
},
value: {
type: ‘NUMBER’,
},
notes: {
type: ‘STRING’,
},
},
required: [‘name’],
},
},

book_appointment: {
name: ‘book_appointment’,
description:
‘Book an appointment only when service_name, date, and time are all known. Never claim success unless the booking function succeeds.’,
parameters: {
type: ‘OBJECT’,
properties: {
service_name: {
type: ‘STRING’,
description: ‘The service the customer wants to book’,
},
date: {
type: ‘STRING’,
description: ‘Appointment date’,
},
time: {
type: ‘STRING’,
description: ‘Appointment time’,
},
},
required: [‘service_name’, ‘date’, ‘time’],
},
},

request_human_handoff: {
name: ‘request_human_handoff’,
description:
‘Transfer the conversation to a human team member when the customer explicitly asks for a human or human assistance.’,
parameters: {
type: ‘OBJECT’,
properties: {
reason: {
type: ‘STRING’,
description: ‘Reason for handoff’,
},
},
required: [‘reason’],
},
},
} as const

const BOOKING_KEYWORDS = [
‘احجز’,
‘حجز’,
‘حجزت’,
‘موعد’,
‘ميعاد’,
‘احجزلي’,
‘عايز احجز’,
‘حابب احجز’,
‘اريد حجز’,
‘ممكن احجز’,
‘عايز احجز موعد’,
‘حجز موعد’,
]

const HANDOFF_KEYWORDS = [
‘موظف’,
‘خدمة عملاء’,
‘حد من الفريق’,
‘اتكلم مع شخص’,
‘بني آدم’,
‘بني ادم’,
‘شخص حقيقي’,
‘موظف حقيقي’,
]

const DEAL_KEYWORDS = [
‘شراء’,
‘اشتري’,
‘عايز الخدمة’,
‘اتعاقد’,
‘عرض سعر’,
‘عايز أشتري’,
‘عايز اشتري’,
‘التعاقد’,
]

const BOOKING_CONTEXT_KEYWORDS = [
‘الخدمة’,
‘اسم الخدمة’,
‘تاريخ’,
‘التاريخ’,
‘يوم’,
‘ميعاد’,
‘موعد’,
‘وقت’,
‘الساعة’,
‘الوقت’,
]

function normalizeArabic(value: string) {
return value
.toLowerCase()
.replace(/[إأآ]/g, ‘ا’)
.replace(/ى/g, ‘ي’)
.replace(/ة/g, ‘ه’)
.replace(/[ًٌٍَُِّْـ]/g, ‘’)
.replace(/\s+/g, ’ ’)
.trim()
}

function containsKeyword(
text: string,
keywords: string[],
) {
const normalized = normalizeArabic(text)

return keywords.some((keyword) =>
normalized.includes(normalizeArabic(keyword)),
)
}

function getHistoryText(
history: RyanHistoryItem[],
count = 6,
) {
return history
.slice(-count)
.map(
(item) =>
item.text ||
item.content ||
‘’,
)
.filter(Boolean)
.join(’ ’)
}

function isRecentBookingContext(
history: RyanHistoryItem[],
) {
const recent = history.slice(-4)

return recent.some((item) => {
const text =
item.text ||
item.content ||
‘’

return containsKeyword(
  text,
  BOOKING_CONTEXT_KEYWORDS,
)

})
}

function getLatestAssistantMessage(
history: RyanHistoryItem[],
) {
for (
let index = history.length - 1;
index >= 0;
index–
) {
const item = history[index]

const isAssistant =
  item.role === 'assistant' ||
  item.role === 'model' ||
  item.sender === 'assistant' ||
  item.sender === 'model' ||
  item.sender === 'ai'
if (isAssistant) {
  return (
    item.text ||
    item.content ||
    ''
  )
}

}

return ‘’
}

function extractCustomerName(
message: string,
) {
const match = message.match(
/(?:اسمي|انا اسمي|أنا اسمي)\s+([^\d،,.\n]+)/
)

if (!match?.[1]) {
return null
}

return match[1]
.trim()
.split(/\s+/)
.slice(0, 3)
.join(’ ’)
}

function getBookingStep(
message: string,
history: RyanHistoryItem[],
) {
const latestAssistant =
normalizeArabic(
getLatestAssistantMessage(
history,
),
)

/*

* The latest Ryan question is the most reliable
* indicator of what the customer is answering.
    */

if (
latestAssistant.includes(
‘تحب تحجز انهي خدمه’,
) ||
latestAssistant.includes(
‘تحب تحجز اي خدمه’,
) ||
latestAssistant.includes(
‘انهي خدمه’,
) ||
latestAssistant.includes(
‘اي خدمه’,
)
) {
return ‘date’
}

if (
latestAssistant.includes(
‘التاريخ’,
) ||
latestAssistant.includes(
‘يوم ايه’,
) ||
latestAssistant.includes(
‘يوم اي’,
) ||
latestAssistant.includes(
‘عايز تحجز يوم’,
) ||
latestAssistant.includes(
‘تحب الحجز يوم’,
)
) {
return ‘time’
}

if (
latestAssistant.includes(
‘الوقت’,
) ||
latestAssistant.includes(
‘الساعه’,
) ||
latestAssistant.includes(
‘ساعة’,
) ||
latestAssistant.includes(
‘ميعاد الحجز’,
)
) {
return ‘ready’
}

/*

* If Ryan did not previously ask a booking question,
* this is the beginning of the booking flow.
    */
    return ‘service’
    }

function detectIntent(
message: string,
history: RyanHistoryItem[] = [],
): RyanIntent {
/*

* IMPORTANT:
* The current user message has priority.
* We only use recent history when the current message
* is clearly a continuation of an existing booking flow.
    */

if (containsKeyword(message, HANDOFF_KEYWORDS)) {
return ‘handoff’
}

if (containsKeyword(message, BOOKING_KEYWORDS)) {
return ‘booking’
}

if (containsKeyword(message, DEAL_KEYWORDS)) {
return ‘deal’
}

/*

* Example:
* Ryan: “تحب تحجز أي خدمة؟”
* User: “إدارة صفحات”
* The current message does not contain “حجز”,
* but the recent conversation clearly does.
    */
    if (isRecentBookingContext(history)) {
    return ‘booking’
    }

return ‘general’
}

function getToolsForIntent(
intent: RyanIntent,
) {
if (intent === ‘booking’) {
return [
TOOL_DEFINITIONS.book_appointment,
]
}

if (intent === ‘handoff’) {
return [
TOOL_DEFINITIONS.request_human_handoff,
]
}

if (intent === ‘deal’) {
return [
TOOL_DEFINITIONS.create_deal,
TOOL_DEFINITIONS.create_lead,
]
}

/*

* Keep general mode conservative.
* Booking/handoff/deal should normally be triggered
* by deterministic intent detection first.
    */
    return [
    TOOL_DEFINITIONS.create_lead,
    TOOL_DEFINITIONS.create_deal,
    TOOL_DEFINITIONS.request_human_handoff,
    ]
    }

function getSupabaseClient(
accessToken: string,
) {
if (!supabaseUrl || !supabaseAnonKey) {
throw new Error(
‘Supabase environment variables are missing’,
)
}

/*

* Important:
* Use the authenticated user’s JWT for all database
* operations performed by Ryan.
* This allows Supabase RLS to evaluate auth.uid()
* against the actual signed-in user.
    */
    return createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
    global: {
    headers: {
    Authorization: Bearer ${accessToken},
    },
    },
    auth: {
    persistSession: false,
    autoRefreshToken: false,
    },
    },
    ) as SupabaseClient<any, ‘public’, any>
    }

async function authenticateUser(
accessToken: string,
) {
if (!supabaseUrl || !supabaseAnonKey) {
throw new Error(
‘Supabase environment variables are missing’,
)
}

const authClient = createClient(
supabaseUrl,
supabaseAnonKey,
)

const {
data: {
user,
},
error,
} = await authClient.auth.getUser(
accessToken,
)

if (error || !user) {
return null
}

return user
}

async function getOrganizationId(
supabase: SupabaseClient<any, ‘public’, any>,
userId: string,
) {
/*

* Current Dragon Media schema uses users.organization_id.
* Keep organization lookup server-side and never trust
* an organization id coming from the browser.
    */
    const { data, error } = await supabase
    .from(‘users’)
    .select(‘organization_id’)
    .eq(‘id’, userId)
    .maybeSingle()

if (error) {
throw error
}

return data?.organization_id || null
}

async function getRyanEntitlements(
supabase: SupabaseClient<any, ‘public’, any>,
organizationId: string,
) {
const { data, error } = await supabase
.from(‘subscriptions’)
.select(
id, status, plan_id, plans ( id, name, limits, features ),
)
.eq(
‘organization_id’,
organizationId,
)
.eq(‘status’, ‘active’)
.order(‘created_at’, {
ascending: false,
})
.limit(1)
.maybeSingle()

if (error) {
console.error(
‘Ryan entitlement error:’,
error,
)

return null

}

if (!data) {
return null
}

const plan = Array.isArray(data.plans)
? data.plans[0]
: data.plans

const limits = plan?.limits || {}

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
planName: plan?.name || null,
messageLimit,
tokenLimit,
}
}

async function getMonthlyUsage(
supabase: SupabaseClient<any, ‘public’, any>,
organizationId: string,
) {
const {
data,
error,
} = await supabase.rpc(
‘ryan_monthly_usage’,
{
p_organization_id:
organizationId,
},
)

if (error) {
console.error(
‘Ryan monthly usage error:’,
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
supabase: SupabaseClient<any, ‘public’, any>,
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
‘record_ryan_usage’,
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
‘Ryan usage recording error:’,
error,
)
}
}

function recordUsageNonBlocking(
supabase: SupabaseClient<any, ‘public’, any>,
payload: Parameters<
typeof recordUsage

[1],
) {
void recordUsage(
supabase,
payload,
).catch((error) => {
console.error(
‘Ryan background usage recording error:’,
error,
)
})
}

async function getOrCreateCustomer(
supabase: SupabaseClient<any, ‘public’, any>,
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
.from(‘customers’)
.select(’*’)
.eq(
‘organization_id’,
organizationId,
)
.eq(
‘email’,
normalizedEmail,
)
.order(‘created_at’, {
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
.from(‘customers’)
.insert({
organization_id:
organizationId,

  name:
    name ||
    normalizedEmail.split('@')[0] ||
    'Website Visitor',
  email:
    normalizedEmail,
  source: 'website',
})
.select('*')
.single()

if (error) {
/*
* If a unique constraint exists and another request
* created the customer at the same time, retry lookup.
/
const retry = await supabase
.from(‘customers’)
.select(’’)
.eq(
‘organization_id’,
organizationId,
)
.eq(
‘email’,
normalizedEmail,
)
.order(‘created_at’, {
ascending: false,
})
.limit(1)
.maybeSingle()

if (!retry.error && retry.data) {
  return retry.data
}
throw error

}

return data
}

async function getOrCreateConversation(
supabase: SupabaseClient<any, ‘public’, any>,
organizationId: string,
customerId: string,
conversationId?: string | null,
) {
/*

* If the frontend sends a conversation id,
* restore ONLY that exact conversation.
    */

if (conversationId) {
const {
data,
error,
} = await supabase
.from(‘conversations’)
.select(’*’)
.eq(
‘id’,
conversationId,
)
.eq(
‘organization_id’,
organizationId,
)
.eq(
‘customer_id’,
customerId,
)
.eq(
‘channel’,
‘website’,
)
.maybeSingle()

if (error) {
  throw error
}
if (data) {
  return data
}

}

/*

* IMPORTANT:
* Never fallback to the latest conversation.
* No conversation id means a genuinely new conversation.
    */

const {
data,
error,
} = await supabase
.from(‘conversations’)
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
supabase: SupabaseClient<any, ‘public’, any>,
functionName: RyanToolName,
args: Record<string, unknown>,
organizationId: string,
conversationId: string,
userId: string,
) {
if (
functionName ===
‘create_lead’
) {
const {
data,
error,
} = await supabase.rpc(
‘ai_create_lead’,
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
‘create_deal’
) {
const {
data,
error,
} = await supabase.rpc(
‘ai_create_deal’,
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
‘book_appointment’
) {
const serviceName =
String(
args.service_name ||
‘’,
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
    type: 'booking',
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
  type: 'booking',
  data,
}

}

if (
functionName ===
‘request_human_handoff’
) {
const {
data,
error,
} = await supabase.rpc(
‘ai_request_handoff’,
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
Unsupported Ryan function: ${functionName},
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
method: ‘POST’,

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
): Promise {
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
Gemini request failed with status ${status}

console.error(
‘Gemini error message:’,
message,
)

if (
status === 401 ||
status === 403
) {
return ‘مفتاح محرك الذكاء الاصطناعي غير صالح أو غير مصرح به.’
}

if (status === 404) {
return ‘موديل الذكاء الاصطناعي غير متاح حاليًا.’
}

if (status === 429) {
return ‘تم الوصول إلى حد استخدام محرك الذكاء الاصطناعي. حاول مرة أخرى بعد قليل.’
}

if (status >= 500) {
return ‘محرك الذكاء الاصطناعي غير متاح مؤقتًا. حاول مرة أخرى.’
}

return ‘تعذر معالجة الرسالة حاليًا.’
}

function buildSystemPrompt(
companyName: string,
knowledge: Array<
Record<string, unknown>

,
) {
const knowledgeText =
knowledge
.map((item) => {
const title =
String(
item.title || ‘’,
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
أنت Ryan، موظف مبيعات وخدمة عملاء حقيقي داخل شركة ${
companyName ||
‘الشركة’
}.

تحدث باللهجة المصرية بطريقة طبيعية ومهنية ومحترمة.

القواعد الأساسية:

* رد قصير ومباشر.
* غالبًا جملة واحدة أو جملتين فقط.
* لا تستخدم إيموجي.
* اسأل سؤالًا واحدًا فقط في كل رسالة.
* لا تكرر مقدمة المحادثة.
* لا تقل إنك ذكاء اصطناعي إلا إذا سُئلت مباشرة.
* لا تستخدم “يافندم” أو “أستاذ” بشكل مبالغ فيه.
* لا تخترع أسعارًا أو خدمات أو مواعيد.
* لا تدعي تنفيذ أي عملية إلا إذا نجحت الأداة فعلًا.

أولوية الحجز:
إذا كان العميل يريد حجز موعد، فالحجز أهم من إنشاء Lead أو Deal.

لا تستخدم create_lead لمجرد أن العميل ذكر:

* اسمه
* رقم هاتفه
* أنه مهتم
* أنه يريد معرفة التفاصيل

في حالة الحجز:
اجمع البيانات الناقصة بالترتيب:

1. الخدمة
2. التاريخ
3. الوقت

اسأل عن عنصر واحد فقط في كل رسالة.

لا تستدعِ book_appointment إلا عندما تكون:
service_name
و date
و time
موجودة بالفعل.

بعد نجاح الحجز فقط أخبر العميل أن الحجز تم.

إذا طلب العميل التحدث مع موظف حقيقي:
استخدم request_human_handoff.

إذا أظهر العميل نية شراء أو تعاقد واضحة:
يمكن استخدام create_deal.

إذا كان مجرد استفسار:
لا تنشئ Lead أو Deal تلقائيًا.

معلومات الشركة وقاعدة المعرفة:
${
knowledgeText ||
‘لا توجد معلومات إضافية متاحة حاليًا.’
}
`
}

export default async function handler(
req: VercelRequest,
res: VercelResponse,
) {
if (
req.method !== ‘POST’
) {
return res
.status(405)
.json({
error:
‘Method not allowed’,
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
‘Ryan configuration is incomplete’,
})
}

const {
message,
history = [],
companyName = ‘’,
accessToken,
conversationId = null,
} = req.body || {}

if (
!message ||
typeof message !==
‘string’
) {
return res
.status(400)
.json({
error:
‘Message is required’,
})
}

if (
!accessToken ||
typeof accessToken !==
‘string’
) {
return res
.status(401)
.json({
error:
‘Authentication required’,
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
/*
 * Use the authenticated JWT for all subsequent
 * Supabase operations.
 */
const supabase =
  getSupabaseClient(
    accessToken,
  )
/*
 * Organization comes from the authenticated user's
 * database record — never from the request body.
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
const safeHistory: RyanHistoryItem[] =
  Array.isArray(history)
    ? history
        .filter(
          (item) =>
            item &&
            typeof item ===
              'object',
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
 * Entitlements and usage can be loaded in parallel.
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
      conversationId,
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
      conversationId,
    })
}
/*
 * Customer is scoped to this organization.
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
 * Existing conversation id = restore exact conversation.
 * Missing id = create genuinely new conversation.
 */
const conversation =
  await getOrCreateConversation(
    supabase,
    organizationId,
    customer.id,
    conversationId,
  )
/*
 * Human handoff protection.
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
      handoff: true,
    })
}
/*
 * Save customer message.
 */
const {
  error:
    customerMessageError,
} = await supabase
  .from('messages')
  .insert({
    conversation_id:
      conversation.id,
    organization_id:
      organizationId,
    sender_type:
      'customer',
    sender_id:
      customer.id,
    content:
      message,
  })
if (
  customerMessageError
) {
  console.error(
    'Ryan customer message error:',
    customerMessageError,
  )
}
/*
 * DETERMINISTIC BOOKING FLOW
 *
 * Do not make Gemini responsible for the first
 * question in the booking flow. This prevents
 * incomplete/truncated responses such as:
 * "أهلاً بك يا أحمد، إ"
 *
 * Flow:
 * service -> date -> time -> Gemini/tool booking
 */
if (intent === 'booking') {
  const bookingStep =
    getBookingStep(
      message,
      safeHistory,
    )
  if (
    bookingStep ===
    'service'
  ) {
    const customerName =
      extractCustomerName(
        message,
      )
    const reply =
      customerName
        ? `أهلاً بك يا ${customerName}، تحب تحجز أنهي خدمة؟`
        : 'أهلاً بك، تحب تحجز أنهي خدمة؟'
    await supabase
      .from('messages')
      .insert({
        conversation_id:
          conversation.id,
        organization_id:
          organizationId,
        sender_type:
          'ai',
        sender_id:
          user.id,
        content:
          reply,
      })
    return res
      .status(200)
      .json({
        reply,
        conversationId:
          conversation.id,
      })
  }
  if (
    bookingStep ===
    'date'
  ) {
    const reply =
      'تمام، تحب الحجز يكون يوم إيه؟'
    await supabase
      .from('messages')
      .insert({
        conversation_id:
          conversation.id,
        organization_id:
          organizationId,
        sender_type:
          'ai',
        sender_id:
          user.id,
        content:
          reply,
      })
    return res
      .status(200)
      .json({
        reply,
        conversationId:
          conversation.id,
      })
  }
  if (
    bookingStep ===
    'time'
  ) {
    const reply =
      'تمام، تحب الموعد الساعة كام؟'
    await supabase
      .from('messages')
      .insert({
        conversation_id:
          conversation.id,
        organization_id:
          organizationId,
        sender_type:
          'ai',
        sender_id:
          user.id,
        content:
          reply,
      })
    return res
      .status(200)
      .json({
        reply,
        conversationId:
          conversation.id,
      })
  }
}
/*
 * Knowledge Base MUST be organization scoped.
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
          'تمام، هساعد العميل بشكل مختصر وطبيعي.',
      },
    ],
  },
  ...safeHistory
    .map((item) => {
      const text =
        item.text ||
        item.content ||
        ''
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
            'model'
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
          /*
           * Increased from 256 to reduce the chance
           * of normal Ryan replies being cut off.
           */
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
if (
  !response.ok
) {
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
 * Execute tools deterministically.
 *
 * We intentionally do NOT make a second Gemini request.
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
     * Extra safety:
     * booking intent can NEVER call lead/deal.
     */
    if (
      intent ===
        'booking' &&
      functionName !==
        'book_appointment'
    ) {
      console.warn(
        'Blocked non-booking Ryan tool during booking intent:',
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
    } catch (error: any) {
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
   * Booking success.
   */
  const booking =
    successfulToolResults.find(
      (item) =>
        item.name ===
        'book_appointment',
    )
  if (booking) {
    const args =
      validFunctionCalls.find(
        (call) =>
          call.name ===
          'book_appointment',
      )?.args || {}
    const serviceName =
      String(
        args.service_name ||
          'الخدمة',
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
        ? `تم تسجيل حجز ${serviceName} بنجاح يوم ${date} الساعة ${time}.`
        : `تم تسجيل حجز ${serviceName} بنجاح.`
    await supabase
      .from('messages')
      .insert({
        conversation_id:
          conversation.id,
        organization_id:
          organizationId,
        sender_type:
          'ai',
        sender_id:
          user.id,
        content:
          reply,
        metadata: {
          action_taken:
            'book_appointment',
        },
      })
    return res
      .status(200)
      .json({
        reply,
        conversationId:
          conversation.id,
        action:
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
      'تمام، هحوّل المحادثة لحد من الفريق ويتواصل معاك قريبًا.'
    await supabase
      .from('messages')
      .insert({
        conversation_id:
          conversation.id,
        organization_id:
          organizationId,
        sender_type:
          'ai',
        sender_id:
          user.id,
        content:
          reply,
        metadata: {
          action_taken:
            'request_human_handoff',
          status:
            'pending',
        },
      })
    return res
      .status(200)
      .json({
        reply,
        conversationId:
          conversation.id,
        action:
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
      'تمام، سجلت طلبك وهنتابع معاك بخصوص الخدمة والتفاصيل.'
    await supabase
      .from('messages')
      .insert({
        conversation_id:
          conversation.id,
        organization_id:
          organizationId,
        sender_type:
          'ai',
        sender_id:
          user.id,
        content:
          reply,
        metadata: {
          action_taken:
            'create_deal',
        },
      })
    return res
      .status(200)
      .json({
        reply,
        conversationId:
          conversation.id,
        action:
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
      'تمام، سجلت بياناتك وهنتابع معاك قريبًا.'
    await supabase
      .from('messages')
      .insert({
        conversation_id:
          conversation.id,
        organization_id:
          organizationId,
        sender_type:
          'ai',
        sender_id:
          user.id,
        content:
          reply,
        metadata: {
          action_taken:
            'create_lead',
        },
      })
    return res
      .status(200)
      .json({
        reply,
        conversationId:
          conversation.id,
        action:
          'create_lead',
      })
  }
}
/*
 * Extract normal text response.
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
 * Gemini can return MAX_TOKENS when it reaches
 * the configured output limit. Never return a
 * partial/cut-off Ryan sentence to the customer.
 */
if (
  finishReason ===
    'MAX_TOKENS' ||
  !rawText
) {
  const fallbackReply =
    intent === 'booking'
      ? 'تمام، نكمل الحجز. تحب تحجز أنهي خدمة؟'
      : 'تمام، ممكن توضّحلي طلبك أكتر؟'
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
  const {
    error:
      fallbackMessageError,
  } = await supabase
    .from('messages')
    .insert({
      conversation_id:
        conversation.id,
      organization_id:
        organizationId,
      sender_type:
        'ai',
      sender_id:
        user.id,
      content:
        fallbackReply,
      metadata: {
        fallback:
          true,
        finish_reason:
          finishReason ||
          'EMPTY_RESPONSE',
      },
    })
  if (
    fallbackMessageError
  ) {
    console.error(
      'Ryan fallback message error:',
      fallbackMessageError,
    )
  }
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
 * Normal text response.
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
const {
  error:
    aiMessageError,
} = await supabase
  .from('messages')
  .insert({
    conversation_id:
      conversation.id,
    organization_id:
      organizationId,
    sender_type:
      'ai',
    sender_id:
      user.id,
    content:
      reply,
  })
if (aiMessageError) {
  console.error(
    'Ryan AI message error:',
    aiMessageError,
  )
}
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
‘Ryan handler error:’,
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
