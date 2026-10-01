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

    // Immediately after SIGNED_IN Supabase can finish publishing the session
    // before the first authenticated PostgREST request is ready. Do not expose
    // that transient failure to the UI. Retry once before declaring that the
    // user's organization could not be loaded.
    let queryError: { message: string } | null = null
    let data: { organization_id: string | null } | null = null

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', userId)
        .maybeSingle()

      data = result.data as { organization_id: string | null } | null
      queryError = result.error ? { message: result.error.message } : null

      if (!queryError) break
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250))
    }

    if (queryError) {
      setOrganizationId(null)
      setNeedsOnboarding(false)
      setError(queryError.message)
    } else if (!data || !data.organization_id) {
      setOrganizationId(null)
      setNeedsOnboarding(true)
    } else {
      setOrganizationId(data.organization_id)
      setNeedsOnboarding(false)
    }

    setLoading(false)
    setLoadedUserId(userId)
    return data?.organization_id ? data.organization_id : null
  }, [userId, authLoading])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const effectiveLoading = loading || (userId ? loadedUserId !== userId : false)

  return { organizationId, loading: effectiveLoading, error, needsOnboarding, refresh }
}
