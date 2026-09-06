import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

export function useIsPlatformAdmin() {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!supabase || !user) {
      setLoading(false)
      return
    }
    supabase.from('users').select('is_platform_admin').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        setIsAdmin(Boolean(data?.is_platform_admin))
        setLoading(false)
      })
  }, [user, authLoading])

  return { isAdmin, loading }
}
