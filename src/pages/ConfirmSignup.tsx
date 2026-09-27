import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { useBranding } from '../hooks/useBranding'
import { useAuth } from '../lib/AuthContext'

export default function ConfirmSignup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { branding, logoUrl } = useBranding()
  const { session } = useAuth()
  const [verifying, setVerifying] = useState(true)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')

  const platformName = branding?.platform_name?.trim() || 'Dragon Media'

  const tokenHash = searchParams.get('token_hash')?.trim() || ''
  const type = (searchParams.get('type')?.trim() || 'email') as EmailOtpType

  useEffect(() => {
    if (session) {
      setVerified(true)
      setVerifying(false)
    } else {
      setVerifying(false)
    }
  }, [session])

  const handleConfirm = async () => {
    if (!tokenHash || !supabase) {
      setError('رابط التأكيد غير مكتمل أو غير صالح.')
      return
    }

    setError('')
    setVerifying(true)

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })

    if (verifyError) {
      setError('تعذر تأكيد البريد الإلكتروني. قد يكون الرابط مستخدمًا بالفعل أو منتهي الصلاحية.')
      setVerifying(false)
      return
    }

    setVerified(true)
    setVerifying(false)
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash)
  }

  useEffect(() => {
    if (!verified || !session) return
    const timer = window.setTimeout(() => navigate('/', { replace: true }), 700)
    return () => window.clearTimeout(timer)
  }, [verified, session, navigate])

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-xl shadow-slate-900/5 sm:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-blue-100 bg-white shadow-lg shadow-blue-900/10">
            <img src={logoUrl} alt={platformName} className="h-14 w-14 rounded-2xl object-contain" />
          </div>

          {verifying && (
            <>
              <h1 className="mt-7 text-2xl font-black text-slate-950">جاري تأكيد البريد الإلكتروني</h1>
              <p className="mt-3 text-sm leading-7 text-slate-500">لحظات ونجهز حسابك للدخول إلى المنصة.</p>
              <div className="mx-auto mt-7 h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
            </>
          )}

          {!verifying && !verified && !error && tokenHash && (
            <>
              <h1 className="mt-7 text-2xl font-black text-slate-950">تأكيد البريد الإلكتروني</h1>
              <p className="mt-3 text-sm leading-7 text-slate-500">اضغط الزر التالي لتأكيد بريدك الإلكتروني وتسجيل الدخول إلى المنصة.</p>
              <button type="button" onClick={() => void handleConfirm()} className="mt-7 w-full rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white transition hover:bg-blue-700">
                تأكيد البريد الإلكتروني والمتابعة
              </button>
            </>
          )}

          {!verifying && verified && (
            <>
              <h1 className="mt-7 text-2xl font-black text-slate-950">تم تأكيد البريد الإلكتروني بنجاح</h1>
              <p className="mt-3 text-sm leading-7 text-slate-500">تم تسجيل الدخول بنجاح. جاري نقلك لإكمال إعداد الحساب.</p>
              <div className="mt-7 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">تم التحقق ✓</div>
            </>
          )}

          {!verifying && error && (
            <>
              <h1 className="mt-7 text-2xl font-black text-slate-950">تعذر تأكيد البريد الإلكتروني</h1>
              <p className="mt-3 text-sm leading-7 text-red-600">{error}</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => navigate('/login?mode=signup', { replace: true })} className="rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white transition hover:bg-blue-700">
                  العودة للتسجيل
                </button>
                <button type="button" onClick={() => navigate('/login', { replace: true })} className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                  تسجيل الدخول
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
