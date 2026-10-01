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
  features_snapshot?: Record<string, boolean> | null
  limits_snapshot?: Record<string, number> | null
  plan: PlanData | null
}

export type SubscriptionAccessState = 'active' | 'expiring_soon' | 'expires_today' | 'expired' | 'pending_payment' | 'cancelled' | 'no_subscription' | 'unknown'

const managerRoles = new Set(['admin', 'super_admin'])

export function useSubscription() {
  const { user } = useAuth()
  const { organizationId, loading: organizationLoading } = useOrganization()
  const { isAdmin, loading: platformAdminLoading } = useIsPlatformAdmin()
  const [role, setRole] = useState<string | null>(null)
  const [roleLoaded, setRoleLoaded] = useState(false)
  const [platformFeatures, setPlatformFeatures] = useState<Set<string>>(new Set())
  const [platformFeaturesLoaded, setPlatformFeaturesLoaded] = useState(false)
  const [rawSubscription, setRawSubscription] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canManageSubscription = isAdmin || managerRoles.has(role || '')

  useEffect(() => {
    let cancelled = false
    const loadPlatformFeatures = async () => {
      if (!supabase || !user?.id) {
        if (!cancelled) {
          setPlatformFeatures(new Set())
          setPlatformFeaturesLoaded(false)
        }
        return
      }
      const { data, error } = await supabase.rpc('platform_enabled_features')
      if (cancelled) return
      if (error) {
        // Keep the platform available if a non-critical feature-control read fails.
        setPlatformFeatures(new Set())
        setPlatformFeaturesLoaded(false)
        return
      }
      const enabled = new Set<string>(
        (data || [])
          .map((row: { feature_key?: string }) => String(row?.feature_key || ''))
          .filter(Boolean)
      )
      setPlatformFeatures(enabled)
      setPlatformFeaturesLoaded(true)
    }
    void loadPlatformFeatures()
    return () => { cancelled = true }
  }, [user?.id])

  useEffect(() => {
    let cancelled = false
    const loadRole = async () => {
      setRoleLoaded(false)
      if (!supabase || !user?.id) {
        if (!cancelled) {
          setRole(null)
          setRoleLoaded(true)
        }
        return
      }
      const { data, error: roleError } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
      if (!cancelled) {
        setRole(data?.role ? String(data.role) : null)
        setRoleLoaded(true)
        if (roleError) setError(roleError.message)
      }
    }
    void loadRole()
    return () => { cancelled = true }
  }, [user?.id])

  useEffect(() => {
    let cancelled = false
    const loadSubscription = async () => {
      if (organizationLoading || platformAdminLoading || !roleLoaded) return
      setLoading(true)
      setLoadedUserId(null)
      setError(null)
      setRawSubscription(null)
      if (isAdmin) {
        if (!cancelled) { setRawSubscription(null); setLoadedUserId(user?.id ?? null); setLoading(false) }
        return
      }
      if (!supabase || !organizationId) {
        if (!cancelled) { setRawSubscription(null); setLoadedUserId(user?.id ?? null); setLoading(false) }
        return
      }
      setError(null)
      try {
        const { data, error: subscriptionError } = await supabase.from('subscriptions').select(`
          id, status, renewal_date, billing_cycle, started_at, expires_at, plan_id, features_snapshot, limits_snapshot,
          plans (id, name, price, currency, billing_cycle, features, limits, trial_days, status, sort_order, yearly_price, is_popular, tagline)
        `).eq('organization_id', organizationId).order('renewal_date', { ascending: false, nullsFirst: false }).limit(10)
        if (subscriptionError) throw subscriptionError
        if (cancelled) return
        if (!data || data.length === 0) {
          setRawSubscription({ id: '', status: 'no_subscription', renewal_date: null, billing_cycle: null, started_at: null, expires_at: null, plan_id: null, plan: null })
          setLoadedUserId(user?.id ?? null)
          return
        }

        // Prefer the currently active subscription over a newer payment request.
        // A pending upgrade/renewal must never temporarily remove the customer's
        // existing access while the platform admin reviews the payment.
        const rows = Array.isArray(data) ? data : [data]
        const selected =
          rows.find((row: any) => row?.status === 'active' || row?.status === 'trialing') ??
          rows.find((row: any) => row?.status === 'pending_payment' || row?.status === 'pending_review') ??
          rows[0]

        const plan = Array.isArray(selected.plans) ? selected.plans[0] ?? null : selected.plans ?? null
        setRawSubscription({
          id: selected.id,
          status: selected.status ?? 'pending_payment',
          renewal_date: selected.renewal_date ?? null,
          billing_cycle: selected.billing_cycle ?? null,
          started_at: selected.started_at ?? null,
          expires_at: selected.expires_at ?? null,
          plan_id: selected.plan_id,
          features_snapshot: selected.features_snapshot ?? null,
          limits_snapshot: selected.limits_snapshot ?? null,
          plan: plan ? ({ ...plan, features: selected.features_snapshot ?? plan.features ?? {}, limits: selected.limits_snapshot ?? plan.limits ?? {} } as PlanData) : null
        })
        setLoadedUserId(user?.id ?? null)
      } catch (err: any) {
        if (cancelled) return
        setRawSubscription(null)
        setError(err?.message || 'تعذر تحميل بيانات الاشتراك.')
        setLoadedUserId(user?.id ?? null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadSubscription()
    return () => { cancelled = true }
  }, [organizationId, organizationLoading, isAdmin, platformAdminLoading, roleLoaded])

  const effectiveLoading = loading || (user?.id ? loadedUserId !== user.id : false)

  const rawStatus = rawSubscription?.status ?? 'no_subscription'
  const effectiveExpiryDate = rawSubscription?.expires_at ?? rawSubscription?.renewal_date ?? null
  const expiryDateOnly = effectiveExpiryDate ? effectiveExpiryDate.slice(0, 10) : null
  const daysRemainingInternal = (() => {
    if (!expiryDateOnly) return null
    const today = new Date()
    const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    const [year, month, day] = expiryDateOnly.split('-').map(Number)
    if (!year || !month || !day) return null
    return Math.max(0, Math.ceil((Date.UTC(year, month - 1, day) - todayUTC) / (1000 * 60 * 60 * 24)))
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
  const rawPendingPayment = rawStatus === 'pending_payment' || rawStatus === 'pending_review'
  const isCancelled = rawStatus === 'cancelled' || rawStatus === 'canceled'
  const rawIsActive = isSubscriptionStatusActive && !isDateExpired
  const rawIsExpired = rawStatus === 'expired' || (isSubscriptionStatusActive && isDateExpired)

  // Never expose a concrete subscription state while the initial subscription
  // query is still resolving. Consumers use this state to decide whether to
  // show onboarding/welcome or a locked screen, so an early "no_subscription"
  // value can cause a visible lock flicker for new accounts.
  let accessState: SubscriptionAccessState = 'unknown'
  if (!effectiveLoading && rawStatus === 'no_subscription') accessState = 'no_subscription'
  else if (isCancelled) accessState = 'cancelled'
  else if (rawIsExpired) accessState = 'expired'
  else if (rawPendingPayment) accessState = 'pending_payment'
  else if (rawIsActive) accessState = daysRemainingInternal === 0 ? 'expires_today' : daysRemainingInternal !== null && daysRemainingInternal <= 7 ? 'expiring_soon' : 'active'

  const formattedRenewalDateInternal = expiryDateOnly ? new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${expiryDateOnly}T00:00:00`)) : null

  const effectiveIsActive = isAdmin || !canManageSubscription ? true : rawIsActive
  const effectiveIsExpired = isAdmin ? false : canManageSubscription ? rawIsExpired : false
  const effectivePendingPayment = isAdmin ? false : canManageSubscription ? rawPendingPayment : false

  const hasFeature = (key: string) => {
    if (isAdmin) return true
    if (platformFeaturesLoaded) {
      const requiredPlatformKeys = key === 'advanced_reports' ? ['reports', 'advanced_reports'] : [key]
      if (requiredPlatformKeys.some(platformKey => !platformFeatures.has(platformKey))) return false
    }
    if (!rawIsActive) return false
    return Boolean(rawSubscription?.plan?.features?.[key])
  }

  const getLimit = (key: string) => {
    if (isAdmin || !canManageSubscription) return Number.POSITIVE_INFINITY
    if (!rawIsActive) return 0
    return rawSubscription?.plan?.limits?.[key] ?? 0
  }

  return {
    subscription: rawSubscription,
    loading: effectiveLoading,
    error,
    status: rawStatus,
    accessState,
    isActive: effectiveIsActive,
    isExpired: effectiveIsExpired,
    isPendingPayment: effectivePendingPayment,
    daysRemaining: daysRemainingInternal,
    billingCycle: rawSubscription?.billing_cycle ?? null,
    startedAt: rawSubscription?.started_at ?? null,
    expiresAt: rawSubscription?.expires_at ?? rawSubscription?.renewal_date ?? null,
    formattedRenewalDate: formattedRenewalDateInternal,
    hasFeature,
    platformFeaturesLoaded,
    isPlatformAdmin: isAdmin,
    canManageSubscription,
    getLimit,
    plan: rawSubscription?.plan ?? null,
  }
}
