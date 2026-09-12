import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useBranding } from '../hooks/useBranding'
import { supabase } from '../lib/supabaseClient'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { branding, logoUrl } = useBranding()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] =
    useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [success, setSuccess] = useState(false)

  const [showPassword, setShowPassword] =
    useState(false)

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false)

  const platformName =
    branding?.platform_name?.trim() || 'Dragon Media'

  useEffect(() => {
    if (!supabase) {
      setError(
        'تعذر الاتصال بالخدمة حاليًا. حاول مرة أخرى.'
      )
      return
    }

    let mounted = true

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (session) {
        setReady(true)
      } else {
        setError(
          'رابط إعادة تعيين كلمة المرور غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا.'
        )
      }
    }

    checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return

        if (
          event === 'PASSWORD_RECOVERY' &&
          session
        ) {
          setReady(true)
          setError('')
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault()

    setError('')

    if (!supabase) {
      setError(
        'تعذر الاتصال بالخدمة حاليًا. حاول مرة أخرى.'
      )
      return
    }

    if (!ready) {
      setError(
        'رابط إعادة التعيين غير صالح أو انتهت صلاحيته.'
      )
      return
    }

    if (password.length < 6) {
      setError(
        'كلمة المرور يجب أن تكون 6 أحرف على الأقل.'
      )
      return
    }

    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.')
      return
    }

    setSaving(true)

    try {
      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        })

      if (updateError) {
        setError(updateError.message)
        return
      }

      setSuccess(true)

      await supabase.auth.signOut()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر تغيير كلمة المرور.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6"
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <div className="w-full">
          <div className="mb-7 flex justify-center">
            <Link
              to="/home"
              className="flex items-center gap-3"
            >
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <img
                  src={logoUrl}
                  alt={platformName}
                  className="h-9 w-9 object-contain"
                />
              </div>

              <span className="text-lg font-black text-slate-900">
                {platformName}
              </span>
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
            {success ? (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-2xl font-black text-emerald-600">
                  ✓
                </div>

                <h1 className="mt-6 text-2xl font-black text-slate-950">
                  تم تغيير كلمة المرور
                </h1>

                <p className="mt-3 text-sm leading-7 text-slate-500">
                  تم تحديث كلمة المرور الخاصة بحسابك
                  بنجاح. يمكنك الآن تسجيل الدخول
                  باستخدام كلمة المرور الجديدة.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    navigate('/login', {
                      replace: true,
                    })
                  }
                  className="mt-7 w-full rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white transition hover:bg-blue-700"
                >
                  تسجيل الدخول
                </button>
              </div>
            ) : (
              <>
                <div className="mb-7">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-lg font-black text-blue-600">
                    🔒
                  </div>

                  <h1 className="text-2xl font-black text-slate-950">
                    إنشاء كلمة مرور جديدة
                  </h1>

                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    اختر كلمة مرور قوية وجديدة لحسابك.
                  </p>
                </div>

                {error && (
                  <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm leading-6 text-red-700">
                    {error}
                  </div>
                )}

                {ready && (
                  <form
                    onSubmit={handleSubmit}
                    className="space-y-5"
                  >
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">
                        كلمة المرور الجديدة
                      </span>

                      <div className="relative">
                        <input
                          type={
                            showPassword
                              ? 'text'
                              : 'password'
                          }
                          value={password}
                          onChange={(event) =>
                            setPassword(
                              event.target.value
                            )
                          }
                          autoComplete="new-password"
                          placeholder="6 أحرف على الأقل"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pl-20 text-sm outline-none transition placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowPassword(
                              !showPassword
                            )
                          }
                          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          {showPassword
                            ? 'إخفاء'
                            : 'إظهار'}
                        </button>
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">
                        تأكيد كلمة المرور
                      </span>

                      <div className="relative">
                        <input
                          type={
                            showConfirmPassword
                              ? 'text'
                              : 'password'
                          }
                          value={
                            confirmPassword
                          }
                          onChange={(event) =>
                            setConfirmPassword(
                              event.target.value
                            )
                          }
                          autoComplete="new-password"
                          placeholder="أعد كتابة كلمة المرور"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pl-20 text-sm outline-none transition placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(
                              !showConfirmPassword
                            )
                          }
                          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          {showConfirmPassword
                            ? 'إخفاء'
                            : 'إظهار'}
                        </button>
                      </div>
                    </label>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs leading-6 text-slate-500">
                        استخدم كلمة مرور لا تقل عن 6
                        أحرف، ويفضل أن تحتوي على حروف
                        وأرقام ورموز.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving
                        ? 'جاري تحديث كلمة المرور...'
                        : 'تحديث كلمة المرور'}
                    </button>
                  </form>
                )}

                {!ready && !error && (
                  <div className="rounded-2xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                    جاري التحقق من رابط إعادة التعيين...
                  </div>
                )}

                <div className="mt-6 text-center">
                  <Link
                    to="/login"
                    className="text-sm font-bold text-slate-500 transition hover:text-slate-900"
                  >
                    العودة لتسجيل الدخول
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
