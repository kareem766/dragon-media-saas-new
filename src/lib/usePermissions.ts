import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

interface Permission { can_view: boolean; can_edit: boolean; can_delete: boolean }

const roleLabels: Record<string, string> = {
  super_admin: 'مدير عام',
  admin: 'أدمن',
  sales: 'مبيعات',
  support: 'خدمة عملاء',
  employee: 'موظف',
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
    sb.from('users').select('role, is_platform_admin').eq('id', user.id).maybeSingle().then(async ({ data: userRow, error }) => {
      if (cancelled) return
      if (error || !userRow) {
        setRole(null)
        setPermissions({})
        setLoading(false)
        return
      }
      const currentRole = String(userRow.role || '')
      setRole(currentRole || null)
      const { data } = await sb.from('role_permissions').select('resource, can_view, can_edit, can_delete').eq('role', currentRole)
      if (cancelled) return
      const map: Record<string, Permission> = {}
      ;(data || []).forEach((permission) => {
        map[permission.resource] = { can_view: Boolean(permission.can_view), can_edit: Boolean(permission.can_edit), can_delete: Boolean(permission.can_delete) }
      })
      setPermissions(map)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [user?.id])

  useEffect(() => {
    if (!role) return
    const root = document.documentElement
    root.dataset.dmRole = role
    root.style.setProperty('--dm-role-label', JSON.stringify(roleLabels[role] || role))

    const styleId = 'dm-role-visibility'
    let style = document.getElementById(styleId) as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = styleId
      document.head.appendChild(style)
    }

    const employeeRoles = ['employee', 'sales', 'support']
    const shouldHideBilling = employeeRoles.includes(role)
    style.textContent = `
      html[data-dm-role="${role}"] header button[aria-label="قائمة الحساب"] > div > p:nth-child(2)::after {
        content: var(--dm-role-label);
        display: block;
        margin-top: 2px;
        font-size: 10px;
        line-height: 1.4;
        font-weight: 700;
        color: #64748b;
      }
      ${shouldHideBilling ? `
        html[data-dm-role="${role}"] a[href="#/billing"],
        html[data-dm-role="${role}"] a[href="#/plans"],
        html[data-dm-role="${role}"] a[href="#/billing/pay"],
        html[data-dm-role="${role}"] .dm-sidebar div:has(> a[href="#/billing"]) { display: none !important; }
      ` : ''}
    `

    return () => {
      if (root.dataset.dmRole === role) {
        delete root.dataset.dmRole
        root.style.removeProperty('--dm-role-label')
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
