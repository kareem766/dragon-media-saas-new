import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

export function useOrganization() {
  const { user, loading: authLoading } = useAuth()
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!supabase || !user) {
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else if (!data) setError('لم يتم ربط حسابك بأي مؤسسة بعد')
        else setOrganizationId(data.organization_id as string)
        setLoading(false)
      })
  }, [user, authLoading])

  return { organizationId, loading, error }
}
