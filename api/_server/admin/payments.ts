import { createClient } from '@supabase/supabase-js'

export default async function handler(req: any, res: any) {
  const authHeader = req.headers.authorization
  const accessToken = authHeader?.replace('Bearer ', '')

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey || !accessToken) {
    res.status(401).json({ error: 'غير مصرح' })
    return
  }
`)
      .order('created_at', {
        ascending: false,
      })

    if (error) {
      res.status(500).json({
        error: error.message,
      })
      return
    }

    const requests = await Promise.all(
      (data ?? []).map(async (request: any) => {
        let receiptSignedUrl: string | null = null

        if (request.receipt_url) {
          const { data: signedData } = await admin.storage
            .from('payment-receipts')
            .createSignedUrl(request.receipt_url, 900)

          receiptSignedUrl =
            signedData?.signedUrl ?? null
        }

        return {
          ...request,
          receipt_signed_url: receiptSignedUrl,
        }
      })
    )

    res.status(200).json({
      requests,
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
    // Determine payment request type before calling RPC.
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
        } = await admin.rpc(
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
      // ---------------------------------------------------

      const {
        data,
        error,
      } = await admin.rpc(
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
        } = await admin.rpc(
          'reject_ryan_credit_purchase',
          {
            p_payment_request_id: requestId,
            p_reason:
              reason || 'تم رفض طلب الدفع',
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
      // ---------------------------------------------------

      const {
        data,
        error,
      } = await admin.rpc(
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
