import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const env = (...names: string[]) => names.map((n) => process.env[n]).find((v) => v?.trim())?.trim() || ''
const GEMINI_TEXT_MODEL = env('AI_CONTENT_GEMINI_MODEL') || 'gemini-3.5-flash'

function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body)
}

function text(value: unknown, max = 20000) {
  return String(value ?? '').trim().slice(0, max)
}

async function authenticate(req: VercelRequest, db: any) {
  const auth = String(req.headers.authorization || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) throw new Error('Authentication required.')
  const { data, error } = await db.auth.getUser(token)
  if (error || !data.user) throw new Error('جلسة الدخول غير صالحة.')
  return data.user.id
}

async function getContext(db: any, userId: string): Promise<any> {
  const { data: user, error: userError } = await db.from('users')
    .select('id,organization_id,role,active,full_name,email')
    .eq('id', userId).maybeSingle()
  if (userError || !user || user.active === false || !user.organization_id) {
    throw new Error('الحساب غير مرتبط بمساحة عمل نشطة.')
  }

  const [{ data: organization }, { data: services }, { data: permission }, { data: subscription }] = await Promise.all([
    db.from('organizations').select('id,name,business_type,address,phone,email,logo_url,timezone,ai_content_enabled').eq('id', user.organization_id).maybeSingle(),
    db.from('services').select('name,description,category,price').eq('organization_id', user.organization_id).order('name').limit(80),
    db.from('role_permissions').select('can_view,can_edit,can_delete').eq('role', user.role).eq('resource', 'ai_content').maybeSingle(),
    db.from('subscriptions').select('status,expires_at,renewal_date,plan_id,plan').eq('organization_id', user.organization_id).order('renewal_date', { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
  ])

  if (!permission?.can_view) throw new Error('ليس لديك صلاحية استخدام استوديو المحتوى.')
  if (organization?.ai_content_enabled === false) throw new Error('استوديو المحتوى غير مفعّل لهذه الشركة.')

  const expiry = text(subscription?.expires_at || subscription?.renewal_date, 40).slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  const activeSubscription = ['active', 'trialing'].includes(String(subscription?.status || '')) && (!expiry || expiry >= today)
  if (!activeSubscription) throw new Error('يجب أن يكون الاشتراك فعالًا لاستخدام استوديو المحتوى.')

  let plan: any = null
  if (subscription?.plan_id) {
    const { data } = await db.from('plans').select('id,name,features').eq('id', subscription.plan_id).maybeSingle()
    plan = data || null
  } else if (subscription?.plan) {
    const { data } = await db.from('plans').select('id,name,features').eq('name', subscription.plan).maybeSingle()
    plan = data || null
  }

  // Image generation is intentionally disabled for now. Text generation remains available.
  const canGenerateImages: boolean = false

  return {
    user,
    organization,
    services: services || [],
    canEdit: Boolean(permission?.can_edit),
    organizationId: user.organization_id,
    plan,
    canGenerateImages,
  }
}

async function generateText(prompt: string, ctx: any) {
  const key = env('GEMINI_API_KEY', 'GOOGLE_GEMINI_API_KEY')
  if (!key) throw new Error('GEMINI_API_KEY غير مضبوط على الخادم.')

  const serviceContext = (ctx.services || []).map((s: any) =>
    [s.name, s.category, s.description, s.price].filter(Boolean).join(' | ')
  ).join('\n')

  const system = `أنت محرر محتوى تسويقي محترف داخل Dragon Media.
اكتب محتوى عربي مصري/عربي طبيعي مناسب لشركة المستخدم.
استخدم بيانات الشركة والخدمات فقط عندما تكون مفيدة ولا تخترع عروضًا أو أسعارًا.
أخرج JSON فقط بالمفاتيح hook, content, cta.
Hook قصير وجذاب.
Content واضح ومقنع ومناسب للسوشيال ميديا.
CTA واحد واضح.
لا تستخدم markdown.`

  const userPrompt = `بيانات الشركة:
الاسم: ${text(ctx.organization?.name, 200)}
النشاط: ${text(ctx.organization?.business_type, 200)}
العنوان: ${text(ctx.organization?.address, 300)}
الهاتف: ${text(ctx.organization?.phone, 100)}
البريد: ${text(ctx.organization?.email, 150)}
الخدمات والمنتجات:
${serviceContext || 'لا توجد خدمات مسجلة حاليًا.'}

نوع المحتوى: ${text(ctx.contentType, 80)}
النبرة: ${text(ctx.tone, 80)}
فكرة المستخدم:
${text(prompt, 6000)}

أنشئ بوستًا احترافيًا متكاملًا.`

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(GEMINI_TEXT_MODEL) + ':generateContent?key=' + encodeURIComponent(key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        maxOutputTokens: 2200,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            hook: { type: 'string' },
            content: { type: 'string' },
            cta: { type: 'string' },
          },
          required: ['hook', 'content', 'cta'],
        },
      },
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(text(data?.error?.message, 500) || 'فشل توليد المحتوى.')

  const raw = text(data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join(''), 12000)
  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('تعذر قراءة نتيجة Gemini بشكل صحيح.')
  }

  return {
    hook: text(parsed?.hook, 1000),
    content: text(parsed?.content, 12000),
    cta: text(parsed?.cta, 1000),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method || '')) return json(res, 405, { error: 'Method not allowed.' })

  try {
    const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY')
    if (!url || !serviceKey) return json(res, 500, { error: 'Server configuration is incomplete.' })

    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const userId = await authenticate(req, db)
    const ctx = await getContext(db, userId)

    if (req.method === 'GET') {
      const { data, error } = await db.from('ai_content_posts').select('*').eq('organization_id', ctx.organizationId).order('updated_at', { ascending: false }).limit(50)
      if (error) throw error
      return json(res, 200, { posts: data || [], canGenerateImages: false, planName: ctx.plan?.name || null })
    }

    if (!ctx.canEdit) return json(res, 403, { error: 'ليس لديك صلاحية تعديل المحتوى.' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const action = text(body.action, 50)

    if (req.method === 'POST' && action === 'generate') {
      const prompt = text(body.prompt, 6000)
      if (prompt.length < 5) return json(res, 400, { error: 'اكتب فكرة البوست أولًا.' })

      ctx.contentType = text(body.contentType || 'custom', 80)
      ctx.tone = text(body.tone || 'professional', 80)

      const generated = await generateText(prompt, ctx)
      const imageError = 'توليد الصور متوقف مؤقتًا في استوديو المحتوى.'

      const { data: post, error } = await db.from('ai_content_posts').insert({
        organization_id: ctx.organizationId,
        created_by: userId,
        prompt,
        content_type: ctx.contentType,
        tone: ctx.tone,
        image_style: text(body.imageStyle || 'modern', 80),
        hook: generated.hook,
        content: generated.content,
        cta: generated.cta,
        image_url: null,
        image_path: null,
        status: 'ready',
        generation_model: GEMINI_TEXT_MODEL,
        image_model: null,
        metadata: {
          image_generation_failed: true,
          image_generation_error: imageError,
          image_generation_provider: 'disabled',
        },
      }).select('*').single()

      if (error) throw error
      return json(res, 200, { post, imageGenerated: false, imageError })
    }

    if (req.method === 'POST' && action === 'regenerate_image') {
      return json(res, 403, { error: 'توليد الصور متوقف مؤقتًا في استوديو المحتوى.', code: 'IMAGE_GENERATION_DISABLED' })
    }

    if (req.method === 'PATCH') {
      const id = text(body.id, 100)
      if (!id) return json(res, 400, { error: 'المحتوى غير محدد.' })
      const patch: Record<string, string> = {}
      for (const key of ['hook', 'content', 'cta', 'status']) {
        if (body[key] !== undefined) patch[key] = text(body[key], key === 'content' ? 12000 : 20000)
      }
      const { data, error } = await db.from('ai_content_posts').update(patch).eq('id', id).eq('organization_id', ctx.organizationId).select('*').single()
      if (error) throw error
      return json(res, 200, { post: data })
    }

    if (req.method === 'DELETE') {
      const id = text(body.id, 100)
      if (!id) return json(res, 400, { error: 'المحتوى غير محدد.' })
      const { error } = await db.from('ai_content_posts').delete().eq('id', id).eq('organization_id', ctx.organizationId)
      if (error) throw error
      return json(res, 200, { ok: true })
    }

    return json(res, 400, { error: 'إجراء غير معروف.' })
  } catch (error) {
    console.error('AI content API error', error)
    return json(res, 500, { error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع.' })
  }
}
