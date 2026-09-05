import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useOrganization } from '../lib/useOrganization'
import Onboarding from '../pages/Onboarding'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth()
  const { loading: orgLoading, needsOnboarding, refresh } = useOrganization()

  if (authLoading || orgLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-sand-50">
        <div className="w-10 h-10 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (needsOnboarding) {
    return <Onboarding onDone={refresh} />
  }

  return <>{children}</>
}
