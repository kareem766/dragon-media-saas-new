import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../lib/ToastContext'

interface PlatformUser {
  id: string
  organization_id: string | null
  full_name: string | null
  email: string | null
  role: string | null
  active: boolean
  is_platform_admin: boolean
  created_at: string
  organization_name: string
}

const roleLabels: Record<string, string> = {
  super_admin: 'مدير المنصة',
  admin: 'مدير الشركة',
  sales: 'المبيعات',
  support: 'الدعم',
  employee: 'الموظف',
}

const getErrorMessage = (value: unknown, fallback: string) => {
  if (value instanceof Error && value.message) return value.message
  if (typeof value === 'string' && value) return value
  if (value && typeof value === 'object' && 'error' in value) {
    const error = (value as { error?: unknown }).error
    if (typeof error === 'string' && error) return error
  }
  return fallback
}

export default function AdminPlatformUsers() {
  const { confirmAction } = useToast()
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'admins' | 'inactive'>('all')

  const getAccessToken = useCallback(async () => {
    if (!supabase) throw new Error('تعذر الاتصال بخدمة البيانات.')
    const { data, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw new Error('تعذر التحقق من جلسة الدخول.')
    const token = data.session?.access_token
    if (!token) throw new Error('انتهت جلسة الدخول. يرجى تسجيل الدخول مرة أخرى.')
    return token
  }, [])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAccessToken()
      const response = await fetch('/api/admin/platform-users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const text = await response.text()
      let payload: any = null
      try { payload = text ? JSON.parse(text) : null } catch { payload = null }
      if (!response.ok) throw new Error(getErrorMessage(payload, 'تعذر تحميل مستخدمي المنصة.'))
      setUsers(Array.isArray(payload?.users) ? payload.users : [])
    } catch (err) {
      setUsers([])
      setError(getErrorMessage(err, 'تعذر تحميل مستخدمي المنصة.'))
    } finally {
      setLoading(false)
    }
  }, [getAccessToken])

  useEffect(() => { void loadUsers() }, [loadUsers])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return users.filter(user => {
      const matchesSearch = !query ||
        [user.full_name, user.email, user.organization_name, user.role]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(query))
      if (!matchesSearch) return false
      if (filter === 'admins') return user.is_platform_admin
      if (filter === 'inactive') return !user.active
      return true
    })
  }, [filter, search, users])

  const updateUser = async (user: PlatformUser, action: 'set_platform_admin' | 'set_active') => {
    const nextValue = action === 'set_platform_admin'
      ? !user.is_platform_admin
      : !user.active

    const confirmed = await confirmAction(
      action === 'set_platform_admin'
        ? nextValue ? 'منح صلاحية مدير المنصة لهذا الحساب؟' : 'إزالة صلاحية مدير المنصة من هذا الحساب؟'
        : nextValue ? 'تفعيل هذا الحساب؟' : 'إيقاف هذا الحساب؟',
      {
        description: 'سيتم تطبيق التغيير مباشرة على صلاحيات الوصول إلى المنصة.',
        confirmLabel: 'متابعة',
        cancelLabel: 'إلغاء',
      },
    )
    if (!confirmed) return

    setSavingId(user.id)
    setError(null)
    try {
      const token = await getAccessToken()
      const response = await fetch('/api/admin/platform-users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id, action, value: nextValue }),
      })
      const text = await response.text()
      let payload: any = null
      try { payload = text ? JSON.parse(text) : null } catch { payload = null }
      if (!response.ok) throw new Error(getErrorMessage(payload, 'تعذر حفظ التعديل.'))
      if (payload?.user) {
        setUsers(current => current.map(item => item.id === user.id ? { ...item, ...payload.user } : item))
      } else {
        await loadUsers()
      }
    } catch (err) {
      setError(getErrorMessage(err, 'تعذر حفظ التعديل.'))
    } finally {
      setSavingId(null)
    }
  }

  const activeCount = users.filter(user => user.active).length
  const adminCount = users.filter(user => user.is_platform_admin && user.active).length

  return (
    <div dir="rtl" className="mx-auto w-full max-w-7xl space-y-6">
      <header className="rounded-3xl border border-blue-100/80 bg-white/90 p-5 shadow-[0_12px_34px_rgba(15,47,107,0.05)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold tracking-wide text-blue-700">تحكم أمني مركزي</p>
            <h1 className="mt-1 text-2xl font-bold text-ink-950">مديرو المنصة والحسابات</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-900/55">
              إدارة الحسابات التي تملك وصولًا للمنصة، ومنح أو إزالة صلاحية مدير المنصة، مع حماية الحساب الأخير من الإيقاف أو خفض الصلاحيات.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => void loadUsers()} disabled={loading}>
            {loading ? 'جاري التحديث...' : 'تحديث القائمة'}
          </Button>
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs font-semibold text-ink-900/50">إجمالي الحسابات</div>
          <div className="mt-1 text-2xl font-bold text-ink-950">{users.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold text-ink-900/50">الحسابات النشطة</div>
          <div className="mt-1 text-2xl font-bold text-emerald-700">{activeCount}</div>
        </Card>
        <Card className="col-span-2 p-4 sm:col-span-1">
          <div className="text-xs font-semibold text-ink-900/50">مديرو المنصة النشطون</div>
          <div className="mt-1 text-2xl font-bold text-blue-700">{adminCount}</div>
        </Card>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row">
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="ابحث بالاسم أو البريد أو الشركة..."
            className="min-h-11 flex-1 rounded-xl border border-sand-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <div className="grid grid-cols-3 gap-2 lg:w-[360px]">
            {([
              ['all', 'الكل'],
              ['admins', 'مديرو المنصة'],
              ['inactive', 'الموقوفون'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={[
                  'rounded-xl border px-3 py-2 text-xs font-bold transition',
                  filter === value
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-sand-200 bg-white text-ink-900/55 hover:bg-sand-50',
                ].join(' ')}
                aria-pressed={filter === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-6">
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-16 rounded-xl bg-sand-100" />
            ))}
          </div>
        </Card>
      ) : filteredUsers.length === 0 ? (
        <Card className="border-dashed p-10 text-center">
          <h2 className="font-bold text-ink-950">لا توجد حسابات مطابقة</h2>
          <p className="mt-1 text-sm text-ink-900/45">جرّب تغيير البحث أو الفلتر.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-sand-200 bg-sand-50 text-ink-900/50">
                <tr>
                  <th className="px-4 py-3 text-right font-semibold">الحساب</th>
                  <th className="px-4 py-3 text-right font-semibold">الشركة</th>
                  <th className="px-4 py-3 text-right font-semibold">الدور</th>
                  <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                  <th className="px-4 py-3 text-right font-semibold">وصول المنصة</th>
                  <th className="px-4 py-3 text-right font-semibold">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-sand-50/60">
                    <td className="px-4 py-3">
                      <div className="font-bold text-ink-950">{user.full_name || 'بدون اسم'}</div>
                      <div className="mt-1 text-xs text-ink-900/45">{user.email || 'بدون بريد'}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-900/65">{user.organization_name}</td>
                    <td className="px-4 py-3">
                      <Badge tone={user.is_platform_admin ? 'gold' : 'default'}>
                        {user.is_platform_admin ? 'مدير المنصة' : roleLabels[user.role || ''] || user.role || 'غير محدد'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={user.active ? 'success' : 'danger'}>
                        {user.active ? 'نشط' : 'موقوف'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={user.is_platform_admin ? 'gold' : 'default'}>
                        {user.is_platform_admin ? 'وصول كامل' : 'وصول الشركة'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={user.is_platform_admin ? 'secondary' : 'primary'}
                          onClick={() => void updateUser(user, 'set_platform_admin')}
                          disabled={savingId === user.id}
                        >
                          {savingId === user.id ? 'جاري التنفيذ...' : user.is_platform_admin ? 'إزالة مدير المنصة' : 'منح مدير المنصة'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void updateUser(user, 'set_active')}
                          disabled={savingId === user.id}
                        >
                          {user.active ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="border-amber-200 bg-amber-50/70 p-4 sm:p-5">
        <p className="text-sm font-bold text-amber-900">حماية الوصول</p>
        <p className="mt-1 text-xs leading-5 text-amber-800/80">
          لا يمكن إيقاف أو خفض صلاحية الحساب الحالي من داخل هذه الصفحة، ولا يمكن إزالة آخر مدير منصة نشط.
        </p>
      </Card>
    </div>
  )
}
