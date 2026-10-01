import React, { useEffect, useState } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import SiteFooter from './SiteFooter'
import BackButton from './BackButton'
import { useSubscription } from '../lib/useSubscription'
import { supabase } from '../lib/supabaseClient'

const titles: Record<string, string> = {
  '/': 'نظرة عامة', '/crm': 'إدارة العملاء (CRM)', '/pipeline': 'مسار المبيعات', '/services': 'الخدمات', '/campaigns': 'الحملات التسويقية', '/ai-content': 'استوديو المحتوى بالـAI', '/inbox': 'صندوق المحادثات الموحد', '/ryan': 'RYAN AI', '/automations': 'الأتمتة', '/tasks': 'المهام والمتابعات', '/appointments': 'المواعيد', '/billing': 'الفواتير والاشتراكات', '/plans': 'الباقات', '/billing/pay': 'إرسال بيانات الدفع', '/reports': 'التقارير', '/users': 'المستخدمون والصلاحيات', '/account': 'حسابي', '/settings': 'الإعدادات', '/tickets': 'الدعم الفني', '/search': 'البحث', '/admin': 'لوحة الإدارة', '/admin/organizations': 'إدارة الشركات', '/admin/payments': 'المدفوعات', '/admin/audit-logs': 'سجل النشاط', '/admin/settings': 'إعدادات المنصة', '/admin/branding': 'هوية المنصة', '/admin/plans': 'إدارة الباقات', '/admin/features': 'تحكم مميزات المنصة', '/admin/ryan-credits': 'باقات Ryan', '/admin/roles': 'الأدوار والصلاحيات', '/admin/tickets': 'تذاكر الدعم', '/admin/platform-users': 'مديرو المنصة والحسابات',
}

const subscriptionExemptPaths = ['/plans', '/billing', '/billing/pay', '/account', '/settings', '/tickets']
const adminPaths = ['/admin', '/admin/organizations', '/admin/payments', '/admin/audit-logs', '/admin/settings', '/admin/branding', '/admin/plans', '/admin/features', '/admin/ryan-credits', '/admin/roles', '/admin/tickets', '/admin/platform-users']
const isPathAllowedWithoutSubscription = (pathname: string) => subscriptionExemptPaths.some(path => pathname === path || pathname.startsWith(`${path}/`))
const isAdminPath = (pathname: string) => adminPaths.some(path => pathname === path || pathname.startsWith(`${path}/`))

const getPageTheme = (pathname: string) => {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/crm') || pathname.startsWith('/pipeline') || pathname.startsWith('/customers') || pathname.startsWith('/leads')) return 'crm'
  if (pathname.startsWith('/tasks')) return 'tasks'
  if (pathname.startsWith('/inbox') || pathname.startsWith('/tickets') || pathname.startsWith('/appointments')) return 'inbox'
  if (pathname.startsWith('/ryan') || pathname.startsWith('/automations')) return 'ai'
  if (pathname.startsWith('/campaigns')) return 'campaigns'
  if (pathname.startsWith('/ai-content')) return 'ai'
  if (pathname.startsWith('/reports')) return 'reports'
  if (pathname.startsWith('/billing') || pathname.startsWith('/plans')) return 'billing'
  if (pathname.startsWith('/integrations')) return 'integrations'
  if (pathname.startsWith('/services')) return 'services'
  if (pathname.startsWith('/settings') || pathname.startsWith('/account')) return 'settings'
  return 'dashboard'
}

