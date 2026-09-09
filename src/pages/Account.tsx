import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';

export default function Account() {
  const { user } = useAuth();

  const [fullName, setFullName] = useState(
    user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      ''
  );

  const [avatarUrl, setAvatarUrl] = useState(
    user?.user_metadata?.avatar_url ||
      user?.user_metadata?.picture ||
      ''
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const email = user?.email || '';

  const role =
    user?.app_metadata?.role ||
    user?.user_metadata?.role ||
    'مستخدم';

  const initials =
    fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((name: string) => name.charAt(0))
      .join('')
      .toUpperCase() || 'DM';

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setMessage('');
    setError('');

    try {
      const { createClient } = await import('@supabase/supabase-js');

      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          avatar_url: avatarUrl.trim(),
        },
      });

      if (updateError) {
        throw updateError;
      }

      setMessage('تم حفظ بيانات الحساب بنجاح.');
    } catch (err: any) {
      setError(
        err?.message ||
          'حدث خطأ أثناء حفظ بيانات الحساب.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) return;

    setMessage('');
    setError('');

    try {
      const { createClient } = await import('@supabase/supabase-js');

      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(email);

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
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          حسابي
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          إدارة بياناتك الشخصية وإعدادات حسابك في Dragon Media
        </p>
      </div>

      {/* Profile Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-100 bg-gradient-to-l from-blue-50 via-white to-white px-6 py-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">

            {/* Avatar */}
            <div className="relative shrink-0">

              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName || 'المستخدم'}
                  className="h-24 w-24 rounded-2xl object-cover shadow-md ring-4 ring-white"
                  onError={() => setAvatarUrl('')}
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-2xl font-bold text-white shadow-md ring-4 ring-white">
                  {initials}
                </div>
              )}

              <span className="absolute -bottom-1 -left-1 h-5 w-5 rounded-full border-4 border-white bg-emerald-500" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {fullName || 'المستخدم'}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {email}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  {role}
                </span>

                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  ● الحساب نشط
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Personal Information */}
        <div className="p-6">

          <div className="mb-5">
            <h3 className="text-base font-bold text-slate-900">
              البيانات الشخصية
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              حدّث المعلومات التي تظهر داخل حسابك.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">

            {/* Name */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                الاسم بالكامل
              </label>

              <input
                type="text"
                value={fullName}
                onChange={(event) =>
                  setFullName(event.target.value)
                }
                placeholder="اكتب اسمك بالكامل"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              />
            </div>

            {/* Email */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                البريد الإلكتروني
              </label>

              <input
                type="email"
                value={email}
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 outline-none"
              />

              <p className="mt-1.5 text-[11px] text-slate-400">
                البريد الإلكتروني مرتبط بحساب تسجيل الدخول.
              </p>
            </div>

            {/* Avatar */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                رابط الصورة الشخصية
              </label>

              <input
                type="url"
                value={avatarUrl}
                onChange={(event) =>
                  setAvatarUrl(event.target.value)
                }
                placeholder="https://example.com/avatar.jpg"
                dir="ltr"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              />

              <p className="mt-1.5 text-[11px] text-slate-400">
                اترك الحقل فارغًا لاستخدام الأحرف الأولى من اسمك.
              </p>
            </div>

          </div>

          {/* Messages */}
          {message && (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {/* Save */}
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </button>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

        <div className="mb-5">
          <h3 className="text-base font-bold text-slate-900">
            الأمان
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            إدارة إعدادات أمان حسابك.
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <p className="text-sm font-semibold text-slate-800">
              كلمة المرور
            </p>

            <p className="mt-1 text-xs text-slate-500">
              إرسال رابط آمن إلى بريدك الإلكتروني لتغيير كلمة المرور.
            </p>
          </div>

          <button
            type="button"
            onClick={handlePasswordReset}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            تغيير كلمة المرور
          </button>

        </div>
      </div>

      {/* Account Information */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

        <div className="mb-5">
          <h3 className="text-base font-bold text-slate-900">
            معلومات الحساب
          </h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs text-slate-400">
              البريد الإلكتروني
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-700">
              {email || 'غير متوفر'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs text-slate-400">
              الدور
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              {role}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs text-slate-400">
              حالة الحساب
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-600">
              نشط
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
