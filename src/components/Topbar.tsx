import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search, Menu, LogOut, User, Settings, X } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useNotifications } from '../hooks/useNotifications';

interface TopbarProps {
  onMenuClick?: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { unreadCount, notifications, markAsRead, markAllAsRead } =
    useNotifications();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

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

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((name: string) => name.charAt(0))
    .join('')
    .toUpperCase();

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

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    setAccountOpen(false);
    await signOut();
    navigate('/login');
  };

  const handleAccount = () => {
    setAccountOpen(false);
    navigate('/settings');
  };

  const handleSettings = () => {
    setAccountOpen(false);
    navigate('/settings');
  };

  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    setNotificationsOpen(false);

    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">

        {/* Right Side */}
        <div className="flex items-center gap-3">

          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
              aria-label="فتح القائمة"
            >
              <Menu size={22} />
            </button>
          )}

          <div className="relative hidden md:block">
            <Search
              size={18}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              placeholder="بحث..."
              className="w-64 rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-10 pl-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* Left Side */}
        <div className="flex items-center gap-2">

          {/* Notifications */}
          <div ref={notificationsRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((value) => !value);
                setAccountOpen(false);
              }}
              className="relative rounded-xl p-2.5 text-slate-600 transition hover:bg-slate-100"
              aria-label="الإشعارات"
            >
              <Bell size={21} />

              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute left-0 mt-2 w-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">

                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      الإشعارات
                    </h3>

                    {unreadCount > 0 && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        لديك {unreadCount} إشعار غير مقروء
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                    aria-label="إغلاق"
                  >
                    <X size={17} />
                  </button>
                </div>

                {unreadCount > 0 && (
                  <div className="border-b border-slate-100 px-4 py-2">
                    <button
                      type="button"
                      onClick={() => markAllAsRead()}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      تحديد الكل كمقروء
                    </button>
                  </div>
                )}

                <div className="max-h-[380px] overflow-y-auto">
                  {notifications?.length > 0 ? (
                    notifications.map((notification: any) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() =>
                          handleNotificationClick(notification)
                        }
                        className={`w-full border-b border-slate-100 px-4 py-3 text-right transition hover:bg-slate-50 ${
                          !notification.read
                            ? 'bg-blue-50/50'
                            : 'bg-white'
                        }`}
                      >
                        <div className="flex gap-3">
                          <div
                            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                              !notification.read
                                ? 'bg-blue-500'
                                : 'bg-slate-300'
                            }`}
                          />

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900">
                              {notification.title}
                            </p>

                            {notification.body && (
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                {notification.body}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-10 text-center">
                      <Bell
                        size={30}
                        className="mx-auto mb-2 text-slate-300"
                      />

                      <p className="text-sm font-medium text-slate-500">
                        لا توجد إشعارات
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Account */}
          <div ref={accountRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setAccountOpen((value) => !value);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl p-1.5 transition hover:bg-slate-100"
              aria-label="قائمة الحساب"
              aria-expanded={accountOpen}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-xs font-bold text-white shadow-sm">
                {initials || 'U'}
              </div>

              <div className="hidden text-right lg:block">
                <p className="max-w-[140px] truncate text-sm font-semibold text-slate-800">
                  {displayName}
                </p>

                <p className="max-w-[140px] truncate text-[11px] text-slate-500">
                  {role}
                </p>
              </div>
            </button>

            {accountOpen && (
              <div className="absolute left-0 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">

                {/* Account Header */}
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-4">
                  <div className="flex items-center gap-3">

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-sm font-bold text-white shadow-sm">
                      {initials || 'U'}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {displayName}
                      </p>

                      {email && (
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {email}
                        </p>
                      )}

                      <span className="mt-1 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        {role}
                      </span>
                    </div>

                  </div>
                </div>

                {/* Account Actions */}
                <div className="p-2">

                  <button
                    type="button"
                    onClick={handleAccount}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <User size={18} className="text-slate-500" />
                    <span>حسابي</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSettings}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <Settings size={18} className="text-slate-500" />
                    <span>إعدادات الحساب</span>
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut size={18} />
                    <span>تسجيل الخروج</span>
                  </button>

                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
