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

type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'expiring_soon'
  | 'expired'
  | 'pending_payment'
  | 'cancelled'
  | 'no_subscription'
  | string

export function useSubscription() {
  const { organizationId, loading: orgLoading } = useOrganization()

  const [subscription, setSubscription] =
    useState<SubscriptionData | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadSubscription = async () => {
      if (orgLoading) {
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
          err?.message || 'تعذر تحميل بيانات الاشتراك.'
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
  }, [organizationId, orgLoading])

  const status: SubscriptionStatus =
    subscription?.status ?? 'no_subscription'

  /*
   * الاشتراك يعتبر فعالًا فقط عندما يكون:
   * active أو trialing
   *
   * أما expiring_soon فهو حالة تحذيرية
   * لكنها لا تعني أن الاشتراك انتهى.
   */
  const isActive =
    status === 'active' ||
    status === 'trialing' ||
    status === 'expiring_soon'

  const isExpired =
    status === 'expired' ||
    status === 'cancelled' ||
    status === 'no_subscription'

  const isPendingPayment =
    status === 'pending_payment'

  const hasFeature = (key: string) => {
    if (!isActive) {
      return false
    }

    return Boolean(
      subscription?.plan?.features?.[key]
    )
  }

  const getLimit = (key: string) => {
    if (!isActive) {
      return 0
    }

    return subscription?.plan?.limits?.[key] ?? 0
  }

  const daysRemaining = (() => {
    if (!subscription?.renewal_date) {
      return null
    }

    const today = new Date()
    const renewalDate = new Date(
      `${subscription.renewal_date}T23:59:59`
    )

    const diff =
      renewalDate.getTime() - today.getTime()

    return Math.max(
      0,
      Math.ceil(diff / (1000 * 60 * 60 * 24))
    )
  })()

  return {
    subscription,
    loading,
    error,

    status,

    isActive,
    isExpired,
    isPendingPayment,

    hasFeature,
    getLimit,

    daysRemaining,

    plan: subscription?.plan ?? null,
  }
}
