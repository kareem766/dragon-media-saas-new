import React, { useCallback, useEffect, useState } from 'react'
import { Card, Badge, Button } from '../components/ui'
import { supabase } from '../lib/supabaseClient'

type RoleName =
  | 'super_admin'
  | 'admin'
  | 'sales'
  | 'support'
  | 'employee'

interface PermissionRow {
  id: string
  role: RoleName
  resource: string
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
}

const roleLabels: Record<RoleName, string> = {
  super_admin: 'مدير المنصة',
  admin: 'مدير الشركة',
  sales: 'المبيعات',
  support: 'الدعم',
  employee: 'الموظف',
}

const resourceLabels: Record<string, string> = {
  appointments: 'المواعيد',
  campaigns: 'الحملات',
  customers: 'العملاء',
  deals: 'الصفقات',
  leads: 'العملاء المحتملون',
  settings: 'الإعدادات',
  tasks: 'المهام',
  users: 'المستخدمون',
}

const roleOrder: RoleName[] = [
  'super_admin',
  'admin',
  'sales',
  'support',
  'employee',
]

const resourceOrder = [
  'appointments',
  'campaigns',
  'customers',
  'deals',
  'leads',
  'settings',
  'tasks',
  'users',
]

function LoadingState() {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-ink-900/8 bg-white p-4 sm:p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-5 w-32 rounded-lg bg-ink-900/8" />
            <div className="h-4 w-28 rounded-lg bg-ink-900/6" />
            <div className="h-4 w-20 rounded-lg bg-ink-900/6" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <Card className="border-red-100 bg-red-50/60 p-5 shadow-[0_12px_34px_rgba(15,47,107,0.04)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-red-800">
            تعذر تحميل الأدوار والصلاحيات
          </h2>

          <p className="mt-1 text-sm leading-6 text-red-700/80">
            {message}
          </p>
        </div>

        <Button type="button" onClick={onRetry}>
          إعادة المحاولة
        </Button>
      </div>
    </Card>
  )
}

function PermissionToggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  disabled: boolean
  label: string
  onChange: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      className={[
        'flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition',
        checked
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-ink-900/8 bg-ink-950/[0.02] text-ink-900/45',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'hover:-translate-y-0.5 hover:shadow-sm',
      ].join(' ')}
      aria-pressed={checked}
      aria-label={label}
    >
      <span
        className={[
          'h-2 w-2 rounded-full',
          checked ? 'bg-emerald-500' : 'bg-ink-900/20',
        ].join(' ')}
      />

      {checked ? 'مسموح' : 'غير مسموح'}
    </button>
  )
}

