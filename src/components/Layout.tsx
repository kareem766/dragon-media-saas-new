import React, { useEffect, useState } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useSubscription } from '../lib/useSubscription'

const titles: Record<string, string> = {
  '/': 'نظرة عامة', '/crm': 'إدارة العملاء (CRM)', '/pipeline': 'مسار المبيعات', '/services': 'الخدمات', '/campaigns': 'الحملات التسويقية', '/inbox': 'صندوق المحادثات الموحد', '/ryan': 'RYAN AI', '/automations': 'الأتمتة', '/tasks': 'المهام والمتابعات', '/appointments': 'المواعيد', '/billing': 'الفواتير والاشتراكات', '/plans': 'الباقات', '/billing/pay': 'إرسال بيانات الدفع', '/reports': 'التقارير', '/users': 'المستخدمون والصلاحيات', '/account': 'حسابي', '/settings': 'الإعدادات', '/tickets': 'الدعم الفني', '/search': 'البحث', '/admin': 'لوحة الإدارة', '/admin/organizations': 'إدارة الشركات', '/admin/payments': 'المدفوعات', '/admin/audit-logs': 'سجل النشاط', '/admin/settings': 'إعدادات المنصة', '/admin/branding': 'هوية المنصة', '/admin/plans': 'إدارة الباقات', '/admin/ryan-credits': 'باقات Ryan', '/admin/roles': 'الأدوار والصلاحيات', '/admin/tickets': 'تذاكر الدعم',
}

const subscriptionExemptPaths = ['/plans', '/billing', '/billing/pay', '/account', '/settings', '/tickets']
const adminPaths = ['/admin', '/admin/organizations', '/admin/payments', '/admin/audit-logs', '/admin/settings', '/admin/branding', '/admin/plans', '/admin/ryan-credits', '/admin/roles', '/admin/tickets']
const isPathAllowedWithoutSubscription = (pathname: string) => subscriptionExemptPaths.some(path => pathname === path || pathname.startsWith(`${path}/`))
const isAdminPath = (pathname: string) => adminPaths.some(path => pathname === path || pathname.startsWith(`${path}/`))

function SubscriptionExpiredScreen({ daysRemaining, formattedRenewalDate }: { daysRemaining: number | null; formattedRenewalDate: string | null }) {
  return <div dir="rtl" className="min-h-[calc(100vh-140px)] flex items-center justify-center py-8 sm:py-10 dm-page-enter"><div className="w-full max-w-xl dm-fade-up"><div className="bg-white border border-sand-200 rounded-3xl shadow-sm p-6 sm:p-10 text-center dm-card-lift"><div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 text-2xl dm-float">!</div><h2 className="text-2xl sm:text-3xl font-bold text-ink-950 mb-3">انتهى اشتراكك</h2><p className="text-sand-600 leading-7 mb-6">انتهت مدة باقتك الحالية وتم إيقاف الوصول إلى مميزات Dragon Media. يمكنك تجديد اشتراكك الآن لاستعادة الوصول.</p>{formattedRenewalDate && <div className="bg-sand-50 rounded-2xl px-4 py-3 mb-6 text-sm text-sand-700">تاريخ انتهاء الاشتراك: <span className="font-semibold text-ink-950">{formattedRenewalDate}</span></div>}<div className="flex flex-col sm:flex-row gap-3 justify-center"><Link to="/plans" className="inline-flex items-center justify-center rounded-xl bg-ink-950 px-6 py-3 text-sm font-semibold text-white hover:opacity-90 dm-interactive">تجديد الاشتراك</Link><Link to="/billing" className="inline-flex items-center justify-center rounded-xl border border-sand-300 bg-white px-6 py-3 text-sm font-semibold text-ink-950 hover:bg-sand-50 dm-interactive">الفواتير والمدفوعات</Link></div>{daysRemaining !== null && <p className="mt-4 text-xs text-sand-500">انتهاء الاشتراك: {daysRemaining === 0 ? 'اليوم' : `${daysRemaining} يوم`}</p>}</div></div></div>
}

