import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

interface Permission {
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
}

export function usePermissions() {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<Record<string, Permission>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !user) { setLoading(false); return }
    supabase.from('users').select('role').eq('id', user.id).single()
      .then(async ({ data: userRow }) => {
        if (!userRow) { setLoading(false); return }
        const { data } = await supabase.from('role_permissions').select('resource, can_view, can_edit, can_delete').eq('role', userRow.role)
        if (data) {
          const map: Record<string, Permission> = {}
          data.forEach(p => { map[p.resource] = { can_view: p.can_view, can_edit: p.can_edit, can_delete: p.can_delete } })
          setPermissions(map)
        }
        setLoading(false)
      })
  }, [user])

  const can = (resource: string, action: 'view' | 'edit' | 'delete') => {
    const key = action === 'view' ? 'can_view' : action === 'edit' ? 'can_edit' : 'can_delete'
    return Boolean(permissions[resource]?.[key])
  }

  return { can, loading }
}
