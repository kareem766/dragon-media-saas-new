import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useOrganization } from './useOrganization'

interface PlanData {
  id: string
  name: string
  price: number
  features: Record<string, boolean>
  limits: Record<string, number>
}

interface SubscriptionData {
  status: string
  renewal_date: string | null
  plan: PlanData | null
}

export function useSubscription() {
  const { organizationId, loading: orgLoading } = useOrganization()
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (orgLoading) return
    if (!supabase || !organizationId) { setLoading(false); return }
    supabase
      .from('subscriptions')
      .select('status, renewal_date, plans(id, name, price, features, limits)')
      .eq('organization_id', organizationId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSubscription({
            status: data.status,
            renewal_date: data.renewal_date,
            plan: data.plans as unknown as PlanData,
          })
        } else {
          setSubscription({ status: 'no_subscription', renewal_date: null, plan: null })
        }
        setLoading(false)
      })
  }, [organizationId, orgLoading])

  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'
  const hasFeature = (key: string) => Boolean(subscription?.plan?.features?.[key])

  return { subscription, loading, isActive, hasFeature }
}
