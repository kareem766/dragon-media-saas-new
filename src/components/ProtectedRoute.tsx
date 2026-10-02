import React, { useCallback, useEffect, useState } from 'react'
import { Navigate, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useOrganization } from '../lib/useOrganization'
import { useSubscription } from '../lib/useSubscription'
import { supabase } from '../lib/supabaseClient'
import { useBranding } from '../hooks/useBranding'
import Onboarding from '../pages/Onboarding'

const SUBSCRIPTION_ALLOWED_PATHS = ['/plans', '/billing', '/billing/pay', '/account', '/settings']
function isSubscriptionAllowedPath(pathname: string) {
  return SUBSCRIPTION_ALLOWED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function PremiumRouteLoader() {
  const { branding, logoUrl } = useBranding()
  const platformName = branding?.platform_name || 'Dragon Media'
  return (
    <div dir="rtl" className="dm-loader-screen" role="status" aria-live="polite" aria-label={`جاري تحميل ${platformName}`}>
      <div className="dm-loader-orbit dm-loader-orbit-one" aria-hidden="true" />
      <div className="dm-loader-orbit dm-loader-orbit-two" aria-hidden="true" />
      <div className="dm-loader-brand">
        <div className="dm-loader-logo-wrap">
          <span className="dm-loader-logo-ring" aria-hidden="true" />
          <span className="dm-loader-logo-ring dm-loader-logo-ring-inner" aria-hidden="true" />
          <img src={logoUrl} alt="" className="dm-loader-logo" onError={(event) => { event.currentTarget.style.display = 'none' }} />
          <span className="dm-loader-fallback" aria-hidden="true">D</span>
        </div>
        <div className="dm-loader-name">{platformName}</div>
        <div className="dm-loader-progress" aria-hidden="true"><span /></div>
        <div className="dm-loader-caption">جاري تجهيز المنصة...</div>
      </div>
    </div>
  )
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading, signOut } = useAuth()
  const { organizationId, loading: orgLoading, needsOnboarding, error: organizationError, refresh } = useOrganization()
  const { loading: subscriptionLoading, isActive, isPendingPayment, isExpired, status, error: subscriptionError } = useSubscription()
  const location = useLocation()
  const navigate = useNavigate()
  const [suspended, setSuspended] = useState(false)
  const [suspensionError, setSuspensionError] = useState<string | null>(null)
  const [checkingSuspend, setCheckingSuspend] = useState(true)
  const [initialChecksReady, setInitialChecksReady] = useState(false)

  const handleOnboardingDone = useCallback(async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const organizationId = await refresh()
      if (organizationId) { navigate('/', { replace: true }); return }
      if (attempt < 5) await new Promise((resolve) => window.setTimeout(resolve, 350))
    }
  }, [refresh, navigate])

  useEffect(() => {
    if (!authLoading && !orgLoading && !subscriptionLoading && !(organizationId && checkingSuspend)) setInitialChecksReady(true)
  }, [authLoading, orgLoading, subscriptionLoading, organizationId, checkingSuspend])

  useEffect(() => {
    let cancelled = false
    async function checkSuspension() {
      if (!organizationId || !supabase) {
        if (!cancelled) { setSuspended(false); setSuspensionError(null); setCheckingSuspend(false) }
        return
      }
      setCheckingSuspend(true)
      setSuspensionError(null)
      const { data, error } = await supabase.from('organizations').select('suspended').eq('id', organizationId).maybeSingle()
      if (cancelled) return
      if (error) { setSuspensionError(error.message); setSuspended(false) } else setSuspended(Boolean(data?.suspended))
      setCheckingSuspend(false)
    }
    checkSuspension()
    return () => { cancelled = true }
  }, [organizationId])

  if (authLoading || !initialChecksReady) return <PremiumRouteLoader />
  if (!session) return <Navigate to="/login" replace />

  if (organizationError) return (
    <div dir="rtl" className="h-screen flex items-center justify-center bg-sand-50 p-6">
      <div className="text-center max-w-md"><h2 className="font-bold text-lg text-ink-950">تعذر تحميل بيانات الحساب</h2><p className="text-sm text-ink-900/60 mt-2">حدث خطأ أثناء تحميل بيانات الشركة. حاول مرة أخرى.</p><button type="button" onClick={refresh} className="mt-5 inline-flex items-center justify-center rounded-lg bg-ink-900 text-sand-50 px-5 py-2.5 text-sm font-semibold hover:bg-ink-800 transition-colors">إعادة المحاولة</button></div>
    </div>
  )

  if (needsOnboarding) return <Onboarding onDone={handleOnboardingDone} />

  if (suspensionError) return (
    <div dir="rtl" className="h-screen flex items-center justify-center bg-sand-50 p-6">
      <div className="text-center max-w-md"><h2 className="font-bold text-lg text-ink-950">تعذر التحقق من حالة الحساب</h2><p className="text-sm text-ink-900/60 mt-2">لم نتمكن من التحقق من حالة حساب الشركة. حاول مرة أخرى.</p><button type="button" onClick={() => window.location.reload()} className="mt-5 inline-flex items-center justify-center rounded-lg bg-ink-900 text-sand-50 px-5 py-2.5 text-sm font-semibold hover:bg-ink-800 transition-colors">إعادة المحاولة</button></div>
    </div>
  )

  if (suspended) {
    const handleLogout = async () => { await signOut(); navigate('/login', { replace: true }) }
    return (
      <div dir="rtl" className="h-screen flex flex-col items-center justify-center bg-sand-50 p-6 relative">
        <button type="button" onClick={handleLogout} className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-ink-900/60 hover:text-ink-900 transition-colors"><span>→</span>تسجيل الخروج</button>
        <div className="text-center max-w-sm"><div className="text-4xl mb-3">⛔</div><h2 className="font-bold text-lg text-ink-950">تم تعليق هذا الحساب</h2><p className="text-sm text-ink-900/55 mt-2">لمزيد من التفاصيل حول سبب التعليق أو لإعادة تفعيل حسابك، تواصل مع فريق الدعم.</p><Link to="/support" className="inline-block mt-4 bg-ink-900 text-sand-50 rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-ink-800 transition-colors">تواصل مع فريق الدعم</Link></div>
      </div>
    )
  }

  if (subscriptionError) return (
    <div dir="rtl" className="h-screen flex items-center justify-center bg-sand-50 p-6">
      <div className="text-center max-w-md"><h2 className="font-bold text-lg text-ink-950">تعذر التحقق من الاشتراك</h2><p className="text-sm text-ink-900/60 mt-2 leading-7">لم نتمكن من التحقق من حالة اشتراك حسابك. حاول مرة أخرى.</p><button type="button" onClick={() => window.location.reload()} className="mt-5 inline-flex items-center justify-center rounded-lg bg-ink-900 text-sand-50 px-5 py-2.5 text-sm font-semibold hover:bg-ink-800 transition-colors">إعادة المحاولة</button></div>
    </div>
  )

  const canUseSubscriptionArea = isActive || isPendingPayment || isSubscriptionAllowedPath(location.pathname)
  if (!canUseSubscriptionArea) return <Navigate to="/plans" replace state={{ reason: isPendingPayment ? 'pending_payment' : isExpired || status === 'expired' ? 'expired' : 'no_subscription' }} />
  return <>{children}</>
}
