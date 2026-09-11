import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

interface TopbarProps {
  title: string
  onMenuClick?: () => void
}

interface NotificationItem {
  id: string
  title: string
  message?: string | null
  body?: string | null
  link?: string | null
  type?: string | null
  is_read: boolean
  created_at: string
}

interface UserProfile {
  full_name: string | null
  email: string | null
  role: string | null
  is_platform_admin: boolean | null
}

export default function Topbar({ title, onMenuClick }: TopbarProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [accountOpen, setAccountOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState<string | null>(
    null
  )

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const [loggingOut, setLoggingOut] = useState(false)

  const accountRef = useRef<HTMLDivElement | null>(null)
  const notificationsRef = useRef<HTMLDivElement | null>(null)

  const authDisplayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'المستخدم'

  const displayName = profile?.full_name?.trim() || authDisplayName

  const email = profile?.email?.trim() || user?.email || ''

  const rawRole = profile?.role || ''

  const role = profile?.is_platform_admin
    ? 'مدير المنصة'
    : rawRole === 'super_admin'
      ? 'مدير النظام'
      : rawRole === 'admin'
        ? 'مدير'
        : rawRole
          ? rawRole
          : 'مستخدم'

  const avatarUrl =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    null

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length

  const loadProfile = async () => {
    if (!supabase || !user?.id) {
      setProfile(null)
      setProfileLoading(false)
      return
    }

    setProfileLoading(true)

    const { data, error } = await supabase
      .from('users')
      .select('full_name, email, role, is_platform_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Failed to load user profile:', error)
      setProfile(null)
    } else {
      setProfile((data || null) as UserProfile | null)
    }

    setProfileLoading(false)
  }

  const loadNotifications = async () => {
    if (!supabase || !user?.id) {
      setNotifications([])
      setNotificationsLoading(false)
      return
    }

    setNotificationsLoading(true)
    setNotificationsError(null)

    const { data, error } = await supabase
      .from('notifications')
      .select(
        'id, title, message, body, link, type, is_read, created_at'
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Failed to load notifications:', error)
      setNotificationsError('تعذر تحميل الإشعارات')
      setNotifications([])
    } else {
      setNotifications((data || []) as NotificationItem[])
    }

    setNotificationsLoading(false)
  }

  useEffect(() => {
    if (!supabase || !user?.id) {
      setProfile(null)
      setNotifications([])
      return
    }

    loadProfile()
    loadNotifications()

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as NotificationItem

          setNotifications((current) => {
            const exists = current.some(
              (item) => item.id === notification.id
            )

            if (exists) {
              return current
            }

            return [notification, ...current].slice(0, 20)
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updatedNotification = payload.new as NotificationItem

          setNotifications((current) =>
            current.map((item) =>
              item.id === updatedNotification.id
                ? {
                    ...item,
                    ...updatedNotification,
                  }
                : item
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node

      if (
        accountRef.current &&
        !accountRef.current.contains(target)
      ) {
        setAccountOpen(false)
      }

      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(target)
      ) {
        setNotificationsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountOpen(false)
        setNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const markAsRead = async (notification: NotificationItem) => {
    if (!supabase || !user?.id || notification.is_read) {
      return
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id
          ? {
              ...item,
              is_read: true,
            }
          : item
      )
    )

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notification.id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to mark notification as read:', error)

      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? {
                ...item,
                is_read: false,
              }
            : item
        )
      )
    }
  }

  const markAllAsRead = async () => {
    if (!supabase || !user?.id || unreadCount === 0) {
      return
    }

    const now = new Date().toISOString()

    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        is_read: true,
      }))
    )

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: now,
      })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (error) {
      console.error('Failed to mark all notifications as read:', error)
      await loadNotifications()
    }
  }

  const handleNotificationClick = async (
    notification: NotificationItem
  ) => {
    await markAsRead(notification)

    setNotificationsOpen(false)

    if (notification.link) {
      navigate(notification.link)
    }
  }

  const handleLogout = async () => {
    if (loggingOut) {
      return
    }

    setLoggingOut(true)

    try {
      await signOut()
      navigate('/login', { replace: true })
    } finally {
      setLoggingOut(false)
      setAccountOpen(false)
    }
  }

  const toggleNotifications = () => {
    setNotificationsOpen((current) => !current)
    setAccountOpen(false)

    if (!notificationsOpen) {
      loadNotifications()
    }
  }

  const toggleAccount = () => {
    setAccountOpen((current) => !current)
    setNotificationsOpen(false)

    if (!accountOpen) {
      loadProfile()
    }
  }

  const formatNotificationDate = (date: string) => {
    try {
      return new Intl.DateTimeFormat('ar-EG', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(date))
    } catch {
      return ''
    }
  }

  const initial = displayName.trim().charAt(0) || 'م'

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/95 backdrop-blur">
      <div className="flex min-h-[72px] items-center justify-between gap-3 px-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-ink-100 bg-white text-ink-700 transition hover:bg-ink-50 lg:hidden"
              aria-label="فتح القائمة"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            </button>
          )}

          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-ink-950 sm:text-xl">
              {title}
            </h1>

            <p className="hidden text-xs text-ink-500 sm:block">
              إدارة أعمالك من مكان واحد
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div ref={notificationsRef} className="relative">
            <button
              type="button"
              onClick={toggleNotifications}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-ink-100 bg-white text-ink-700 transition hover:bg-ink-50"
              aria-label="الإشعارات"
              aria-expanded={notificationsOpen}
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>

              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute left-0 mt-3 w-[min(380px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
                  <div>
                    <h3 className="font-bold text-ink-950">
                      الإشعارات
                    </h3>

                    {unreadCount > 0 && (
                      <p className="mt-0.5 text-xs text-ink-500">
                        لديك {unreadCount} إشعار غير مقروء
                      </p>
                    )}
                  </div>

                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="text-xs font-semibold text-gold-600 hover:underline"
                    >
                      تحديد الكل كمقروء
                    </button>
                  )}
                </div>

                <div className="max-h-[420px] overflow-y-auto">
                  {notificationsLoading ? (
                    <div className="flex items-center justify-center px-4 py-10 text-sm text-ink-500">
                      جاري تحميل الإشعارات...
                    </div>
                  ) : notificationsError ? (
                    <div className="px-4 py-10 text-center">
                      <p className="text-sm text-red-600">
                        {notificationsError}
                      </p>

                      <button
                        type="button"
                        onClick={loadNotifications}
                        className="mt-2 text-xs font-semibold text-gold-600 hover:underline"
                      >
                        إعادة المحاولة
                      </button>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ink-50 text-ink-400">
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                      </div>

                      <p className="text-sm font-medium text-ink-700">
                        لا توجد إشعارات
                      </p>

                      <p className="mt-1 text-xs text-ink-400">
                        ستظهر الإشعارات الجديدة هنا
                      </p>
                    </div>
                  ) : (
                    notifications.map((notification) => {
                      const notificationText =
                        notification.message ||
                        notification.body ||
                        ''

                      return (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() =>
                            handleNotificationClick(notification)
                          }
                          className={`block w-full border-b border-ink-50 px-4 py-3 text-right transition last:border-b-0 hover:bg-ink-50 ${
                            !notification.is_read
                              ? 'bg-gold-50/40'
                              : 'bg-white'
                          }`}
                        >
                          <div className="flex gap-3">
                            <div
                              className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                                notification.is_read
                                  ? 'bg-transparent'
                                  : 'bg-gold-500'
                              }`}
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p
                                  className={`text-sm ${
                                    notification.is_read
                                      ? 'font-medium text-ink-700'
                                      : 'font-bold text-ink-950'
                                  }`}
                                >
                                  {notification.title}
                                </p>

                                <span className="shrink-0 text-[10px] text-ink-400">
                                  {formatNotificationDate(
                                    notification.created_at
                                  )}
                                </span>
                              </div>

                              {notificationText && (
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-500">
                                  {notificationText}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div ref={accountRef} className="relative">
            <button
              type="button"
              onClick={toggleAccount}
              className="flex items-center gap-2 rounded-xl border border-ink-100 bg-white px-2 py-1.5 transition hover:bg-ink-50 sm:px-3"
              aria-expanded={accountOpen}
              aria-haspopup="menu"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-100 text-sm font-bold text-gold-700">
                  {initial}
                </div>
              )}

              <div className="hidden min-w-0 text-right sm:block">
                <p className="max-w-[150px] truncate text-sm font-semibold text-ink-900">
                  {displayName}
                </p>

                <p className="max-w-[150px] truncate text-[11px] text-ink-500">
                  {email}
                </p>
              </div>

              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="hidden text-ink-400 sm:block"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {accountOpen && (
              <div
                className="absolute left-0 mt-3 w-72 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-xl"
                role="menu"
              >
                <div className="border-b border-ink-100 px-4 py-4">
                  <div className="flex items-center gap-3">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="h-11 w-11 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-100 font-bold text-gold-700">
                        {initial}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink-950">
                        {profileLoading ? 'جاري تحميل الحساب...' : displayName}
                      </p>

                      <p className="truncate text-xs text-ink-500">
                        {email}
                      </p>

                      <p className="mt-1 text-xs font-semibold text-gold-600">
                        {role}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-2">
                  <Link
                    to="/account"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-700 transition hover:bg-ink-50"
                    role="menuitem"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 21a8 8 0 0 1 16 0" />
                    </svg>

                    <span>حسابي</span>
                  </Link>

                  <Link
                    to="/settings"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-700 transition hover:bg-ink-50"
                    role="menuitem"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V20h-2.6v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4v-2.6h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v2.6h-.1a1.7 1.7 0 0 0-1.6 1Z" />
                    </svg>

                    <span>الإعدادات</span>
                  </Link>

                  <div className="my-1 border-t border-ink-100" />

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    role="menuitem"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M10 17l5-5-5-5" />
                      <path d="M15 12H3" />
                      <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
                    </svg>

                    <span>
                      {loggingOut
                        ? 'جاري تسجيل الخروج...'
                        : 'تسجيل الخروج'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
