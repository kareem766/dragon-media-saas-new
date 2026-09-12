import React, { useEffect, useState } from ‘react’
import { Card, Badge, Button } from ‘../components/ui’
import { supabase } from ‘../lib/supabaseClient’

interface DBTicket {
id: string
subject: string
status: string
priority: string
updated_at: string
organizations: { name: string } | null
}

interface DBMessage {
id: string
sender_type: string
message: string
created_at: string
}

const statusTones: Record<string, ‘success’ | ‘warning’ | ‘danger’ | ‘default’> = {
open: ‘warning’,
pending: ‘warning’,
resolved: ‘success’,
closed: ‘default’,
}

const statusLabels: Record<string, string> = {
open: ‘مفتوحة’,
pending: ‘قيد المتابعة’,
resolved: ‘محلولة’,
closed: ‘مغلقة’,
}

const priorityLabels: Record<string, string> = {
low: ‘منخفضة’,
medium: ‘متوسطة’,
high: ‘مرتفعة’,
urgent: ‘عاجلة’,
}

function formatDate(value: string) {
try {
return new Date(value).toLocaleString(‘ar-EG’, {
dateStyle: ‘medium’,
timeStyle: ‘short’,
})
} catch {
return value
}
}

function SkeletonRow() {
return (
)
}

