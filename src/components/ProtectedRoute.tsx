import React, { useEffect, useState } from 'react'
import { Navigate, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useOrganization } from '../lib/useOrganization'
import { supabase } from '../lib/supabaseClient'
import Onboarding from '../pages/Onboarding'

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode
}) {
  const {
    session,
    loading: authLoading,
    signOut,
  } = useAuth()

  const {
    organizationId,
    loading: orgLoading,
    needsOnboarding,
    error: organizationError,
    refresh,
  } = useOrganization()

  const [suspended, setSuspended] = useState(false)
  const [suspensionError, setSuspensionError] = useState<string | null>(null)
  const [checkingSuspend, setCheckingSuspend] = useState(true)

  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    async function checkSuspension() {
      if (!organizationId || !supabase) {
        if (!cancelled) {
          setSuspended(false)
          setSuspensionError(null)
          setCheckingSuspend(false)
        }
        return
      }

      setCheckingSuspend(true)
      setSuspensionError(null)

      const { data, error } = await supabase
        .from('organizations')
        .select('suspended')
        .eq('id', organizationId)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        setSuspensionError(error.message)
        setSuspended(false)
      } else {
        setSuspended(Boolean(data?.suspended))
      }

      setCheckingSuspend(false)
    }

    checkSuspension()

    return () => {
      cancelled = true
    }
  }, [organizationId])

  if (
    authLoading ||
    orgLoading ||
    (organizationId && checkingSuspend)
  ) {
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

  if (organizationError) {
    return (
      <div
        dir="rtl"
        className="h-screen flex items-center justify-center bg-sand-50 p-6"
      >
        <div className="w-full max-w-md rounded-2xl bg-white border border-ink-900/10 p-6 text-center shadow-sm">
          <h2 className="text-lg font-bold text-ink-950">
            تعذر تحميل بيانات الحساب
          </h2>

          <p className="text-sm text-ink-900/60 mt-2">
            حدث خطأ أثناء تحميل بيانات الشركة. حاول مرة أخرى.
          </p>

          <button
            type="button"
            onClick={refresh}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-ink-900 text-sand-50 px-5 py-2.5 text-sm font-semibold hover:bg-ink-800 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    )
  }

  if (needsOnboarding) {
    return <Onboarding onDone={refresh} />
  }

  if (suspensionError) {
    return (
      <div
        dir="rtl"
        className="h-screen flex items-center justify-center bg-sand-50 p-6"
      >
        <div className="w-full max-w-md rounded-2xl bg-white border border-ink-900/10 p-6 text-center shadow-sm">
          <h2 className="text-lg font-bold text-ink-950">
            تعذر التحقق من حالة الحساب
          </h2>

          <p className="text-sm text-ink-900/60 mt-2">
            لم نتمكن من التحقق من حالة حساب الشركة. حاول مرة أخرى.
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-ink-900 text-sand-50 px-5 py-2.5 text-sm font-semibold hover:bg-ink-800 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    )
  }

  if (suspended) {
    const handleLogout = async () => {
      await signOut()
      navigate('/login', { replace: true })
    }

    return (
      <div
        dir="rtl"
        className="h-screen flex flex-col items-center justify-center bg-sand-50 p-6 relative"
      >
        <button
          type="button"
          onClick={handleLogout}
          className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-ink-900/60 hover:text-ink-900 transition-colors"
        >
          <span>→</span>
          تسجيل الخروج
        </button>

        <div className="text-center max-w-sm">
          <div className="text-4xl mb-3">⛔</div>

          <h2 className="font-bold text-lg text-ink-950">
            تم تعليق هذا الحساب
          </h2>

          <p className="text-sm text-ink-900/55 mt-2">
            لمزيد من التفاصيل حول سبب التعليق أو لإعادة تفعيل حسابك، تواصل مع فريق الدعم.
          </p>

          <Link
            to="/support"
            className="inline-block mt-4 bg-ink-900 text-sand-50 rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-ink-800 transition-colors"
          >
            تواصل مع فريق الدعم
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
