import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'node:crypto'

const json = (res: VercelResponse, status: number, body: unknown) => res.status(status).json(body)

function env(name: string, fallback?: string) {
  return process.env[name] || (fallback ? process.env[fallback] : '') || ''
}

function normalizeEgyptianPhone(value: string) {
  const raw = value.replace(/[\s()-]/g, '')
  if (/^01\d{9}$/.test(raw)) return '+20' + raw.slice(1)
  if (/^00201\d{9}$/.test(raw)) return '+' + raw.slice(2)
  if (/^\+201\d{9}$/.test(raw)) return raw
  return ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' })

  try {
    const accessToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!accessToken) return json(res, 401, { error: 'جلسة الدخول غير صالحة.' })

    const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
    const anonKey = env('VITE_SUPABASE_ANON_KEY')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY')
    const secretKey = env('PAYMOB_SECRET_KEY')
    const publicKey = env('PAYMOB_PUBLIC_KEY')
    const integrationId = Number(env('PAYMOB_INTEGRATION_ID'))

    if (!supabaseUrl || !anonKey || !serviceKey || !secretKey || !publicKey || !integrationId) {
      return json(res, 500, { error: 'إعدادات Paymob غير مكتملة.' })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData?.user) return json(res, 401, { error: 'جلسة الدخول غير صالحة.' })

    const body = (req.body || {}) as { plan_id?: string; billing_cycle?: string }
    const planId = String(body.plan_id || '')
    const billingCycle = body.billing_cycle === 'yearly' ? 'yearly' : 'monthly'
    if (!planId) return json(res, 400, { error: 'الباقة مطلوبة.' })

    const { data: userRow, error: userError } = await admin
      .from('users')
      .select('organization_id,full_name,email,active')
      .eq('id', authData.user.id)
      .single()
    if (userError || !userRow?.organization_id || userRow.active === false) {
      return json(res, 403, { error: 'الحساب غير مؤهل لإتمام الدفع.' })
    }

    const [{ data: plan, error: planError }, { data: org, error: orgError }] = await Promise.all([
      admin.from('plans').select('id,name,price,yearly_price,currency,status').eq('id', planId).eq('status', 'active').single(),
      admin.from('organizations').select('id,name,email,phone,address').eq('id', userRow.organization_id).single(),
    ])

    if (planError || !plan) return json(res, 404, { error: 'الباقة غير متاحة.' })
    if (orgError || !org) return json(res, 404, { error: 'بيانات الشركة غير متاحة.' })

    const amount = billingCycle === 'yearly' ? Number(plan.yearly_price || 0) : Number(plan.price || 0)
    if (!Number.isFinite(amount) || amount <= 0) return json(res, 400, { error: 'سعر الباقة غير صالح.' })
    if (billingCycle === 'yearly' && !plan.yearly_price) return json(res, 400, { error: 'السعر السنوي غير متاح.' })

    const merchantReference = `DM-${crypto.randomUUID()}`
    const paymentRequestId = crypto.randomUUID()

    const { error: requestError } = await admin.from('payment_requests').insert({
      id: paymentRequestId,
      organization_id: userRow.organization_id,
      plan_id: plan.id,
      amount,
      method: 'paymob',
      reference: merchantReference,
      payment_date: new Date().toISOString().slice(0, 10),
      note: 'طلب دفع إلكتروني عبر Paymob',
      status: 'pending_review',
      item_snapshot: {
        type: 'subscription',
        plan_id: plan.id,
        plan_name: plan.name,
        billing_cycle: billingCycle,
        payment_provider: 'paymob',
      },
      payment_method_snapshot: {
        method_key: 'paymob',
        name: 'Paymob',
        integration_id: integrationId,
      },
      billing_cycle: billingCycle,
      request_type: 'subscription',
    })

    if (requestError) {
      console.error('Paymob payment request insert failed', requestError)
      return json(res, 500, { error: 'تعذر إنشاء طلب الدفع.' })
    }

    const { error: txError } = await admin.from('paymob_transactions').insert({
      organization_id: userRow.organization_id,
      payment_request_id: paymentRequestId,
      plan_id: plan.id,
      amount,
      currency: plan.currency || 'EGP',
      billing_cycle: billingCycle,
      integration_id: integrationId,
      merchant_reference: merchantReference,
      status: 'initiated',
    })

    if (txError) {
      await admin.from('payment_requests').delete().eq('id', paymentRequestId)
      console.error('Paymob transaction insert failed', txError)
      return json(res, 500, { error: 'تعذر تجهيز عملية Paymob.' })
    }

    const firstName = String(userRow.full_name || org.name || 'Dragon').trim().split(/\s+/)[0] || 'Dragon'
    const lastName = String(userRow.full_name || org.name || 'Media').trim().split(/\s+/).slice(1).join(' ') || 'Media'
    const phone = normalizeEgyptianPhone(String(org.phone || '').trim())
    if (!phone) {
      return json(res, 400, { error: 'رقم هاتف الشركة غير صالح. أضف رقمًا مصريًا صحيحًا قبل إتمام الدفع.' })
    }
    const email = String(userRow.email || org.email || '').trim() || 'billing@dragon-media.com'

    const intentionPayload = {
      amount: Math.round(amount * 100),
      currency: plan.currency || 'EGP',
      payment_methods: [integrationId],
      items: [{
        name: `Dragon Media - ${plan.name} - ${billingCycle === 'yearly' ? 'سنوي' : 'شهري'}`,
        amount: Math.round(amount * 100),
        description: 'اشتراك منصة Dragon Media',
        quantity: 1,
      }],
      billing_data: {
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phone,
        street: String(org.address || 'NA'),
        building: 'NA',
        floor: 'NA',
        apartment: 'NA',
        city: 'Alexandria',
        state: 'Alexandria',
        country: 'EG',
        postal_code: 'NA',
        shipping_method: 'UNK',
      },
      special_reference: merchantReference,
    }

    const paymobResponse = await fetch('https://accept.paymob.com/v1/intention/', {
      method: 'POST',
      headers: {
        Authorization: `Token ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(intentionPayload),
    })

    const paymobData = await paymobResponse.json().catch(() => ({}))
    if (!paymobResponse.ok || !paymobData?.client_secret) {
      await admin.from('paymob_transactions').update({
        status: 'failed',
        failure_reason: typeof paymobData === 'object' ? JSON.stringify(paymobData).slice(0, 2000) : 'Paymob intention failed',
        updated_at: new Date().toISOString(),
      }).eq('payment_request_id', paymentRequestId)
      await admin.from('payment_requests').update({ status: 'cancelled' }).eq('id', paymentRequestId)
      console.error('Paymob intention failed', paymobResponse.status, paymobData)
      return json(res, 502, { error: 'تعذر إنشاء جلسة الدفع عبر Paymob.' })
    }

    await admin.from('paymob_transactions').update({
      intention_id: String(paymobData.id || ''),
      order_id: paymobData.intention_order_id ? Number(paymobData.intention_order_id) : null,
      status: 'pending',
      updated_at: new Date().toISOString(),
    }).eq('payment_request_id', paymentRequestId)

    const checkoutUrl = `https://accept.paymob.com/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(String(paymobData.client_secret))}`

    return json(res, 200, {
      success: true,
      checkout_url: checkoutUrl,
      payment_request_id: paymentRequestId,
      intention_id: paymobData.id,
      order_id: paymobData.intention_order_id,
    })
  } catch (error) {
    console.error('Paymob create intention error', error)
    return json(res, 500, { error: 'حدث خطأ أثناء تجهيز الدفع الإلكتروني.' })
  }
}
