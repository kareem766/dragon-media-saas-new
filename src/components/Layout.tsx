import React, {
  useEffect,
  useState,
} from 'react'
import {
  Outlet,
  useLocation,
  Link,
} from 'react-router-dom'

import Sidebar from './Sidebar'
import Topbar from './Topbar'

import {
  useSubscription,
} from '../lib/useSubscription'

const titles: Record<string, string> = {
  '/': 'نظرة عامة',
  '/crm': 'إدارة العملاء (CRM)',
  '/pipeline': 'مسار المبيعات',
  '/services': 'الخدمات',
  '/campaigns': 'الحملات التسويقية',
  '/inbox': 'صندوق المحادثات الموحد',
  '/ryan': 'RYAN AI',
  '/automations': 'الأتمتة',
  '/tasks': 'المهام والمتابعات',
  '/appointments': 'المواعيد',
  '/billing': 'الفواتير والاشتراكات',
  '/plans': 'الباقات',
  '/billing/pay': 'إرسال بيانات الدفع',
  '/reports': 'التقارير',
  '/users': 'المستخدمون والصلاحيات',
  '/account': 'حسابي',
  '/settings': 'الإعدادات',
  '/tickets': 'الدعم الفني',
  '/search': 'البحث',
  '/admin': 'لوحة الإدارة',
  '/admin/organizations': 'إدارة الشركات',
  '/admin/payments': 'المدفوعات',
  '/admin/audit-logs': 'سجل النشاط',
  '/admin/settings': 'إعدادات المنصة',
  '/admin/branding': 'هوية المنصة',
  '/admin/plans': 'إدارة الباقات',
  '/admin/roles': 'الأدوار والصلاحيات',
  '/admin/tickets': 'تذاكر الدعم',
}

const subscriptionExemptPaths = [
  '/plans',
  '/billing',
  '/billing/pay',
  '/account',
  '/settings',
  '/tickets',
]

const adminPaths = [
  '/admin',
  '/admin/organizations',
  '/admin/payments',
  '/admin/audit-logs',
  '/admin/settings',
  '/admin/branding',
  '/admin/plans',
  '/admin/roles',
  '/admin/tickets',
]

function isPathAllowedWithoutSubscription(pathname: string) {
  return subscriptionExemptPaths.some(
    (path) =>
      pathname === path ||
      pathname.startsWith(`${path}/`)
  )
}

function isAdminPath(pathname: string) {
  return adminPaths.some(
    (path) =>
      pathname === path ||
      pathname.startsWith(`${path}/`)
  )
}

