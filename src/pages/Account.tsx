import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabaseClient';
interface UserProfile {
  full_name: string | null;
  email: string | null;
  role: string | null;
  active: boolean | null;
  organization_id: string | null;
}
interface Organization {
  name: string | null;
  slug: string | null;
}
export default function Account() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const clearMessages = () => {
    setMessage('');
    setError('');
  };
  useEffect(() => {
    let mounted = true;
    const loadAccount = async () => {
      if (!user || !supabase) {
        if (mounted) setLoading(false);
        return;
      }
      setLoading(true);
      clearMessages();
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select(
            'full_name, email, role, active, organization_id'
          )
          .eq('id', user.id)
          .maybeSingle();
        if (userError) {
          throw userError;
        }
        let organizationData: Organization | null = null;
        if (userData?.organization_id) {
          const { data, error: organizationError } =
            await supabase
              .from('organizations')
              .select('name, slug')
              .eq('id', userData.organization_id)
              .maybeSingle();
          if (organizationError) {
            throw organizationError;
          }
          organizationData = data;
        }
        if (!mounted) return;
        setProfile(userData as UserProfile | null);
        setOrganization(organizationData);
        setFullName(
          userData?.full_name ||
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            ''
        );
        setAvatarUrl(
          user.user_metadata?.avatar_url ||
            user.user_metadata?.picture ||
            ''
        );
        setNewEmail('');
      } catch (err: any) {
        if (!mounted) return;
        setError(
          err?.message ||
            'تعذر تحميل بيانات الحساب.'
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    loadAccount();
    return () => {
      mounted = false;
    };
  }, [user]);
  const email = user?.email || profile?.email || '';
  const role = profile?.role || 'مستخدم';
  const isActive = profile?.active !== false;
  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'غير متوفر';
  const initials = useMemo(() => {
    const name = fullName.trim();
    if (!name) return 'DM';
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join('')
        .toUpperCase() || 'DM'
    );
  }, [fullName]);
  const handleSaveProfile = async () => {
    if (!user || !supabase) return;
    clearMessages();
    const cleanName = fullName.trim();
    const cleanAvatar = avatarUrl.trim();
    if (!cleanName) {
      setError('من فضلك أدخل الاسم بالكامل.');
      return;
    }
    if (cleanName.length < 2) {
      setError('الاسم يجب أن يحتوي على حرفين على الأقل.');
      return;
    }
    setSavingProfile(true);
    try {
      /*
       * Update Supabase Auth metadata
       */
      const { error: authError } =
        await supabase.auth.updateUser({
          data: {
            full_name: cleanName,
            avatar_url: cleanAvatar || null,
          },
        });
      if (authError) {
        throw authError;
      }
      /*
       * Keep the application users table synchronized.
       */
      const { error: profileError } = await supabase
        .from('users')
        .update({
          full_name: cleanName,
          email: email,
        })
        .eq('id', user.id);
      if (profileError) {
        throw profileError;
      }
      setProfile((current) =>
        current
          ? {
              ...current,
              full_name: cleanName,
              email,
            }
          : current
      );
      setMessage('تم حفظ بيانات الحساب بنجاح.');
    } catch (err: any) {
      setError(
        err?.message ||
          'حدث خطأ أثناء حفظ بيانات الحساب.'
      );
    } finally {
      setSavingProfile(false);
    }
  };
  const handleChangeEmail = async () => {
    if (!user || !supabase) return;
    clearMessages();
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setError('أدخل البريد الإلكتروني الجديد أولًا.');
      return;
    }
    if (cleanEmail === email.toLowerCase()) {
      setError(
        'البريد الإلكتروني الجديد مطابق للبريد الحالي.'
      );
      return;
    }
    setChangingEmail(true);
    try {
      const { error: emailError } =
        await supabase.auth.updateUser({
          email: cleanEmail,
        });
      if (emailError) {
        throw emailError;
      }
      setNewEmail('');
      setMessage(
        'تم طلب تغيير البريد الإلكتروني. تحقق من البريد الجديد لإتمام عملية التأكيد.'
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'تعذر تغيير البريد الإلكتروني.'
      );
    } finally {
      setChangingEmail(false);
    }
  };
  const handlePasswordReset = async () => {
    if (!supabase || !email) return;
    clearMessages();
    setSendingPasswordReset(true);
    try {
      const redirectTo =
        `${window.location.origin}${window.location.pathname}#/account`;
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo,
          }
        );
      if (resetError) {
        throw resetError;
      }
      setMessage(
        'تم إرسال رابط تغيير كلمة المرور إلى بريدك الإلكتروني.'
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'تعذر إرسال رابط تغيير كلمة المرور.'
      );
    } finally {
      setSendingPasswordReset(false);
    }
  };
  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <p className="text-sm text-slate-500">
            جاري تحميل بيانات الحساب...
          </p>
        </div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-700">
          لم يتم العثور على جلسة مستخدم صالحة.
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-600" />
          <span className="text-xs font-semibold text-blue-600">
            الحساب الشخصي
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          حسابي
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          إدارة بياناتك الشخصية وأمان حسابك في Dragon Media.
        </p>
      </div>
      {/* Messages */}
      {message && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span className="mt-0.5 text-emerald-600">✓</span>
          <p className="text-sm font-medium text-emerald-700">
            {message}
          </p>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <span className="mt-0.5 text-red-600">!</span>
          <p className="text-sm font-medium text-red-700">
            {error}
          </p>
        </div>
      )}
      {/* Profile Hero */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="relative overflow-hidden bg-gradient-to-l from-blue-50 via-white to-white px-6 py-7 sm:px-8">
          <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-blue-100/50 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 right-10 h-40 w-40 rounded-full bg-indigo-100/40 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            {/* Avatar */}
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName || 'المستخدم'}
                  className="h-24 w-24 rounded-2xl object-cover shadow-lg ring-4 ring-white"
                  onError={() => setAvatarUrl('')}
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-2xl font-bold text-white shadow-lg ring-4 ring-white">
                  {initials}
                </div>
              )}
              <span
                className={`absolute -bottom-1 -left-1 h-5 w-5 rounded-full border-4 border-white ${
                  isActive
                    ? 'bg-emerald-500'
                    : 'bg-slate-400'
                }`}
              />
            </div>
            {/* Identity */}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-bold text-slate-900">
                {fullName || 'المستخدم'}
              </h2>
              <p className="mt-1 truncate text-sm text-slate-500">
                {email}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  {role}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isActive
                    ? '● الحساب نشط'
                    : '● الحساب غير نشط'}
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* Personal Data */}
        <div className="p-6 sm:p-8">
          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-900">
              البيانات الشخصية
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              هذه البيانات مرتبطة بحسابك ويمكنك تحديث المعلومات المسموح لك بتعديلها.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {/* Name */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                الاسم بالكامل
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value);
                  clearMessages();
                }}
                placeholder="اكتب الاسم بالكامل"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              />
            </div>
            {/* Current Email */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                البريد الإلكتروني الحالي
              </label>
              <input
                type="email"
                value={email}
                disabled
                dir="ltr"
                className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 outline-none"
              />
              <p className="mt-1.5 text-[11px] text-slate-400">
                البريد الحالي مرتبط بنظام تسجيل الدخول.
              </p>
            </div>
            {/* Avatar */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                رابط الصورة الشخصية
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(event) => {
                    setAvatarUrl(event.target.value);
                    clearMessages();
                  }}
                  placeholder="https://example.com/avatar.jpg"
                  dir="ltr"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrl('');
                      clearMessages();
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    إزالة الصورة
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                يمكنك استخدام رابط مباشر لصورة شخصية. عند ترك الحقل فارغًا سيظهر اختصار اسمك.
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingProfile
                ? 'جاري الحفظ...'
                : 'حفظ التغييرات'}
            </button>
          </div>
        </div>
      </section>
      {/* Email */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <h3 className="text-base font-bold text-slate-900">
            تغيير البريد الإلكتروني
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            سيتم إرسال رسالة تأكيد إلى البريد الإلكتروني الجديد قبل اعتماده.
          </p>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              البريد الإلكتروني الجديد
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(event) => {
                setNewEmail(event.target.value);
                clearMessages();
              }}
              placeholder="name@example.com"
              dir="ltr"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>
          <button
            type="button"
            onClick={handleChangeEmail}
            disabled={changingEmail || !newEmail.trim()}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {changingEmail
              ? 'جاري الإرسال...'
              : 'تغيير البريد'}
          </button>
        </div>
      </section>
      {/* Security */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <h3 className="text-base font-bold text-slate-900">
            الأمان
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            حافظ على أمان حسابك من خلال تحديث كلمة المرور بشكل دوري.
          </p>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">
              كلمة المرور
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              سيتم إرسال رابط آمن إلى بريدك الإلكتروني لإنشاء كلمة مرور جديدة.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={sendingPasswordReset}
            className="shrink-0 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sendingPasswordReset
              ? 'جاري الإرسال...'
              : 'تغيير كلمة المرور'}
          </button>
        </div>
      </section>
      {/* Account Information */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <h3 className="text-base font-bold text-slate-900">
            معلومات الحساب
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            معلومات النظام المرتبطة بحسابك.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard
            label="الدور"
            value={role}
          />
          <InfoCard
            label="الشركة"
            value={
              organization?.name ||
              'غير محدد'
            }
          />
          <InfoCard
            label="حالة الحساب"
            value={
              isActive
                ? 'نشط'
                : 'غير نشط'
            }
            valueClassName={
              isActive
                ? 'text-emerald-600'
                : 'text-slate-500'
            }
          />
          <InfoCard
            label="تاريخ إنشاء الحساب"
            value={createdAt}
          />
        </div>
      </section>
    </div>
  );
}
function InfoCard({
  label,
  value,
  valueClassName = 'text-slate-800',
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs text-slate-400">
        {label}
      </p>
      <p
        className={`mt-2 truncate text-sm font-bold ${valueClassName}`}
      >
        {value}
      </p>
    </div>
  );
}
