import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

export function useIsPlatformAdmin() {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (authLoading) return

    if (!supabase || !userId) {
      setIsAdmin(false)
      setLoadedUserId(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadedUserId(null)

    supabase
      .from('users')
      .select('is_platform_admin, active')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return

        if (error) {
          console.error('platform admin check failed:', error.message)
          setIsAdmin(false)
          setLoadedUserId(userId)
          setLoading(false)
          return
        }

        setIsAdmin(Boolean(data?.is_platform_admin && data?.active !== false))
        setLoadedUserId(userId)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId, authLoading])

  return { isAdmin, loading: loading || (userId ? loadedUserId !== userId : false) }
}
