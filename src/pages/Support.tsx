import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useBranding } from '../hooks/useBranding'

interface SettingsData {
  support_phone: string | null
  support_email: string | null
  support_whatsapp: string | null
}

const COMPANY_ADDRESS = 'الإسكندرية - مصر'

function WhatsAppIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.5 3.5A11.9 11.9 0 0 0 12.05 0C5.5 0 .17 5.32.17 11.88c0 2.1.55 4.15 1.6 5.96L.06 23.98l6.28-1.65a11.9 11.9 0 0 0 5.7 1.45h.01c6.55 0 11.88-5.33 11.88-11.89 0-3.17-1.23-6.15-3.43-8.39ZM12.05 21.75h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.73.98 1-3.64-.23-.37a9.87 9.87 0 0 1-1.52-5.25C2.17 6.42 6.6 1.99 12.05 1.99c2.64 0 5.12 1.03 6.99 2.91a9.84 9.84 0 0 1 2.9 7c0 5.45-4.43 9.85-9.89 9.85Zm5.42-7.39c-.3-.15-1.77-.87-2.05-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.64-2.06-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.13 3.25 5.17 4.56.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
    </svg>
  )
}

function PhoneIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M7 3.5 9.2 3c.5-.1 1 .2 1.2.7l1 2.7c.2.5 0 1-.4 1.3L9.5 9c1 2 2.5 3.5 4.5 4.5l1.3-1.5c.3-.4.8-.6 1.3-.4l2.7 1c.5.2.8.7.7 1.2l-.5 2.2c-.2.9-1 1.5-1.9 1.5C10 17.5 6.5 14 4.5 6.4c-.2-.9.5-1.7 1.5-1.9L7 3.5Z" />
    </svg>
  )
}

function MailIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  )
}

function LocationIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20 10.5c0 5.1-8 10-8 10s-8-4.9-8-10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10.5" r="2.5" />
    </svg>
  )
}

