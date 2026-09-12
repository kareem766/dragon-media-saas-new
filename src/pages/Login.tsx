import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useBranding } from '../hooks/useBranding';

const TERMS_VERSION = '1.0';
const PRIVACY_VERSION = '1.0';

type Mode = 'login' | 'signup';
type SignupStep = 'account' | 'verification';

function getInitialMode(search: string): Mode {
  const params = new URLSearchParams(search);
  return params.get('mode') === 'signup' ? 'signup' : 'login';
}

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, signIn, signUp, loading: authLoading } = useAuth();
  const { branding, logoUrl, logoDarkUrl } = useBranding();

  const initialMode = useMemo(
    () => getInitialMode(location.search),
    [location.search]
  );

  const [mode, setMode] = useState<Mode>(initialMode);
  const [signupStep, setSignupStep] = useState<SignupStep>('account');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setSuccess('');

    if (initialMode === 'login') {
      setSignupStep('account');
    }
  }, [initialMode]);

  useEffect(() => {
    const storedInviteCode = localStorage.getItem('dragon_media_invite_code');

    if (storedInviteCode) {
      setInviteCode(storedInviteCode);
    }
  }, []);

  if (session && signupStep !== 'verification') {
    return <Navigate to="/" replace />;
  }

  const platformName =
    branding?.platform_name?.trim() || 'Dragon Media';

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setSignupStep('account');
    setError('');
    setSuccess('');

    navigate(
      nextMode === 'signup'
        ? '/login?mode=signup'
        : '/login',
      { replace: true }
    );
  };

  const validateSignup = () => {
    if (!fullName.trim()) {
      return 'اكتب اسمك بالكامل.';
    }

    if (!email.trim()) {
      return 'اكتب البريد الإلكتروني.';
    }

    if (!password) {
      return 'اكتب كلمة المرور.';
    }

    if (password.length < 6) {
      return 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
    }

    if (!termsAccepted || !privacyAccepted) {
      return 'يجب الموافقة على الشروط وسياسة الخصوصية للمتابعة.';
    }

    return '';
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!email.trim() || !password) {
      setError('اكتب البريد الإلكتروني وكلمة المرور.');
      return;
    }

    setSubmitting(true);

    try {
      const result = await signIn(email.trim(), password);

      if (result?.error) {
        setError(result.error.message || 'تعذر تسجيل الدخول.');
        return;
      }

      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء تسجيل الدخول.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    const validationError = validateSignup();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      if (inviteCode.trim()) {
        localStorage.setItem(
          'dragon_media_invite_code',
          inviteCode.trim().toUpperCase()
        );
      } else {
        localStorage.removeItem('dragon_media_invite_code');
      }

      const acceptedAt = new Date().toISOString();

      const result = await signUp(
        email.trim(),
        password,
        fullName.trim(),
        {
          termsAcceptedAt: acceptedAt,
          termsVersion: TERMS_VERSION,
          privacyAcceptedAt: acceptedAt,
          privacyVersion: PRIVACY_VERSION,
        }
      );

      if (result?.error) {
        setError(result.error.message || 'تعذر إنشاء الحساب.');
        return;
      }

      setSignupStep('verification');
      setSuccess(
        'تم إنشاء الحساب بنجاح. أرسلنا رسالة تأكيد إلى بريدك الإلكتروني.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء إنشاء الحساب.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resendVerification = async () => {
    if (!email.trim()) {
      setError('اكتب البريد الإلكتروني أولًا.');
      return;
    }

    setError('');
    setSuccess('');
    setResending(true);

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });

      if (resendError) {
        setError(
          resendError.message || 'تعذر إعادة إرسال رسالة التأكيد.'
        );
        return;
      }

      setSuccess('تم إرسال رسالة تأكيد جديدة إلى بريدك الإلكتروني.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر إعادة إرسال رسالة التأكيد.'
      );
    } finally {
      setResending(false);
    }
  };

  const accountStepDone =
    mode === 'signup' && signupStep === 'verification';

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-50 text-slate-900"
    >
      <div className="min-h-screen lg:grid lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden lg:flex relative overflow-hidden bg-slate-950 p-10 text-white">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />

          <div className="relative z-10 flex w-full flex-col">
            <Link
              to="/home"
              className="mb-16 inline-flex w-fit items-center gap-3"
            >
              <img
                src={logoDarkUrl || logoUrl}
                alt={platformName}
                className="h-12 w-auto object-contain"
              />

              <span className="text-xl font-bold">
                {platformName}
              </span>
            </Link>

            <div className="max-w-xl">
              <span className="mb-5 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                منصة متكاملة لإدارة نشاطك
              </span>

              <h1 className="text-4xl font-black leading-tight xl:text-5xl">
                إدارة العملاء والمبيعات والتسويق من مكان واحد.
              </h1>

              <p className="mt-6 text-lg leading-8 text-slate-300">
                {platformName} تجمع لك أدوات الـ CRM، الحملات،
                المحادثات، الأتمتة والذكاء الاصطناعي في منصة واحدة
                مصممة لنمو أعمالك.
              </p>
            </div>

            <div className="mt-auto grid gap-4 sm:grid-cols-2">
              {[
                'إدارة العملاء والـ CRM',
                'Inbox موحد للمحادثات',
                'حملات وأتمتة ذكية',
                'Ryan AI للمبيعات وخدمة العملاء',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                    <Check size={18} />
                  </span>

                  <span className="text-sm text-slate-200">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <main className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-xl">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <Link
                to="/home"
                className="flex items-center gap-3"
              >
                <img
                  src={logoUrl}
                  alt={platformName}
                  className="h-10 w-auto object-contain"
                />

                <span className="font-bold">
                  {platformName}
                </span>
              </Link>

              <Link
                to="/home"
                className="text-sm text-slate-500 hover:text-slate-900"
              >
                الرئيسية
              </Link>
            </div>

            {mode === 'signup' && (
              <SignupStepper
                verificationDone={accountStepDone}
                currentStep={signupStep === 'account' ? 1 : 2}
              />
            )}

            <div className="mb-7">
              <h2 className="text-3xl font-black tracking-tight">
                {mode === 'login'
                  ? 'مرحبًا بعودتك'
                  : signupStep === 'verification'
                    ? 'تأكيد البريد الإلكتروني'
                    : 'أنشئ حسابك'}
              </h2>

              <p className="mt-2 leading-7 text-slate-500">
                {mode === 'login'
                  ? 'سجّل دخولك للوصول إلى مساحة عملك.'
                  : signupStep === 'verification'
                    ? 'خطوة بسيطة ونكمل إعداد مساحة عملك.'
                    : 'ابدأ إعداد مساحة عملك في خطوات بسيطة.'}
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                {success}
              </div>
            )}

            {mode === 'login' && (
              <form
                onSubmit={handleLogin}
                className="space-y-5"
              >
                <InputField
                  label="البريد الإلكتروني"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="name@company.com"
                  autoComplete="email"
                  icon={<Mail size={18} />}
                />

                <PasswordField
                  value={password}
                  onChange={setPassword}
                  showPassword={showPassword}
                  setShowPassword={setShowPassword}
                />

                <div className="flex items-center justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    نسيت كلمة المرور؟
                  </Link>
                </div>

                <SubmitButton
                  loading={submitting || authLoading}
                  label="تسجيل الدخول"
                  loadingLabel="جاري تسجيل الدخول..."
                />
              </form>
            )}

            {mode === 'signup' &&
              signupStep === 'account' && (
                <form
                  onSubmit={handleSignup}
                  className="space-y-5"
                >
                  <InputField
                    label="الاسم بالكامل"
                    value={fullName}
                    onChange={setFullName}
                    placeholder="اكتب اسمك بالكامل"
                    autoComplete="name"
                    icon={<UserPlus size={18} />}
                  />

                  <InputField
                    label="البريد الإلكتروني"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="name@company.com"
                    autoComplete="email"
                    icon={<Mail size={18} />}
                  />

                  <PasswordField
                    value={password}
                    onChange={setPassword}
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                  />

                  <InputField
                    label="كود الدعوة"
                    value={inviteCode}
                    onChange={setInviteCode}
                    placeholder="اختياري"
                    autoComplete="off"
                  />

                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <CheckField
                      checked={termsAccepted}
                      onChange={setTermsAccepted}
                    >
                      أوافق على{' '}
                      <Link
                        to="/terms"
                        target="_blank"
                        className="font-semibold text-blue-600 hover:underline"
                      >
                        الشروط والأحكام
                      </Link>
                      .
                    </CheckField>

                    <CheckField
                      checked={privacyAccepted}
                      onChange={setPrivacyAccepted}
                    >
                      أوافق على{' '}
                      <Link
                        to="/privacy"
                        target="_blank"
                        className="font-semibold text-blue-600 hover:underline"
                      >
                        سياسة الخصوصية
                      </Link>
                      .
                    </CheckField>
                  </div>

                  <SubmitButton
                    loading={submitting}
                    label="إنشاء الحساب والمتابعة"
                    loadingLabel="جاري إنشاء الحساب..."
                    icon={<ArrowLeft size={18} />}
                  />
                </form>
              )}

            {mode === 'signup' &&
              signupStep === 'verification' && (
                <VerificationCard
                  email={email}
                  resending={resending}
                  onResend={resendVerification}
                  onChangeEmail={() => {
                    setSignupStep('account');
                    setError('');
                    setSuccess('');
                  }}
                />
              )}

            <div className="my-7 flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-semibold text-slate-400">
                أو
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={() =>
                switchMode(mode === 'login' ? 'signup' : 'login')
              }
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {mode === 'login' ? (
                <>
                  <UserPlus size={18} />
                  إنشاء حساب جديد
                </>
              ) : (
                <>
                  <ArrowRight size={18} />
                  لدي حساب بالفعل
                </>
              )}
            </button>

            <p className="mt-7 text-center text-xs leading-6 text-slate-400">
              باستخدام {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}،
              أنت توافق على استخدام المنصة وفقًا للشروط وسياسة الخصوصية.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

