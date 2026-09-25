import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

export function useOrganization() {
  const { user, loading: authLoading } = useAuth()
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (authLoading) return null

    if (!supabase || !user) {
      setOrganizationId(null)
      setNeedsOnboarding(false)
      setError(null)
      setLoading(false)
      return null
    }

    setLoading(true)
    setNeedsOnboarding(false)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()

    if (queryError) {
      setOrganizationId(null)
      setNeedsOnboarding(false)
      setError(queryError.message)
    } else if (!data || !data.organization_id) {
      setOrganizationId(null)
      setNeedsOnboarding(true)
    } else {
      setOrganizationId(data.organization_id as string)
      setNeedsOnboarding(false)
    }

    setLoading(false)
    return data?.organization_id ? (data.organization_id as string) : null
  }, [user, authLoading])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { organizationId, loading, error, needsOnboarding, refresh }
}
