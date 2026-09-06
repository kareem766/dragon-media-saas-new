import React, { useState } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useSubscription } from '../lib/useSubscription'

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
  '/settings': 'الإعدادات',
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const title = titles[pathname] ?? 'Dragon Media'
  const { subscription, loading, isActive } = useSubscription()

  return (
    <div dir="rtl" className="flex h-screen overflow-hidden bg-sand-50">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} onMenuClick={() => setOpen(true)} />
        {!loading && !isActive && pathname !== '/plans' && pathname !== '/billing/pay' && (
          <div className="bg-gold-500/15 border-b border-gold-500/30 px-4 sm:px-8 py-2.5 flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm text-ink-950">
              أنت في وضع المعاينة{subscription?.status === 'pending_review' ? ' — طلب الدفع قيد المراجعة' : ' — بعض المميزات مقفلة حتى تفعيل الاشتراك'}
            </span>
            {subscription?.status !== 'pending_review' && (
              <Link to="/plans" className="text-sm font-semibold text-gold-600 hover:underline">اختر باقة الآن</Link>
            )}
          </div>
        )}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