function SubscriptionBanner({ daysRemaining, formattedRenewalDate }: { daysRemaining: number | null; formattedRenewalDate: string | null }) {
  if (daysRemaining === null || daysRemaining > 14) return null
  const isToday = daysRemaining === 0
  const isUrgent = daysRemaining <= 3
  return <div role="status" aria-live="polite" className={`border-b px-3 sm:px-4 md:px-8 py-3 shrink-0 dm-fade-up ${isUrgent ? 'bg-red-50 border-red-200' : 'bg-gold-500/15 border-gold-500/30'}`}><div className="mx-auto w-full max-w-[1600px] flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className={`text-sm font-semibold leading-6 ${isUrgent ? 'text-red-800' : 'text-ink-950'}`}>{isToday ? 'اشتراكك ينتهي اليوم' : `متبقي ${daysRemaining} يوم على انتهاء اشتراكك`}</p>{formattedRenewalDate && <p className="text-xs text-sand-600 mt-0.5">تاريخ الانتهاء: {formattedRenewalDate}</p>}</div><Link to="/plans" className={`inline-flex items-center justify-center w-full sm:w-auto rounded-xl px-4 py-2 text-sm font-bold dm-interactive ${isUrgent ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-gold-100 text-gold-700 hover:bg-gold-200'}`}>تجديد الاشتراك</Link></div></div>
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const title = titles[pathname] ?? 'Dragon Media'
  const { loading, isActive, isExpired, isPendingPayment, daysRemaining, formattedRenewalDate } = useSubscription()
  const [accessResolved, setAccessResolved] = useState(false)

  useEffect(() => { if (!loading) setAccessResolved(true) }, [loading])
  useEffect(() => { setOpen(false) }, [pathname])

  const exempt = isPathAllowedWithoutSubscription(pathname)
  const adminRoute = isAdminPath(pathname)
  const shouldLockPage = accessResolved && !loading && !isActive && !exempt && !adminRoute
  const showPendingBanner = accessResolved && !loading && isPendingPayment && !exempt && !adminRoute

  return <div dir="rtl" className="flex h-screen min-h-0 overflow-hidden bg-sand-50 dm-app-shell"><Sidebar open={open} onClose={() => setOpen(false)} /><div className="flex-1 flex min-w-0 min-h-0 flex-col"><Topbar title={title} onMenuClick={() => setOpen(true)} />{!loading && isActive && <SubscriptionBanner daysRemaining={daysRemaining} formattedRenewalDate={formattedRenewalDate} />}{showPendingBanner && <div role="status" aria-live="polite" className="bg-gold-500/15 border-b border-gold-500/30 px-3 sm:px-4 md:px-8 py-3 dm-fade-up"><div className="mx-auto max-w-[1600px] flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-ink-950">طلب الاشتراك قيد المراجعة</p><p className="text-xs text-sand-600 mt-0.5">سيتم تفعيل مميزات الباقة بعد تأكيد الدفع.</p></div><Link to="/billing" className="shrink-0 rounded-xl px-4 py-2 bg-gold-100 text-sm font-bold text-gold-700 hover:bg-gold-200 dm-interactive">متابعة الدفع</Link></div></div>}{!loading && isExpired && !exempt && !adminRoute && <div role="alert" className="bg-red-50 border-b border-red-200 px-3 sm:px-4 md:px-8 py-3 dm-fade-up"><div className="mx-auto max-w-[1600px] flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-red-800">انتهى اشتراكك وتم إيقاف مميزات المنصة</p><p className="text-xs text-red-700/80 mt-0.5">جدد اشتراكك لاستعادة الوصول.</p></div><Link to="/plans" className="shrink-0 rounded-xl px-4 py-2 bg-red-100 text-sm font-bold text-red-700 hover:bg-red-200 dm-interactive">تجديد الاشتراك</Link></div></div>}<main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 dm-main-stage"><div className="mx-auto w-full max-w-[1600px] min-h-full dm-page-enter dm-page-content" key={pathname}>{shouldLockPage ? <SubscriptionExpiredScreen daysRemaining={daysRemaining} formattedRenewalDate={formattedRenewalDate} /> : <Outlet />}</div></main></div></div>
}
