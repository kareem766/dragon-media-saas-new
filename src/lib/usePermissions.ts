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
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    if (!supabase || !user) {
      setRole(null)
      setPermissions({})
      setLoading(false)
      return
    }

    setLoading(true)
    const sb = supabase

    sb.from('users')
      .select('role, is_platform_admin')
      .eq('id', user.id)
      .maybeSingle()
      .then(async ({ data: userRow, error }) => {
        if (cancelled) return

        if (error || !userRow) {
          setRole(null)
          setPermissions({})
          setLoading(false)
          return
        }

        const currentRole = String(userRow.role || '')
        setRole(currentRole || null)

        const { data } = await sb
          .from('role_permissions')
          .select('resource, can_view, can_edit, can_delete')
          .eq('role', currentRole)

        if (cancelled) return

        const map: Record<string, Permission> = {}
        ;(data || []).forEach((permission) => {
          map[permission.resource] = {
            can_view: Boolean(permission.can_view),
            can_edit: Boolean(permission.can_edit),
            can_delete: Boolean(permission.can_delete),
          }
        })

        setPermissions(map)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  // Keep subscription/billing UI out of employee navigation even if an old
  // cached permission record briefly exists in the browser.
  useEffect(() => {
    if (!role) return

    document.documentElement.dataset.dmRole = role

    const styleId = 'dm-role-visibility'
    let style = document.getElementById(styleId) as HTMLStyleElement | null

    if (!style) {
      style = document.createElement('style')
      style.id = styleId
      document.head.appendChild(style)
    }

    const employeeRoles = ['employee', 'sales', 'support']
    const shouldHideBilling = employeeRoles.includes(role)

    style.textContent = shouldHideBilling
      ? `
        html[data-dm-role="${role}"] a[href="#/billing"],
        html[data-dm-role="${role}"] a[href="#/plans"],
        html[data-dm-role="${role}"] a[href="#/billing/pay"] { display: none !important; }
      `
      : ''

    return () => {
      if (document.documentElement.dataset.dmRole === role) {
        delete document.documentElement.dataset.dmRole
      }
    }
  }, [role])

  const can = (resource: string, action: 'view' | 'edit' | 'delete') => {
    const key = action === 'view' ? 'can_view' : action === 'edit' ? 'can_edit' : 'can_delete'
    return Boolean(permissions[resource]?.[key])
  }

  const canManageSubscription = role === 'admin' || role === 'super_admin'

  return { can, loading, role, canManageSubscription }
}
