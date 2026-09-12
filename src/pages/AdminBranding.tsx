import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useBranding } from '../hooks/useBranding'
import { useAuth } from '../lib/AuthContext'

type LogoSlot = 'logo_url' | 'logo_dark_url' | 'favicon_url'

const slotLabels: Record<LogoSlot, string> = {
  logo_url: 'اللوجو - الوضع الفاتح',
  logo_dark_url: 'اللوجو - الوضع الداكن',
  favicon_url: 'Favicon',
}

function LoadingState() {
  return (
    <div
      dir="rtl"
      className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6"
      aria-busy="true"
    >
      <div className="animate-pulse space-y-2">
        <div className="h-7 w-40 rounded-lg bg-ink-900/8" />
        <div className="h-4 w-80 max-w-full rounded-lg bg-ink-900/6" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="animate-pulse rounded-2xl border border-ink-900/8 bg-white p-5"
          >
            <div className="h-5 w-36 rounded-lg bg-ink-900/8" />
            <div className="mt-4 h-24 rounded-xl bg-ink-900/6" />
          </div>
        ))}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  dir = 'rtl',
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  dir?: 'rtl' | 'ltr'
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-ink-950">
        {label}
      </label>

      <input
        type={type}
        value={value}
        dir={dir}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-xl border border-sand-200 bg-white px-3.5 py-2.5 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/25 focus:border-ink-700 focus:ring-2 focus:ring-ink-950/5"
      />
    </div>
  )
}

function SectionTitle({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div>
      <h2 className="text-base font-bold text-ink-950 sm:text-lg">
        {title}
      </h2>

      {description && (
        <p className="mt-1 text-sm leading-6 text-ink-900/50">
          {description}
        </p>
      )}
    </div>
  )
}

