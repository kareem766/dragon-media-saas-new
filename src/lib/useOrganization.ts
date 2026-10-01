import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

export function useOrganization() {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (authLoading) return null

    if (!supabase || !userId) {
      setLoadedUserId(null)
      setOrganizationId(null)
      setNeedsOnboarding(false)
      setError(null)
      setLoading(false)
      return null
    }

    setLoading(true)
    setLoadedUserId(null)
    setNeedsOnboarding(false)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', userId)
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
    setLoadedUserId(userId)
    return data?.organization_id ? (data.organization_id as string) : null
  }, [userId, authLoading])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const effectiveLoading = loading || (userId ? loadedUserId !== userId : false)

  return { organizationId, loading: effectiveLoading, error, needsOnboarding, refresh }
}
