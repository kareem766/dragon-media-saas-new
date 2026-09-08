import React, { useState } from 'react'
import { IconBell, IconSearch, IconGrid } from './Icon'
import { useAuth } from '../lib/AuthContext'
import { useNotifications } from '../lib/useNotifications'

export default function Topbar({ title, onMenuClick }: { title: string; onMenuClick: () => void }) {
  const { user, signOut } = useAuth()
  const { notifications, unreadCount, markRead, markAllRead, refresh } = useNotifications()
  const [open, setOpen] = useState(false)
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'مس'

  const toggleOpen = () => {
    if (!open) refresh()
    setOpen(v => !v)
  }

  return (
    <header className="sticky top-0 z-20 bg-sand-50/90 backdrop-blur border-b border-sand-200 px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg hover:bg-sand-100 text-ink-900">
          <IconGrid className="w-5 h-5" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-ink-950">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 bg-white border border-sand-200 rounded-full px-4 py-2 w-72">
          <IconSearch className="w-4 h-4 text-ink-900/40" />
          <input
            placeholder="بحث عن عميل، صفقة، أو مهمة..."
            onFocus={() => { window.location.hash = '#/search' }}
            readOnly
            className="bg-transparent outline-none text-sm w-full placeholder:text-ink-900/40 cursor-pointer"
          />
        </div>

        <div className="relative">
          <button onClick={toggleOpen} className="relative p-2.5 rounded-full bg-white border border-sand-200 text-ink-900 hover:bg-sand-100">
            <IconBell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-clay-500 border-2 border-sand-50 flex items-center justify-center text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
              <div className="absolute left-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-sand-200 rounded-2xl shadow-lg z-40">
                <div className="flex items-center justify-between px-4 py-3 border-b border-sand-100">
                  <span className="font-semibold text-sm text-ink-950">الإشعارات</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-gold-600 hover:underline">تعليم الكل كمقروء</button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="text-sm text-ink-900/40 text-center py-8">لا توجد إشعارات</div>
                ) : (
                  notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className={`w-full text-right px-4 py-3 border-b border-sand-50 last:border-0 hover:bg-sand-50 ${!n.read ? 'bg-gold-500/5' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-ink-950">{n.title}</span>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-clay-500 shrink-0 mt-1" />}
                      </div>
                      {n.body && <div className="text-xs text-ink-900/55 mt-1">{n.body}</div>}
                      <div className="text-[11px] text-ink-900/35 mt-1">{new Date(n.created_at).toLocaleString('ar-EG')}</div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <button
          onClick={signOut}
          title="تسجيل الخروج"
          className="w-10 h-10 rounded-full bg-ink-900 text-sand-100 flex items-center justify-center font-semibold text-sm hover:bg-ink-800"
        >
          {initials}
        </button>
      </div>
    </header>
  )
}