export default function AdminTickets() {
const [tickets, setTickets] = useState<DBTicket[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

const [activeId, setActiveId] = useState<string | null>(null)
const [messages, setMessages] = useState<DBMessage[]>([])
const [messagesLoading, setMessagesLoading] = useState(false)
const [messagesError, setMessagesError] = useState<string | null>(null)

const [reply, setReply] = useState(’’)
const [sending, setSending] = useState(false)
const [statusSaving, setStatusSaving] = useState<string | null>(null)

const getToken = async () => {
if (!supabase) return ‘’

const { data } = await supabase.auth.getSession()
return data.session?.access_token ?? ''

}

const load = async () => {
setLoading(true)
setError(null)

try {
  const token = await getToken()
  const res = await fetch('/api/admin/tickets', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || 'تعذر تحميل تذاكر الدعم.')
  }
  setTickets(Array.isArray(json.tickets) ? json.tickets : [])
} catch (err: any) {
  setError(err?.message || 'حدث خطأ أثناء تحميل التذاكر.')
} finally {
  setLoading(false)
}

}

useEffect(() => {
load()
}, [])

const openTicket = async (id: string) => {
setActiveId(id)
setMessages([])
setMessagesError(null)
setMessagesLoading(true)

try {
  const token = await getToken()
  const res = await fetch(`/api/admin/tickets?messages=${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || 'تعذر تحميل رسائل التذكرة.')
  }
  setMessages(Array.isArray(json.messages) ? json.messages : [])
} catch (err: any) {
  setMessagesError(err?.message || 'حدث خطأ أثناء تحميل الرسائل.')
} finally {
  setMessagesLoading(false)
}

}

const handleReply = async (e: React.FormEvent) => {
e.preventDefault()

if (!activeId || !reply.trim() || sending) return
setSending(true)
setMessagesError(null)
try {
  const token = await getToken()
  const res = await fetch('/api/admin/tickets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: 'reply',
      ticketId: activeId,
      message: reply.trim(),
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || 'تعذر إرسال الرد.')
  }
  setReply('')
  await openTicket(activeId)
  await load()
} catch (err: any) {
  setMessagesError(err?.message || 'حدث خطأ أثناء إرسال الرد.')
} finally {
  setSending(false)
}

}

const setStatus = async (status: string) => {
if (!activeId || statusSaving) return

setStatusSaving(status)
setMessagesError(null)
try {
  const token = await getToken()
  const res = await fetch('/api/admin/tickets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: 'status',
      ticketId: activeId,
      status,
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || 'تعذر تحديث حالة التذكرة.')
  }
  await load()
} catch (err: any) {
  setMessagesError(err?.message || 'حدث خطأ أثناء تحديث حالة التذكرة.')
} finally {
  setStatusSaving(null)
}

}

if (loading) {
return (
    <div className="space-y-3">
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </div>
  </div>
)

}

if (error) {
return (
!
    <h2 className="font-bold text-red-900">
      تعذر تحميل تذاكر الدعم
    </h2>
    <p className="mt-1 text-sm text-red-700">
      {error}
    </p>
    <button
      type="button"
      onClick={load}
      className="mt-4 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-800"
    >
      إعادة المحاولة
    </button>
  </div>
)

}

if (activeId) {
const ticket = tickets.find(t => t.id === activeId)

return (
  <div className="mx-auto max-w-4xl space-y-5">
    <button
      type="button"
      onClick={() => {
        setActiveId(null)
        setMessages([])
        setReply('')
        setMessagesError(null)
      }}
      className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium text-ink-900/60 transition hover:bg-sand-100 hover:text-ink-950"
    >
      <span aria-hidden="true">→</span>
      رجوع لكل التذاكر
    </button>
    <Card className="overflow-hidden">
      <div className="border-b border-sand-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  ticket
                    ? statusTones[ticket.status] || 'default'
                    : 'default'
                }
              >
                {ticket
                  ? statusLabels[ticket.status] || ticket.status
                  : '—'}
              </Badge>
              {ticket?.priority && (
                <span className="rounded-full bg-sand-100 px-2.5 py-1 text-xs font-medium text-ink-900/60">
                  أولوية: {priorityLabels[ticket.priority] || ticket.priority}
                </span>
              )}
            </div>
            <h2 className="break-words text-lg font-bold text-ink-950 sm:text-xl">
              {ticket?.subject || 'تذكرة دعم'}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-900/45">
              <span>
                {ticket?.organizations?.name || 'شركة غير محددة'}
              </span>
              {ticket?.updated_at && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span>
                    آخر تحديث: {formatDate(ticket.updated_at)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="bg-sand-50/40 p-3 sm:p-5">
        <div className="min-h-[260px] max-h-[55vh] space-y-3 overflow-y-auto rounded-2xl border border-sand-200 bg-white p-3 sm:p-4">
          {messagesLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="mr-auto h-16 w-3/4 rounded-2xl bg-sand-100" />
              <div className="ml-auto h-20 w-3/4 rounded-2xl bg-sand-200" />
              <div className="mr-auto h-14 w-2/3 rounded-2xl bg-sand-100" />
            </div>
          ) : messagesError ? (
            <div
              className="flex min-h-[220px] flex-col items-center justify-center text-center"
              role="alert"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                !
              </div>
              <p className="text-sm font-medium text-ink-950">
                تعذر تحميل المحادثة
              </p>
              <p className="mt-1 max-w-sm text-xs text-ink-900/50">
                {messagesError}
              </p>
              <button
                type="button"
                onClick={() => openTicket(activeId)}
                className="mt-4 rounded-xl border border-sand-200 bg-white px-4 py-2 text-xs font-semibold text-ink-950 transition hover:border-ink-300 hover:bg-sand-50"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-sand-100 text-ink-900/50">
                —
              </div>
              <p className="text-sm font-semibold text-ink-950">
                لا توجد رسائل بعد
              </p>
              <p className="mt-1 text-xs text-ink-900/45">
                يمكنك بدء المحادثة بالرد على العميل.
              </p>
            </div>
          ) : (
            messages.map(m => (
              <div
                key={m.id}
                className={`flex ${
                  m.sender_type === 'admin'
                    ? 'justify-end'
                    : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl p-3 text-sm leading-6 shadow-sm sm:max-w-[78%] ${
                    m.sender_type === 'admin'
                      ? 'rounded-tl-md bg-ink-950 text-sand-50'
                      : 'rounded-tr-md border border-sand-200 bg-sand-100 text-ink-950'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {m.message}
                  </div>
                  <div
                    className={`mt-1.5 text-[10px] ${
                      m.sender_type === 'admin'
                        ? 'text-sand-50/55'
                        : 'text-ink-900/40'
                    }`}
                  >
                    {m.sender_type === 'admin'
                      ? 'أنت — الدعم'
                      : 'العميل'}
                    {' · '}
                    {formatDate(m.created_at)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {messagesError && !messagesLoading && messages.length > 0 && (
          <div
            className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"
            role="alert"
          >
            {messagesError}
          </div>
        )}
        <form
          onSubmit={handleReply}
          className="mt-4 rounded-2xl border border-sand-200 bg-white p-3"
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="اكتب ردًا للعميل..."
              disabled={sending}
              className="min-w-0 flex-1 rounded-xl border border-sand-200 bg-sand-50 px-3.5 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/35 focus:border-ink-700 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            />
            <Button
              type="submit"
              disabled={sending || !reply.trim()}
            >
              {sending ? 'جارٍ الإرسال...' : 'إرسال الرد'}
            </Button>
          </div>
        </form>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            disabled={!!statusSaving}
            onClick={() => setStatus('resolved')}
          >
            {statusSaving === 'resolved'
              ? 'جارٍ التحديث...'
              : 'تعليم كمحلولة'}
          </Button>
          <Button
            variant="secondary"
            disabled={!!statusSaving}
            onClick={() => setStatus('closed')}
          >
            {statusSaving === 'closed'
              ? 'جارٍ الإغلاق...'
              : 'إغلاق التذكرة'}
          </Button>
        </div>
      </div>
    </Card>
  </div>
)

}

return (
تذاكر الدعم
    <p className="mt-1 text-sm text-ink-900/50">
      إدارة ومتابعة تذاكر الدعم الخاصة بجميع الشركات.
    </p>
  </div>
  {tickets.length === 0 ? (
    <div className="rounded-2xl border border-dashed border-sand-300 bg-white px-5 py-16 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sand-100 text-ink-900/50">
        —
      </div>
      <h3 className="text-sm font-bold text-ink-950">
        لا توجد تذاكر دعم
      </h3>
      <p className="mt-1 text-xs text-ink-900/45">
        ستظهر تذاكر العملاء هنا عند إنشائها.
      </p>
    </div>
  ) : (
    <div className="space-y-3">
      {tickets.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => openTicket(t.id)}
          className="block w-full text-right"
        >
          <Card className="group p-4 transition duration-200 hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-md sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-words text-sm font-bold text-ink-950">
                    {t.subject}
                  </span>
                  <Badge
                    tone={statusTones[t.status] || 'default'}
                  >
                    {statusLabels[t.status] || t.status}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-900/45">
                  <span>
                    {t.organizations?.name || 'شركة غير محددة'}
                  </span>
                  <span>
                    الأولوية:{' '}
                    {priorityLabels[t.priority] || t.priority}
                  </span>
                  {t.updated_at && (
                    <span>{formatDate(t.updated_at)}</span>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold text-ink-900/40 transition group-hover:text-ink-950">
                فتح التذكرة ←
              </span>
            </div>
          </Card>
        </button>
      ))}
    </div>
  )}
</div>

)
}
