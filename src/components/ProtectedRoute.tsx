import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useOrganization } from '../lib/useOrganization'
import { supabase } from '../lib/supabaseClient'
import Onboarding from '../pages/Onboarding'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth()
  const { organizationId, loading: orgLoading, needsOnboarding, refresh } = useOrganization()
  const [suspended, setSuspended] = useState(false)
  const [checkingSuspend, setCheckingSuspend] = useState(true)

  useEffect(() => {
    if (!organizationId || !supabase) { setCheckingSuspend(false); return }
    supabase.from('organizations').select('suspended').eq('id', organizationId).single()
      .then(({ data }) => {
        setSuspended(Boolean(data?.suspended))
        setCheckingSuspend(false)
      })
  }, [organizationId])

  if (authLoading || orgLoading || (organizationId && checkingSuspend)) {
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

  if (suspended) {
    return (
      <div dir="rtl" className="h-screen flex items-center justify-center bg-sand-50 p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-3">⛔</div>
          <h2 className="font-bold text-lg text-ink-950">تم تعليق هذا الحساب</h2>
          <p className="text-sm text-ink-900/55 mt-2">تواصل مع فريق الدعم لمزيد من التفاصيل.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
