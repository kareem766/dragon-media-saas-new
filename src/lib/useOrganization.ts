import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

export function useOrganization() {
  const { user, loading: authLoading } = useAuth()
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (authLoading) return
    if (!supabase || !user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setNeedsOnboarding(false)
    setError(null)
    supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else if (!data) setNeedsOnboarding(true)
        else setOrganizationId(data.organization_id as string)
        setLoading(false)
      })
  }, [user, authLoading])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { organizationId, loading, error, needsOnboarding, refresh }
}
