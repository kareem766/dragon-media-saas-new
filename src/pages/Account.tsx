import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

interface UserProfile {
  full_name: string | null
  email: string | null
  role: string | null
  active: boolean | null
  organization_id: string | null
}

interface Organization {
  name: string | null
  slug: string | null
}

export default function Account() {
  const { user } = useAuth()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)

  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [newEmail, setNewEmail] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [changingEmail, setChangingEmail] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const clearMessages = () => {
    setMessage('')
    setError('')
  }

  const loadAccount = async () => {
    if (!user || !supabase) {
      setLoading(false)
      return
    }

    setLoading(true)
    clearMessages()

    try {
      const {
        data: authUserData,
        error: authUserError,
      } = await supabase.auth.getUser()

      if (authUserError) {
        throw authUserError
      }

      const currentUser = authUserData.user || user

      const {
        data: userData,
        error: userError,
      } = await supabase
        .from('users')
        .select('full_name, email, role, active, organization_id')
        .eq('id', currentUser.id)
        .maybeSingle()

      if (userError) {
        throw userError
      }

      let organizationData: Organization | null = null

      if (userData?.organization_id) {
        const {
          data,
          error: organizationError,
        } = await supabase
          .from('organizations')
          .select('name, slug')
          .eq('id', userData.organization_id)
          .maybeSingle()

        if (organizationError) {
          throw organizationError
        }

        organizationData = data
      }

      const authFullName =
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        ''

      const authAvatar =
        currentUser.user_metadata?.avatar_url ||
        currentUser.user_metadata?.picture ||
        ''

      setProfile(userData as UserProfile | null)
      setOrganization(organizationData)

      setFullName(
        authFullName ||
          userData?.full_name ||
          ''
      )

      setAvatarUrl(authAvatar)
    } catch (err: any) {
      setError(
        err?.message ||
          'تعذر تحميل بيانات الحساب.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccount()
  }, [user?.id])

  const email =
    user?.email ||
    profile?.email ||
    ''

  const role =
    profile?.role ||
    user?.app_metadata?.role ||
    user?.user_metadata?.role ||
    'مستخدم'

  const isActive =
    profile?.active !== false

  const createdAt = user?.created_at
    ? new Date(
        user.created_at
      ).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'غير متوفر'

  const initials = useMemo(() => {
    const name = fullName.trim()

    if (!name) {
      return 'DM'
    }

    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) =>
          part.charAt(0)
        )
        .join('')
        .toUpperCase() || 'DM'
    )
  }, [fullName])

  const handleSaveProfile = async () => {
    if (!user || !supabase) {
      return
    }

    clearMessages()

    const cleanName = fullName.trim()
    const cleanAvatar = avatarUrl.trim()

    if (!cleanName) {
      setError('من فضلك أدخل الاسم بالكامل.')
      return
    }

    if (cleanName.length < 2) {
      setError(
        'الاسم يجب أن يحتوي على حرفين على الأقل.'
      )
      return
    }

    setSavingProfile(true)

    try {
      const {
        error: authError,
      } = await supabase.auth.updateUser({
        data: {
          full_name: cleanName,
          avatar_url: cleanAvatar || null,
        },
      })

      if (authError) {
        throw authError
      }

      const {
        error: profileError,
      } = await supabase
        .from('users')
        .update({
          full_name: cleanName,
          email,
        })
        .eq('id', user.id)

      if (profileError) {
        throw profileError
      }

      const {
        data: refreshedAuth,
        error: refreshError,
      } = await supabase.auth.getUser()

      if (refreshError) {
        throw refreshError
      }

      const refreshedUser = refreshedAuth.user

      if (refreshedUser) {
        const refreshedName =
          refreshedUser.user_metadata?.full_name ||
          refreshedUser.user_metadata?.name ||
          cleanName

        const refreshedAvatar =
          refreshedUser.user_metadata?.avatar_url ||
          refreshedUser.user_metadata?.picture ||
          cleanAvatar

        setFullName(refreshedName)
        setAvatarUrl(refreshedAvatar)

        setProfile((current) =>
          current
            ? {
                ...current,
                full_name: refreshedName,
                email:
                  refreshedUser.email ||
                  email,
              }
            : current
        )
      }

      setMessage(
        'تم حفظ بيانات الحساب بنجاح.'
      )
    } catch (err: any) {
      setError(
        err?.message ||
          'حدث خطأ أثناء حفظ بيانات الحساب.'
      )
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangeEmail = async () => {
    if (!user || !supabase) {
      return
    }

    clearMessages()

    const cleanEmail =
      newEmail.trim().toLowerCase()

    if (!cleanEmail) {
      setError(
        'أدخل البريد الإلكتروني الجديد أولًا.'
      )
      return
    }

    if (
      cleanEmail ===
      email.toLowerCase()
    ) {
      setError(
        'البريد الإلكتروني الجديد مطابق للبريد الحالي.'
      )
      return
    }

    setChangingEmail(true)

    try {
      const {
        error: emailError,
      } = await supabase.auth.updateUser({
        email: cleanEmail,
      })

      if (emailError) {
        throw emailError
      }

      setNewEmail('')

      setMessage(
        'تم إرسال رسالة تأكيد إلى البريد الإلكتروني الجديد. أكمل التأكيد لتفعيل البريد الجديد.'
      )
    } catch (err: any) {
      setError(
        err?.message ||
          'تعذر تغيير البريد الإلكتروني.'
      )
    } finally {
      setChangingEmail(false)
    }
  }

  const handleChangePassword = async () => {
    if (!user || !supabase) {
      return
    }

    clearMessages()

    if (!email) {
      setError(
        'تعذر تحديد البريد الإلكتروني للحساب.'
      )
      return
    }

    if (!currentPassword) {
      setError(
        'أدخل كلمة المرور الحالية.'
      )
      return
    }

    if (!newPassword) {
      setError(
        'أدخل كلمة المرور الجديدة.'
      )
      return
    }

    if (newPassword.length < 8) {
      setError(
        'كلمة المرور الجديدة يجب أن تحتوي على 8 أحرف أو أكثر.'
      )
      return
    }

    if (newPassword === currentPassword) {
      setError(
        'كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية.'
      )
      return
    }

    if (!confirmPassword) {
      setError(
        'أكد كلمة المرور الجديدة.'
      )
      return
    }

    if (newPassword !== confirmPassword) {
      setError(
        'تأكيد كلمة المرور غير مطابق لكلمة المرور الجديدة.'
      )
      return
    }

    setChangingPassword(true)

    try {
      const {
        error: signInError,
      } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })

      if (signInError) {
        throw new Error(
          'كلمة المرور الحالية غير صحيحة.'
        )
      }

      const {
        error: updateError,
      } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        throw updateError
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      setMessage(
        'تم تغيير كلمة المرور بنجاح.'
      )
    } catch (err: any) {
      setError(
        err?.message ||
          'تعذر تغيير كلمة المرور.'
      )
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="space-y-2">
          <div className="h-4 w-28 animate-pulse rounded-lg bg-sand-200" />
          <div className="h-8 w-32 animate-pulse rounded-lg bg-sand-200" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded-lg bg-sand-100" />
        </div>

        <div className="overflow-hidden rounded-3xl border border-sand-200 bg-white">
          <div className="h-40 animate-pulse bg-sand-100" />

          <div className="space-y-6 p-6 sm:p-8">
            <div className="grid gap-5 md:grid-cols-2">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="space-y-2"
                >
                  <div className="h-4 w-28 animate-pulse rounded bg-sand-100" />
                  <div className="h-11 animate-pulse rounded-xl bg-sand-100" />
                </div>
              ))}
            </div>

            <div className="h-11 w-36 animate-pulse rounded-xl bg-sand-200" />
          </div>
        </div>

        <div className="h-48 animate-pulse rounded-3xl border border-sand-200 bg-white" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-semibold text-red-700">
            لم يتم العثور على جلسة مستخدم صالحة.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      dir="rtl"
      className="mx-auto w-full max-w-6xl space-y-6 pb-8"
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span className="text-xs font-bold text-ink-900/55">
            الحساب الشخصي
          </span>
        </div>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
          حسابي
        </h1>

        <p className="mt-1 text-sm leading-6 text-ink-900/55">
          إدارة بياناتك الشخصية وأمان حسابك في Dragon Media.
        </p>
      </div>

      {message && (
        <div
          className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3"
          role="status"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
            ✓
          </span>

          <p className="text-sm font-medium leading-6 text-emerald-800">
            {message}
          </p>
        </div>
      )}

      {error && (
        <div
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3"
          role="alert"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            !
          </span>

          <p className="text-sm font-medium leading-6 text-red-800">
            {error}
          </p>
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-sm">
        <div className="relative overflow-hidden border-b border-sand-200 bg-gradient-to-l from-amber-50 via-white to-sand-50 px-6 py-7 sm:px-8">
          <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-amber-200/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 right-10 h-44 w-44 rounded-full bg-sand-200/50 blur-3xl" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName || 'المستخدم'}
                  className="h-24 w-24 rounded-2xl object-cover shadow-lg ring-4 ring-white"
                  onError={() => setAvatarUrl('')}
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-ink-950 text-2xl font-bold text-amber-400 shadow-lg ring-4 ring-white">
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

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-bold text-ink-950">
                {fullName || 'المستخدم'}
              </h2>

              <p
                dir="ltr"
                className="mt-1 truncate text-right text-sm text-ink-900/50"
              >
                {email}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-ink-950 px-3 py-1 text-xs font-bold text-white">
                  {role}
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isActive
                    ? 'الحساب نشط'
                    : 'الحساب غير نشط'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="mb-6">
            <h3 className="text-base font-bold text-ink-950">
              البيانات الشخصية
            </h3>

            <p className="mt-1 text-xs leading-5 text-ink-900/50">
              حدّث الاسم والصورة الشخصية المرتبطين بحسابك.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="account-full-name"
                className="mb-2 block text-sm font-bold text-ink-900"
              >
                الاسم بالكامل
              </label>

              <input
                id="account-full-name"
                type="text"
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value)
                  clearMessages()
                }}
                placeholder="اكتب الاسم بالكامل"
                autoComplete="name"
                className="w-full rounded-xl border border-sand-300 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/30 focus:border-ink-900/30 focus:ring-4 focus:ring-amber-100"
              />
            </div>

            <div>
              <label
                htmlFor="account-email"
                className="mb-2 block text-sm font-bold text-ink-900"
              >
                البريد الإلكتروني الحالي
              </label>

              <input
                id="account-email"
                type="email"
                value={email}
                disabled
                dir="ltr"
                className="w-full cursor-not-allowed rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 text-left text-sm text-ink-900/50 outline-none"
              />

              <p className="mt-1.5 text-[11px] text-ink-900/40">
                لتغيير البريد استخدم قسم البريد الإلكتروني بالأسفل.
              </p>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="account-avatar"
                className="mb-2 block text-sm font-bold text-ink-900"
              >
                رابط الصورة الشخصية
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="account-avatar"
                  type="url"
                  value={avatarUrl}
                  onChange={(event) => {
                    setAvatarUrl(event.target.value)
                    clearMessages()
                  }}
                  placeholder="https://example.com/avatar.jpg"
                  dir="ltr"
                  className="min-w-0 flex-1 rounded-xl border border-sand-300 bg-white px-4 py-3 text-left text-sm text-ink-950 outline-none transition placeholder:text-ink-900/30 focus:border-ink-900/30 focus:ring-4 focus:ring-amber-100"
                />

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrl('')
                      clearMessages()
                    }}
                    className="rounded-xl border border-sand-300 px-4 py-3 text-sm font-bold text-ink-900/65 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    إزالة الصورة
                  </button>
                )}
              </div>

              <p className="mt-1.5 text-[11px] leading-5 text-ink-900/40">
                اترك الحقل فارغًا لاستخدام اختصار اسمك كصورة للحساب.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-start border-t border-sand-100 pt-6">
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-ink-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingProfile ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  جاري الحفظ...
                </>
              ) : (
                'حفظ التغييرات'
              )}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-sand-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="mb-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              @
            </div>

            <h3 className="text-base font-bold text-ink-950">
              تغيير البريد الإلكتروني
            </h3>

            <p className="mt-1 text-xs leading-5 text-ink-900/50">
              سيتم إرسال رسالة تأكيد إلى البريد الإلكتروني الجديد.
            </p>
          </div>

          <label
            htmlFor="new-email"
            className="mb-2 block text-sm font-bold text-ink-900"
          >
            البريد الإلكتروني الجديد
          </label>

          <input
            id="new-email"
            type="email"
            value={newEmail}
            onChange={(event) => {
              setNewEmail(event.target.value)
              clearMessages()
            }}
            placeholder="name@example.com"
            dir="ltr"
            autoComplete="email"
            className="w-full rounded-xl border border-sand-300 bg-white px-4 py-3 text-left text-sm text-ink-950 outline-none transition placeholder:text-ink-900/30 focus:border-ink-900/30 focus:ring-4 focus:ring-amber-100"
          />

          <button
            type="button"
            onClick={handleChangeEmail}
            disabled={changingEmail}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {changingEmail ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                جاري الإرسال...
              </>
            ) : (
              'تحديث البريد الإلكتروني'
            )}
          </button>
        </section>

        <section className="rounded-3xl border border-sand-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="mb-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              ✓
            </div>

            <h3 className="text-base font-bold text-ink-950">
              تغيير كلمة المرور
            </h3>

            <p className="mt-1 text-xs leading-5 text-ink-900/50">
              استخدم كلمة مرور قوية لا تقل عن 8 أحرف.
            </p>
          </div>

          <div className="space-y-4">
            <PasswordField
              id="current-password"
              label="كلمة المرور الحالية"
              value={currentPassword}
              visible={showCurrentPassword}
              onChange={setCurrentPassword}
              onToggle={() =>
                setShowCurrentPassword(
                  (value) => !value
                )
              }
              autoComplete="current-password"
            />

            <PasswordField
              id="new-password"
              label="كلمة المرور الجديدة"
              value={newPassword}
              visible={showNewPassword}
              onChange={setNewPassword}
              onToggle={() =>
                setShowNewPassword(
                  (value) => !value
                )
              }
              autoComplete="new-password"
            />

            <PasswordField
              id="confirm-password"
              label="تأكيد كلمة المرور الجديدة"
              value={confirmPassword}
              visible={showConfirmPassword}
              onChange={setConfirmPassword}
              onToggle={() =>
                setShowConfirmPassword(
                  (value) => !value
                )
              }
              autoComplete="new-password"
            />
          </div>

          <button
            type="button"
            onClick={handleChangePassword}
            disabled={changingPassword}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {changingPassword ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                جاري التحديث...
              </>
            ) : (
              'تغيير كلمة المرور'
            )}
          </button>
        </section>
      </div>

      <section className="rounded-3xl border border-sand-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="mb-6">
          <h3 className="text-base font-bold text-ink-950">
            معلومات الحساب
          </h3>

          <p className="mt-1 text-xs leading-5 text-ink-900/50">
            معلومات أساسية للقراءة فقط مرتبطة بحسابك داخل المنصة.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoItem
            label="الدور"
            value={role}
          />

          <InfoItem
            label="حالة الحساب"
            value={
              isActive
                ? 'نشط'
                : 'غير نشط'
            }
            positive={isActive}
          />

          <InfoItem
            label="تاريخ إنشاء الحساب"
            value={createdAt}
          />

          <InfoItem
            label="الشركة"
            value={
              organization?.name ||
              'غير محدد'
            }
          />
        </div>

        {organization?.slug && (
          <div className="mt-3 rounded-2xl border border-sand-100 bg-sand-50 px-4 py-3">
            <div className="text-[11px] font-semibold text-ink-900/40">
              معرف الشركة
            </div>

            <div
              dir="ltr"
              className="mt-1 truncate text-sm font-semibold text-ink-900/75"
            >
              {organization.slug}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  visible: boolean
  onChange: (value: string) => void
  onToggle: () => void
  autoComplete: string
}

function PasswordField({
  id,
  label,
  value,
  visible,
  onChange,
  onToggle,
  autoComplete,
}: PasswordFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-bold text-ink-900"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          autoComplete={autoComplete}
          dir="ltr"
          className="w-full rounded-xl border border-sand-300 bg-white px-4 py-3 pl-16 text-left text-sm text-ink-950 outline-none transition placeholder:text-ink-900/30 focus:border-ink-900/30 focus:ring-4 focus:ring-amber-100"
        />

        <button
          type="button"
          onClick={onToggle}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-ink-900/50 transition hover:bg-sand-100 hover:text-ink-950"
        >
          {visible ? 'إخفاء' : 'إظهار'}
        </button>
      </div>
    </div>
  )
}

interface InfoItemProps {
  label: string
  value: string
  positive?: boolean
}

function InfoItem({
  label,
  value,
  positive = false,
}: InfoItemProps) {
  return (
    <div className="rounded-2xl border border-sand-100 bg-sand-50 p-4">
      <div className="text-[11px] font-semibold text-ink-900/40">
        {label}
      </div>

      <div
        className={`mt-1.5 truncate text-sm font-bold ${
          positive
            ? 'text-emerald-700'
            : 'text-ink-950'
        }`}
      >
        {value}
      </div>
    </div>
  )
}
