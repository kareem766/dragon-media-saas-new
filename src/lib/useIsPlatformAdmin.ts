import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

export function useIsPlatformAdmin() {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    if (authLoading) return

    if (!supabase || !user) {
      setIsAdmin(false)
      setLoading(false)
      return
    }

    setLoading(true)

    supabase
      .from('users')
      .select('is_platform_admin, active')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return

        if (error) {
          console.error('platform admin check failed:', error.message)
          setIsAdmin(false)
          setLoading(false)
          return
        }

        setIsAdmin(Boolean(data?.is_platform_admin && data?.active !== false))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  return { isAdmin, loading }
}
