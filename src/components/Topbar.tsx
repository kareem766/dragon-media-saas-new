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

  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((name: string) => name.charAt(0))
      .join('')
      .toUpperCase() || 'U';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        accountRef.current &&
        !accountRef.current.contains(event.target as Node)
      ) {
        setAccountOpen(false);
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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white">
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
              ☰
            </button>
          )}

          {title && (
            <h1 className="text-lg font-bold text-slate-900">
              {title}
            </h1>
          )}
        </div>

        {/* Left Side */}
        <div className="flex items-center gap-3">

          {/* Account */}
          <div ref={accountRef} className="relative">

            <button
              type="button"
              onClick={() => setAccountOpen((value) => !value)}
              className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-slate-100"
              aria-label="قائمة الحساب"
              aria-expanded={accountOpen}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-xs font-bold text-white shadow-sm">
                {initials}
              </div>

              <div className="hidden text-right lg:block">
                <p className="max-w-[150px] truncate text-sm font-semibold text-slate-800">
                  {displayName}
                </p>

                <p className="max-w-[150px] truncate text-[11px] text-slate-500">
                  {role}
                </p>
              </div>

              <span
                className={`hidden text-xs text-slate-400 transition lg:block ${
                  accountOpen ? 'rotate-180' : ''
                }`}
              >
                ▼
              </span>
            </button>

            {accountOpen && (
              <div className="absolute left-0 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">

                {/* Account Header */}
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-4">
                  <div className="flex items-center gap-3">

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-sm font-bold text-white shadow-sm">
                      {initials}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {displayName}
                      </p>

                      {email && (
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {email}
                        </p>
                      )}

                      <span className="mt-1 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        {role}
                      </span>
                    </div>

                  </div>
                </div>

                {/* Menu */}
                <div className="p-2">

                  <button
                    type="button"
                    onClick={handleAccount}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <span className="text-base">👤</span>
                    <span>حسابي</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSettings}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <span className="text-base">⚙️</span>
                    <span>إعدادات الحساب</span>
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <span className="text-base">↪</span>
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
