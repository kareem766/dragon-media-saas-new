import { createClient } from '@supabase/supabase-js'

export default async function handler(req: any, res: any) {
  const authHeader = req.headers.authorization
  const accessToken = authHeader?.replace('Bearer ', '')

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !anonKey || !serviceKey || !accessToken) {
    res.status(401).json({ error: 'غير مصرح' })
    return
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })

  const { data: authData, error: authError } =
    await userClient.auth.getUser()

  if (authError || !authData?.user) {
    res.status(401).json({ error: 'غير مصرح' })
    return
  }

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: callerRow, error: callerError } = await admin
    .from('users')
    .select('is_platform_admin')
    .eq('id', authData.user.id)
    .single()

  if (
    callerError ||
    !callerRow?.is_platform_admin
  ) {
    res.status(403).json({
      error: 'هذه الصفحة مخصصة لمدير المنصة فقط',
    })
    return
  }

  // -------------------------------------------------------
  // GET
  // -------------------------------------------------------

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('payment_requests')
      .select(
        '*, organizations(name), plans(name, price)'
      )
      .order('created_at', {
        ascending: false,
      })

    if (error) {
      res.status(500).json({
        error: error.message,
      })
      return
    }

    res.status(200).json({
      requests: data ?? [],
    })

    return
  }

  // -------------------------------------------------------
  // POST
  // -------------------------------------------------------

  if (req.method === 'POST') {
    const {
      action,
      requestId,
      reason,
    } = req.body || {}

    if (!requestId) {
      res.status(400).json({
        error: 'معرّف طلب الدفع مطلوب',
      })
      return
    }

    // -----------------------------------------------------
    // IMPORTANT:
    // Determine payment request type before calling the
    // subscription approval/rejection RPC.
    // -----------------------------------------------------

    const {
      data: paymentRequest,
      error: requestError,
    } = await admin
      .from('payment_requests')
      .select(
        'id, request_type, ryan_credit_purchase_id, status'
      )
      .eq('id', requestId)
      .single()

    if (requestError || !paymentRequest) {
      res.status(404).json({
        error: 'طلب الدفع غير موجود',
      })
      return
    }

    // -----------------------------------------------------
    // APPROVE
    // -----------------------------------------------------

    if (action === 'approve') {
      // Ryan Credits
      //
      // IMPORTANT:
      // Do NOT call approve_payment_request()
      // because that RPC is subscription-specific and
      // expects plan_id.
      //
      // Ryan Credits are independent from subscriptions.
      if (
        paymentRequest.request_type === 'ryan_credits'
      ) {
        if (!paymentRequest.ryan_credit_purchase_id) {
          res.status(400).json({
            error:
              'طلب رصيد Ryan غير مرتبط بعملية شراء',
          })
          return
        }

        const {
          data,
          error,
        } = await userClient.rpc(
          'approve_ryan_credit_purchase',
          {
            p_payment_request_id: requestId,
            p_reviewer_id: authData.user.id,
          }
        )

        if (error) {
          res.status(400).json({
            error: error.message,
          })
          return
        }

        res.status(200).json(
          data ?? {
            success: true,
          }
        )

        return
      }

      // ---------------------------------------------------
      // Subscription
      //
      // Keep the existing subscription approval flow
      // completely unchanged.
      // ---------------------------------------------------

      const {
        data,
        error,
      } = await userClient.rpc(
        'approve_payment_request',
        {
          p_request_id: requestId,
          p_reviewer_id: authData.user.id,
        }
      )

      if (error) {
        res.status(400).json({
          error: error.message,
        })

        return
      }

      res.status(200).json(
        data ?? {
          success: true,
        }
      )

      return
    }

    // -----------------------------------------------------
    // REJECT
    // -----------------------------------------------------

    if (action === 'reject') {
      // Ryan Credits
      if (
        paymentRequest.request_type === 'ryan_credits'
      ) {
        if (!paymentRequest.ryan_credit_purchase_id) {
          res.status(400).json({
            error:
              'طلب رصيد Ryan غير مرتبط بعملية شراء',
          })
          return
        }

        const {
          data,
          error,
        } = await userClient.rpc(
          'reject_ryan_credit_purchase',
          {
            p_payment_request_id: requestId,
            p_reason: reason || 'تم رفض طلب الدفع',
            p_reviewer_id: authData.user.id,
          }
        )

        if (error) {
          res.status(400).json({
            error: error.message,
          })
          return
        }

        res.status(200).json(
          data ?? {
            success: true,
          }
        )

        return
      }

      // ---------------------------------------------------
      // Subscription
      //
      // Keep the existing subscription rejection flow
      // completely unchanged.
      // ---------------------------------------------------

      const {
        data,
        error,
      } = await userClient.rpc(
        'reject_payment_request',
        {
          p_request_id: requestId,
          p_reviewer_id: authData.user.id,
          p_reason: reason,
        }
      )

      if (error) {
        res.status(400).json({
          error: error.message,
        })

        return
      }

      res.status(200).json(
        data ?? {
          success: true,
        }
      )

      return
    }

    // -----------------------------------------------------
    // Unknown action
    // -----------------------------------------------------

    res.status(400).json({
      error: 'إجراء غير معروف',
    })

    return
  }

  // -------------------------------------------------------
  // Method Not Allowed
  // -------------------------------------------------------

  res.status(405).json({
    error: 'الطريقة غير مسموحة',
  })
}
