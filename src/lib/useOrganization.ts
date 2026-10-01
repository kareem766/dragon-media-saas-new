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
    // Never expose a transient organization error while the auth session is
    // still settling after SIGNED_IN or a browser restore.
    setError(null)

    const client = supabase

    // Ensure the current authenticated session is available to PostgREST
    // before querying the users table. onAuthStateChange can publish SIGNED_IN
    // just before the session is fully usable by the REST client.
    const { data: sessionData } = await client.auth.getSession()
    if (!sessionData.session || sessionData.session.user.id !== userId) {
      setLoading(false)
      setLoadedUserId(userId)
      return null
    }

    let lastError: string | null = null
    let data: { organization_id: string | null } | null = null

    // Transient auth/RLS propagation can make the first request fail for a
    // short moment after login. Retry silently several times. The UI should
    // never flash a red organization error for a recoverable race condition.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await client
        .from('users')
        .select('organization_id')
        .eq('id', userId)
        .maybeSingle()

      data = result.data as { organization_id: string | null } | null
      lastError = result.error?.message ?? null

      if (!lastError) break

      if (attempt < 4) {
        await new Promise((resolve) => window.setTimeout(resolve, 350))
      }
    }

    if (lastError) {
      // Keep the authenticated shell usable while the data layer recovers.
      // A later explicit refresh can still retry; do not flash an error page
      // during navigation/login initialization.
      setOrganizationId(null)
      setNeedsOnboarding(false)
      setError(null)
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
