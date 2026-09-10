import { createClient } from '@supabase/supabase-js'

function getClient(accessToken: string) {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('إعدادات Supabase غير مكتملة')
  }

  return createClient(url, key, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      error: 'الطريقة غير مسموحة',
    })
  }

  const accessToken =
    req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    req.body?.accessToken

  if (!accessToken) {
    return res.status(401).json({
      error: 'يجب تسجيل الدخول',
    })
  }

  try {
    const client = getClient(accessToken)

    const {
      data: authData,
      error: authError,
    } = await client.auth.getUser()

    if (authError || !authData?.user) {
      return res.status(401).json({
        error: 'جلسة الدخول غير صالحة',
      })
    }

    const {
      data: user,
      error: userError,
    } = await client
      .from('users')
      .select('organization_id')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (userError) {
      throw new Error(userError.message)
    }

    if (!user?.organization_id) {
      throw new Error('الحساب غير مرتبط بشركة')
    }

    if (req.method === 'GET') {
      const [
        summaryResult,
        packagesResult,
        methodsResult,
        purchasesResult,
      ] = await Promise.all([
        client.rpc('ryan_entitlement_summary', {
          p_organization_id: user.organization_id,
        }),

        client
          .from('ryan_credit_packages')
          .select(
            'id,name,message_count,price,currency,description,sort_order'
          )
          .eq('active', true)
          .order('sort_order', {
            ascending: true,
          })
          .order('created_at', {
            ascending: true,
          }),

        client
          .from('payment_methods')
          .select(
            'method_key,name,details,display_order'
          )
          .eq('enabled', true)
          .order('display_order', {
            ascending: true,
          }),

        client
          .from('ryan_credit_purchases')
          .select(
            'id,package_name,credits_purchased,credits_remaining,amount,currency,status,payment_request_id,rejection_reason,created_at,approved_at'
          )
          .eq(
            'organization_id',
            user.organization_id
          )
          .order('created_at', {
            ascending: false,
          })
          .limit(20),
      ])

      if (summaryResult.error) {
        throw new Error(summaryResult.error.message)
      }

      if (packagesResult.error) {
        throw new Error(packagesResult.error.message)
      }

      if (methodsResult.error) {
        throw new Error(methodsResult.error.message)
      }

      if (purchasesResult.error) {
        throw new Error(purchasesResult.error.message)
      }

      const summary = Array.isArray(
        summaryResult.data
      )
        ? summaryResult.data[0] || null
        : summaryResult.data

      return res.status(200).json({
        summary,
        packages: packagesResult.data || [],
        paymentMethods:
          methodsResult.data || [],
        purchases:
          purchasesResult.data || [],
      })
    }

    const {
      packageId,
      method,
      reference,
      paymentDate,
      note,
    } = req.body || {}

    if (!packageId) {
      return res.status(400).json({
        error: 'اختر باقة Ryan أولًا',
      })
    }

    if (!method) {
      return res.status(400).json({
        error: 'اختر طريقة الدفع',
      })
    }

    if (!reference?.trim()) {
      return res.status(400).json({
        error: 'أدخل رقم العملية',
      })
    }

    const {
      data: purchaseId,
      error: purchaseError,
    } = await client.rpc(
      'submit_ryan_credit_purchase',
      {
        p_package_id: packageId,
        p_method: method,
        p_reference: reference.trim(),
        p_payment_date:
          paymentDate ||
          new Date()
            .toISOString()
            .slice(0, 10),
        p_note: note?.trim() || null,
      }
    )

    if (purchaseError) {
      throw new Error(
        purchaseError.message
      )
    }

    return res.status(201).json({
      purchaseId,
      status: 'pending_review',
    })
  } catch (error: any) {
    console.error(
      'Ryan credits API error:',
      error
    )

    return res.status(500).json({
      error:
        error?.message ||
        'حدث خطأ غير متوقع',
    })
  }
}
