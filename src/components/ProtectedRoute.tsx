import React, { useCallback, useEffect, useState } from 'react'
import {
  Navigate,
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useOrganization } from '../lib/useOrganization'
import { useSubscription } from '../lib/useSubscription'
import { supabase } from '../lib/supabaseClient'
import Onboarding from '../pages/Onboarding'

const SUBSCRIPTION_ALLOWED_PATHS = [
  '/plans',
  '/billing',
  '/billing/pay',
  '/account',
  '/settings',
]

function isSubscriptionAllowedPath(pathname: string) {
  return SUBSCRIPTION_ALLOWED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode
}) {
  const { session, user, loading: authLoading, signOut } = useAuth()
  const { organizationId, loading: orgLoading, needsOnboarding, error: organizationError, refresh } = useOrganization()
  const { loading: subscriptionLoading, isActive, isPendingPayment, isExpired, status, error: subscriptionError } = useSubscription()
  const location = useLocation()
  const navigate = useNavigate()

  const [suspended, setSuspended] = useState(false)
  const [suspensionError, setSuspensionError] = useState<string | null>(null)
  const [checkingSuspend, setCheckingSuspend] = useState(true)
  const [initialChecksReady, setInitialChecksReady] = useState(false)
  const [readyUserId, setReadyUserId] = useState<string | null>(null)

  const handleOnboardingDone = useCallback(async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const nextOrganizationId = await refresh()
      if (nextOrganizationId) {
        navigate('/', { replace: true })
        return
      }
      if (attempt < 5) await new Promise((resolve) => window.setTimeout(resolve, 350))
    }
  }, [refresh, navigate])

  useEffect(() => {
    setInitialChecksReady(false)
    setReadyUserId(null)
    setSuspended(false)
    setSuspensionError(null)
    setCheckingSuspend(true)
  }, [user?.id])

  // Do not render child pages until the current user's organization has been
  // resolved. Child pages otherwise see organizationId=null for one render
  // and show their red "تعذر تحميل المؤسسة" state even though the lookup is
  // still in progress.
  useEffect(() => {
    if (!authLoading && !user?.id) {
      setReadyUserId(null)
      setInitialChecksReady(true)
      return
    }

    const organizationResolved = Boolean(organizationId) || needsOnboarding

    if (
      !authLoading &&
      !orgLoading &&
      organizationResolved &&
      !subscriptionLoading &&
      !(organizationId && checkingSuspend) &&
      !!user?.id &&
      readyUserId !== user.id
    ) {
      setReadyUserId(user.id)
      setInitialChecksReady(true)
    }
  }, [authLoading, orgLoading, subscriptionLoading, organizationId, needsOnboarding, checkingSuspend, user?.id, readyUserId])

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
    return () => { cancelled = true }
  }, [organizationId])

  if (authLoading || !initialChecksReady || (user?.id ? readyUserId !== user.id : false)) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-sand-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (organizationError) {
    return (
      <div dir="rtl" className="h-screen flex items-center justify-center bg-sand-50 p-6">
        <div className="text-center max-w-md">
          <h2 className="font-bold text-lg text-ink-950">تعذر تحميل بيانات الحساب</h2>
          <p className="text-sm text-ink-900/60 mt-2">حدث خطأ أثناء تحميل بيانات الشركة. حاول مرة أخرى.</p>
          <button type="button" onClick={refresh} className="mt-5 inline-flex items-center justify-center rounded-lg bg-ink-900 text-sand-50 px-5 py-2.5 text-sm font-semibold hover:bg-ink-800 transition-colors">إعادة المحاولة</button>
        </div>
      </div>
    )
  }

  if (needsOnboarding) return <Onboarding onDone={handleOnboardingDone} />

  if (suspensionError) {
    return (
      <div dir="rtl" className="h-screen flex items-center justify-center bg-sand-50 p-6">
        <div className="text-center max-w-md">
          <h2 className="font-bold text-lg text-ink-950">تعذر التحقق من حالة المؤسسة</h2>
          <p className="text-sm text-ink-900/60 mt-2">حاول مرة أخرى بعد لحظات.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 inline-flex items-center justify-center rounded-lg bg-ink-900 text-sand-50 px-5 py-2.5 text-sm font-semibold hover:bg-ink-800 transition-colors">إعادة المحاولة</button>
        </div>
      </div>
    )
  }

  if (suspended) {
    return (
      <div dir="rtl" className="h-screen flex items-center justify-center bg-sand-50 p-6">
        <div className="text-center max-w-md">
          <h2 className="font-bold text-lg text-ink-950">المؤسسة موقوفة مؤقتًا</h2>
          <p className="text-sm text-ink-900/60 mt-2">تواصل مع مسؤول المنصة لمعرفة التفاصيل.</p>
          <button type="button" onClick={signOut} className="mt-5 inline-flex items-center justify-center rounded-lg bg-ink-900 text-sand-50 px-5 py-2.5 text-sm font-semibold hover:bg-ink-800 transition-colors">تسجيل الخروج</button>
        </div>
      </div>
    )
  }

  const subscriptionAllowed = isSubscriptionAllowedPath(location.pathname)
  if (!subscriptionLoading && !subscriptionAllowed && !isActive) {
    if (isPendingPayment) return <Navigate to="/billing" replace />
    if (isExpired || status === 'no_subscription' || status === 'rejected') return <Navigate to="/plans" replace />
  }

  if (subscriptionError && !subscriptionAllowed) return <Navigate to="/billing" replace />

  return <>{children}</>
}
