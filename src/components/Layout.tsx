import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const titles: Record<string, string> = {
  '/': 'نظرة عامة',
  '/crm': 'إدارة العملاء (CRM)',
  '/pipeline': 'مسار المبيعات',
  '/services': 'الخدمات',
  '/campaigns': 'الحملات التسويقية',
  '/inbox': 'صندوق المحادثات الموحد',
  '/ryan': 'RYAN AI',
  '/tasks': 'المهام والمتابعات',
  '/appointments': 'المواعيد',
  '/billing': 'الفواتير والاشتراكات',
  '/reports': 'التقارير',
  '/users': 'المستخدمون والصلاحيات',
  '/settings': 'الإعدادات',
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const title = titles[pathname] ?? 'Dragon Media'

  return (
    <div dir="rtl" className="flex h-screen overflow-hidden bg-sand-50">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} onMenuClick={() => setOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