function SubscriptionExpiredScreen({ isNewCompany, daysRemaining, formattedRenewalDate }: { isNewCompany: boolean; daysRemaining: number | null; formattedRenewalDate: string | null }) {
  if (isNewCompany) {
    const features = ['إدارة العملاء والمبيعات', 'Ryan AI للمحادثات والبيع', 'الحملات والتسويق', 'صندوق المحادثات الموحد', 'التقارير والمتابعة', 'الأتمتة وتنظيم العمل']
    return <div dir="rtl" className="min-h-[calc(100vh-140px)] flex items-center justify-center py-6 sm:py-10 dm-page-enter"><div className="w-full max-w-3xl dm-fade-up"><div className="bg-white/95 border border-sand-200 rounded-3xl shadow-sm p-6 sm:p-10 text-center dm-card-lift"><div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 text-xl font-bold">D</div><p className="mb-2 text-sm font-semibold text-blue-700">مرحبًا بك في Dragon Media</p><h2 className="text-2xl sm:text-3xl font-bold text-ink-950 mb-3">اهلا وسهلا بيك في منصة دراجون ميديا</h2><p className="mx-auto max-w-2xl text-sand-600 leading-7 mb-7">منصة واحدة تساعدك على إدارة عملائك ومبيعاتك وتسويقك ومحادثاتك، مع أدوات ذكية مصممة لتنظيم شغلك وتنمية نشاطك.</p><div className="mb-7 text-right"><h3 className="mb-3 text-base font-bold text-ink-950">أهم مميزات المنصة</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{features.map(feature => <div key={feature} className="flex items-center gap-3 rounded-2xl border border-sand-200 bg-sand-50/70 px-4 py-3 text-sm font-semibold text-ink-950"><span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />{feature}</div>)}</div></div><div className="flex flex-col sm:flex-row gap-3 justify-center"><Link to="/plans" className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 dm-interactive">استعرض الباقات وابدأ الآن</Link><Link to="/billing" className="inline-flex items-center justify-center rounded-xl border border-sand-300 bg-white px-6 py-3 text-sm font-semibold text-ink-950 hover:bg-sand-50 dm-interactive">الفواتير والمدفوعات</Link></div></div></div></div>
  }
  return <div dir="rtl" className="min-h-[calc(100vh-140px)] flex items-center justify-center py-8 sm:py-10 dm-page-enter"><div className="w-full max-w-xl dm-fade-up"><div className="bg-white border border-sand-200 rounded-3xl shadow-sm p-6 sm:p-10 text-center dm-card-lift"><div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 text-2xl dm-float">!</div><h2 className="text-2xl sm:text-3xl font-bold text-ink-950 mb-3">انتهى اشتراكك</h2><p className="text-sand-600 leading-7 mb-6">انتهت مدة باقتك الحالية وتم إيقاف الوصول إلى مميزات Dragon Media. يمكنك تجديد اشتراكك الآن لاستعادة الوصول.</p>{formattedRenewalDate && <div className="bg-sand-50 rounded-2xl px-4 py-3 mb-6 text-sm text-sand-700">تاريخ انتهاء الاشتراك: <span className="font-semibold text-ink-950">{formattedRenewalDate}</span></div>}<div className="flex flex-col sm:flex-row gap-3 justify-center"><Link to="/plans" className="inline-flex items-center justify-center rounded-xl bg-ink-950 px-6 py-3 text-sm font-semibold text-white hover:opacity-90 dm-interactive">تجديد الاشتراك</Link><Link to="/billing" className="inline-flex items-center justify-center rounded-xl border border-sand-300 bg-white px-6 py-3 text-sm font-semibold text-ink-950 hover:bg-sand-50 dm-interactive">الفواتير والمدفوعات</Link></div>{daysRemaining !== null && <p className="mt-4 text-xs text-sand-500">انتهاء الاشتراك: {daysRemaining === 0 ? 'اليوم' : `${daysRemaining} يوم`}</p>}</div></div></div>
}

