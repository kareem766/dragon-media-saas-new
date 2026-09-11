import React, { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { useBranding } from '../hooks/useBranding'

const TERMS_VERSION = '1.0'
const PRIVACY_VERSION = '1.0'

export default function Login() {
  const {
    session,
    signIn,
    signUp,
    resendConfirmation,
  } = useAuth()

  const { branding, logoUrl } = useBranding()
  const location = useLocation()

  const [mode, setMode] = useState<'login' | 'signup'>(
    'login'
  )

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  const [termsAccepted, setTermsAccepted] =
    useState(false)

  const [error, setError] = useState<string | null>(
    null
  )

  const [info, setInfo] = useState<string | null>(
    null
  )

  const [submitting, setSubmitting] =
    useState(false)

  const [
    verificationPending,
    setVerificationPending,
  ] = useState(false)

  const [
    verificationEmail,
    setVerificationEmail,
  ] = useState('')

  const [resending, setResending] =
    useState(false)

  const [resendMessage, setResendMessage] =
    useState<string | null>(null)

  /*
   * When Supabase sends the user back after
   * successful email confirmation:
   *
   * /#/login?verified=1
   */
  useEffect(() => {
    const params = new URLSearchParams(
      location.search
    )

    const verified = params.get('verified')

    if (verified === '1') {
      setMode('login')
      setVerificationPending(false)
      setError(null)
      setInfo(
        'تم تأكيد بريدك الإلكتروني بنجاح. يمكنك الآن تسجيل الدخول.'
      )
    }
  }, [location.search])

  if (session) {
    return <Navigate to="/" replace />
  }

  const switchMode = (
    nextMode: 'login' | 'signup'
  ) => {
    setMode(nextMode)
    setError(null)
    setInfo(null)
    setResendMessage(null)
    setVerificationPending(false)
  }

  /*
   * Redeem a pending invite after the user
   * successfully authenticates.
   *
   * This is important because with email confirmation
   * enabled there is no authenticated session at
   * signup time.
   */
  const redeemPendingInvite = async () => {
    if (!supabase) {
      return null
    }

    const pendingInvite =
      localStorage.getItem(
        'dragon_media_pending_invite_code'
      )

    if (!pendingInvite) {
      return null
    }

    const { error: redeemError } =
      await supabase.rpc(
        'redeem_invite_code',
        {
          p_code: pendingInvite,
          p_full_name: fullName,
        }
      )

    if (redeemError) {
      return redeemError.message
    }

    localStorage.removeItem(
      'dragon_media_pending_invite_code'
    )

    return null
  }

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault()

    setError(null)
    setInfo(null)
    setResendMessage(null)
    setSubmitting(true)

    /*
     * LOGIN
     */
    if (mode === 'login') {
      /*
       * If the user had an invite code waiting from
       * the signup process, make sure it is available
       * before authentication.
       */
      const { error: signInError } =
        await signIn(email, password)

      if (signInError) {
        setError(signInError)

        if (
          signInError.includes(
            'البريد الإلكتروني غير مؤكد'
          )
        ) {
          setVerificationEmail(email)
          setVerificationPending(true)
        }

        setSubmitting(false)
        return
      }

      /*
       * If there is a pending invite, redeem it now
       * because a valid authenticated session exists.
       */
      const inviteError =
        await redeemPendingInvite()

      if (inviteError) {
        setError(
          `تم تسجيل الدخول بنجاح، لكن تعذر تنفيذ كود الدعوة: ${inviteError}`
        )
        setSubmitting(false)
        return
      }

      setSubmitting(false)
      return
    }

    /*
     * SIGNUP
     */

    if (!termsAccepted) {
      setError(
        'يجب الموافقة على شروط الاستخدام وسياسة الخصوصية لإنشاء الحساب.'
      )
      setSubmitting(false)
      return
    }

    /*
     * Keep invite code locally because with email
     * confirmation enabled there will be no session
     * until the email is verified.
     */
    if (inviteCode.trim()) {
      localStorage.setItem(
        'dragon_media_pending_invite_code',
        inviteCode.trim().toUpperCase()
      )
    }

    const consentAcceptedAt =
      new Date().toISOString()

    const {
      error: signUpError,
      needsEmailConfirmation,
    } = await signUp(
      email,
      password,
      fullName,
      {
        termsAcceptedAt: consentAcceptedAt,
        termsVersion: TERMS_VERSION,
        privacyAcceptedAt: consentAcceptedAt,
        privacyVersion: PRIVACY_VERSION,
      }
    )

    if (signUpError) {
      setError(signUpError)
      setSubmitting(false)
      return
    }

    /*
     * Email confirmation is required.
     */
    if (needsEmailConfirmation) {
      setVerificationEmail(email)
      setVerificationPending(true)
      setInfo(null)
      setSubmitting(false)
      return
    }

    /*
     * If email confirmation is disabled and Supabase
     * immediately returned a session, preserve the
     * existing invite behavior.
     */
    if (inviteCode.trim() && supabase) {
      const {
        error: redeemError,
      } = await supabase.rpc(
        'redeem_invite_code',
        {
          p_code: inviteCode
            .trim()
            .toUpperCase(),
          p_full_name: fullName,
        }
      )

      if (redeemError) {
        setError(
          `تم إنشاء الحساب، لكن كود الدعوة غير صالح: ${redeemError.message}`
        )
        setSubmitting(false)
        return
      }

      localStorage.removeItem(
        'dragon_media_pending_invite_code'
      )

      setInfo(
        'تم إنشاء الحساب والانضمام للمؤسسة بنجاح!'
      )
    } else {
      setInfo(
        'تم إنشاء الحساب! لاحظ أنك تحتاج كود دعوة من مديرك للانضمام لمؤسسة.'
      )
    }

    setSubmitting(false)
  }

  const handleResendConfirmation =
    async () => {
      if (!verificationEmail.trim()) {
        setError(
          'اكتب البريد الإلكتروني أولًا.'
        )
        return
      }

      setResending(true)
      setError(null)
      setResendMessage(null)

      const {
        error: resendError,
      } = await resendConfirmation(
        verificationEmail.trim()
      )

      if (resendError) {
        setError(resendError)
      } else {
        setResendMessage(
          'تم إرسال رسالة تأكيد جديدة إلى بريدك الإلكتروني.'
        )
      }

      setResending(false)
    }

  const platformName =
    branding?.platform_name ||
    'Dragon Media'

  /*
   * EMAIL VERIFICATION SCREEN
   */
  if (verificationPending) {
    return (
      <div
        dir="rtl"
        className="min-h-screen flex bg-sand-50"
      >
        <div className="hidden lg:flex lg:w-1/2 bg-ink-950 text-sand-100 flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt={platformName}
              className="w-11 h-11 rounded-xl object-contain bg-white/5"
            />

            <span className="font-bold text-xl">
              {platformName}
            </span>
          </div>

          <div>
            <h1 className="text-3xl font-bold leading-snug">
              منصة واحدة تدير بيها تسويقك، مبيعاتك، وخدمة عملائك
            </h1>

            <p className="text-sand-100/55 mt-4 leading-relaxed">
              CRM، مسار مبيعات، حملات تسويقية، وصندوق
              محادثات موحد — مع RYAN AI يشتغل معاك
              على مدار الساعة.
            </p>
          </div>

          <p className="text-xs text-sand-100/40">
            © 2026 {platformName}
          </p>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
              <img
                src={logoUrl}
                alt={platformName}
                className="w-10 h-10 rounded-lg object-contain"
              />

              <span className="font-bold text-lg text-ink-950">
                {platformName}
              </span>
            </div>

            <div className="bg-white border border-sand-200 rounded-2xl p-6 shadow-sm">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-5">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M4 4h16v16H4z" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
              </div>

              <h2 className="text-xl font-bold text-ink-950 text-center">
                تم إنشاء حسابك بنجاح
              </h2>

              <p className="text-sm text-ink-900/55 mt-2 text-center leading-relaxed">
                أرسلنا رسالة تأكيد إلى:
              </p>

              <p
                dir="ltr"
                className="text-sm font-semibold text-ink-950 text-center mt-1 break-all"
              >
                {verificationEmail}
              </p>

              <p className="text-sm text-ink-900/55 mt-4 text-center leading-relaxed">
                افتح بريدك الإلكتروني واضغط على رابط
                تأكيد البريد الإلكتروني لتفعيل حسابك.
              </p>

              {error && (
                <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
                  {error}
                </div>
              )}

              {resendMessage && (
                <div className="mt-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3.5 py-2.5">
                  {resendMessage}
                </div>
              )}

              <button
                type="button"
                onClick={
                  handleResendConfirmation
                }
                disabled={resending}
                className="w-full mt-6 bg-ink-900 text-sand-50 rounded-lg py-3 text-sm font-semibold hover:bg-ink-800 transition-colors disabled:opacity-60"
              >
                {resending
                  ? 'جاري إرسال الرسالة...'
                  : 'إعادة إرسال رسالة التأكيد'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setVerificationPending(
                    false
                  )
                  setMode('login')
                  setError(null)
                  setInfo(null)
                  setResendMessage(null)
                }}
                className="w-full mt-3 border border-sand-200 text-ink-900 rounded-lg py-3 text-sm font-semibold hover:bg-sand-50 transition-colors"
              >
                العودة لتسجيل الدخول
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /*
   * NORMAL LOGIN / SIGNUP SCREEN
   */
  return (
    <div
      dir="rtl"
      className="min-h-screen flex bg-sand-50"
    >
      <div className="hidden lg:flex lg:w-1/2 bg-ink-950 text-sand-100 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <img
            src={logoUrl}
            alt={platformName}
            className="w-11 h-11 rounded-xl object-contain bg-white/5"
          />

          <span className="font-bold text-xl">
            {platformName}
          </span>
        </div>

        <div>
          <h1 className="text-3xl font-bold leading-snug">
            منصة واحدة تدير بيها تسويقك، مبيعاتك، وخدمة عملائك
          </h1>

          <p className="text-sand-100/55 mt-4 leading-relaxed">
            CRM، مسار مبيعات، حملات تسويقية، وصندوق
            محادثات موحد — مع RYAN AI يشتغل معاك
            على مدار الساعة.
          </p>
        </div>

        <p className="text-xs text-sand-100/40">
          © 2026 {platformName}
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <img
              src={logoUrl}
              alt={platformName}
              className="w-10 h-10 rounded-lg object-contain"
            />

            <span className="font-bold text-lg text-ink-950">
              {platformName}
            </span>
          </div>

          <h2 className="text-2xl font-bold text-ink-950">
            {mode === 'login'
              ? 'تسجيل الدخول'
              : 'إنشاء حساب جديد'}
          </h2>

          <p className="text-sm text-ink-900/50 mt-1.5">
            {mode === 'login'
              ? 'أهلًا بيك تاني، سجّل دخولك للمتابعة'
              : 'ابدأ في إدارة عملك من مكان واحد'}
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-7 space-y-4"
          >
            {mode === 'signup' && (
              <>
                <div>
                  <label className="text-xs text-ink-900/50">
                    الاسم الكامل
                  </label>

                  <input
                    value={fullName}
                    onChange={e =>
                      setFullName(e.target.value)
                    }
                    required
                    className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white"
                    placeholder="اسمك بالكامل"
                  />
                </div>

                <div>
                  <label className="text-xs text-ink-900/50">
                    كود الدعوة (لو معاك واحد من مديرك)
                  </label>

                  <input
                    value={inviteCode}
                    onChange={e =>
                      setInviteCode(e.target.value)
                    }
                    className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white"
                    placeholder="مثال: A1B2C3D4"
                    dir="ltr"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-xs text-ink-900/50">
                البريد الإلكتروني
              </label>

              <input
                type="email"
                value={email}
                onChange={e =>
                  setEmail(e.target.value)
                }
                required
                dir="ltr"
                className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white text-right"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="text-xs text-ink-900/50">
                كلمة المرور
              </label>

              <input
                type="password"
                value={password}
                onChange={e =>
                  setPassword(e.target.value)
                }
                required
                minLength={6}
                dir="ltr"
                className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white text-right"
                placeholder="••••••••"
              />
            </div>

            {mode === 'signup' && (
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={e =>
                    setTermsAccepted(
                      e.target.checked
                    )
                  }
                  className="mt-1 h-4 w-4 rounded border-sand-300 text-ink-900 focus:ring-ink-700"
                />

                <span className="text-xs text-ink-900/60 leading-6">
                  أوافق على{' '}
                  <a
                    href="/#/terms"
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink-900 font-semibold hover:underline"
                    onClick={e =>
                      e.stopPropagation()
                    }
                  >
                    شروط الاستخدام
                  </a>{' '}
                  و{' '}
                  <a
                    href="/#/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink-900 font-semibold hover:underline"
                    onClick={e =>
                      e.stopPropagation()
                    }
                  >
                    سياسة الخصوصية
                  </a>
                  .
                </span>
              </label>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
                {error}
              </div>
            )}

            {info && (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3.5 py-2.5">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={
                submitting ||
                (mode === 'signup' &&
                  !termsAccepted)
              }
              className="w-full bg-ink-900 text-sand-50 rounded-lg py-3 text-sm font-semibold hover:bg-ink-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting
                ? 'جاري التنفيذ...'
                : mode === 'login'
                  ? 'تسجيل الدخول'
                  : 'إنشاء الحساب'}
            </button>
          </form>

          <p className="text-sm text-ink-900/55 mt-6 text-center">
            {mode === 'login'
              ? 'مفيش عندك حساب؟'
              : 'عندك حساب بالفعل؟'}{' '}
            <button
              type="button"
              onClick={() =>
                switchMode(
                  mode === 'login'
                    ? 'signup'
                    : 'login'
                )
              }
              className="text-ink-900 font-semibold hover:underline"
            >
              {mode === 'login'
                ? 'إنشاء حساب جديد'
                : 'تسجيل الدخول'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
