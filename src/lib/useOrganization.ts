import { useEffect, useState, useCallback, useRef } from 'react'
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
  const retryTimerRef = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }

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

    const client = supabase
    const { data: sessionData } = await client.auth.getSession()
    if (!sessionData.session || sessionData.session.user.id !== userId) {
      setLoading(true)
      setLoadedUserId(null)
      return null
    }

    let lastError: string | null = null
    let data: { organization_id: string | null } | null = null

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
      // A database/RLS request that fails while the auth session is settling
      // must remain a loading state, not an organization error. Several pages
      // independently consume this hook; exposing loading=false with a null
      // organization makes those pages flash their red error fallback.
      setOrganizationId(null)
      setNeedsOnboarding(false)
      setError(null)
      setLoadedUserId(null)
      setLoading(true)

      // Keep retrying silently. This covers session/RLS propagation races and
      // avoids an error flash during login and navigation. If the account is
      // truly unavailable, the user remains on the neutral loading state
      // instead of being shown a misleading temporary organization error.
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null
        void refresh()
      }, 1000)

      return null
    }

    if (!data || !data.organization_id) {
      setOrganizationId(null)
      setNeedsOnboarding(true)
    } else {
      setOrganizationId(data.organization_id)
      setNeedsOnboarding(false)
    }

    setError(null)
    setLoading(false)
    setLoadedUserId(userId)
    return data?.organization_id ? data.organization_id : null
  }, [userId, authLoading])

  useEffect(() => {
    void refresh()
    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [refresh])

  const effectiveLoading = loading || (userId ? loadedUserId !== userId : false)

  return { organizationId, loading: effectiveLoading, error, needsOnboarding, refresh }
}