function PlatformMaintenanceScreen({ message }: { message: string }) {
  return <div dir="rtl" className="min-h-[calc(100vh-140px)] flex items-center justify-center py-8 sm:py-10 dm-page-enter">
    <div className="w-full max-w-2xl dm-fade-up">
      <div className="bg-white border border-sand-200 rounded-3xl shadow-sm p-7 sm:p-10 text-center dm-card-lift">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 text-xl font-bold">!</div>
        <p className="mb-2 text-sm font-semibold text-amber-700">Dragon Media</p>
        <h2 className="text-2xl sm:text-3xl font-bold text-ink-950 mb-3">المنصة متوقفة مؤقتًا</h2>
        <p className="mx-auto max-w-xl text-sand-600 leading-7">{message}</p>
        <p className="mt-5 text-xs text-sand-500">يمكنك المحاولة مرة أخرى بعد إعادة تشغيل المنصة.</p>
      </div>
    </div>
  </div>
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
  const pageTheme = getPageTheme(pathname)
  const { loading, isActive, isExpired, isPendingPayment, daysRemaining, formattedRenewalDate, accessState } = useSubscription()
  const [preSubscriptionAccess, setPreSubscriptionAccess] = useState({ integrations: false })
  const [platformControl, setPlatformControl] = useState({ enabled: true, message: 'المنصة متوقفة مؤقتًا للصيانة. سنعود للعمل قريبًا.' })
  useEffect(() => {
    if (!supabase) return
    void supabase.from('platform_settings').select('integrations_enabled_before_subscription, platform_enabled, maintenance_message').eq('id', 1).single().then(({ data }) => { setPreSubscriptionAccess({ integrations: Boolean(data?.integrations_enabled_before_subscription) }); setPlatformControl({ enabled: data?.platform_enabled !== false, message: data?.maintenance_message || 'المنصة متوقفة مؤقتًا للصيانة. سنعود للعمل قريبًا.' }) })
  }, [])
  // Do not evaluate subscription locks until the first subscription load has
  // completed. This keeps new accounts on a neutral loading state instead of
  // briefly showing the locked/expired screen before the welcome card.
  const accessResolved = !loading
  useEffect(() => { setOpen(false) }, [pathname])

  const exempt = isPathAllowedWithoutSubscription(pathname) || (pathname.startsWith('/integrations') && preSubscriptionAccess.integrations)
  const adminRoute = isAdminPath(pathname)
  const platformLocked = accessResolved && !loading && !platformControl.enabled && !adminRoute
  // Pending payment is an intentional intermediate state. Do not replace the
  // customer's current page with the plans screen while payment is being reviewed.
  const shouldLockPage = accessResolved && !loading && !isActive && !isPendingPayment && !exempt && !adminRoute
  const showPendingBanner = accessResolved && !loading && isPendingPayment && !exempt && !adminRoute
  const isNewCompany = accessState === 'no_subscription'

  return <div dir="rtl" data-page-theme={pageTheme} className="flex h-screen min-h-0 overflow-hidden bg-sand-50 dm-app-shell"><div className="dm-page-backdrop" aria-hidden="true" /><Sidebar open={open} onClose={() => setOpen(false)} /><div className="flex-1 flex min-w-0 min-h-0 flex-col"><Topbar title={title} onMenuClick={() => setOpen(true)} />{!loading && isActive && <SubscriptionBanner daysRemaining={daysRemaining} formattedRenewalDate={formattedRenewalDate} />}{showPendingBanner && <div role="status" aria-live="polite" className="bg-gold-500/15 border-b border-gold-500/30 px-3 sm:px-4 md:px-8 py-3 dm-fade-up"><div className="mx-auto max-w-[1600px] flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-ink-950">طلب الاشتراك قيد المراجعة</p><p className="text-xs text-sand-600 mt-0.5">سيتم تفعيل مميزات الباقة بعد تأكيد الدفع.</p></div><Link to="/billing" className="shrink-0 rounded-xl px-4 py-2 bg-gold-100 text-sm font-bold text-gold-700 hover:bg-gold-200 dm-interactive">متابعة الدفع</Link></div></div>}{!loading && isExpired && !exempt && !adminRoute && <div role="alert" className="bg-red-50 border-b border-red-200 px-3 sm:px-4 md:px-8 py-3 dm-fade-up"><div className="mx-auto max-w-[1600px] flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-red-800">انتهى اشتراكك وتم إيقاف مميزات المنصة</p><p className="text-xs text-red-700/80 mt-0.5">جدد اشتراكك لاستعادة الوصول.</p></div><Link to="/plans" className="shrink-0 rounded-xl px-4 py-2 bg-red-100 text-sm font-bold text-red-700 hover:bg-red-200 dm-interactive">تجديد الاشتراك</Link></div></div>}<main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 dm-main-stage"><div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col dm-page-enter dm-page-content"><div className="flex-1"><BackButton />{platformLocked ? <PlatformMaintenanceScreen message={platformControl.message} /> : shouldLockPage ? <SubscriptionExpiredScreen isNewCompany={isNewCompany} daysRemaining={daysRemaining} formattedRenewalDate={formattedRenewalDate} /> : <Outlet />}</div><SiteFooter /></div></main></div></div>
}
