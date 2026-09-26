import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useOrganization } from './useOrganization'
import { useIsPlatformAdmin } from './useIsPlatformAdmin'
import { useAuth } from './AuthContext'

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

const managerRoles = new Set(['admin', 'super_admin'])

export function useSubscription() {
  const { user } = useAuth()
  const { organizationId, loading: organizationLoading } = useOrganization()
  const { isAdmin, loading: platformAdminLoading } = useIsPlatformAdmin()

  const [role, setRole] = useState<string | null>(null)
  const [rawSubscription, setRawSubscription] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canManageSubscription = isAdmin || managerRoles.has(role || '')

  useEffect(() => {
    let cancelled = false

    const loadRole = async () => {
      if (!supabase || !user?.id) {
        setRole(null)
        return
      }

      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (!cancelled) setRole(data?.role ? String(data.role) : null)
    }

    void loadRole()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    let cancelled = false

    const loadSubscription = async () => {
      if (organizationLoading || platformAdminLoading || (user?.id && role === null)) {
        return
      }

      if (isAdmin) {
        if (!cancelled) {
          setRawSubscription(null)
          setLoading(false)
        }
        return
      }

      if (!supabase || !organizationId) {
        if (!cancelled) {
          setRawSubscription(null)
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
          .order('renewal_date', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle()

        if (subscriptionError) throw subscriptionError
        if (cancelled) return

        if (!data) {
          setRawSubscription({
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

        const plan = Array.isArray(data.plans) ? data.plans[0] ?? null : data.plans ?? null

        setRawSubscription({
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
        if (cancelled) return
        setRawSubscription(null)
        setError(err?.message || 'تعذر تحميل بيانات الاشتراك.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadSubscription()

    return () => {
      cancelled = true
    }
  }, [organizationId, organizationLoading, isAdmin, platformAdminLoading, role, user?.id])

  const rawStatus = rawSubscription?.status ?? 'no_subscription'
  const effectiveExpiryDate = rawSubscription?.expires_at ?? rawSubscription?.renewal_date ?? null
  const expiryDateOnly = effectiveExpiryDate ? effectiveExpiryDate.slice(0, 10) : null

  const daysRemainingInternal = (() => {
    if (!expiryDateOnly) return null
    const today = new Date()
    const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    const [year, month, day] = expiryDateOnly.split('-').map(Number)
    if (!year || !month || !day) return null
    const expiryUTC = Date.UTC(year, month - 1, day)
    return Math.max(0, Math.ceil((expiryUTC - todayUTC) / (1000 * 60 * 60 * 24)))
  })()

  const isDateExpired = (() => {
    if (!expiryDateOnly) return false
    const today = new Date()
    const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    const [year, month, day] = expiryDateOnly.split('-').map(Number)
    if (!year || !month || !day) return false
    return Date.UTC(year, month - 1, day) < todayUTC
  })()

  const isSubscriptionStatusActive = rawStatus === 'active' || rawStatus === 'trialing'
  const isPendingPayment = rawStatus === 'pending_payment' || rawStatus === 'pending_review'
  const isCancelled = rawStatus === 'cancelled' || rawStatus === 'canceled'
  const isActive = isSubscriptionStatusActive && !isDateExpired
  const isExpired = rawStatus === 'expired' || (isSubscriptionStatusActive && isDateExpired)

  let accessState: SubscriptionAccessState = 'unknown'
  if (rawStatus === 'no_subscription') accessState = 'no_subscription'
  else if (isCancelled) accessState = 'cancelled'
  else if (isExpired) accessState = 'expired'
  else if (isPendingPayment) accessState = 'pending_payment'
  else if (isActive) accessState = daysRemainingInternal === 0 ? 'expires_today' : daysRemainingInternal !== null && daysRemainingInternal <= 7 ? 'expiring_soon' : 'active'

  const formattedRenewalDateInternal = expiryDateOnly
    ? new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${expiryDateOnly}T00:00:00`))
    : null

  const hasFeature = (key: string) => {
    if (isAdmin) return true
    if (!isActive) return false
    return Boolean(rawSubscription?.plan?.features?.[key])
  }

  const getLimit = (key: string) => {
    if (isAdmin) return Number.POSITIVE_INFINITY
    if (!isActive) return 0
    return rawSubscription?.plan?.limits?.[key] ?? 0
  }

  // Employees can use the workspace according to their role, but subscription
  // identity, plan name, dates and billing state are deliberately not exposed.
  const visibleSubscription = canManageSubscription ? rawSubscription : null
  const visibleDaysRemaining = canManageSubscription ? daysRemainingInternal : null
  const visibleFormattedRenewalDate = canManageSubscription ? formattedRenewalDateInternal : null

  return {
    subscription: visibleSubscription,
    loading,
    error,
    status: rawStatus,
    accessState,
    isActive: isAdmin ? true : isActive,
    isExpired: isAdmin ? false : isExpired,
    isPendingPayment: isAdmin ? false : isPendingPayment,
    daysRemaining: visibleDaysRemaining,
    billingCycle: canManageSubscription ? rawSubscription?.billing_cycle ?? null : null,
    startedAt: canManageSubscription ? rawSubscription?.started_at ?? null : null,
    expiresAt: canManageSubscription ? rawSubscription?.expires_at ?? rawSubscription?.renewal_date ?? null : null,
    formattedRenewalDate: visibleFormattedRenewalDate,
    hasFeature,
    isPlatformAdmin: isAdmin,
    canManageSubscription,
    getLimit,
    plan: canManageSubscription ? rawSubscription?.plan ?? null : null,
  }
}
