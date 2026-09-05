import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

export function useOrganization() {
  const { user } = useAuth()
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !user) {
      setLoading(false)
      return
    }
    supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setOrganizationId((data?.organization_id as string) ?? null)
        setLoading(false)
      })
  }, [user])

  return { organizationId, loading }
}