export default function Support() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const { branding, logoUrl } = useBranding()

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase
      .from('platform_settings')
      .select('support_phone, support_email, support_whatsapp')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        setSettings(data as SettingsData)
        setLoading(false)
      })
  }, [])

  const platformName = branding?.platform_name || 'Dragon Media'
  const whatsappHref = settings?.support_whatsapp
    ? `https://wa.me/20${settings.support_whatsapp.replace(/^0/, '')}`
    : null

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.12),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(37,99,235,0.10),_transparent_35%)] bg-sand-50 px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-sand-200/80 bg-white/90 shadow-[0_25px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl lg:grid-cols-[0.85fr_1.15fr]">
          <section className="relative hidden overflow-hidden bg-ink-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-gold-500/15 blur-3xl" />
            <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />

            <div className="relative">
              <div className="mb-8 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 p-2.5 shadow-lg">
                  <img src={logoUrl} alt={platformName} className="h-full w-full object-contain" />
                </div>
                <div>
                  <p className="text-lg font-bold">{platformName}</p>
                  <p className="text-sm text-white/55">مركز الدعم والمساعدة</p>
                </div>
              </div>

              <div className="max-w-sm">
                <span className="mb-4 inline-flex rounded-full border border-gold-400/20 bg-gold-400/10 px-3 py-1 text-xs font-semibold text-gold-300">
                  نحن هنا لمساعدتك
                </span>
                <h1 className="text-3xl font-black leading-tight xl:text-4xl">
                  تواصل مع فريق الدعم بكل سهولة
                </h1>
                <p className="mt-5 text-sm leading-7 text-white/65">
                  لو عندك استفسار أو واجهتك أي مشكلة داخل المنصة، اختار وسيلة التواصل المناسبة وهنساعدك في أقرب وقت.
                </p>
              </div>
            </div>

            <p className="relative text-xs text-white/40">
              دعم {platformName} — تجربة واضحة وسريعة
            </p>
          </section>

          <section className="p-5 sm:p-8 lg:p-10">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sand-200 bg-white p-2 shadow-sm">
                <img src={logoUrl} alt={platformName} className="h-full w-full object-contain" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-ink-950">تواصل مع فريق الدعم</h1>
                <p className="text-xs text-ink-900/50">{platformName}</p>
              </div>
            </div>

            <div className="mb-7">
              <span className="text-xs font-bold text-gold-600">مركز الدعم</span>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-ink-950 sm:text-3xl">إزاي نقدر نساعدك؟</h2>
              <p className="mt-2 text-sm leading-6 text-ink-900/55">
                تواصل معنا مباشرة من خلال أي وسيلة متاحة بالأسفل.
              </p>
            </div>

            {loading ? (
              <div className="space-y-3" aria-live="polite">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-20 animate-pulse rounded-2xl bg-sand-100" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {whatsappHref && settings?.support_whatsapp && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100/80 hover:shadow-lg hover:shadow-emerald-900/5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-sm">
                        <WhatsAppIcon className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-emerald-950">واتساب</p>
                        <p className="mt-0.5 text-xs text-emerald-900/60">تواصل معنا مباشرة</p>
                      </div>
                    </div>
                    <span dir="ltr" className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-bold text-emerald-900 shadow-sm">{settings.support_whatsapp}</span>
                  </a>
                )}

                {settings?.support_phone && (
                  <a
                    href={`tel:${settings.support_phone}`}
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-100/80 hover:shadow-lg hover:shadow-blue-900/5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                        <PhoneIcon />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-blue-950">اتصال هاتفي</p>
                        <p className="mt-0.5 text-xs text-blue-900/60">اتصل بفريق الدعم</p>
                      </div>
                    </div>
                    <span dir="ltr" className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-bold text-blue-900 shadow-sm">{settings.support_phone}</span>
                  </a>
                )}

                {settings?.support_email && (
                  <a
                    href={`mailto:${settings.support_email}`}
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-100/80 hover:shadow-lg hover:shadow-amber-900/5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                        <MailIcon />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-amber-950">البريد الإلكتروني</p>
                        <p className="mt-0.5 text-xs text-amber-900/60">راسلنا في أي وقت</p>
                      </div>
                    </div>
                    <span dir="ltr" className="max-w-[58%] truncate rounded-xl bg-white px-3 py-2 text-sm font-bold text-amber-900 shadow-sm">{settings.support_email}</span>
                  </a>
                )}

                <div className="flex items-center gap-4 rounded-2xl border border-sand-200 bg-sand-50 px-4 py-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-white shadow-sm">
                    <LocationIcon />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink-950">مقر الشركة</p>
                    <p className="mt-0.5 text-xs text-ink-900/55">{COMPANY_ADDRESS}</p>
                  </div>
                </div>

                {!settings?.support_phone && !settings?.support_whatsapp && !settings?.support_email && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    بيانات التواصل مع الدعم غير متاحة حاليًا. يمكنك مراجعة إدارة المنصة لتحديث وسائل التواصل.
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 border-t border-sand-200 pt-6">
              <div className="mb-3 text-xs font-bold text-ink-900/45">معلومات وسياسات</div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <Link to="/terms" className="font-semibold text-ink-900/60 transition-colors hover:text-ink-950 hover:underline">الشروط والأحكام</Link>
                <Link to="/privacy" className="font-semibold text-ink-900/60 transition-colors hover:text-ink-950 hover:underline">سياسة الخصوصية</Link>
                <Link to="/refund-policy" className="font-semibold text-ink-900/60 transition-colors hover:text-ink-950 hover:underline">استرداد الأموال</Link>
              </div>
            </div>

            <Link to="/login" className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm font-bold text-ink-900 transition-all hover:border-ink-200 hover:bg-sand-50">
              العودة لتسجيل الدخول
            </Link>
          </section>
        </div>
      </div>
    </div>
  )
}
