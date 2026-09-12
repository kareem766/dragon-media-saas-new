import React, { useCallback, useEffect, useState } from 'react'
import { Card, Button } from '../components/ui'
import { supabase } from '../lib/supabaseClient'

function LoadingState() {
  return (
    <div className="max-w-2xl space-y-5" aria-busy="true">
      <div className="animate-pulse space-y-2">
        <div className="h-7 w-56 rounded-lg bg-ink-900/8" />
        <div className="h-4 w-80 max-w-full rounded-lg bg-ink-900/6" />
      </div>

      <Card className="space-y-5 p-5 sm:p-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-3.5 w-32 rounded-lg bg-ink-900/8" />
            <div className="h-11 w-full rounded-xl bg-ink-900/6" />
          </div>
        ))}

        <div className="h-10 w-24 rounded-xl bg-ink-900/8" />
      </Card>
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <Card className="max-w-2xl border-red-500/15 bg-red-50/50 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                d="M12 9v4M12 17h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.75 3h14.9a2 2 0 0 0 1.75-3l-7.5-13.1a2 2 0 0 0-3.4 0Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-bold text-red-800">
              تعذر تحميل إعدادات المنصة
            </h2>
            <p className="mt-1 break-words text-sm leading-6 text-red-700/80">
              {message}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRetry}
          className="min-h-10 shrink-0 rounded-xl bg-ink-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-900 active:scale-[0.98]"
        >
          إعادة المحاولة
        </button>
      </div>
    </Card>
  )
}

export default function AdminSettings() {
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSaved(false)

    try {
      if (!supabase) {
        throw new Error('تعذر الاتصال بقاعدة البيانات.')
      }

      const { data, error: loadError } = await supabase
        .from('platform_settings')
        .select('support_phone, support_email, support_whatsapp')
        .eq('id', 1)
        .single()

      if (loadError) {
        throw loadError
      }

      setPhone(data?.support_phone ?? '')
      setWhatsapp(data?.support_whatsapp ?? '')
      setEmail(data?.support_email ?? '')
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'حدث خطأ غير متوقع أثناء تحميل الإعدادات.'

      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const handleSave = async () => {
    if (!supabase || saving) return

    setSaving(true)
    setSaved(false)
    setError(null)

    try {
      const { error: saveError } = await supabase
        .from('platform_settings')
        .update({
          support_phone: phone.trim(),
          support_whatsapp: whatsapp.trim(),
          support_email: email.trim(),
        })
        .eq('id', 1)

      if (saveError) {
        throw saveError
      }

      setSaved(true)

      window.setTimeout(() => {
        setSaved(false)
      }, 2500)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'حدث خطأ غير متوقع أثناء حفظ الإعدادات.'

      setError(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingState />
  }

  if (error && !saving && !saved) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-950 sm:text-2xl">
            إعدادات المنصة العامة
          </h1>
          <p className="mt-1 text-sm leading-6 text-ink-900/55">
            إدارة بيانات التواصل والدعم الخاصة بمنصة Dragon Media.
          </p>
        </div>

        <ErrorState message={error} onRetry={() => void loadSettings()} />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink-950 sm:text-2xl">
          إعدادات المنصة العامة
        </h1>
        <p className="mt-1 text-sm leading-6 text-ink-900/55">
          إدارة بيانات التواصل والدعم التي تستخدمها المنصة.
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-ink-900/6 bg-white px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/10 text-gold-700">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5h-5.2l-3.6 3.2c-.66.59-1.7.12-1.7-.76V16H6.5A2.5 2.5 0 0 1 4 13.5v-8Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink-950">
                بيانات الدعم
              </h2>
              <p className="mt-1 text-xs leading-5 text-ink-900/50">
                ستظهر هذه البيانات للعملاء عند الحاجة إلى التواصل مع دعم Dragon Media.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <label
              htmlFor="support-phone"
              className="mb-1.5 block text-sm font-semibold text-ink-950"
            >
              رقم هاتف الدعم
            </label>

            <input
              id="support-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              placeholder="مثال: +20 10 0000 0000"
              className="min-h-11 w-full rounded-xl border border-sand-200 bg-white px-3.5 py-2.5 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/25 focus:border-ink-700 focus:ring-2 focus:ring-ink-950/5"
            />
          </div>

          <div>
            <label
              htmlFor="support-whatsapp"
              className="mb-1.5 block text-sm font-semibold text-ink-950"
            >
              رقم واتساب الدعم
            </label>

            <input
              id="support-whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              placeholder="مثال: +20 10 0000 0000"
              className="min-h-11 w-full rounded-xl border border-sand-200 bg-white px-3.5 py-2.5 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/25 focus:border-ink-700 focus:ring-2 focus:ring-ink-950/5"
            />
          </div>

          <div>
            <label
              htmlFor="support-email"
              className="mb-1.5 block text-sm font-semibold text-ink-950"
            >
              البريد الإلكتروني للدعم
            </label>

            <input
              id="support-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              inputMode="email"
              autoComplete="email"
              placeholder="support@example.com"
              className="min-h-11 w-full rounded-xl border border-sand-200 bg-white px-3.5 py-2.5 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/25 focus:border-ink-700 focus:ring-2 focus:ring-ink-950/5"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/15 bg-red-50 px-3.5 py-3 text-sm leading-6 text-red-700"
            >
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-ink-900/6 pt-5 sm:flex-row sm:items-center">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="min-h-11 w-full sm:w-auto"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </Button>

            {saved && (
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10">
                  ✓
                </span>
                تم حفظ الإعدادات بنجاح
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
