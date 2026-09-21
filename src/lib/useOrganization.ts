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
      setOrganizationId(null)
      setNeedsOnboarding(false)
      setError(null)
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
        if (error) {
          setOrganizationId(null)
          setNeedsOnboarding(false)
          setError(error.message)
        } else if (!data || !data.organization_id) {
          // A confirmed auth user can exist before the app-level organization row.
          // Send that user to workspace setup instead of falling through.
          setOrganizationId(null)
          setNeedsOnboarding(true)
        } else {
          setOrganizationId(data.organization_id as string)
          setNeedsOnboarding(false)
        }

        setLoading(false)
      })
  }, [user, authLoading])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { organizationId, loading, error, needsOnboarding, refresh }
}
