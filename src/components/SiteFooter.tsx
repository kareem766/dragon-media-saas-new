import React from 'react'
import { Link } from 'react-router-dom'
import { useBranding } from '../hooks/useBranding'

const links = [
  { to: '/terms', label: 'الشروط والأحكام' },
  { to: '/privacy', label: 'سياسة الخصوصية' },
  { to: '/refund-policy', label: 'استرداد الأموال' },
  { to: '/support', label: 'تواصل معنا' },
]

export default function SiteFooter() {
  const { branding } = useBranding()
  const phone = branding?.contact_phone || branding?.whatsapp_number || ''
  const email = branding?.contact_email || ''
  const address = branding?.support_address || 'الإسكندرية - مصر'
  return <footer dir="rtl" className="shrink-0 border-t border-blue-100 bg-white/95 backdrop-blur-xl shadow-[0_-8px_30px_rgba(15,47,107,.04)]"><div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap items-center gap-2">{links.map(link=><Link key={link.to} to={link.to} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs font-semibold text-ink-900 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 sm:text-sm">{link.label}</Link>)}</div><div className="text-center text-xs leading-6 text-ink-900/55 lg:text-right"><div className="font-semibold text-ink-900/70">معلومات التواصل</div><div>{address}</div><div className="mt-0.5 flex flex-wrap items-center justify-center gap-2 lg:justify-end">{phone&&<a href={`tel:${phone}`} dir="ltr" className="hover:text-blue-800">{phone}</a>}{phone&&email&&<span className="text-blue-200">•</span>}{email&&<a href={`mailto:${email}`} dir="ltr" className="hover:text-blue-800">{email}</a>}</div></div></div></div></footer>
}