export default function AdminRoles() {
  const [permissions, setPermissions] = useState<PermissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const loadPermissions = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSavedMessage(null)

    try {
      if (!supabase) {
        throw new Error('تعذر الاتصال بخدمة قاعدة البيانات.')
      }

      const {
        data,
        error: queryError,
      } = await supabase
        .from('role_permissions')
        .select(
          'id, role, resource, can_view, can_edit, can_delete',
        )
        .order('role')
        .order('resource')

      if (queryError) {
        throw queryError
      }

      setPermissions(
        Array.isArray(data)
          ? (data as PermissionRow[])
          : [],
      )
    } catch (err) {
      setPermissions([])

      setError(
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء تحميل الصلاحيات.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPermissions()
  }, [loadPermissions])

  const updatePermission = async (
    row: PermissionRow,
    field:
      | 'can_view'
      | 'can_edit'
      | 'can_delete',
  ) => {
    if (!supabase || savingId) {
      return
    }

    const nextValue = !row[field]

    setSavingId(row.id)
    setError(null)
    setSavedMessage(null)

    try {
      const {
        data,
        error: updateError,
      } = await supabase
        .from('role_permissions')
        .update({
          [field]: nextValue,
        })
        .eq('id', row.id)
        .select(
          'id, role, resource, can_view, can_edit, can_delete',
        )
        .single()

      if (updateError) {
        throw updateError
      }

      if (!data) {
        throw new Error(
          'تعذر تأكيد حفظ الصلاحية.',
        )
      }

      setPermissions((current) =>
        current.map((item) =>
          item.id === row.id
            ? (data as PermissionRow)
            : item,
        ),
      )

      setSavedMessage('تم حفظ الصلاحية بنجاح.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر حفظ الصلاحية.',
      )
    } finally {
      setSavingId(null)
    }
  }

  const getPermission = (
    role: RoleName,
    resource: string,
  ) =>
    permissions.find(
      (item) =>
        item.role === role &&
        item.resource === resource,
    )

  const totalPermissions = permissions.length

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="rounded-3xl border border-blue-100/80 bg-white/85 p-4 shadow-[0_12px_34px_rgba(15,47,107,0.05)] backdrop-blur-sm sm:p-5 sm:flex sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-950 sm:text-2xl">
            الأدوار والصلاحيات
          </h1>

          <p className="mt-1 text-sm leading-6 text-ink-900/55">
            إدارة صلاحيات الأدوار داخل الشركات والمنصة.
          </p>
        </div>

        {!loading && !error && (
          <div className="w-fit rounded-xl border border-blue-100/80 bg-white px-3 py-2 text-xs font-semibold text-ink-900/55 shadow-sm">
            {totalPermissions} صلاحية
          </div>
        )}
      </div>

      {savedMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {savedMessage}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => void loadPermissions()}
        />
      ) : permissions.length === 0 ? (
        <Card className="border-dashed border-blue-100/80 bg-white/90 p-8 shadow-[0_12px_34px_rgba(15,47,107,0.05)] sm:p-12">
          <div className="mx-auto max-w-md text-center">
            <h2 className="text-sm font-bold text-ink-950">
              لا توجد صلاحيات مسجلة
            </h2>

            <p className="mt-2 text-sm leading-6 text-ink-900/50">
              لم يتم العثور على بيانات في جدول صلاحيات الأدوار.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {roleOrder.map((role) => {
            const rolePermissions = permissions.filter(
              (item) => item.role === role,
            )

            if (rolePermissions.length === 0) {
              return null
            }

            return (
              <Card
                key={role}
                className="overflow-hidden border border-blue-100/80 bg-white/90 p-0 shadow-[0_14px_38px_rgba(15,47,107,0.06)] backdrop-blur-sm"
              >
                <div className="border-b border-ink-900/8 bg-ink-950/[0.02] p-4 sm:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-base font-bold text-ink-950">
                        {roleLabels[role]}
                      </h2>

                      <p className="mt-1 text-xs text-ink-900/45">
                        {rolePermissions.length} موارد
                      </p>
                    </div>

                    <Badge
                      tone={
                        role === 'super_admin'
                          ? 'gold'
                          : 'default'
                      }
                    >
                      {role}
                    </Badge>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[760px] w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-900/8 bg-white text-right">
                        <th className="px-4 py-3 font-semibold text-ink-900/55 sm:px-5">
                          القسم
                        </th>

                        <th className="px-4 py-3 text-center font-semibold text-ink-900/55">
                          عرض
                        </th>

                        <th className="px-4 py-3 text-center font-semibold text-ink-900/55">
                          تعديل
                        </th>

                        <th className="px-4 py-3 text-center font-semibold text-ink-900/55">
                          حذف
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {resourceOrder.map((resource) => {
                        const permission =
                          getPermission(
                            role,
                            resource,
                          )

                        if (!permission) {
                          return null
                        }

                        const saving =
                          savingId === permission.id

                        return (
                          <tr
                            key={permission.id}
                            className="border-b border-ink-900/6 last:border-b-0"
                          >
                            <td className="px-4 py-4 font-semibold text-ink-950 sm:px-5">
                              {resourceLabels[
                                resource
                              ] ?? resource}
                            </td>

                            <td className="px-4 py-4 text-center">
                              <PermissionToggle
                                checked={
                                  permission.can_view
                                }
                                disabled={saving}
                                label={`تغيير صلاحية العرض لـ ${
                                  resourceLabels[
                                    resource
                                  ] ?? resource
                                }`}
                                onChange={() =>
                                  void updatePermission(
                                    permission,
                                    'can_view',
                                  )
                                }
                              />
                            </td>

                            <td className="px-4 py-4 text-center">
                              <PermissionToggle
                                checked={
                                  permission.can_edit
                                }
                                disabled={saving}
                                label={`تغيير صلاحية التعديل لـ ${
                                  resourceLabels[
                                    resource
                                  ] ?? resource
                                }`}
                                onChange={() =>
                                  void updatePermission(
                                    permission,
                                    'can_edit',
                                  )
                                }
                              />
                            </td>

                            <td className="px-4 py-4 text-center">
                              <PermissionToggle
                                checked={
                                  permission.can_delete
                                }
                                disabled={saving}
                                label={`تغيير صلاحية الحذف لـ ${
                                  resourceLabels[
                                    resource
                                  ] ?? resource
                                }`}
                                onChange={() =>
                                  void updatePermission(
                                    permission,
                                    'can_delete',
                                  )
                                }
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {savingId && (
                  <div className="border-t border-ink-900/6 px-4 py-3 text-xs text-ink-900/45">
                    جارٍ حفظ التغيير...
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
