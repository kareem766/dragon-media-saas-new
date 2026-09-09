import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
interface TopbarProps {
  title?: string;
  onMenuClick?: () => void;
}
export default function Topbar({ title, onMenuClick }: TopbarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        accountRef.current &&
        !accountRef.current.contains(event.target as Node)
      ) {
        setAccountOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);
  const handleAccount = () => {
  setAccountOpen(false);
  navigate('/account');
  };
  const handleSettings = () => {
    setAccountOpen(false);
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
    }
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
              <span className="text-xl leading-none">☰</span>
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
          {/* Account */}
          <div ref={accountRef} className="relative">
            <button
              type="button"
              onClick={() => setAccountOpen((value) => !value)}
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
                {/* Online Status */}
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
                  accountOpen ? 'rotate-180' : ''
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
                  {/* Decorative Background */}
                  <div className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full bg-blue-100/40 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-10 right-0 h-28 w-28 rounded-full bg-indigo-100/30 blur-2xl" />
                  <div className="relative flex items-center gap-3">
                    {/* Large Avatar */}
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
                    {/* User Details */}
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
                      {loggingOut ? '...' : '↪'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-red-600">
                        {loggingOut ? 'جاري تسجيل الخروج...' : 'تسجيل الخروج'}
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
                    <span>Dragon Media</span>
                    <span>حساب آمن</span>
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