function SignupStepper({
  currentStep,
  verificationDone,
}: {
  currentStep: number;
  verificationDone: boolean;
}) {
  const steps = [
    {
      number: 1,
      title: 'إنشاء الحساب',
      done: verificationDone,
    },
    {
      number: 2,
      title: 'تأكيد البريد',
      done: verificationDone,
    },
    {
      number: 3,
      title: 'بيانات الشركة',
      done: false,
    },
  ];

  return (
    <div className="mb-9">
      <div className="flex items-start">
        {steps.map((step, index) => {
          const active = currentStep === step.number;
          const completed = step.done || currentStep > step.number;

          return (
            <React.Fragment key={step.number}>
              <div className="flex min-w-0 flex-1 flex-col items-center">
                <div
                  className={[
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-black transition',
                    completed
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : active
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-400',
                  ].join(' ')}
                >
                  {completed ? (
                    <Check size={18} strokeWidth={3} />
                  ) : (
                    step.number
                  )}
                </div>

                <span
                  className={[
                    'mt-2 text-center text-[11px] font-bold sm:text-xs',
                    completed || active
                      ? 'text-slate-800'
                      : 'text-slate-400',
                  ].join(' ')}
                >
                  {step.title}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div className="mt-5 h-0.5 flex-1 bg-slate-200">
                  <div
                    className={[
                      'h-full transition-all duration-500',
                      currentStep > step.number
                        ? 'w-full bg-emerald-500'
                        : 'w-0 bg-transparent',
                    ].join(' ')}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>

      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        )}

        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={[
            'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm outline-none transition',
            'placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10',
            icon ? 'pr-11' : '',
          ].join(' ')}
        />
      </div>
    </label>
  );
}

function PasswordField({
  value,
  onChange,
  showPassword,
  setShowPassword,
}: {
  value: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        كلمة المرور
      </span>

      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="6 أحرف على الأقل"
          autoComplete="current-password"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pl-12 text-sm outline-none transition placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
        />

        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label={
            showPassword
              ? 'إخفاء كلمة المرور'
              : 'إظهار كلمة المرور'
          }
        >
          {showPassword ? (
            <EyeOff size={18} />
          ) : (
            <Eye size={18} />
          )}
        </button>
      </div>
    </label>
  );
}

function CheckField({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />

      <span>{children}</span>
    </label>
  );
}

function SubmitButton({
  loading,
  label,
  loadingLabel,
  icon,
}: {
  loading: boolean;
  label: string;
  loadingLabel: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <>
          <Loader2
            size={18}
            className="animate-spin"
          />
          {loadingLabel}
        </>
      ) : (
        <>
          {label}
          {icon}
        </>
      )}
    </button>
  );
}