function SubscriptionExpiredScreen({
  daysRemaining,
  formattedRenewalDate,
}: {
  daysRemaining: number | null
  formattedRenewalDate: string | null
}) {
  return (
    <div
      dir="rtl"
      className="min-h-[calc(100vh-140px)] flex items-center justify-center py-8 sm:py-10"
    >
      <div className="w-full max-w-xl">
        <div className="bg-white border border-sand-200 rounded-3xl shadow-sm p-6 sm:p-10 text-center">
          <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-red-600"
              aria-hidden="true"
            >
              <path
                d="M12 9V13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M12 17H12.01"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M10.3 4.7L2.9 17.5C2.13 18.83 3.09 20.5 4.63 20.5H19.37C20.91 20.5 21.87 18.83 21.1 17.5L13.7 4.7C12.93 3.37 11.07 3.37 10.3 4.7Z"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-ink-950 mb-3">
            انتهى اشتراكك
          </h2>

          <p className="text-sand-600 leading-7 mb-6">
            انتهت مدة باقتك الحالية وتم إيقاف
            الوصول إلى مميزات Dragon Media.
            يمكنك تجديد اشتراكك الآن لاستعادة
            الوصول إلى جميع مميزات المنصة.
          </p>

          {formattedRenewalDate && (
            <div className="bg-sand-50 rounded-2xl px-4 py-3 mb-6 text-sm text-sand-700">
              تاريخ انتهاء الاشتراك:{' '}
              <span className="font-semibold text-ink-950">
                {formattedRenewalDate}
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/plans"
              className="inline-flex items-center justify-center rounded-xl bg-ink-950 px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition"
            >
              تجديد الاشتراك
            </Link>

            <Link
              to="/billing"
              className="inline-flex items-center justify-center rounded-xl border border-sand-300 bg-white px-6 py-3 text-sm font-semibold text-ink-950 hover:bg-sand-50 transition"
            >
              عرض الفواتير والمدفوعات
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function SubscriptionBanner({
  daysRemaining,
  formattedRenewalDate,
}: {
  daysRemaining: number | null
  formattedRenewalDate: string | null
}) {
  if (daysRemaining === null || daysRemaining > 14) {
    return null
  }

  const isToday = daysRemaining === 0
  const isUrgent = daysRemaining <= 3

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'border-b px-4 sm:px-8 py-3 shrink-0',
        'transition-colors duration-200',
        isUrgent
          ? 'bg-red-50 border-red-200'
          : 'bg-gold-500/15 border-gold-500/30',
      ].join(' ')}
    >
      <div className="mx-auto w-full max-w-[1600px] flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={[
              'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
              isUrgent
                ? 'bg-red-100 text-red-600'
                : 'bg-gold-100 text-gold-700',
            ].join(' ')}
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="8.5"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M12 7V12L15 14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="min-w-0">
            <p
              className={[
                'text-sm font-semibold',
                isUrgent
                  ? 'text-red-800'
                  : 'text-ink-950',
              ].join(' ')}
            >
              {isToday
                ? 'اشتراكك ينتهي اليوم'
                : `متبقي ${daysRemaining} يوم على انتهاء اشتراكك`}
            </p>

            {formattedRenewalDate && (
              <p className="text-xs text-sand-600 mt-0.5 truncate">
                تاريخ الانتهاء: {formattedRenewalDate}
              </p>
            )}
          </div>
        </div>

        <Link
          to="/plans"
          className={[
            'text-sm font-bold whitespace-nowrap transition-colors',
            isUrgent
              ? 'text-red-700 hover:text-red-800'
              : 'text-gold-700 hover:text-gold-800',
          ].join(' ')}
        >
          تجديد الاشتراك
        </Link>
      </div>
    </div>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  const title = titles[pathname] ?? 'Dragon Media'

  const {
    loading,
    isActive,
    isExpired,
    isPendingPayment,
    daysRemaining,
    formattedRenewalDate,
  } = useSubscription()

  const [
    accessResolved,
    setAccessResolved,
  ] = useState(false)

  useEffect(() => {
    if (!loading) {
      setAccessResolved(true)
    }
  }, [loading])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const exempt =
    isPathAllowedWithoutSubscription(pathname)

  const adminRoute =
    isAdminPath(pathname)

  const shouldLockPage =
    accessResolved &&
    !loading &&
    !isActive &&
    !exempt &&
    !adminRoute

  const showPendingBanner =
    accessResolved &&
    !loading &&
    isPendingPayment &&
    !exempt &&
    !adminRoute

  return (
    <div
      dir="rtl"
      className="flex h-screen min-h-0 overflow-hidden bg-sand-50"
    >
      <Sidebar
        open={open}
        onClose={() => setOpen(false)}
      />

      <div className="flex-1 flex min-w-0 min-h-0 flex-col">
        <Topbar
          title={title}
          onMenuClick={() => setOpen(true)}
        />

        {!loading && isActive && (
          <SubscriptionBanner
            daysRemaining={daysRemaining}
            formattedRenewalDate={formattedRenewalDate}
          />
        )}

        {showPendingBanner && (
          <div
            role="status"
            aria-live="polite"
            className="bg-gold-500/15 border-b border-gold-500/30 px-4 sm:px-8 py-3 shrink-0"
          >
            <div className="mx-auto w-full max-w-[1600px] flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-ink-950">
                  طلب الاشتراك قيد المراجعة
                </p>

                <p className="text-xs text-sand-600 mt-0.5">
                  سيتم تفعيل مميزات الباقة بعد تأكيد الدفع.
                </p>
              </div>

              <Link
                to="/billing"
                className="text-sm font-bold text-gold-700 hover:underline"
              >
                متابعة الدفع
              </Link>
            </div>
          </div>
        )}

        {!loading &&
          isExpired &&
          !exempt &&
          !adminRoute && (
            <div
              role="alert"
              aria-live="assertive"
              className="bg-red-50 border-b border-red-200 px-4 sm:px-8 py-3 shrink-0"
            >
              <div className="mx-auto w-full max-w-[1600px] flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-red-800">
                    انتهى اشتراكك وتم إيقاف مميزات المنصة
                  </p>

                  <p className="text-xs text-red-700/80 mt-0.5">
                    جدد اشتراكك لاستعادة الوصول.
                  </p>
                </div>

                <Link
                  to="/plans"
                  className="text-sm font-bold text-red-700 hover:underline"
                >
                  تجديد الاشتراك
                </Link>
              </div>
            </div>
          )}

        <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <div className="mx-auto w-full max-w-[1600px] min-h-full">
            {shouldLockPage ? (
              <SubscriptionExpiredScreen
                daysRemaining={daysRemaining}
                formattedRenewalDate={formattedRenewalDate}
              />
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
