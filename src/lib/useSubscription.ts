import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useOrganization } from './useOrganization'

interface PlanData {
  id: string
  name: string
  price: number
  currency: string | null
  billing_cycle: string | null
  features: Record<string, boolean>
  limits: Record<string, number>
  trial_days: number | null
  status: string | null
  sort_order: number
  yearly_price: number | null
  is_popular: boolean
  tagline: string | null
}

interface SubscriptionData {
  id: string
  status: string
  renewal_date: string | null
  plan_id: string | null
  plan: PlanData | null
}

export type SubscriptionAccessState =
  | 'active'
  | 'expiring_soon'
  | 'expires_today'
  | 'expired'
  | 'pending_payment'
  | 'cancelled'
  | 'no_subscription'
  | 'unknown'

export function useSubscription() {
  const {
    organizationId,
    loading: organizationLoading,
  } = useOrganization()

  const [subscription, setSubscription] =
    useState<SubscriptionData | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadSubscription = async () => {
      if (organizationLoading) {
        return
      }

      if (!supabase || !organizationId) {
        if (!cancelled) {
          setSubscription(null)
          setLoading(false)
        }
        return
      }

      setLoading(true)
      setError(null)

      try {
        /*
         * الاشتراك الخاص بالـ Organization الحالية فقط.
         *
         * RLS في Supabase يمنع المستخدم من قراءة اشتراك
         * Organization أخرى.
         */
        const { data, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select(`
            id,
            status,
            renewal_date,
            plan_id,
            plans (
              id,
              name,
              price,
              currency,
              billing_cycle,
              features,
              limits,
              trial_days,
              status,
              sort_order,
              yearly_price,
              is_popular,
              tagline
            )
          `)
          .eq('organization_id', organizationId)
          .order('renewal_date', {
            ascending: false,
            nullsFirst: false,
          })
          .limit(1)
          .maybeSingle()

        if (subscriptionError) {
          throw subscriptionError
        }

        if (cancelled) {
          return
        }

        if (!data) {
          setSubscription({
            id: '',
            status: 'no_subscription',
            renewal_date: null,
            plan_id: null,
            plan: null,
          })

          return
        }

        const plan = Array.isArray(data.plans)
          ? data.plans[0] ?? null
          : data.plans ?? null

        setSubscription({
          id: data.id,
          status: data.status ?? 'pending_payment',
          renewal_date: data.renewal_date,
          plan_id: data.plan_id,
          plan: plan as PlanData | null,
        })
      } catch (err: any) {
        if (cancelled) {
          return
        }

        setSubscription(null)

        setError(
          err?.message ||
            'تعذر تحميل بيانات الاشتراك.'
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadSubscription()

    return () => {
      cancelled = true
    }
  }, [organizationId, organizationLoading])

  const rawStatus =
    subscription?.status ?? 'no_subscription'

  /*
   * نحسب الأيام اعتمادًا على تاريخ التجديد الموجود
   * في قاعدة البيانات.
   *
   * استخدمنا UTC لتجنب اختلاف الحساب بسبب timezone
   * الجهاز.
   */
  const daysRemaining = (() => {
    if (!subscription?.renewal_date) {
      return null
    }

    const today = new Date()

    const todayUTC = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate()
    )

    const [year, month, day] =
      subscription.renewal_date
        .split('-')
        .map(Number)

    if (
      !year ||
      !month ||
      !day
    ) {
      return null
    }

    const renewalUTC = Date.UTC(
      year,
      month - 1,
      day
    )

    return Math.max(
      0,
      Math.ceil(
        (renewalUTC - todayUTC) /
          (1000 * 60 * 60 * 24)
      )
    )
  })()

  /*
   * الحالة الحقيقية للاشتراك.
   *
   * مهم:
   * حتى لو كانت status = active،
   * الاشتراك يصبح منتهيًا بمجرد مرور renewal_date.
   */
  const isDateExpired =
    subscription?.renewal_date !== null &&
    subscription?.renewal_date !== undefined &&
    daysRemaining === 0

  const isSubscriptionStatusActive =
    rawStatus === 'active' ||
    rawStatus === 'trialing'

  const isPendingPayment =
    rawStatus === 'pending_payment' ||
    rawStatus === 'pending_review'

  const isCancelled =
    rawStatus === 'cancelled' ||
    rawStatus === 'canceled'

  /*
   * الاشتراك فعال فقط إذا:
   *
   * 1. الحالة active/trialing
   * 2. ولم ينتهِ التاريخ.
   */
  const isActive =
    isSubscriptionStatusActive &&
    !isDateExpired

  const isExpired =
    rawStatus === 'expired' ||
    isCancelled ||
    rawStatus === 'no_subscription' ||
    (isSubscriptionStatusActive &&
      isDateExpired)

  /*
   * حالة العرض في الواجهة.
   */
  let accessState: SubscriptionAccessState = 'unknown'

  if (isExpired) {
    accessState = 'expired'
  } else if (isPendingPayment) {
    accessState = 'pending_payment'
  } else if (isActive) {
    if (daysRemaining === 0) {
      accessState = 'expires_today'
    } else if (
      daysRemaining !== null &&
      daysRemaining <= 7
    ) {
      accessState = 'expiring_soon'
    } else {
      accessState = 'active'
    }
  } else {
    accessState = 'unknown'
  }

  /*
   * تاريخ انتهاء الاشتراك بصيغة عربية.
   */
  const formattedRenewalDate =
    subscription?.renewal_date
      ? new Intl.DateTimeFormat(
          'ar-EG',
          {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }
        ).format(
          new Date(
            `${subscription.renewal_date}T00:00:00`
          )
        )
      : null

  /*
   * التأكد من صلاحية Feature معينة
   * حسب الباقة الحالية.
   */
  const hasFeature = (
    key: string
  ) => {
    if (!isActive) {
      return false
    }

    return Boolean(
      subscription?.plan?.features?.[key]
    )
  }

  /*
   * الحصول على Limit من الباقة.
   */
  const getLimit = (
    key: string
  ) => {
    if (!isActive) {
      return 0
    }

    return (
      subscription?.plan?.limits?.[key] ??
      0
    )
  }

  return {
    subscription,

    loading,
    error,

    status: rawStatus,

    accessState,

    isActive,
    isExpired,
    isPendingPayment,

    daysRemaining,

    formattedRenewalDate,

    hasFeature,
    getLimit,

    plan:
      subscription?.plan ?? null,
  }
}
