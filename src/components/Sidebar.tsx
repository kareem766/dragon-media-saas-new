import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  IconGrid, IconUsers, IconFunnel, IconLayers, IconMegaphone, IconChat,
  IconSpark, IconCheck, IconCalendar, IconCard, IconChart, IconShield,
  IconSettings, IconDragon
} from './Icon'

const items = [
  { to: '/', label: 'الرئيسية', icon: IconGrid, end: true },
  { to: '/crm', label: 'إدارة العملاء (CRM)', icon: IconUsers },
  { to: '/pipeline', label: 'مسار المبيعات', icon: IconFunnel },
  { to: '/services', label: 'الخدمات', icon: IconLayers },
  { to: '/campaigns', label: 'الحملات التسويقية', icon: IconMegaphone },
  { to: '/inbox', label: 'صندوق المحادثات', icon: IconChat },
  { to: '/ryan', label: 'RYAN AI', icon: IconSpark },
  { to: '/tasks', label: 'المهام والمتابعات', icon: IconCheck },
  { to: '/appointments', label: 'المواعيد', icon: IconCalendar },
  { to: '/billing', label: 'الفواتير والاشتراكات', icon: IconCard },
  { to: '/reports', label: 'التقارير', icon: IconChart },
  { to: '/users', label: 'المستخدمون والصلاحيات', icon: IconShield },
  { to: '/settings', label: 'الإعدادات', icon: IconSettings },
]

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />
      )}
      <aside className={`fixed lg:static z-40 h-full w-72 shrink-0 bg-ink-950 text-sand-100 flex flex-col transition-transform duration-200
        ${open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
          <div className="w-10 h-10 rounded-lg bg-gold-500/90 flex items-center justify-center text-ink-950">
            <IconDragon className="w-6 h-6" />
          </div>
          <div>
            <div className="font-bold text-lg leading-tight">Dragon Media</div>
            <div className="text-xs text-sand-100/50">منصة التسويق والمبيعات</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {items.map(({ to, label, icon: Icon, end }) => (
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
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="rounded-xl bg-white/5 p-3.5">
            <div className="text-sm font-semibold text-sand-100">الباقة الحالية: النمو</div>
            <div className="text-xs text-sand-100/50 mt-1">التجديد القادم في 15 أكتوبر</div>
          </div>
        </div>
      </aside>
    </>
  )
}