export default function AdminBranding() {
  const { branding, refresh } = useBranding()
  const { user } = useAuth()

  const [form, setForm] = useState(branding)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<LogoSlot | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fileInputs = {
    logo_url: useRef<HTMLInputElement>(null),
    logo_dark_url: useRef<HTMLInputElement>(null),
    favicon_url: useRef<HTMLInputElement>(null),
  }

  useEffect(() => {
    if (branding) {
      setForm(branding)
    }
  }, [branding])

  useEffect(() => {
    if (!toast) return

    const timeout = window.setTimeout(() => {
      setToast(null)
    }, 3000)

    return () => window.clearTimeout(timeout)
  }, [toast])

  if (!form) {
    return <LoadingState />
  }

  async function uploadFile(slot: LogoSlot, file: File) {
    const sb = supabase

    if (!sb) {
      setError('تعذر الاتصال بقاعدة البيانات.')
      return
    }

    setError(null)
    setUploading(slot)

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `${slot}-${Date.now()}.${extension}`

      const { error: uploadError } = await sb.storage
        .from('branding')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) {
        throw uploadError
      }

      const { data: publicData } = sb.storage
        .from('branding')
        .getPublicUrl(path)

      setForm((current) =>
        current
          ? {
              ...current,
              [slot]: publicData.publicUrl,
            }
          : current
      )

      setToast('تم رفع الملف. اضغط حفظ التعديلات لتطبيقه.')
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء رفع الملف.'
      )
    } finally {
      setUploading(null)

      const input = fileInputs[slot].current
      if (input) {
        input.value = ''
      }
    }
  }

  function removeLogo(slot: LogoSlot) {
    setForm((current) =>
      current
        ? {
            ...current,
            [slot]: null,
          }
        : current
    )

    setToast('تم إزالة الملف من الإعدادات. اضغط حفظ التعديلات للتأكيد.')
  }

  async function save() {
    const sb = supabase

    if (!sb || !form || saving) {
      return
    }

    setSaving(true)
    setError(null)
    setToast(null)

    try {
      const { error: saveError } = await sb
        .from('branding_settings')
        .update({
          platform_name: form.platform_name,
          logo_url: form.logo_url,
          logo_dark_url: form.logo_dark_url,
          favicon_url: form.favicon_url,
          primary_color: form.primary_color,
          secondary_color: form.secondary_color,
          accent_color: form.accent_color,
          company_name: form.company_name,
          description: form.description,
          contact_email: form.contact_email,
          contact_phone: form.contact_phone,
          whatsapp_number: form.whatsapp_number,
          website_url: form.website_url,
          social_links: form.social_links,
          is_default: !form.logo_url,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', form.id)

      if (saveError) {
        throw saveError
      }

      await refresh()
      setToast('تم حفظ التعديلات بنجاح.')
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء حفظ إعدادات الهوية.'
      )
    } finally {
      setSaving(false)
    }
  }

  function restoreDefault() {
    setForm((current) =>
      current
        ? {
            ...current,
            logo_url: null,
            logo_dark_url: null,
            favicon_url: null,
            primary_color: '#4F46E5',
            secondary_color: '#7C3AED',
            accent_color: '#F59E0B',
          }
        : current
    )

    setConfirmReset(false)
    setToast('تمت استعادة القيم الافتراضية. اضغط حفظ التعديلات لتطبيقها.')
  }

  const LogoUploader = ({
    slot,
  }: {
    slot: LogoSlot
  }) => {
    const currentUrl = form[slot]
    const label = slotLabels[slot]

    return (
      <div className="rounded-2xl border border-ink-900/8 bg-white p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-ink-950">
              {label}
            </h3>

            <p className="mt-1 text-xs leading-5 text-ink-900/45">
              {slot === 'favicon_url'
                ? 'أيقونة المتصفح الخاصة بالمنصة.'
                : 'الصورة المستخدمة في واجهة المنصة.'}
            </p>
          </div>

          {currentUrl && (
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              مضاف
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-sand-200 bg-sand-50">
            {currentUrl ? (
              <img
                src={currentUrl}
                alt={label}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="text-center text-xs text-ink-900/35">
                لا يوجد
              </div>
            )}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <input
              ref={fileInputs[slot]}
              type="file"
              accept="image/png,image/svg+xml,image/x-icon,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]

                if (file) {
                  void uploadFile(slot, file)
                }
              }}
            />

            <button
              type="button"
              onClick={() => fileInputs[slot].current?.click()}
              disabled={uploading === slot}
              className="min-h-10 rounded-xl bg-ink-950 px-4 py-2 text-sm font-semibold text-sand-50 transition hover:bg-ink-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading === slot
                ? 'جارٍ الرفع...'
                : currentUrl
                  ? 'استبدال الملف'
                  : 'رفع ملف'}
            </button>

            {currentUrl && (
              <button
                type="button"
                onClick={() => removeLogo(slot)}
                disabled={uploading === slot}
                className="min-h-10 rounded-xl border border-red-500/20 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                إزالة
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      dir="rtl"
      className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6"
    >
      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-2xl border border-ink-900/10 bg-ink-950 px-4 py-3 text-sm font-medium text-white shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:left-auto sm:right-6 sm:inset-x-auto sm:mx-0"
        >
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink-950 sm:text-2xl">
          هوية المنصة
        </h1>

        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-900/55">
          إدارة اللوجو والألوان ومعلومات المنصة. تظهر التغييرات في واجهة
          Dragon Media بعد حفظ الإعدادات.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/15 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
        >
          {error}
        </div>
      )}

      <section className="space-y-4">
        <SectionTitle
          title="إدارة لوجو المنصة"
          description="أضف النسخ المناسبة للواجهات الفاتحة والداكنة بالإضافة إلى Favicon."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <LogoUploader slot="logo_url" />
          <LogoUploader slot="logo_dark_url" />
          <LogoUploader slot="favicon_url" />
        </div>

        <div className="rounded-2xl border border-ink-900/8 bg-white p-4 sm:p-5">
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="text-sm font-medium text-ink-900/55 underline decoration-ink-900/20 underline-offset-4 transition hover:text-ink-950"
          >
            استعادة اللوجو والألوان الافتراضية لـ Dragon Media
          </button>

          {confirmReset && (
            <div className="mt-4 rounded-2xl border border-gold-500/30 bg-gold-500/8 p-4">
              <p className="text-sm font-semibold text-ink-950">
                هل أنت متأكد من استعادة الإعدادات الافتراضية؟
              </p>

              <p className="mt-1 text-xs leading-5 text-ink-900/50">
                سيتم تغيير القيم داخل النموذج فقط حتى تضغط على حفظ التعديلات.
              </p>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={restoreDefault}
                  className="min-h-10 rounded-xl bg-ink-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-900"
                >
                  تأكيد الاستعادة
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="min-h-10 rounded-xl border border-ink-900/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900 transition hover:bg-sand-50"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle
          title="ألوان الهوية"
          description="حدد الألوان المستخدمة في الهوية المرئية للمنصة."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          {(
            ['primary_color', 'secondary_color', 'accent_color'] as const
          ).map((key) => {
            const label =
              key === 'primary_color'
                ? 'اللون الأساسي'
                : key === 'secondary_color'
                  ? 'اللون الثانوي'
                  : 'لون التمييز'

            return (
              <div
                key={key}
                className="rounded-2xl border border-ink-900/8 bg-white p-4"
              >
                <label
                  htmlFor={key}
                  className="mb-2 block text-sm font-semibold text-ink-950"
                >
                  {label}
                </label>

                <div className="flex items-center gap-3">
                  <input
                    id={key}
                    type="color"
                    value={form[key]}
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              [key]: event.target.value,
                            }
                          : current
                      )
                    }
                    className="h-11 w-14 cursor-pointer rounded-xl border border-sand-200 bg-white p-1"
                  />

                  <input
                    type="text"
                    value={form[key]}
                    dir="ltr"
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              [key]: event.target.value,
                            }
                          : current
                      )
                    }
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-sand-200 bg-white px-3 text-sm text-ink-950 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-950/5"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle
          title="معلومات المنصة"
          description="البيانات العامة التي يمكن استخدامها في واجهة المنصة ومعلومات التواصل."
        />

        <div className="rounded-2xl border border-ink-900/8 bg-white p-5 sm:p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="اسم المنصة"
              value={form.platform_name}
              onChange={(value) =>
                setForm((current) =>
                  current
                    ? { ...current, platform_name: value }
                    : current
                )
              }
              placeholder="Dragon Media"
            />

            <Field
              label="اسم الشركة"
              value={form.company_name || ''}
              onChange={(value) =>
                setForm((current) =>
                  current
                    ? { ...current, company_name: value }
                    : current
                )
              }
            />

            <Field
              label="البريد الإلكتروني"
              value={form.contact_email || ''}
              type="email"
              dir="ltr"
              onChange={(value) =>
                setForm((current) =>
                  current
                    ? { ...current, contact_email: value }
                    : current
                )
              }
              placeholder="support@example.com"
            />

            <Field
              label="رقم الهاتف"
              value={form.contact_phone || ''}
              dir="ltr"
              onChange={(value) =>
                setForm((current) =>
                  current
                    ? { ...current, contact_phone: value }
                    : current
                )
              }
              placeholder="+20 10 0000 0000"
            />

            <Field
              label="رقم WhatsApp"
              value={form.whatsapp_number || ''}
              dir="ltr"
              onChange={(value) =>
                setForm((current) =>
                  current
                    ? { ...current, whatsapp_number: value }
                    : current
                )
              }
              placeholder="+20 10 0000 0000"
            />

            <Field
              label="رابط الموقع الإلكتروني"
              value={form.website_url || ''}
              dir="ltr"
              onChange={(value) =>
                setForm((current) =>
                  current
                    ? { ...current, website_url: value }
                    : current
                )
              }
              placeholder="https://example.com"
            />
          </div>

          <div className="mt-5">
            <label
              htmlFor="platform-description"
              className="mb-1.5 block text-sm font-semibold text-ink-950"
            >
              وصف المنصة
            </label>

            <textarea
              id="platform-description"
              value={form.description || ''}
              onChange={(event) =>
                setForm((current) =>
                  current
                    ? {
                        ...current,
                        description: event.target.value,
                      }
                    : current
                )
              }
              rows={4}
              placeholder="وصف مختصر لمنصة Dragon Media"
              className="w-full resize-y rounded-xl border border-sand-200 bg-white px-3.5 py-3 text-sm leading-6 text-ink-950 outline-none transition placeholder:text-ink-900/25 focus:border-ink-700 focus:ring-2 focus:ring-ink-950/5"
            />
          </div>
        </div>
      </section>

      <div className="sticky bottom-3 z-10 rounded-2xl border border-ink-900/8 bg-white/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.08)] backdrop-blur sm:bottom-4 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-ink-900/45">
            احفظ التعديلات لتطبيق الهوية الجديدة على المنصة.
          </p>

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || uploading !== null}
            className="min-h-11 w-full rounded-xl bg-ink-950 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </div>
    </div>
  )
}
