import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBranding } from '../hooks/useBranding'
import { supabase } from '../lib/supabaseClient'

export default function ForgotPassword() {
  const { branding, logoUrl } = useBranding()

  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const platformName =
    branding?.platform_name?.trim() || 'Dragon Media'

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault()

    setError('')
    setSuccess(false)

    if (!supabase) {
      setError(
        'تعذر الاتصال بالخدمة حاليًا. حاول مرة أخرى.'
      )
      return
    }

    if (!email.trim()) {
      setError('اكتب البريد الإلكتروني.')
      return
    }

    setSubmitting(true)

    try {
      const redirectTo =
        `${window.location.origin}/#/reset-password`

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo,
          }
        )

      if (resetError) {
        setError(resetError.message)
        return
      }

      setSuccess(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر إرسال رابط إعادة تعيين كلمة المرور.'
      )
    } finally {
      setSubmitting(false)
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
            {!success ? (
              <>
                <div className="mb-7">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-lg font-black text-blue-600">
                    ?
                  </div>

                  <h1 className="text-2xl font-black text-slate-950">
                    نسيت كلمة المرور؟
                  </h1>

                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    اكتب البريد الإلكتروني المرتبط بحسابك
                    وسنرسل لك رابطًا آمنًا لإعادة تعيين
                    كلمة المرور.
                  </p>
                </div>

                {error && (
                  <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm leading-6 text-red-700">
                    {error}
                  </div>
                )}

                <form
                  onSubmit={handleSubmit}
                  className="space-y-5"
                >
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">
                      البريد الإلكتروني
                    </span>

                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      placeholder="name@company.com"
                      autoComplete="email"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting
                      ? 'جاري إرسال الرابط...'
                      : 'إرسال رابط إعادة التعيين'}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-2xl font-black text-emerald-600">
                  ✓
                </div>

                <h1 className="mt-6 text-2xl font-black text-slate-950">
                  تم إرسال الرابط
                </h1>

                <p className="mt-3 text-sm leading-7 text-slate-500">
                  لو البريد الإلكتروني مسجل في
                  {` ${platformName}`}، ستصلك رسالة تحتوي
                  على رابط لإعادة تعيين كلمة المرور.
                </p>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-right">
                  <p className="text-xs leading-6 text-slate-500">
                    لو لم تجد الرسالة، راجع مجلد Spam أو
                    البريد غير المرغوب فيه.
                  </p>
                </div>

                <Link
                  to="/login"
                  className="mt-6 flex w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white transition hover:bg-blue-700"
                >
                  العودة لتسجيل الدخول
                </Link>
              </div>
            )}
          </div>

          <div className="mt-5 text-center">
            <Link
              to="/login"
              className="text-sm font-bold text-slate-500 transition hover:text-slate-900"
            >
              العودة لتسجيل الدخول
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
