import React, { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
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

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
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
      return planName ? `${planName} - منتهية` : 'لا يوجد اشتراك فعال'
    }

    if (isActive) {
      return planName ? `الباقة الحالية: ${planName}` : 'الباقة الحالية'
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
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:static z-40 h-full w-72 shrink-0 bg-ink-950 text-sand-100 flex flex-col transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
          <img
            src={logoUrl}
            alt={platformName}
            className="w-10 h-10 rounded-lg object-contain bg-white/5"
          />

          <div>
            <div className="font-bold text-lg leading-tight">
              {platformName}
            </div>

            <div className="text-xs text-sand-100/50">
              منصة التسويق والمبيعات
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {items.map(({ to, label, icon: Icon, end, feature }) => {
            const locked = isFeatureLocked(feature)

            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] transition-colors ${
                    isActive
                      ? 'bg-gold-500/15 text-gold-400 font-semibold'
                      : locked
                        ? 'text-sand-100/40 hover:bg-white/5 hover:text-sand-100/60'
                        : 'text-sand-100/70 hover:bg-white/5 hover:text-sand-100'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />

                <span className="flex-1">{label}</span>

                {locked && (
                  <span
                    className="text-xs text-sand-100/35"
                    title="الميزة غير متاحة في باقتك الحالية"
                    aria-label="الميزة غير متاحة في باقتك الحالية"
                  >
                    🔒
                  </span>
                )}
              </NavLink>
            )
          })}

          {isAdmin && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setAdminOpen((current) => !current)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-[15px] transition-colors ${
                  adminOpen
                    ? 'bg-gold-500/15 text-gold-400 font-semibold'
                    : 'text-gold-400/80 hover:bg-white/5 hover:text-gold-300'
                }`}
              >
                <span className="flex items-center gap-3">
                  <IconShield className="w-5 h-5 shrink-0" />
                  <span>لوحة تحكم المنصة</span>
                </span>

                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  className={`transition-transform ${
                    adminOpen ? 'rotate-180' : ''
                  }`}
                >
                  <path
                    d="M6 9L12 15L18 9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {adminOpen && (
                <div className="mt-1 mr-2 pr-2 border-r border-white/10 space-y-0.5">
                  {adminItems.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                          isActive
                            ? 'bg-gold-500/15 text-gold-400 font-semibold'
                            : 'text-sand-100/60 hover:bg-white/5 hover:text-sand-100'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-white/10">
          <Link
            to="/billing"
            onClick={onClose}
            className="block rounded-xl bg-white/5 p-3.5 hover:bg-white/10 transition-colors"
          >
            <div className="text-sm font-semibold text-sand-100">
              {subscriptionLabel}
            </div>

            <div className="text-xs text-sand-100/50 mt-1">
              {renewalLabel}
            </div>
          </Link>
        </div>
      </aside>
    </>
  )
}
