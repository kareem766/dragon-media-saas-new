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

function MenuIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  )
}

function BellIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V20h-2.6v-.1a2 2 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4v-2.6h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1.9-.3l-.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v2.6h-.1a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={[
        'transition-transform duration-200',
        open ? 'rotate-180' : '',
      ].join(' ')}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function NotificationEmptyState() {
  return (
    <div className="px-5 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-50 text-ink-400">
        <BellIcon />
      </div>

      <p className="text-sm font-semibold text-ink-700">
        لا توجد إشعارات
      </p>

      <p className="mt-1 text-xs leading-5 text-ink-400">
        ستظهر الإشعارات الجديدة هنا
      </p>
    </div>
  )
}

function NotificationSkeleton() {
  return (
    <div className="space-y-0">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="flex gap-3 border-b border-ink-50 px-4 py-4 last:border-b-0"
        >
          <div className="mt-1.5 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-ink-100" />

          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-ink-100" />
            <div className="h-3 w-full animate-pulse rounded bg-ink-50" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-ink-50" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Topbar({
  title,
  onMenuClick,
}: TopbarProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [accountOpen, setAccountOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] =
    useState(false)

  const [notifications, setNotifications] = useState<
    NotificationItem[]
  >([])
  const [notificationsLoading, setNotificationsLoading] =
    useState(false)
  const [notificationsError, setNotificationsError] =
    useState<string | null>(null)

  const [profile, setProfile] =
    useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] =
    useState(false)

  const [loggingOut, setLoggingOut] = useState(false)

  const accountRef = useRef<HTMLDivElement | null>(null)
  const notificationsRef =
    useRef<HTMLDivElement | null>(null)

  const authDisplayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'المستخدم'

  const displayName =
    profile?.full_name?.trim() || authDisplayName

  const email =
    profile?.email?.trim() || user?.email || ''

  const rawRole = profile?.role || ''

  const role = profile?.is_platform_admin
    ? 'مدير المنصة'
    : rawRole === 'super_admin'
      ? 'مدير النظام'
      : rawRole === 'admin'
        ? 'مدير'
        : rawRole || 'مستخدم'

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
      .select(
        'full_name, email, role, is_platform_admin'
      )
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.error(
        'Failed to load user profile:',
        error
      )
      setProfile(null)
    } else {
      setProfile(
        (data || null) as UserProfile | null
      )
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
      .order('created_at', {
        ascending: false,
      })
      .limit(20)

    if (error) {
      console.error(
        'Failed to load notifications:',
        error
      )

      setNotificationsError(
        'تعذر تحميل الإشعارات'
      )

      setNotifications([])
    } else {
      setNotifications(
        (data || []) as NotificationItem[]
      )
    }

    setNotificationsLoading(false)
  }

  useEffect(() => {
    if (!supabase || !user?.id) {
      setProfile(null)
      setNotifications([])
      return
    }

    const client = supabase

    loadProfile()
    loadNotifications()

    const channel = client
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
          const notification =
            payload.new as NotificationItem

          setNotifications((current) => {
            const exists = current.some(
              (item) =>
                item.id === notification.id
            )

            if (exists) {
              return current
            }

            return [
              notification,
              ...current,
            ].slice(0, 20)
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
          const updatedNotification =
            payload.new as NotificationItem

          setNotifications((current) =>
            current.map((item) =>
              item.id ===
              updatedNotification.id
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
      client.removeChannel(channel)
    }
  }, [user?.id])

  useEffect(() => {
    const handleOutsideClick = (
      event: MouseEvent
    ) => {
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

    const handleEscape = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        setAccountOpen(false)
        setNotificationsOpen(false)
      }
    }

    document.addEventListener(
      'mousedown',
      handleOutsideClick
    )

    document.addEventListener(
      'keydown',
      handleEscape
    )

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick
      )

      document.removeEventListener(
        'keydown',
        handleEscape
      )
    }
  }, [])

  const markAsRead = async (
    notification: NotificationItem
  ) => {
    if (
      !supabase ||
      !user?.id ||
      notification.is_read
    ) {
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
      console.error(
        'Failed to mark notification as read:',
        error
      )

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
    if (
      !supabase ||
      !user?.id ||
      unreadCount === 0
    ) {
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
      console.error(
        'Failed to mark all notifications as read:',
        error
      )

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

      navigate('/login', {
        replace: true,
      })
    } finally {
      setLoggingOut(false)
      setAccountOpen(false)
    }
  }

  const toggleNotifications = () => {
    const nextState = !notificationsOpen

    setNotificationsOpen(nextState)
    setAccountOpen(false)

    if (nextState) {
      loadNotifications()
    }
  }

  const toggleAccount = () => {
    const nextState = !accountOpen

    setAccountOpen(nextState)
    setNotificationsOpen(false)

    if (nextState) {
      loadProfile()
    }
  }

  const formatNotificationDate = (
    date: string
  ) => {
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

  const initial =
    displayName.trim().charAt(0) || 'م'

  return (
    <header
      dir="rtl"
      className={[
        'sticky top-0 z-30 shrink-0',
        'border-b border-ink-100/80',
        'bg-sand-50/90 backdrop-blur-xl',
        'supports-[backdrop-filter]:bg-sand-50/80',
      ].join(' ')}
    >
      <div className="mx-auto flex min-h-[68px] w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:min-h-[76px] sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className={[
                'inline-flex h-10 w-10 shrink-0',
                'items-center justify-center',
                'rounded-xl',
                'border border-ink-100',
                'bg-white',
                'text-ink-700',
                'shadow-sm',
                'transition-all duration-200',
                'hover:border-ink-200 hover:bg-ink-50',
                'active:scale-[0.97]',
                'lg:hidden',
              ].join(' ')}
              aria-label="فتح القائمة"
            >
              <MenuIcon />
            </button>
          )}

          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-bold leading-6 text-ink-950 sm:text-xl">
              {title}
            </h1>

            <p className="hidden text-xs text-ink-500 sm:block">
              إدارة أعمالك من مكان واحد
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div
            ref={notificationsRef}
            className="relative z-40"
          >
            <button
              type="button"
              onClick={toggleNotifications}
              className={[
                'relative inline-flex',
                'h-10 w-10 sm:h-11 sm:w-11',
                'items-center justify-center',
                'rounded-xl',
                'border',
                'bg-white',
                'shadow-sm',
                'transition-all duration-200',
                'active:scale-[0.97]',
                notificationsOpen
                  ? 'border-gold-300 bg-gold-50 text-gold-700'
                  : 'border-ink-100 text-ink-700 hover:border-ink-200 hover:bg-ink-50',
              ].join(' ')}
              aria-label="الإشعارات"
              aria-expanded={notificationsOpen}
              aria-haspopup="dialog"
            >
              <BellIcon
                className={
                  unreadCount > 0
                    ? 'animate-[pulse_2.2s_ease-in-out_infinite]'
                    : ''
                }
              />

              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-h-[19px] min-w-[19px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-sand-50">
                  {unreadCount > 99
                    ? '99+'
                    : unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div
                className={[
                  /*
                   * Mobile:
                   * Use fixed positioning so the notification panel
                   * can never overflow outside the viewport.
                   */
                  'fixed left-3 right-3 top-[76px]',
                  'w-auto max-w-none',
                  'sm:absolute sm:left-0 sm:right-auto sm:top-auto sm:mt-3',
                  'sm:w-[min(390px,calc(100vw-24px))] sm:max-w-[390px]',
                  'overflow-hidden rounded-2xl',
                  'border border-ink-100',
                  'bg-white',
                  'shadow-[0_18px_50px_rgba(0,0,0,0.12)]',
                  'animate-[fadeIn_160ms_ease-out]',
                ].join(' ')}
                role="dialog"
                aria-label="الإشعارات"
              >
                <div className="flex flex-col gap-3 border-b border-ink-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-ink-950">
                        الإشعارات
                      </h3>

                      {unreadCount > 0 && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                          {unreadCount} جديد
                        </span>
                      )}
                    </div>

                    {unreadCount > 0 && (
                      <p className="mt-1 text-[11px] leading-5 text-ink-500">
                        لديك إشعارات تحتاج إلى مراجعة
                      </p>
                    )}
                  </div>

                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="inline-flex min-h-9 w-full shrink-0 items-center justify-center rounded-lg bg-gold-50 px-3 py-2 text-[11px] font-semibold text-gold-700 transition-colors hover:bg-gold-100 sm:w-auto"
                    >
                      تحديد الكل كمقروء
                    </button>
                  )}
                </div>

                <div className="max-h-[min(430px,65vh)] overflow-y-auto overscroll-contain">
                  {notificationsLoading ? (
                    <NotificationSkeleton />
                  ) : notificationsError ? (
                    <div className="px-4 py-10 text-center">
                      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-500">
                        <svg
                          width="21"
                          height="21"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M12 8v4" />
                          <path d="M12 16h.01" />
                          <path d="M10.3 3.9 2.7 17a2 2 0 0 0 1.73 3h15.14a2 2 0 0 0 1.73-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                        </svg>
                      </div>

                      <p className="text-sm font-semibold text-red-600">
                        {notificationsError}
                      </p>

                      <button
                        type="button"
                        onClick={loadNotifications}
                        className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-100"
                      >
                        إعادة المحاولة
                      </button>
                    </div>
                  ) : notifications.length === 0 ? (
                    <NotificationEmptyState />
                  ) : (
                    notifications.map(
                      (notification) => {
                        const notificationText =
                          notification.message ||
                          notification.body ||
                          ''

                        return (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() =>
                              handleNotificationClick(
                                notification
                              )
                            }
                            className={[
                              'group block w-full',
                              'border-b border-ink-50',
                              'px-4 py-3.5',
                              'text-right',
                              'transition-colors duration-150',
                              'last:border-b-0',
                              notification.is_read
                                ? 'bg-white hover:bg-ink-50'
                                : 'bg-gold-50/50 hover:bg-gold-50',
                            ].join(' ')}
                          >
                            <div className="flex gap-3">
                              <span
                                className={[
                                  'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                                  notification.is_read
                                    ? 'bg-transparent'
                                    : 'bg-gold-500 shadow-[0_0_0_3px_rgba(245,158,11,0.10)]',
                                ].join(' ')}
                                aria-hidden="true"
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                                  <p
                                    className={[
                                      'min-w-0 text-sm leading-5',
                                      'break-words',
                                      notification.is_read
                                        ? 'font-medium text-ink-700'
                                        : 'font-bold text-ink-950',
                                    ].join(' ')}
                                  >
                                    {notification.title}
                                  </p>

                                  <span className="shrink-0 text-[10px] leading-4 text-ink-400">
                                    {formatNotificationDate(
                                      notification.created_at
                                    )}
                                  </span>
                                </div>

                                {notificationText && (
                                  <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-ink-500">
                                    {notificationText}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        )
                      }
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          <div
            ref={accountRef}
            className="relative z-40"
          >
            <button
              type="button"
              onClick={toggleAccount}
              className={[
                'group flex items-center gap-2',
                'rounded-xl border border-ink-100',
                'bg-white',
                'px-1.5 py-1.5 sm:px-2.5',
                'shadow-sm',
                'transition-all duration-200',
                'hover:border-ink-200 hover:bg-ink-50',
                'active:scale-[0.99]',
              ].join(' ')}
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              aria-label="قائمة الحساب"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-white sm:h-9 sm:w-9"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gold-100 to-gold-50 text-sm font-bold text-gold-700 ring-1 ring-gold-200/70 sm:h-9 sm:w-9">
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

              <span className="hidden text-ink-400 sm:block">
                <ChevronIcon open={accountOpen} />
              </span>
            </button>

            {accountOpen && (
              <div
                className={[
                  'absolute left-0 mt-3',
                  'w-[min(310px,calc(100vw-24px))]',
                  'overflow-hidden rounded-2xl',
                  'border border-ink-100',
                  'bg-white',
                  'shadow-[0_18px_50px_rgba(0,0,0,0.12)]',
                  'animate-[fadeIn_160ms_ease-out]',
                ].join(' ')}
                role="menu"
                aria-label="قائمة الحساب"
              >
                <div className="border-b border-ink-100 bg-gradient-to-br from-ink-50/80 to-white px-4 py-4">
                  <div className="flex items-center gap-3">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="h-11 w-11 rounded-full object-cover shadow-sm ring-2 ring-white"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-gold-100 to-gold-50 font-bold text-gold-700 ring-1 ring-gold-200/70">
                        {initial}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-ink-950">
                        {profileLoading
                          ? 'جاري تحميل الحساب...'
                          : displayName}
                      </p>

                      <p className="truncate text-xs text-ink-500">
                        {email}
                      </p>

                      <div className="mt-1.5 inline-flex rounded-full bg-gold-50 px-2 py-0.5 text-[10px] font-bold text-gold-700">
                        {role}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-2">
                  <Link
                    to="/account"
                    onClick={() =>
                      setAccountOpen(false)
                    }
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-700 transition-colors hover:bg-ink-50 hover:text-ink-950"
                    role="menuitem"
                  >
                    <UserIcon />
                    <span>حسابي</span>
                  </Link>

                  <Link
                    to="/settings"
                    onClick={() =>
                      setAccountOpen(false)
                    }
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-700 transition-colors hover:bg-ink-50 hover:text-ink-950"
                    role="menuitem"
                  >
                    <SettingsIcon />
                    <span>الإعدادات</span>
                  </Link>

                  <div className="my-1.5 border-t border-ink-100" />

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    role="menuitem"
                  >
                    <LogoutIcon />

                    <span>
                      {loggingOut
                        ? 'جاري تسجيل الخروج...'
                        : 'تسجيل الخروج'}
                    </span>

                    {loggingOut && (
                      <span className="mr-auto h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-600" />
                    )}
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
