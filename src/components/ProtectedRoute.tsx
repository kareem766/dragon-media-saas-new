import React, { useEffect, useState } from ‘react’
import { Navigate, Link, useNavigate } from ‘react-router-dom’
import { useAuth } from ‘../lib/AuthContext’
import { useOrganization } from ‘../lib/useOrganization’
import { supabase } from ‘../lib/supabaseClient’
import Onboarding from ‘../pages/Onboarding’

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
error: organizationError,
needsOnboarding,
refresh,
} = useOrganization()

const [suspended, setSuspended] = useState(false)
const [checkingSuspend, setCheckingSuspend] = useState(true)
const [suspensionError, setSuspensionError] =
useState<string | null>(null)

const navigate = useNavigate()

useEffect(() => {
let cancelled = false

const checkSuspension = async () => {
  setSuspensionError(null)
  if (!organizationId || !supabase) {
    if (!cancelled) {
      setSuspended(false)
      setCheckingSuspend(false)
    }
    return
  }
  setCheckingSuspend(true)
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
)
}

if (!session) {
return 
}

if (organizationError || suspensionError) {
const message =
organizationError ||
suspensionError ||
‘حدث خطأ أثناء التحقق من الحساب.’

return (
  <div
    dir="rtl"
    className="min-h-screen flex items-center justify-center bg-sand-50 p-6"
  >
    <div className="w-full max-w-md rounded-2xl bg-white border border-ink-900/10 shadow-sm p-6 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xl">
        !
      </div>
      <h2 className="mt-4 font-bold text-lg text-ink-950">
        تعذر التحقق من الحساب
      </h2>
      <p className="mt-2 text-sm text-ink-900/60 leading-6">
        {message}
      </p>
      <button
        type="button"
        onClick={refresh}
        className="mt-5 px-5 py-2.5 rounded-lg bg-ink-900 text-sand-50 text-sm font-semibold hover:bg-ink-800 transition-colors"
      >
        إعادة المحاولة
      </button>
    </div>
  </div>
)

}

if (needsOnboarding) {
return 
}

if (suspended) {
const handleLogout = async () => {
await signOut()
navigate(’/login’, { replace: true })
}

return (
  <div
    dir="rtl"
    className="h-screen flex flex-col items-center justify-center bg-sand-50 p-6 relative"
  >
    <button
      type="button"
      onClick={handleLogout}
      className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-ink-900/60 hover:text-ink-900"
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
        لمزيد من التفاصيل حول سبب التعليق أو لإعادة تفعيل
        حسابك، يرجى التواصل مع فريق الدعم.
      </p>
      <Link
        to="/support"
        className="inline-block mt-4 bg-ink-900 text-sand-50 rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-ink-800"
      >
        تواصل مع فريق الدعم
      </Link>
    </div>
  </div>
)

}

return <>{children}</>
}
