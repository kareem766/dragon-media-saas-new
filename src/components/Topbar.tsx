import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabaseClient';

interface TopbarProps {
  title?: string;
  onMenuClick?: () => void;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string | null;
  body: string | null;
  link: string | null;
  type: string | null;
  is_read: boolean;
  created_at: string;
}

export default function Topbar({ title, onMenuClick }: TopbarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  const accountRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'المستخدم';

  const email = user?.email || '';

  const role =
    user?.app_metadata?.role ||
    user?.user_metadata?.role ||
    'مستخدم';

  const avatarUrl =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    user?.user_metadata?.avatar ||
    '';

  const organizationName =
    user?.user_metadata?.organization_name ||
    user?.user_metadata?.company_name ||
    'Dragon Media';

  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((name: string) => name.charAt(0))
      .join('')
      .toUpperCase() || 'DM';

  const unreadCount = notifications.filter(
    notification => !notification.is_read
  ).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        accountRef.current &&
        !accountRef.current.contains(target)
      ) {
        setAccountOpen(false);
      }

      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountOpen(false);
        setNotificationsOpen(false);
      }
    };

    document.addEventListener(
      'mousedown',
      handleClickOutside
    );

    document.addEventListener(
      'keydown',
      handleEscape
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );

      document.removeEventListener(
        'keydown',
        handleEscape
      );
    };
  }, []);

  const loadNotifications = async () => {
    if (!supabase || !user?.id) return;

    setNotificationsLoading(true);
    setNotificationsError('');

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(
          'id, title, message, body, link, type, is_read, created_at'
        )
        .eq('user_id', user.id)
        .order('created_at', {
          ascending: false,
        })
        .limit(20);

      if (error) {
        throw error;
      }

      setNotifications(
        (data || []) as NotificationItem[]
      );
    } catch (err: any) {
      setNotificationsError(
        err?.message ||
          'تعذر تحميل الإشعارات.'
      );
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id || !supabase) {
      setNotifications([]);
      return;
    }

    loadNotifications();

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
        payload => {
          const newNotification =
            payload.new as NotificationItem;

          setNotifications(prev => [
            newNotification,
            ...prev,
          ].slice(0, 20));
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
        payload => {
          const updatedNotification =
            payload.new as NotificationItem;

          setNotifications(prev =>
            prev.map(notification =>
              notification.id ===
              updatedNotification.id
                ? updatedNotification
                : notification
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleNotifications = async () => {
    const nextOpen = !notificationsOpen;

    setNotificationsOpen(nextOpen);
    setAccountOpen(false);

    if (nextOpen) {
      await loadNotifications();
    }
  };

  const markAsRead = async (
    notification: NotificationItem
  ) => {
    if (!supabase || notification.is_read) {
      if (notification.link) {
        navigate(notification.link);
        setNotificationsOpen(false);
      }

      return;
    }

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notification.id)
      .eq('user_id', user?.id);

    if (!error) {
      setNotifications(prev =>
        prev.map(item =>
          item.id === notification.id
            ? {
                ...item,
                is_read: true,
              }
            : item
        )
      );
    }

    if (notification.link) {
      navigate(notification.link);
      setNotificationsOpen(false);
    }
  };

  const markAllAsRead = async () => {
    if (!supabase || !user?.id || unreadCount === 0) {
      return;
    }

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (!error) {
      setNotifications(prev =>
        prev.map(notification => ({
          ...notification,
          is_read: true,
        }))
      );
    }
  };

  const handleAccount = () => {
    setAccountOpen(false);
    setNotificationsOpen(false);
    navigate('/account');
  };

  const handleSettings = () => {
    setAccountOpen(false);
    setNotificationsOpen(false);
    navigate('/settings');
  };

  const handleSignOut = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await signOut();
      navigate('/login');
    } finally {
      setLoggingOut(false);
      setAccountOpen(false);
      setNotificationsOpen(false);
    }
  };

  const formatNotificationTime = (
    dateString: string
  ) => {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
      <div className="flex h-[68px] items-center justify-between px-4 sm:px-5 lg:px-7">

        {/* Right Side */}
        <div className="flex min-w-0 items-center gap-3">

          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 active:scale-95 lg:hidden"
              aria-label="فتح القائمة"
            >
              <span className="text-xl leading-none">
                ☰
              </span>
            </button>
          )}

          {title && (
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                {title}
              </h1>

              <div className="mt-0.5 hidden items-center gap-1.5 text-[11px] text-slate-400 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                <span>Dragon Media</span>
              </div>
            </div>
          )}
        </div>

        {/* Left Side */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Workspace Status */}
          <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 lg:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm" />

            <div className="text-right">
              <p className="text-[10px] font-medium text-slate-400">
                مساحة العمل
              </p>

              <p className="max-w-[130px] truncate text-xs font-semibold text-slate-700">
                {organizationName}
              </p>
            </div>
          </div>

          {/* Notifications */}
          <div
            ref={notificationsRef}
            className="relative"
          >
            <button
              type="button"
              onClick={handleNotifications}
              className={`relative flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-200 ${
                notificationsOpen
                  ? 'border-blue-200 bg-blue-50 text-blue-600 shadow-sm'
                  : 'border-transparent bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700'
              }`}
              aria-label="الإشعارات"
              aria-expanded={notificationsOpen}
            >
              <span className="text-[22px] leading-none">
                ♢
              </span>

              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex min-w-[19px] h-[19px] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm">
                  {unreadCount > 99
                    ? '99+'
                    : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {notificationsOpen && (
              <div className="absolute left-0 top-full mt-3 w-[350px] max-w-[calc(100vw-2rem)] origin-top-left overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      الإشعارات
                    </p>

                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {unreadCount > 0
                        ? `${unreadCount} إشعار غير مقروء`
                        : 'لا توجد إشعارات غير مقروءة'}
                    </p>
                  </div>

                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      تحديد الكل كمقروء
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="max-h-[420px] overflow-y-auto">

                  {notificationsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
                    </div>
                  ) : notificationsError ? (
                    <div className="px-5 py-10 text-center">
                      <p className="text-sm text-red-600">
                        تعذر تحميل الإشعارات
                      </p>

                      <button
                        type="button"
                        onClick={loadNotifications}
                        className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                      >
                        إعادة المحاولة
                      </button>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-xl">
                        ♢
                      </div>

                      <p className="mt-3 text-sm font-semibold text-slate-700">
                        لا توجد إشعارات
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        ستظهر إشعاراتك هنا عند وصولها.
                      </p>
                    </div>
                  ) : (
                    notifications.map(notification => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() =>
                          markAsRead(notification)
                        }
                        className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3.5 text-right transition-colors hover:bg-slate-50 ${
                          !notification.is_read
                            ? 'bg-blue-50/40'
                            : 'bg-white'
                        }`}
                      >
                        <div className="relative mt-0.5 shrink-0">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-sm text-blue-600">
                            ●
                          </div>

                          {!notification.is_read && (
                            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm ${
                              notification.is_read
                                ? 'font-medium text-slate-700'
                                : 'font-bold text-slate-900'
                            }`}
                          >
                            {notification.title}
                          </p>

                          {(notification.message ||
                            notification.body) && (
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                              {notification.message ||
                                notification.body}
                            </p>
                          )}

                          <p className="mt-1.5 text-[10px] text-slate-400">
                            {formatNotificationTime(
                              notification.created_at
                            )}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setNotificationsOpen(false);
                      }}
                      className="w-full text-center text-[11px] font-semibold text-slate-500 hover:text-blue-600"
                    >
                      إغلاق
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Account */}
          <div
            ref={accountRef}
            className="relative"
          >
            <button
              type="button"
              onClick={() =>
                setAccountOpen(value => !value)
              }
              className={`group flex items-center gap-2 rounded-2xl border p-1.5 transition-all duration-200 ${
                accountOpen
                  ? 'border-blue-200 bg-blue-50/70 shadow-sm'
                  : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
              }`}
              aria-label="قائمة الحساب"
              aria-expanded={accountOpen}
            >
              {/* Avatar */}
              <div className="relative">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-10 w-10 rounded-xl object-cover shadow-sm ring-1 ring-slate-200"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-xs font-bold text-white shadow-sm ring-1 ring-blue-200">
                    {initials}
                  </div>
                )}

                <span className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
              </div>

              {/* User Info */}
              <div className="hidden max-w-[150px] text-right xl:block">
                <p className="truncate text-sm font-bold text-slate-800">
                  {displayName}
                </p>

                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {role}
                </p>
              </div>

              {/* Arrow */}
              <span
                className={`hidden text-[10px] text-slate-400 transition-transform duration-200 xl:block ${
                  accountOpen
                    ? 'rotate-180'
                    : ''
                }`}
              >
                ▼
              </span>
            </button>

            {/* Dropdown */}
            {accountOpen && (
              <div className="absolute left-0 top-full mt-3 w-[310px] origin-top-left animate-[fadeIn_0.15s_ease-out] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">

                {/* Profile Header */}
                <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-blue-50/50 px-4 pb-4 pt-5">

                  <div className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full bg-blue-100/40 blur-2xl" />

                  <div className="pointer-events-none absolute -bottom-10 right-0 h-28 w-28 rounded-full bg-indigo-100/30 blur-2xl" />

                  <div className="relative flex items-center gap-3">

                    <div className="relative shrink-0">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={displayName}
                          className="h-14 w-14 rounded-2xl object-cover shadow-md ring-2 ring-white"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-sm font-bold text-white shadow-md ring-2 ring-white">
                          {initials}
                        </div>
                      )}

                      <span className="absolute -bottom-1 -left-1 h-4 w-4 rounded-full border-[3px] border-white bg-emerald-500" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {displayName}
                      </p>

                      {email && (
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {email}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          {role}
                        </span>

                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          نشط
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Workspace */}
                  <div className="relative mt-4 flex items-center justify-between rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm">
                        ◈
                      </div>

                      <div className="min-w-0 text-right">
                        <p className="text-[10px] text-slate-400">
                          مساحة العمل
                        </p>

                        <p className="truncate text-xs font-semibold text-slate-700">
                          {organizationName}
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] font-medium text-emerald-600">
                      متصلة
                    </span>
                  </div>
                </div>

                {/* Menu */}
                <div className="p-2">

                  {/* Account */}
                  <button
                    type="button"
                    onClick={handleAccount}
                    className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right transition-all duration-150 hover:bg-blue-50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition group-hover:bg-blue-100 group-hover:text-blue-600">
                      👤
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">
                        حسابي
                      </p>

                      <p className="mt-0.5 text-[10px] text-slate-400">
                        عرض بيانات الحساب والملف الشخصي
                      </p>
                    </div>

                    <span className="text-xs text-slate-300 transition group-hover:text-blue-500">
                      ←
                    </span>
                  </button>

                  {/* Settings */}
                  <button
                    type="button"
                    onClick={handleSettings}
                    className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right transition-all duration-150 hover:bg-blue-50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition group-hover:bg-blue-100 group-hover:text-blue-600">
                      ⚙
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">
                        إعدادات الحساب
                      </p>

                      <p className="mt-0.5 text-[10px] text-slate-400">
                        إدارة إعدادات المنصة والحساب
                      </p>
                    </div>

                    <span className="text-xs text-slate-300 transition group-hover:text-blue-500">
                      ←
                    </span>
                  </button>

                  <div className="my-2 border-t border-slate-100" />

                  {/* Logout */}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={loggingOut}
                    className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right transition-all duration-150 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 transition group-hover:bg-red-100">
                      {loggingOut
                        ? '...'
                        : '↪'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-red-600">
                        {loggingOut
                          ? 'جاري تسجيل الخروج...'
                          : 'تسجيل الخروج'}
                      </p>

                      <p className="mt-0.5 text-[10px] text-red-400">
                        إنهاء جلسة الحساب الحالية
                      </p>
                    </div>
                  </button>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>
                      Dragon Media
                    </span>

                    <span>
                      حساب آمن
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
