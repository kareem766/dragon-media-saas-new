import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'node:crypto'

function env(name: string, fallback?: string) {
  return process.env[name] || (fallback ? process.env[fallback] : '') || ''
}

function valueString(value: unknown) {
  if (value === true) return 'true'
  if (value === false) return 'false'
  return String(value ?? '')
}

function verifyHmac(obj: any, received: string, secret: string) {
  const source = obj?.source_data || {}
  const fields = [
    obj?.amount_cents,
    obj?.created_at,
    obj?.currency,
    obj?.error_occured,
    obj?.has_parent_transaction,
    obj?.id,
    obj?.integration_id,
    obj?.is_3d_secure,
    obj?.is_auth,
    obj?.is_capture,
    obj?.is_refunded,
    obj?.is_standalone_payment,
    obj?.is_voided,
    obj?.order?.id,
    obj?.owner,
    obj?.pending,
    source?.pan,
    source?.sub_type,
    source?.type,
    obj?.success,
  ].map(valueString).join('')
  const expected = crypto.createHmac('sha512', secret).update(fields).digest('hex')
  const receivedBuffer = Buffer.from(String(received || '').toLowerCase())
  const expectedBuffer = Buffer.from(expected)
  return receivedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })

  try {
    const hmacSecret = env('PAYMOB_HMAC_SECRET')
    const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY')
    if (!hmacSecret || !supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Paymob webhook configuration is incomplete.' })

    const payload = req.body || {}
    const obj = payload?.obj
    if (payload?.type !== 'TRANSACTION' || !obj) return res.status(200).json({ ok: true, ignored: true })

    const receivedHmac = String(req.query.hmac || payload.hmac || obj.hmac || '')
    if (!verifyHmac(obj, receivedHmac, hmacSecret)) {
      console.warn('Paymob webhook rejected: invalid HMAC')
      return res.status(401).json({ error: 'Invalid HMAC.' })
    }

    const integrationIds = (env('PAYMOB_INTEGRATION_IDS') || env('PAYMOB_INTEGRATION_ID'))
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0)
    if (integrationIds.length > 0 && !integrationIds.includes(Number(obj.integration_id))) {
      return res.status(400).json({ error: 'Integration mismatch.' })
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const orderId = Number(obj?.order?.id)
    const transactionId = Number(obj?.id)
    const amountCents = Number(obj?.amount_cents)

    if (!Number.isFinite(orderId) || !Number.isFinite(transactionId) || !Number.isFinite(amountCents)) {
      return res.status(400).json({ error: 'Invalid transaction payload.' })
    }

    if (obj.success !== true || obj.pending === true || obj.error_occured === true) {
      await admin.from('paymob_transactions').update({
        transaction_id: transactionId,
        order_id: orderId,
        status: 'failed',
        hmac_verified: true,
        raw_callback: payload,
        failure_reason: String(obj?.data?.message || 'Paymob payment was not successful').slice(0, 1000),
        updated_at: new Date().toISOString(),
      }).eq('order_id', orderId)
      return res.status(200).json({ ok: true, success: false })
    }

    const { data, error } = await admin.rpc('activate_paymob_payment', {
      p_paymob_transaction_id: transactionId,
      p_order_id: orderId,
      p_amount_cents: amountCents,
      p_callback: payload,
    })

    if (error) {
      console.error('Paymob activation RPC failed', error)
      return res.status(500).json({ error: 'Payment received but activation failed.' })
    }

    return res.status(200).json({ ok: true, result: data })
  } catch (error) {
    console.error('Paymob webhook error', error)
    return res.status(500).json({ error: 'Webhook processing failed.' })
  }
}
