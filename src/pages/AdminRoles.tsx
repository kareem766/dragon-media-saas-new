import React, { useCallback, useEffect, useState } from 'react'
import { Card, Badge } from '../components/ui'
import { supabase } from '../lib/supabaseClient'

interface LogRow {
  id: string
  action: string
  entity: string
  created_at: string
  organizations: { name: string } | null
  actor: { full_name: string } | null
  new_value: any
}

const actionLabels: Record<string, string> = {
  approve_payment: 'موافقة على دفعة',
  reject_payment: 'رفض دفعة',
  suspend_organization: 'تعليق شركة',
  activate_organization: 'تفعيل شركة',
}

const getActionLabel = (action: string) => actionLabels[action] ?? action

const formatDate = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleString('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function SectionHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-950">
        {title}
      </h1>
      <p className="mt-1 text-sm leading-6 text-ink-900/55">
        {description}
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-ink-900/8 bg-white p-4 sm:p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-5 w-44 rounded-lg bg-ink-900/8" />
              <div className="h-3.5 w-56 rounded-lg bg-ink-900/6" />
            </div>

            <div className="h-4 w-32 rounded-lg bg-ink-900/6" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <Card className="border-dashed p-8 sm:p-12">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-950/5 text-ink-950/55">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path
              d="M12 8v4l2.5 2.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h2 className="mt-4 text-sm font-bold text-ink-950">
          لا يوجد نشاط مسجّل بعد
        </h2>

        <p className="mt-1.5 text-sm leading-6 text-ink-900/50">
          ستظهر هنا العمليات الإدارية المهمة التي تتم داخل المنصة.
        </p>
      </div>
    </Card>
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
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                d="M12 9v4M12 17h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.75 3h14.9a2 2 0 0 0 1.75-3l-7.5-13.1a2 2 0 0 0-3.4 0Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-bold text-red-800">
              تعذر تحميل سجل النشاط
            </h2>
            <p className="mt-1 break-words text-sm leading-6 text-red-700/80">
              {message}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRetry}
          className="min-h-10 shrink-0 rounded-xl bg-ink-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-900 active:scale-[0.98]"
        >
          إعادة المحاولة
        </button>
      </div>
    </Card>
  )
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (!supabase) {
        throw new Error('تعذر الاتصال بخدمة المصادقة.')
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      if (sessionError) {
        throw sessionError
      }

      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error('انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى.')
      }

      const res = await fetch('/api/admin/audit-logs', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      let json: { logs?: LogRow[]; error?: string } = {}

      try {
        json = await res.json()
      } catch {
        throw new Error('تعذر قراءة استجابة الخادم.')
      }

      if (!res.ok) {
        throw new Error(json.error || 'تعذر تحميل سجل النشاط.')
      }

      setLogs(Array.isArray(json.logs) ? json.logs : [])
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'حدث خطأ غير متوقع أثناء تحميل سجل النشاط.'

      setError(message)
      setLogs([])
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
        <SectionHeader
          title="سجل النشاط"
          description="مراجعة العمليات الإدارية والأحداث المهمة التي تمت داخل المنصة."
        />

        {!loading && !error && (
          <div className="w-fit rounded-xl border border-ink-900/8 bg-white px-3 py-2 text-xs font-semibold text-ink-900/55">
            {logs.length} {logs.length === 1 ? 'عملية' : 'عملية مسجلة'}
          </div>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadLogs()} />
      ) : logs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card
              key={log.id}
              className="overflow-hidden p-0 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(0,0,0,0.06)]"
            >
              <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="gold">
                      {getActionLabel(log.action)}
                    </Badge>

                    {log.entity && (
                      <span className="rounded-lg bg-ink-950/5 px-2 py-1 text-[11px] font-medium text-ink-900/50">
                        {log.entity}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
                    <span className="font-semibold text-ink-950">
                      {log.organizations?.name ?? 'بدون شركة محددة'}
                    </span>

                    <span className="hidden text-ink-900/20 sm:inline">
                      •
                    </span>

                    <span className="text-ink-900/50">
                      بواسطة: {log.actor?.full_name || 'النظام'}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 border-t border-ink-900/6 pt-3 text-xs text-ink-900/45 lg:border-t-0 lg:pt-0">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  <span className="whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
