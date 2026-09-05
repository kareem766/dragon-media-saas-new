import React from 'react'
import { IconBell, IconSearch, IconGrid } from './Icon'
import { useAuth } from '../lib/AuthContext'

export default function Topbar({ title, onMenuClick }: { title: string; onMenuClick: () => void }) {
  const { user, signOut } = useAuth()
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'مس'

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
            className="bg-transparent outline-none text-sm w-full placeholder:text-ink-900/40"
          />
        </div>
        <button className="relative p-2.5 rounded-full bg-white border border-sand-200 text-ink-900 hover:bg-sand-100">
          <IconBell className="w-5 h-5" />
          <span className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 rounded-full bg-clay-500 border-2 border-sand-50" />
        </button>
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
