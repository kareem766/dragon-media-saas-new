import React from 'react'
import { Link } from 'react-router-dom'

const links = [
  { to: '/terms', label: 'الشروط والأحكام' },
  { to: '/privacy', label: 'سياسة الخصوصية' },
  { to: '/refund-policy', label: 'استرداد الأموال' },
  { to: '/support', label: 'تواصل معنا' },
]

export default function SiteFooter() {
  return (
    <footer dir="rtl" className="shrink-0 border-t border-sand-200 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="inline-flex items-center justify-center rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-xs font-semibold text-ink-900 transition hover:border-sand-300 hover:bg-white hover:text-ink-950 sm:text-sm"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="text-center text-xs leading-5 text-sand-600 lg:text-right">
            <div>مقر الشركة: الإسكندرية - مصر</div>
            <div className="mt-0.5">
              <a href="tel:01096656281" className="hover:text-ink-950">01096656281</a>
              <span className="mx-2 text-sand-300">•</span>
              <a href="mailto:kalnoby0@gmail.com" className="hover:text-ink-950">kalnoby0@gmail.com</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
