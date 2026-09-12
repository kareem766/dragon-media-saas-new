import React, { useEffect, useState } from ‘react’
import { Card, Badge, Button } from ‘../components/ui’
import { IconPlus } from ‘../components/Icon’
import { supabase } from ‘../lib/supabaseClient’
import { useOrganization } from ‘../lib/useOrganization’
import { useAuth } from ‘../lib/AuthContext’

interface DBTicket {
id: string
subject: string
status: string
priority: string
created_at: string
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
عالية: ‘أولوية عالية’,
متوسطة: ‘أولوية متوسطة’,
منخفضة: ‘أولوية منخفضة’,
}

export default function Tickets() {
const { organizationId, loading: orgLoading } = useOrganization()
const { user } = useAuth()

const [tickets, setTickets] = useState<DBTicket[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState(’’)
const [showForm, setShowForm] = useState(false)
const [form, setForm] = useState({
subject: ‘’,
priority: ‘متوسطة’,
message: ‘’,
})
const [saving, setSaving] = useState(false)

const [activeId, setActiveId] = useState<string | null>(null)
const [messages, setMessages] = useState<DBMessage[]>([])
const [messagesLoading, setMessagesLoading] = useState(false)
const [messagesError, setMessagesError] = useState(’’)
const [reply, setReply] = useState(’’)
const [sendingReply, setSendingReply] = useState(false)

const loadTickets = async () => {
if (!supabase || !organizationId) return

setLoading(true)
setError('')
const { data, error: ticketsError } = await supabase
  .from('support_tickets')
  .select('*')
  .eq('organization_id', organizationId)
  .order('created_at', { ascending: false })
if (ticketsError) {
  setError('تعذر تحميل التذاكر حاليًا. حاول مرة أخرى.')
  setTickets([])
} else if (data) {
  setTickets(data as DBTicket[])
}
setLoading(false)

}

useEffect(() => {
if (organizationId) {
loadTickets()
}
}, [organizationId])

const loadMessages = async (ticketId: string) => {
if (!supabase) return

setMessagesLoading(true)
setMessagesError('')
const { data, error: messagesError } = await supabase
  .from('support_ticket_messages')
  .select('*')
  .eq('ticket_id', ticketId)
  .order('created_at', { ascending: true })
if (messagesError) {
  setMessages([])
  setMessagesError('تعذر تحميل رسائل التذكرة.')
} else if (data) {
  setMessages(data as DBMessage[])
}
setMessagesLoading(false)

}

const openTicket = (id: string) => {
setActiveId(id)
setMessages([])
loadMessages(id)
}

const closeTicket = () => {
setActiveId(null)
setMessages([])
setReply(’’)
setMessagesError(’’)
}

const handleCreate = async (e: React.FormEvent) => {
e.preventDefault()

if (!supabase || !organizationId || !form.subject.trim() || !form.message.trim()) {
  return
}
setSaving(true)
setError('')
const { data: ticket, error: ticketError } = await supabase
  .from('support_tickets')
  .insert({
    organization_id: organizationId,
    created_by: user?.id,
    subject: form.subject.trim(),
    priority: form.priority,
  })
  .select('id')
  .single()
if (ticketError || !ticket) {
  setSaving(false)
  setError('تعذر إنشاء التذكرة. حاول مرة أخرى.')
  return
}
const { error: messageError } = await supabase
  .from('support_ticket_messages')
  .insert({
    ticket_id: ticket.id,
    sender_id: user?.id,
    sender_type: 'customer',
    message: form.message.trim(),
  })
if (messageError) {
  setSaving(false)
  setError('تم إنشاء التذكرة ولكن تعذر إضافة الرسالة. حاول فتح التذكرة وإرسال الرد مرة أخرى.')
  setForm({
    subject: '',
    priority: 'متوسطة',
    message: '',
  })
  setShowForm(false)
  await loadTickets()
  return
}
setSaving(false)
setForm({
  subject: '',
  priority: 'متوسطة',
  message: '',
})
setShowForm(false)
await loadTickets()

}

const handleReply = async (e: React.FormEvent) => {
e.preventDefault()

if (!supabase || !activeId || !reply.trim()) return
setSendingReply(true)
setMessagesError('')
const { error: messageError } = await supabase
  .from('support_ticket_messages')
  .insert({
    ticket_id: activeId,
    sender_id: user?.id,
    sender_type: 'customer',
    message: reply.trim(),
  })
if (messageError) {
  setSendingReply(false)
  setMessagesError('تعذر إرسال الرد. حاول مرة أخرى.')
  return
}
const { error: ticketError } = await supabase
  .from('support_tickets')
  .update({
    status: 'open',
    updated_at: new Date().toISOString(),
  })
  .eq('id', activeId)
if (ticketError) {
  setMessagesError('تم إرسال الرد، لكن تعذر تحديث حالة التذكرة.')
}
setReply('')
setSendingReply(false)
await loadMessages(activeId)
await loadTickets()

}

if (orgLoading || loading) {
return (
    <div className="space-y-3">
      {[1, 2, 3].map(item => (
        <div
          key={item}
          className="h-20 rounded-2xl border border-sand-200 bg-white animate-pulse"
        />
      ))}
    </div>
  </div>
)

}

if (activeId) {
const ticket = tickets.find(t => t.id === activeId)

return (
  <div className="space-y-5 max-w-3xl">
    <button
      type="button"
      onClick={closeTicket}
      className="inline-flex items-center gap-2 text-sm font-medium text-ink-900/60 hover:text-ink-950 transition-colors"
    >
      <span aria-hidden="true">→</span>
      العودة إلى التذاكر
    </button>
    <Card className="overflow-hidden">
      <div className="border-b border-sand-200 bg-sand-50/60 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-ink-900 text-sand-50 flex items-center justify-center shrink-0">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-ink-900/45">
                طلب دعم
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-ink-950 break-words">
              {ticket?.subject || 'تذكرة الدعم'}
            </h1>
            {ticket && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge tone={statusTones[ticket.status] || 'default'}>
                  {statusLabels[ticket.status] || ticket.status}
                </Badge>
                {ticket.priority && (
                  <span className="text-xs text-ink-900/45">
                    {priorityLabels[ticket.priority] || ticket.priority}
                  </span>
                )}
                <span className="text-xs text-ink-900/35">
                  {new Date(ticket.created_at).toLocaleDateString('ar-EG')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <div
          className="space-y-3 max-h-[420px] overflow-y-auto pl-1"
          aria-live="polite"
        >
          {messagesLoading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map(item => (
                <div
                  key={item}
                  className={`h-16 rounded-2xl bg-sand-100 animate-pulse ${
                    item % 2 === 0 ? 'mr-auto w-4/5' : 'ml-auto w-3/4'
                  }`}
                />
              ))}
            </div>
          ) : messagesError ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {messagesError}
              <button
                type="button"
                onClick={() => loadMessages(activeId)}
                className="block mt-2 font-semibold underline underline-offset-2"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-10 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-sand-100 text-ink-900/45 flex items-center justify-center">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
                </svg>
              </div>
              <p className="mt-3 text-sm font-medium text-ink-950">
                لا توجد رسائل بعد
              </p>
            </div>
          ) : (
            messages.map(message => {
              const isAdmin = message.sender_type === 'admin'
              return (
                <div
                  key={message.id}
                  className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[88%] sm:max-w-[75%] rounded-2xl p-3.5 text-sm leading-6 ${
                      isAdmin
                        ? 'bg-ink-900 text-sand-50 rounded-tr-md'
                        : 'bg-sand-100 text-ink-950 rounded-tl-md'
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">
                      {message.message}
                    </div>
                    <div className="text-[10px] opacity-55 mt-2">
                      {isAdmin ? 'فريق الدعم' : 'أنت'} ·{' '}
                      {new Date(message.created_at).toLocaleString('ar-EG')}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        <form
          onSubmit={handleReply}
          className="mt-5 pt-5 border-t border-sand-200"
        >
          {messagesError && !messagesLoading && messages.length > 0 && (
            <div
              role="alert"
              className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
            >
              {messagesError}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="اكتب ردًا على فريق الدعم..."
              disabled={sendingReply}
              className="flex-1 min-w-0 border border-sand-200 bg-white rounded-xl px-4 py-3 text-sm text-ink-950 placeholder:text-ink-900/35 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-900/5 transition disabled:opacity-60"
            />
            <Button
              type="submit"
              disabled={sendingReply || !reply.trim()}
            >
              {sendingReply ? 'جاري الإرسال...' : 'إرسال الرد'}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  </div>
)

}

return (
الدعم الفني
تواصل مع فريق Dragon Media وتابع طلبات الدعم الخاصة بك.
    <Button onClick={() => setShowForm(value => !value)}>
      <span className="inline-flex items-center gap-2">
        <IconPlus className="w-4 h-4" />
        تذكرة جديدة
      </span>
    </Button>
  </div>
  {error && (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <span>{error}</span>
      <button
        type="button"
        onClick={loadTickets}
        className="font-semibold underline underline-offset-2 shrink-0"
      >
        إعادة المحاولة
      </button>
    </div>
  )}
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
    <Card className="p-4">
      <div className="text-xs text-ink-900/45">إجمالي التذاكر</div>
      <div className="text-2xl font-bold text-ink-950 mt-1">
        {tickets.length}
      </div>
    </Card>
    <Card className="p-4">
      <div className="text-xs text-ink-900/45">مفتوحة</div>
      <div className="text-2xl font-bold text-ink-950 mt-1">
        {tickets.filter(t => t.status === 'open' || t.status === 'pending').length}
      </div>
    </Card>
    <Card className="p-4 col-span-2 sm:col-span-1">
      <div className="text-xs text-ink-900/45">محلولة</div>
      <div className="text-2xl font-bold text-ink-950 mt-1">
        {tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length}
      </div>
    </Card>
  </div>
  {showForm && (
    <Card className="p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="font-bold text-ink-950">إنشاء تذكرة جديدة</h2>
        <p className="text-xs text-ink-900/45 mt-1">
          اشرح المشكلة وسيتابع فريق الدعم طلبك.
        </p>
      </div>
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-ink-900/65 mb-1.5">
            عنوان المشكلة
          </label>
          <input
            required
            value={form.subject}
            onChange={e =>
              setForm({ ...form, subject: e.target.value })
            }
            placeholder="مثال: مشكلة في إعدادات الحساب"
            className="w-full border border-sand-200 bg-white rounded-xl px-4 py-3 text-sm text-ink-950 placeholder:text-ink-900/35 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-900/5 transition"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-900/65 mb-1.5">
            الأولوية
          </label>
          <select
            value={form.priority}
            onChange={e =>
              setForm({ ...form, priority: e.target.value })
            }
            className="w-full border border-sand-200 bg-white rounded-xl px-4 py-3 text-sm text-ink-950 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-900/5 transition"
          >
            <option value="عالية">عالية</option>
            <option value="متوسطة">متوسطة</option>
            <option value="منخفضة">منخفضة</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-900/65 mb-1.5">
            تفاصيل المشكلة
          </label>
          <textarea
            required
            rows={5}
            value={form.message}
            onChange={e =>
              setForm({ ...form, message: e.target.value })
            }
            placeholder="اشرح المشكلة بالتفصيل وأي خطوات قمت بها قبل التواصل مع الدعم..."
            className="w-full resize-y border border-sand-200 bg-white rounded-xl px-4 py-3 text-sm text-ink-950 placeholder:text-ink-900/35 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-900/5 transition"
          />
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowForm(false)}
            disabled={saving}
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            disabled={saving || !form.subject.trim() || !form.message.trim()}
          >
            {saving ? 'جاري إرسال التذكرة...' : 'إرسال التذكرة'}
          </Button>
        </div>
      </form>
    </Card>
  )}
  {tickets.length === 0 ? (
    <Card className="p-8 sm:p-12">
      <div className="text-center max-w-md mx-auto">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-sand-100 text-ink-900/50 flex items-center justify-center">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
          </svg>
        </div>
        <h2 className="mt-4 font-bold text-ink-950">
          لا توجد تذاكر دعم
        </h2>
        <p className="text-sm text-ink-900/45 mt-2 leading-6">
          إذا واجهت أي مشكلة أو تحتاج إلى مساعدة، يمكنك إنشاء تذكرة جديدة وسيتابعها فريق الدعم.
        </p>
        {!showForm && (
          <div className="mt-5">
            <Button onClick={() => setShowForm(true)}>
              <span className="inline-flex items-center gap-2">
                <IconPlus className="w-4 h-4" />
                إنشاء أول تذكرة
              </span>
            </Button>
          </div>
        )}
      </div>
    </Card>
  ) : (
    <div className="space-y-3">
      {tickets.map(ticket => (
        <button
          key={ticket.id}
          type="button"
          onClick={() => openTicket(ticket.id)}
          className="w-full text-right group"
        >
          <Card className="p-4 sm:p-5 transition-all duration-200 group-hover:border-ink-700 group-hover:shadow-sm">
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex w-10 h-10 rounded-xl bg-sand-100 text-ink-900/55 items-center justify-center shrink-0">
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <h3 className="font-semibold text-sm sm:text-base text-ink-950 truncate">
                    {ticket.subject}
                  </h3>
                  <div className="shrink-0">
                    <Badge tone={statusTones[ticket.status] || 'default'}>
                      {statusLabels[ticket.status] || ticket.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-ink-900/40">
                  <span>
                    {new Date(ticket.created_at).toLocaleDateString('ar-EG')}
                  </span>
                  {ticket.priority && (
                    <>
                      <span aria-hidden="true">•</span>
                      <span>
                        {priorityLabels[ticket.priority] || ticket.priority}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <span
                aria-hidden="true"
                className="text-ink-900/25 group-hover:text-ink-900/60 transition-colors"
              >
                ←
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