function VerificationCard({
  email,
  resending,
  onResend,
  onChangeEmail,
}: {
  email: string;
  resending: boolean;
  onResend: () => void;
  onChangeEmail: () => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Mail size={28} />
      </div>

      <div className="mt-6 text-center">
        <h3 className="text-xl font-black text-slate-900">
          راجع بريدك الإلكتروني
        </h3>

        <p className="mt-3 text-sm leading-7 text-slate-500">
          أرسلنا رسالة تأكيد إلى:
        </p>

        <p className="mt-1 break-all font-bold text-slate-900">
          {email}
        </p>

        <p className="mt-4 text-sm leading-7 text-slate-500">
          افتح الرسالة واضغط على رابط التأكيد، وبعدها يمكنك
          الانتقال لإكمال بيانات شركتك.
        </p>
      </div>

      <div className="mt-7 rounded-2xl bg-slate-50 p-4">
        <div className="flex gap-3">
          <ShieldCheck
            size={20}
            className="mt-0.5 shrink-0 text-emerald-500"
          />

          <p className="text-xs leading-6 text-slate-500">
            لو لم تجد الرسالة، راجع مجلد Spam أو البريد غير المرغوب
            فيه قبل طلب إرسال رسالة جديدة.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={onResend}
          disabled={resending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {resending ? (
            <Loader2
              size={18}
              className="animate-spin"
            />
          ) : (
            <RefreshCw size={18} />
          )}

          {resending
            ? 'جاري الإرسال...'
            : 'إعادة إرسال رسالة التأكيد'}
        </button>

        <button
          type="button"
          onClick={onChangeEmail}
          className="flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowRight size={17} />
          تغيير البريد الإلكتروني
        </button>
      </div>
    </div>
  );
}
