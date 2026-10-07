import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'node:crypto'

const env = (name: string) => process.env[name] || ''
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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'الطريقة غير مسموحة' }) }

  const secret = env('PAYMOB_HMAC_SECRET')
  const serviceKey = env('SUPABASE_SERVICE_KEY')
  const supabaseUrl = env('VITE_SUPABASE_URL') || env('SUPABASE_URL')
  if (!secret || !serviceKey || !supabaseUrl) return res.status(500).json({ error: 'إعدادات Paymob غير مكتملة.' })

  const obj = req.body?.obj
  const hmac = String(req.query?.hmac || '')
  if (!obj || !hmac || !validHmac(obj, hmac, secret)) return res.status(200).json({ received: true, verified: false })

  const admin = createClient(supabaseUrl, serviceKey)
  const transactionId = Number(obj.id)
  const orderId = Number(obj.order?.id)
  const integrationId = Number(obj.integration_id)

  if (!Number.isInteger(transactionId) || !Number.isInteger(orderId) || !Number.isInteger(integrationId)) return res.status(200).json({ received: true, verified: true })

  if (obj.success !== true || obj.pending === true || obj.error_occured === true || obj.is_refunded === true || obj.is_voided === true) {
    await admin.from('paymob_transactions').update({
      transaction_id: transactionId, order_id: orderId, status: 'failed',
      hmac_verified: true, raw_callback: req.body, failure_reason: 'عملية Paymob لم تكتمل بنجاح', updated_at: new Date().toISOString()
    }).eq('order_id', orderId).eq('status', 'initiated')
    return res.status(200).json({ received: true, verified: true, success: false })
  }

  const { data, error } = await admin.rpc('activate_ryan_paymob_payment', {
    p_paymob_transaction_id: transactionId,
    p_order_id: orderId,
    p_amount_cents: Number(obj.amount_cents),
    p_integration_id: integrationId,
    p_callback: req.body
  })
  if (error) return res.status(400).json({ received: true, verified: true, error: error.message })
  return res.status(200).json({ received: true, verified: true, ...(data || {}) })
}