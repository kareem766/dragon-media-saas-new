import React, { useCallback, useEffect, useState } from 'react'
import { Card, Badge, Button } from '../components/ui'
import { supabase } from '../lib/supabaseClient'

interface AuditLog {
  id: string
  action: string | null
  entity_type: string | null
  entity_id: string | null
  created_at: string
  actor_id: string | null
  organization_id: string | null
  metadata?: Record<string, unknown> | null
  actor?: {
    full_name: string | null
  } | null
  organizations?: {
    name: string | null
  } | null
}

const actionLabels: Record<string, string> = {
  approve_payment_request: 'اعتماد طلب دفع',
  reject_payment_request: 'رفض طلب دفع',
  create_organization: 'إنشاء شركة',
  update_organization: 'تعديل شركة',
  delete_organization: 'حذف شركة',
  activate_organization: 'تفعيل شركة',
  suspend_organization: 'إيقاف شركة',
  create_user: 'إنشاء مستخدم',
  update_user: 'تعديل مستخدم',
  delete_user: 'حذف مستخدم',
  login: 'تسجيل دخول',
  logout: 'تسجيل خروج',
}

const entityLabels: Record<string, string> = {
  organization: 'شركة',
  organizations: 'شركة',
  payment_request: 'طلب دفع',
  payment_requests: 'طلبات الدفع',
  user: 'مستخدم',
  users: 'مستخدمون',
  subscription: 'اشتراك',
  subscriptions: 'اشتراكات',
  customer: 'عميل',
  customers: 'عملاء',
  lead: 'عميل محتمل',
  leads: 'عملاء محتملون',
  campaign: 'حملة',
  campaigns: 'حملات',
  settings: 'إعدادات',
}

function formatDate(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getActionLabel(action: string | null) {
  if (!action) return 'نشاط'

  return (
    actionLabels[action] ??
    action
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  )
}

function getEntityLabel(entity: string | null) {
  if (!entity) return '—'

  return entityLabels[entity] ?? entity
}

function LoadingState() {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-ink-900/8 bg-white p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-5 w-36 rounded-lg bg-ink-900/8" />
            <div className="h-4 w-28 rounded-lg bg-ink-900/6" />
            <div className="h-4 w-32 rounded-lg bg-ink-900/6" />
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
    <Card className="border-red-500/15 bg-red-50/50 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-red-800">
            تعذر تحميل سجل النشاط
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

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (!supabase) {
        throw new Error('تعذر الاتصال بخدمة قاعدة البيانات.')
      }

      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        throw sessionError
      }

      if (!sessionData.session) {
        throw new Error('انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى.')
      }

      const {
        data,
        error: queryError,
      } = await supabase
        .from('audit_logs')
        .select(
          `
            id,
            action,
            entity_type,
            entity_id,
            created_at,
            actor_id,
            organization_id,
            metadata,
            actor:actor_id (
              full_name
            ),
            organizations (
              name
            )
          `,
        )
        .order('created_at', {
          ascending: false,
        })
        .limit(200)

      if (queryError) {
        throw queryError
      }

      setLogs(
        Array.isArray(data)
          ? (data as unknown as AuditLog[])
          : [],
      )
    } catch (err) {
      setLogs([])

      setError(
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء قراءة سجل النشاط.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-950 sm:text-2xl">
            سجل النشاط
          </h1>

          <p className="mt-1 text-sm leading-6 text-ink-900/55">
            سجل مركزي لعمليات الإدارة والتغييرات المهمة داخل المنصة.
          </p>
        </div>

        {!loading && !error && (
          <div className="w-fit rounded-xl border border-ink-900/8 bg-white px-3 py-2 text-xs font-semibold text-ink-900/55">
            {logs.length} عملية
          </div>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => void loadLogs()}
        />
      ) : logs.length === 0 ? (
        <Card className="border-dashed p-8 sm:p-12">
          <div className="mx-auto max-w-md text-center">
            <h2 className="text-sm font-bold text-ink-950">
              لا توجد عمليات مسجلة
            </h2>

            <p className="mt-2 text-sm leading-6 text-ink-900/50">
              لم يتم العثور على أي نشاط مسجل حتى الآن.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="border-b border-ink-900/8 bg-ink-950/[0.02] text-right">
                  <th className="px-4 py-4 font-semibold text-ink-900/55 sm:px-5">
                    العملية
                  </th>

                  <th className="px-4 py-4 font-semibold text-ink-900/55">
                    القسم
                  </th>

                  <th className="px-4 py-4 font-semibold text-ink-900/55">
                    المنفذ
                  </th>

                  <th className="px-4 py-4 font-semibold text-ink-900/55">
                    الشركة
                  </th>

                  <th className="px-4 py-4 font-semibold text-ink-900/55">
                    التاريخ
                  </th>
                </tr>
              </thead>

              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-ink-900/6 last:border-b-0 hover:bg-ink-950/[0.015]"
                  >
                    <td className="px-4 py-4 sm:px-5">
                      <div className="flex items-center gap-2">
                        <Badge tone="default">
                          {getActionLabel(log.action)}
                        </Badge>
                      </div>
                    </td>

                    <td className="px-4 py-4 font-medium text-ink-900">
                      {getEntityLabel(log.entity_type)}
                    </td>

                    <td className="px-4 py-4 text-ink-900/70">
                      {log.actor?.full_name || 'مدير المنصة'}
                    </td>

                    <td className="px-4 py-4 text-ink-900/70">
                      {log.organizations?.name || '—'}
                    </td>

                    <td
                      className="px-4 py-4 whitespace-nowrap text-ink-900/55"
                      dir="ltr"
                    >
                      {formatDate(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-ink-900/6 px-4 py-3 text-xs text-ink-900/45">
            يتم عرض آخر 200 عملية مسجلة.
          </div>
        </Card>
      )}
    </div>
  )
}
