import React, { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

import {
  IconGrid,
  IconUsers,
  IconFunnel,
  IconLayers,
  IconMegaphone,
  IconChat,
  IconSpark,
  IconCheck,
  IconCalendar,
  IconCard,
  IconChart,
  IconShield,
  IconSettings,
  IconDragon,
} from './Icon'

import { useIsPlatformAdmin } from '../lib/useIsPlatformAdmin'
import { useSubscription } from '../lib/useSubscription'
import { useBranding } from '../hooks/useBranding'

type FeatureKey =
  | 'crm'
  | 'campaigns'
  | 'ryan'
  | 'automations'
  | 'advanced_reports'

type SidebarItem = {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
  feature?: FeatureKey
}

const items: SidebarItem[] = [
  {
    to: '/',
    label: 'الرئيسية',
    icon: IconGrid,
    end: true,
  },
  {
    to: '/crm',
    label: 'إدارة العملاء (CRM)',
    icon: IconUsers,
    feature: 'crm',
  },
  {
    to: '/pipeline',
    label: 'مسار المبيعات',
    icon: IconFunnel,
    feature: 'crm',
  },
  {
    to: '/services',
    label: 'الخدمات',
    icon: IconLayers,
  },
  {
    to: '/campaigns',
    label: 'الحملات التسويقية',
    icon: IconMegaphone,
    feature: 'campaigns',
  },
  {
    to: '/inbox',
    label: 'صندوق المحادثات',
    icon: IconChat,
  },
  {
    to: '/ryan',
    label: 'RYAN AI',
    icon: IconSpark,
    feature: 'ryan',
  },
  {
    to: '/automations',
    label: 'الأتمتة',
    icon: IconSettings,
    feature: 'automations',
  },
  {
    to: '/tasks',
    label: 'المهام والمتابعات',
    icon: IconCheck,
  },
  {
    to: '/appointments',
    label: 'المواعيد',
    icon: IconCalendar,
  },
  {
    to: '/billing',
    label: 'الفواتير والاشتراكات',
    icon: IconCard,
  },
  {
    to: '/reports',
    label: 'التقارير',
    icon: IconChart,
    feature: 'advanced_reports',
  },
  {
    to: '/users',
    label: 'المستخدمون والصلاحيات',
    icon: IconShield,
  },
  {
    to: '/tickets',
    label: 'الدعم الفني',
    icon: IconChat,
  },
  {
    to: '/settings',
    label: 'الإعدادات',
    icon: IconSettings,
  },
]

const adminItems = [
  {
    to: '/admin',
    label: 'الرئيسية',
    icon: IconGrid,
    end: true,
  },
  {
    to: '/admin/organizations',
    label: 'إدارة الشركات',
    icon: IconUsers,
  },
  {
    to: '/admin/payments',
    label: 'المدفوعات وطلبات الدفع',
    icon: IconCard,
  },
  {
    to: '/admin/plans',
    label: 'إدارة الباقات',
    icon: IconLayers,
  },
  {
    to: '/admin/ryan-credits',
    label: 'باقات RYAN الإضافية',
    icon: IconSpark,
  },
  {
    to: '/admin/branding',
    label: 'هوية المنصة',
    icon: IconDragon,
  },
  {
    to: '/admin/settings',
    label: 'إعدادات المنصة',
    icon: IconSettings,
  },
  {
    to: '/admin/roles',
    label: 'الأدوار والصلاحيات',
    icon: IconShield,
  },
  {
    to: '/admin/audit-logs',
    label: 'سجل النشاط',
    icon: IconChart,
  },
  {
    to: '/admin/tickets',
    label: 'تذاكر الدعم',
    icon: IconChat,
  },
]

function LockIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 10V7.5C8 5.29 9.79 3.5 12 3.5C14.21 3.5 16 5.29 16 7.5V10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 14V16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={[
        'shrink-0 transition-transform duration-200',
        open ? 'rotate-180' : '',
      ].join(' ')}
      aria-hidden="true"
    >
      <path
        d="M6 9L12 15L18 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const location = useLocation()
  const { pathname } = location

  const { isAdmin } = useIsPlatformAdmin()
  const { branding, logoUrl } = useBranding()

  const {
    subscription,
    loading: subscriptionLoading,
    isActive,
    isExpired,
    isPendingPayment,
    formattedRenewalDate,
    hasFeature,
  } = useSubscription()

  const platformName = branding?.platform_name || 'Dragon Media'

  const [adminOpen, setAdminOpen] = useState(false)

  const isAdminRoute = pathname.startsWith('/admin')

  useEffect(() => {
    if (isAdminRoute) {
      setAdminOpen(true)
    }
  }, [isAdminRoute])

  const planName = subscription?.plan?.name || null

  const subscriptionLabel = (() => {
    if (subscriptionLoading) {
      return 'جاري تحميل الاشتراك...'
    }

    if (isPendingPayment) {
      return planName
        ? `طلب ${planName} قيد المراجعة`
        : 'طلب الاشتراك قيد المراجعة'
    }

    if (isExpired) {
      return planName
        ? `${planName} - منتهية`
        : 'لا يوجد اشتراك فعال'
    }

    if (isActive) {
      return planName
        ? `الباقة الحالية: ${planName}`
        : 'الباقة الحالية'
    }

    return 'لا يوجد اشتراك فعال'
  })()

  const renewalLabel = (() => {
    if (subscriptionLoading) {
      return 'جاري تحميل بيانات الاشتراك...'
    }

    if (isPendingPayment) {
      return 'سيتم التفعيل بعد مراجعة الدفع'
    }

    if (isExpired) {
      return 'يمكنك تجديد الاشتراك الآن'
    }

    if (isActive && formattedRenewalDate) {
      return `التجديد في ${formattedRenewalDate}`
    }

    return 'اختر باقتك للبدء'
  })()

  const isFeatureLocked = (feature?: FeatureKey) => {
    if (!feature) {
      return false
    }

    if (!isActive) {
      return true
    }

    return !hasFeature(feature)
  }

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="إغلاق القائمة"
          className={[
            'fixed inset-0 z-30 lg:hidden',
            'bg-black/45 backdrop-blur-[2px]',
            'transition-opacity duration-200',
          ].join(' ')}
          onClick={onClose}
        />
      )}

      <aside
        aria-label="القائمة الرئيسية"
        className={[
          'fixed lg:static z-40',
          'top-0 right-0 bottom-0',
          'w-[min(84vw,18rem)] lg:w-72',
          'shrink-0',
          'bg-ink-950 text-sand-100',
          'flex flex-col',
          'border-l border-white/5',
          'shadow-2xl lg:shadow-none',
          'transition-transform duration-300 ease-out',
          open
            ? 'translate-x-0'
            : 'translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {/* Brand Header */}
        <div className="relative shrink-0 px-4 sm:px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-xl bg-white/[0.07] border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={logoUrl}
                alt={platformName}
                className="w-9 h-9 object-contain"
              />

              <span
                className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 to-transparent pointer-events-none"
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="font-bold text-[17px] leading-tight text-white truncate">
                {platformName}
              </div>

              <div className="text-[11px] text-sand-100/45 mt-1 truncate">
                منصة التسويق والمبيعات
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق القائمة"
              className="lg:hidden w-9 h-9 rounded-xl text-sand-100/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M6 6L18 18M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav
          className={[
            'flex-1 min-h-0 overflow-y-auto',
            'py-4 px-3',
            'space-y-1',
            'scrollbar-thin',
          ].join(' ')}
        >
          {items.map(
            ({
              to,
              label,
              icon: Icon,
              end,
              feature,
            }) => {
              const locked = isFeatureLocked(feature)

              return (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={onClose}
                  className={({ isActive: active }) =>
                    [
                      'group relative',
                      'flex items-center gap-3',
                      'min-h-11',
                      'px-3 py-2.5',
                      'rounded-xl',
                      'text-[14px] sm:text-[15px]',
                      'transition-all duration-200 ease-out',
                      'select-none',
                      active
                        ? [
                            'bg-gold-500/15',
                            'text-gold-300',
                            'font-semibold',
                            'shadow-[inset_0_0_0_1px_rgba(245,158,11,0.08)]',
                          ].join(' ')
                        : locked
                          ? [
                              'text-sand-100/35',
                              'hover:bg-white/[0.04]',
                              'hover:text-sand-100/55',
                            ].join(' ')
                          : [
                              'text-sand-100/65',
                              'hover:bg-white/[0.055]',
                              'hover:text-white',
                              'hover:translate-x-[-1px]',
                            ].join(' '),
                    ].join(' ')
                  }
                >
                  {({ isActive: active }) => (
                    <>
                      {active && (
                        <span
                          className="absolute right-0 top-2 bottom-2 w-0.5 rounded-full bg-gold-400"
                          aria-hidden="true"
                        />
                      )}

                      <span
                        className={[
                          'w-9 h-9 rounded-lg',
                          'flex items-center justify-center',
                          'shrink-0',
                          'transition-colors duration-200',
                          active
                            ? 'bg-gold-500/10'
                            : 'bg-transparent group-hover:bg-white/[0.04]',
                        ].join(' ')}
                      >
                        <Icon className="w-[19px] h-[19px] shrink-0" />
                      </span>

                      <span className="flex-1 truncate">
                        {label}
                      </span>

                      {locked && (
                        <span
                          className="text-sand-100/30 shrink-0"
                          title="الميزة غير متاحة في باقتك الحالية"
                          aria-label="الميزة غير متاحة في باقتك الحالية"
                        >
                          <LockIcon />
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              )
            }
          )}

          {/* Admin Navigation */}
          {isAdmin && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <button
                type="button"
                aria-expanded={adminOpen}
                onClick={() =>
                  setAdminOpen((current) => !current)
                }
                className={[
                  'w-full min-h-11',
                  'flex items-center justify-between gap-3',
                  'px-3 py-2.5',
                  'rounded-xl',
                  'text-[14px] sm:text-[15px]',
                  'transition-all duration-200',
                  'focus-visible:outline-none',
                  'focus-visible:ring-2',
                  'focus-visible:ring-gold-400/40',
                  adminOpen || isAdminRoute
                    ? 'bg-gold-500/15 text-gold-300 font-semibold'
                    : 'text-gold-400/75 hover:bg-white/[0.055] hover:text-gold-300',
                ].join(' ')}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-lg bg-gold-500/10 flex items-center justify-center shrink-0">
                    <IconShield className="w-[19px] h-[19px]" />
                  </span>

                  <span className="truncate">
                    لوحة تحكم المنصة
                  </span>
                </span>

                <ChevronIcon open={adminOpen} />
              </button>

              <div
                className={[
                  'overflow-hidden transition-all duration-200 ease-out',
                  adminOpen
                    ? 'max-h-[520px] opacity-100'
                    : 'max-h-0 opacity-0',
                ].join(' ')}
              >
                <div className="mt-1 mr-2 pr-2 border-r border-white/10 space-y-1">
                  {adminItems.map(
                    ({
                      to,
                      label,
                      icon: Icon,
                      end,
                    }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={end}
                        onClick={onClose}
                        className={({ isActive: active }) =>
                          [
                            'group flex items-center gap-3',
                            'min-h-10',
                            'px-3 py-2',
                            'rounded-lg',
                            'text-sm',
                            'transition-all duration-200',
                            active
                              ? 'bg-gold-500/15 text-gold-300 font-semibold'
                              : 'text-sand-100/55 hover:bg-white/[0.055] hover:text-white hover:translate-x-[-1px]',
                          ].join(' ')
                        }
                      >
                        {({ isActive: active }) => (
                          <>
                            <span
                              className={[
                                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                                active
                                  ? 'bg-gold-500/10'
                                  : 'bg-transparent group-hover:bg-white/[0.04]',
                              ].join(' ')}
                            >
                              <Icon className="w-[17px] h-[17px] shrink-0" />
                            </span>

                            <span className="truncate">
                              {label}
                            </span>
                          </>
                        )}
                      </NavLink>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* Subscription Card */}
        <div className="shrink-0 p-3 sm:p-4 border-t border-white/10">
          <Link
            to="/billing"
            onClick={onClose}
            className={[
              'group block rounded-2xl',
              'bg-white/[0.055]',
              'border border-white/[0.06]',
              'p-3.5',
              'transition-all duration-200',
              'hover:bg-white/[0.085]',
              'hover:border-white/10',
              'hover:shadow-lg hover:shadow-black/10',
            ].join(' ')}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-gold-500/10 text-gold-400 flex items-center justify-center shrink-0">
                <IconCard
                  className="w-[18px] h-[18px]"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white truncate">
                  {subscriptionLabel}
                </div>

                <div className="text-[11px] leading-5 text-sand-100/45 mt-1">
                  {renewalLabel}
                </div>
              </div>

              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="mt-1 text-sand-100/30 group-hover:text-gold-400 transition-colors shrink-0"
                aria-hidden="true"
              >
                <path
                  d="M9 18L15 12L9 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </Link>
        </div>
      </aside>
    </>
  )
}
