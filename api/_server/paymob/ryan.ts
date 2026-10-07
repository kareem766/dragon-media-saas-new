import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

const env = (name: string, fallback = '') => process.env[name] || fallback
const stringify = (v: unknown) => v === true ? 'true' : v === false ? 'false' : v == null ? '' : String(v)

function validHmac(obj: any, received: string, secret: string) {
  const s = obj?.source_data || {}, o = obj?.order || {}
  const raw = [
    obj?.amount_cents, obj?.created_at, obj?.currency, obj?.error_occured,
    obj?.has_parent_transaction, obj?.id, obj?.integration_id, obj?.is_3d_secure,
    obj?.is_auth, obj?.is_capture, obj?.is_refunded, obj?.is_standalone_payment,
    obj?.is_voided, o?.id, obj?.owner, obj?.pending, s?.pan, s?.sub_type, s?.type, obj?.success
  ].map(stringify).join('')
  const expected = createHmac('sha512', secret).update(raw, 'utf8').digest('hex')
  const a = Buffer.from(expected), b = Buffer.from(String(received || ''))
  return a.length === b.length && timingSafeEqual(a, b)
}

async function createCheckout(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = env('VITE_SUPABASE_URL', env('SUPABASE_URL'))
  const anonKey = env('VITE_SUPABASE_ANON_KEY')
  const serviceKey = env('SUPABASE_SERVICE_KEY')
  const secretKey = env('PAYMOB_SECRET_KEY')
  const publicKey = env('PAYMOB_PUBLIC_KEY')
  const integrations = env('PAYMOB_INTEGRATION_IDS').split(',').map(v => Number(v.trim())).filter(v => Number.isInteger(v) && v > 0)
  if (!supabaseUrl || !anonKey || !serviceKey || !secretKey || !publicKey || integrations.length < 2) return res.status(500).json({ error: 'إعدادات Paymob غير مكتملة على الخادم.' })

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return res.status(401).json({ error: 'غير مصرح' })
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const admin = createClient(supabaseUrl, serviceKey)
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData?.user) return res.status(401).json({ error: 'غير مصرح' })

  const packageId = String((req.body as any)?.package_id || '').trim()
  if (!packageId) return res.status(400).json({ error: 'باقة Ryan مطلوبة.' })

  const [{ data: userRow }, { data: pkg }] = await Promise.all([
    admin.from('users').select('id,organization_id,full_name,email,active').eq('id', authData.user.id).maybeSingle(),
    admin.from('ryan_message_packages').select('id,name,messages,price,currency,status').eq('id', packageId).eq('status', 'active').maybeSingle(),
  ])
  if (!userRow?.organization_id || userRow.active === false) return res.status(403).json({ error: 'الحساب غير مرتبط بشركة فعالة.' })
  if (!pkg) return res.status(400).json({ error: 'باقة Ryan غير متاحة حاليًا.' })

  const { data: org } = await admin.from('organizations').select('id,name,phone,suspended').eq('id', userRow.organization_id).maybeSingle()
  if (!org || org.suspended) return res.status(403).json({ error: 'الشركة موقوفة أو غير متاحة حاليًا.' })
  const { data: hasRyan } = await admin.rpc('service_subscription_has_feature', { p_organization_id: org.id, p_feature: 'ryan' })
  if (hasRyan !== true) return res.status(403).json({ error: 'Ryan غير متاح في الباقة الحالية.' })

  const amount = Number(pkg.price), amountCents = Math.round(amount * 100)
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amountCents) || amountCents <= 0) return res.status(400).json({ error: 'سعر باقة Ryan غير صالح.' })

  const phone = String(org.phone || authData.user.phone || '').trim()
  const email = String(userRow.email || authData.user.email || '').trim()
  if (!phone) return res.status(400).json({ error: 'أضف رقم هاتف الشركة أولًا لإتمام الدفع عبر Paymob.' })
  if (!email) return res.status(400).json({ error: 'البريد الإلكتروني للحساب غير متاح.' })

  const fullName = String(userRow.full_name || authData.user.user_metadata?.full_name || 'Dragon Media').trim()
  const parts = fullName.split(/\s+/).filter(Boolean)
  const firstName = (parts.shift() || 'Dragon').slice(0, 50)
  const lastName = (parts.join(' ') || 'Media').slice(0, 50)
  const merchantReference = `RYAN-${randomUUID()}`
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0]
  const base = `${proto}://${req.headers.host}`

  const { data: purchase, error: purchaseError } = await admin.from('ryan_credit_purchases').insert({
    organization_id: org.id, messages: pkg.messages, amount, currency: pkg.currency || 'EGP', status: 'pending_review'
  }).select('id').single()
  if (purchaseError || !purchase) return res.status(400).json({ error: purchaseError?.message || 'تعذر إنشاء عملية شراء Ryan.' })

  const { data: paymentRequest, error: requestError } = await admin.from('payment_requests').insert({
    organization_id: org.id, plan_id: null, amount, method: 'paymob', reference: merchantReference,
    payment_date: new Date().toISOString().slice(0, 10), note: 'شراء باقة Ryan عبر Paymob', status: 'pending_payment',
    item_snapshot: { type: 'ryan_credits', package_id: pkg.id, package_name: pkg.name, messages: pkg.messages, purchase_id: purchase.id },
    payment_method_snapshot: { method_key: 'paymob', name: 'Paymob', integrations },
    request_type: 'ryan_credits', ryan_credit_purchase_id: purchase.id
  }).select('id').single()
  if (requestError || !paymentRequest) {
    await admin.from('ryan_credit_purchases').delete().eq('id', purchase.id)
    return res.status(400).json({ error: requestError?.message || 'تعذر إنشاء طلب الدفع.' })
  }

  await admin.from('ryan_credit_purchases').update({ payment_request_id: paymentRequest.id }).eq('id', purchase.id)
  const { data: tx, error: txError } = await admin.from('paymob_transactions').insert({
    organization_id: org.id, payment_request_id: paymentRequest.id, plan_id: null, amount,
    currency: pkg.currency || 'EGP', integration_id: integrations[0], merchant_reference: merchantReference, status: 'initiated'
  }).select('id').single()
  if (txError || !tx) return res.status(400).json({ error: txError?.message || 'تعذر تسجيل عملية Paymob.' })

  const paymobResponse = await fetch('https://accept.paymob.com/v1/intention/', {
    method: 'POST',
    headers: { Authorization: `Token ${secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amountCents, currency: pkg.currency || 'EGP', payment_methods: integrations,
      items: [{ name: String(pkg.name).slice(0, 50), amount: amountCents, description: `Ryan ${pkg.messages} messages`.slice(0, 255), quantity: 1 }],
      billing_data: { apartment: 'NA', first_name: firstName, last_name: lastName, street: 'NA', building: 'NA', phone_number: phone, city: 'NA', country: 'EG', email, floor: 'NA', state: 'NA', postal_code: 'NA', shipping_method: 'NA' },
      extras: { type: 'ryan_credits', purchase_id: purchase.id, payment_request_id: paymentRequest.id, organization_id: org.id },
      special_reference: merchantReference, expiration: 3600,
      notification_url: `${base}/api/admin/ryan-paymob?mode=webhook`,
      redirection_url: `${base}/billing?ryan_payment=1&reference=${encodeURIComponent(merchantReference)}`
    })
  })

  const raw = await paymobResponse.text()
  let paymob: any = null
  try { paymob = JSON.parse(raw) } catch {}
  if (!paymobResponse.ok || !paymob?.client_secret || !paymob?.intention_order_id) {
    await admin.from('paymob_transactions').update({ status: 'failed', failure_reason: raw.slice(0, 1000), updated_at: new Date().toISOString() }).eq('id', tx.id)
    return res.status(502).json({ error: 'تعذر تجهيز الدفع عبر Paymob. حاول مرة أخرى.' })
  }

  await admin.from('paymob_transactions').update({ intention_id: paymob.id || null, order_id: paymob.intention_order_id, updated_at: new Date().toISOString() }).eq('id', tx.id)
  const checkoutUrl = `https://accept.paymob.com/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(paymob.client_secret)}`
  return res.status(200).json({ success: true, checkout_url: checkoutUrl, purchase_id: purchase.id, payment_request_id: paymentRequest.id })
}

async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  const secret = env('PAYMOB_HMAC_SECRET')
  const serviceKey = env('SUPABASE_SERVICE_KEY')
  const supabaseUrl = env('VITE_SUPABASE_URL', env('SUPABASE_URL'))
  if (!secret || !serviceKey || !supabaseUrl) return res.status(500).json({ error: 'إعدادات Paymob غير مكتملة.' })

  const obj = (req.body as any)?.obj
  const hmac = String(req.query?.hmac || '')
  if (!obj || !hmac || !validHmac(obj, hmac, secret)) return res.status(200).json({ received: true, verified: false })

  const admin = createClient(supabaseUrl, serviceKey)
  const transactionId = Number(obj.id), orderId = Number(obj.order?.id), integrationId = Number(obj.integration_id)
  if (!Number.isInteger(transactionId) || !Number.isInteger(orderId) || !Number.isInteger(integrationId)) return res.status(200).json({ received: true, verified: true })

  if (obj.success !== true || obj.pending === true || obj.error_occured === true || obj.is_refunded === true || obj.is_voided === true) {
    await admin.from('paymob_transactions').update({
      transaction_id: transactionId, order_id: orderId, status: 'failed', hmac_verified: true,
      raw_callback: req.body, failure_reason: 'عملية Paymob لم تكتمل بنجاح', updated_at: new Date().toISOString()
    }).eq('order_id', orderId).eq('status', 'initiated')
    return res.status(200).json({ received: true, verified: true, success: false })
  }

  const { data, error } = await admin.rpc('activate_ryan_paymob_payment', {
    p_paymob_transaction_id: transactionId, p_order_id: orderId, p_amount_cents: Number(obj.amount_cents),
    p_integration_id: integrationId, p_callback: req.body
  })
  if (error) return res.status(400).json({ received: true, verified: true, error: error.message })
  return res.status(200).json({ received: true, verified: true, ...(data || {}) })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const mode = Array.isArray(req.query.mode) ? req.query.mode[0] : req.query.mode
  if (mode === 'webhook') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'الطريقة غير مسموحة' })
    return handleWebhook(req, res)
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'الطريقة غير مسموحة' }) }
  return createCheckout(req, res)
}