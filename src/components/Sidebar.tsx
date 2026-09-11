import React, { useState } from ‘react’
import { NavLink } from ‘react-router-dom’
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
} from ‘./Icon’
import { useIsPlatformAdmin } from ‘../lib/useIsPlatformAdmin’
import { useBranding } from ‘../hooks/useBranding’

const items = [
{
to: ‘/’,
label: ‘الرئيسية’,
icon: IconGrid,
end: true,
},
{
to: ‘/crm’,
label: ‘إدارة العملاء (CRM)’,
icon: IconUsers,
},
{
to: ‘/pipeline’,
label: ‘مسار المبيعات’,
icon: IconFunnel,
},
{
to: ‘/services’,
label: ‘الخدمات’,
icon: IconLayers,
},
{
to: ‘/campaigns’,
label: ‘الحملات التسويقية’,
icon: IconMegaphone,
},
{
to: ‘/inbox’,
label: ‘صندوق المحادثات’,
icon: IconChat,
},
{
to: ‘/ryan’,
label: ‘RYAN AI’,
icon: IconSpark,
},
{
to: ‘/automations’,
label: ‘الأتمتة’,
icon: IconSettings,
},
{
to: ‘/tasks’,
label: ‘المهام والمتابعات’,
icon: IconCheck,
},
{
to: ‘/appointments’,
label: ‘المواعيد’,
icon: IconCalendar,
},
{
to: ‘/billing’,
label: ‘الفواتير والاشتراكات’,
icon: IconCard,
},
{
to: ‘/reports’,
label: ‘التقارير’,
icon: IconChart,
},
{
to: ‘/users’,
label: ‘المستخدمون والصلاحيات’,
icon: IconShield,
},
{
to: ‘/tickets’,
label: ‘الدعم الفني’,
icon: IconChat,
},
{
to: ‘/settings’,
label: ‘الإعدادات’,
icon: IconSettings,
},
]

const adminItems = [
{
to: ‘/admin’,
label: ‘الرئيسية’,
icon: IconGrid,
end: true,
},
{
to: ‘/admin/organizations’,
label: ‘إدارة الشركات’,
icon: IconUsers,
},
{
to: ‘/admin/payments’,
label: ‘المدفوعات وطلبات الدفع’,
icon: IconCard,
},
{
to: ‘/admin/plans’,
label: ‘إدارة الباقات’,
icon: IconLayers,
},
{
to: ‘/admin/ryan-credits’,
label: ‘باقات RYAN الإضافية’,
icon: IconSpark,
},
{
to: ‘/admin/branding’,
label: ‘هوية المنصة’,
icon: IconDragon,
},
{
to: ‘/admin/settings’,
label: ‘إعدادات المنصة’,
icon: IconSettings,
},
{
to: ‘/admin/roles’,
label: ‘الأدوار والصلاحيات’,
icon: IconShield,
},
{
to: ‘/admin/audit-logs’,
label: ‘سجل النشاط’,
icon: IconChart,
},
{
to: ‘/admin/tickets’,
label: ‘تذاكر الدعم’,
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

const platformName =
branding?.platform_name || ‘Dragon Media’

const [adminOpen, setAdminOpen] = useState(false)

return (
<>
{open && (
)}

  <aside
    className={`fixed lg:static z-40 h-full w-72 shrink-0 bg-ink-950 text-sand-100 flex flex-col transition-transform duration-200 ${
      open
        ? 'translate-x-0'
        : 'translate-x-full lg:translate-x-0'
    }`}
  >
    {/* BRAND */}
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
    {/* NAVIGATION */}
    <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
      {items.map(
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
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] transition-colors ${
                isActive
                  ? 'bg-gold-500/15 text-gold-400 font-semibold'
                  : 'text-sand-100/70 hover:bg-white/5 hover:text-sand-100'
              }`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span>{label}</span>
          </NavLink>
        )
      )}
      {/* ADMIN */}
      {isAdmin && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() =>
              setAdminOpen(current => !current)
            }
            aria-expanded={adminOpen}
            aria-controls="platform-admin-navigation"
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
            <div
              id="platform-admin-navigation"
              className="mt-1 mr-2 pr-2 border-r border-white/10 space-y-0.5"
            >
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
                )
              )}
            </div>
          )}
        </div>
      )}
    </nav>
    {/* CURRENT PLAN */}
    <div className="p-4 border-t border-white/10">
      <div className="rounded-xl bg-white/5 p-3.5">
        <div className="text-sm font-semibold text-sand-100">
          الباقة الحالية: النمو
        </div>
        <div className="text-xs text-sand-100/50 mt-1">
          التجديد القادم في 15 أكتوبر
        </div>
      </div>
    </div>
  </aside>
</>

)
}
