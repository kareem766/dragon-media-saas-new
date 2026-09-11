import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useIsPlatformAdmin } from '../lib/useIsPlatformAdmin'

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth()
  const { isAdmin, loading: adminLoading } = useIsPlatformAdmin()

  if (authLoading || adminLoading) {
    return (
      <div
        dir="rtl"
        className="h-screen flex items-center justify-center bg-sand-50"
      >
        <div className="w-10 h-10 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
