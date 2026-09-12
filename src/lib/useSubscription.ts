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
  billing_cycle: string | null
  started_at: string | null
  expires_at: string | null
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
        const { data, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select(`
            id,
            status,
            renewal_date,
            billing_cycle,
            started_at,
            expires_at,
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
            billing_cycle: null,
            started_at: null,
            expires_at: null,
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
          renewal_date: data.renewal_date ?? null,
          billing_cycle: data.billing_cycle ?? null,
          started_at: data.started_at ?? null,
          expires_at: data.expires_at ?? null,
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
   * expires_at هو المصدر الأساسي.
   * renewal_date يظل fallback للبيانات القديمة.
   */
  const effectiveExpiryDate =
    subscription?.expires_at ??
    subscription?.renewal_date ??
    null

  /*
   * expires_at قد يأتي من Supabase كتاريخ فقط:
   * 2026-10-12
   *
   * أو كتوقيت:
   * 2026-10-12T21:30:00+00:00
   *
   * نستخدم أول 10 أحرف للحصول على تاريخ التقويم
   * بدون التأثر بالـ timezone.
   */
  const expiryDateOnly = effectiveExpiryDate
    ? effectiveExpiryDate.slice(0, 10)
    : null

  const daysRemaining = (() => {
    if (!expiryDateOnly) {
      return null
    }

    const today = new Date()

    const todayUTC = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate()
    )

    const [year, month, day] =
      expiryDateOnly.split('-').map(Number)

    if (!year || !month || !day) {
      return null
    }

    const expiryUTC = Date.UTC(
      year,
      month - 1,
      day
    )

    return Math.max(
      0,
      Math.ceil(
        (expiryUTC - todayUTC) /
          (1000 * 60 * 60 * 24)
      )
    )
  })()

  /*
   * الاشتراك يعتبر منتهيًا فقط إذا مر تاريخ الانتهاء.
   *
   * إذا كان تاريخ الانتهاء هو اليوم،
   * يظل الاشتراك فعالًا خلال اليوم الحالي.
   */
  const isDateExpired = (() => {
    if (!expiryDateOnly) {
      return false
    }

    const today = new Date()

    const todayUTC = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate()
    )

    const [year, month, day] =
      expiryDateOnly.split('-').map(Number)

    if (!year || !month || !day) {
      return false
    }

    const expiryUTC = Date.UTC(
      year,
      month - 1,
      day
    )

    return expiryUTC < todayUTC
  })()

  const isSubscriptionStatusActive =
    rawStatus === 'active' ||
    rawStatus === 'trialing'

  const isPendingPayment =
    rawStatus === 'pending_payment' ||
    rawStatus === 'pending_review'

  const isCancelled =
    rawStatus === 'cancelled' ||
    rawStatus === 'canceled'

  const isActive =
    isSubscriptionStatusActive &&
    !isDateExpired

  /*
   * cancelled لا يعني expired.
   * no_subscription لا يعني expired.
   * نحتفظ بالحالات بشكل منفصل حتى تستخدمها الواجهة
   * والـ ProtectedRoute بشكل صحيح.
   */
  const isExpired =
    rawStatus === 'expired' ||
    (
      isSubscriptionStatusActive &&
      isDateExpired
    )

  let accessState: SubscriptionAccessState = 'unknown'

  if (rawStatus === 'no_subscription') {
    accessState = 'no_subscription'
  } else if (isCancelled) {
    accessState = 'cancelled'
  } else if (isExpired) {
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
  const formattedRenewalDate = expiryDateOnly
    ? new Intl.DateTimeFormat('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(
        new Date(
          `${expiryDateOnly}T00:00:00`
        )
      )
    : null

  /*
   * التحقق من Features حسب الباقة الحالية.
   */
  const hasFeature = (key: string) => {
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
  const getLimit = (key: string) => {
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

    /*
     * بيانات الاشتراك الحقيقية.
     */
    billingCycle:
      subscription?.billing_cycle ?? null,

    startedAt:
      subscription?.started_at ?? null,

    expiresAt:
      subscription?.expires_at ??
      subscription?.renewal_date ??
      null,

    formattedRenewalDate,

    hasFeature,
    getLimit,

    plan:
      subscription?.plan ?? null,
  }
}
