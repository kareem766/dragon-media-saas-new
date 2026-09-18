import React from 'react'
import { Navigate } from 'react-router-dom'
import { useIsPlatformAdmin } from '../lib/useIsPlatformAdmin'
import { usePermissions } from '../lib/usePermissions'

export default function PermissionRoute({
  resource,
  children,
}: {
  resource: string
  children: React.ReactNode
}) {
  const { isAdmin, loading: adminLoading } = useIsPlatformAdmin()
  const { can, loading: permissionsLoading } = usePermissions()

  if (adminLoading || permissionsLoading) {
    return (
      <div dir="rtl" className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
      </div>
    )
  }

  if (isAdmin || can(resource, 'view')) return <>{children}</>

  return <Navigate to="/" replace />
}
