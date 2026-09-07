import React, { useEffect, useState } from 'react'
import { Card, Badge, Button } from '../components/ui'
import { IconPlus } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'
import { useAuth } from '../lib/AuthContext'

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

const statusTones: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  open: 'warning', pending: 'warning', resolved: 'success', closed: 'default',
}
const statusLabels: Record<string, string> = {
  open: 'مفتوحة', pending: 'قيد المتابعة', resolved: 'محلولة', closed: 'مغلقة',
}

export default function Tickets() {
  const { organizationId, loading: orgLoading } = useOrganization()
  const { user } = useAuth()
  const [tickets, setTickets] = useState<DBTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ subject: '', priority: 'متوسطة', message: '' })
  const [saving, setSaving] = useState(false)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<DBMessage[]>([])
  const [reply, setReply] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  const loadTickets = async () => {
    if (!supabase || !organizationId) return
    setLoading(true)
    const { data } = await supabase.from('support_tickets').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false })
    if (data) setTickets(data as DBTicket[])
    setLoading(false)
  }

  useEffect(() => { if (organizationId) loadTickets() }, [organizationId])

  const loadMessages = async (ticketId: string) => {
    if (!supabase) return
    const { data } = await supabase.from('support_ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true })
    if (data) setMessages(data as DBMessage[])
  }

  const openTicket = (id: string) => {
    setActiveId(id)
    loadMessages(id)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !organizationId) return
    setSaving(true)
    const { data: ticket, error } = await supabase.from('support_tickets').insert({
      organization_id: organizationId,
      created_by: user?.id,
      subject: form.subject,
      priority: form.priority,
    }).select('id').single()
    if (!error && ticket) {
      await supabase.from('support_ticket_messages').insert({
        ticket_id: ticket.id,
        sender_id: user?.id,
        sender_type: 'customer',
        message: form.message,
      })
    }
    setSaving(false)
    setForm({ subject: '', priority: 'متوسطة', message: '' })
    setShowForm(false)
    loadTickets()
  }

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !activeId || !reply.trim()) return
    setSendingReply(true)
    await supabase.from('support_ticket_messages').insert({
      ticket_id: activeId, sender_id: user?.id, sender_type: 'customer', message: reply.trim(),
    })
    await supabase.from('support_tickets').update({ status: 'open', updated_at: new Date().toISOString() }).eq('id', activeId)
    setReply('')
    setSendingReply(false)
    loadMessages(activeId)
    loadTickets()
  }

  if (orgLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (activeId) {
    const ticket = tickets.find(t => t.id === activeId)
    return (
      <div className="space-y-4 max-w-lg">
        <button onClick={() => setActiveId(null)} className="text-sm text-ink-900/60 hover:underline">→ رجوع للتذاكر</button>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-ink-950">{ticket?.subject}</h3>
            {ticket && <Badge tone={statusTones[ticket.status]}>{statusLabels[ticket.status]}</Badge>}
          </div>
          <div className="space-y-3 mt-4 max-h-80 overflow-y-auto">
            {messages.map(m => (
              <div key={m.id} className={`max-w-[85%] rounded-2xl p-3 text-sm ${m.sender_type === 'admin' ? 'bg-ink-900 text-sand-50 mr-auto rounded-tl-sm' : 'bg-sand-100 ml-auto rounded-tr-sm'}`}>
                <div>{m.message}</div>
                <div className="text-[10px] opacity-60 mt-1">{m.sender_type === 'admin' ? 'فريق الدعم' : 'أنت'} · {new Date(m.created_at).toLocaleString('ar-EG')}</div>
              </div>
            ))}
          </div>
          <form onSubmit={handleReply} className="flex gap-2 mt-4">
            <input value={reply} onChange={e => setReply(e.target.value)} placeholder="اكتب ردًا..." className="flex-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            <Button type="submit" disabled={sendingReply}>إرسال</Button>
          </form>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(v => !v)}>
          <span className="inline-flex items-center gap-2"><IconPlus className="w-4 h-4" /> تذكرة جديدة</span>
        </Button>
      </div>

      {showForm && (
        <Card className="p-5">
          <form onSubmit={handleCreate} className="space-y-3">
            <input required placeholder="عنوان المشكلة" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="w-full border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white">
              <option value="عالية">عالية</option>
              <option value="متوسطة">متوسطة</option>
              <option value="منخفضة">منخفضة</option>
            </select>
            <textarea required placeholder="اشرح المشكلة بالتفصيل..." rows={3} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="w-full border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? 'جاري الإرسال...' : 'إرسال التذكرة'}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </form>
        </Card>
      )}

      {tickets.length === 0 ? (
        <div className="text-center py-16 text-sm text-ink-900/40">لا توجد تذاكر بعد</div>
      ) : (
        <div className="space-y-3">
          {tickets.map(t => (
            <Card key={t.id} className="p-4 flex items-center justify-between flex-wrap gap-3 cursor-pointer hover:border-ink-700" onClick={() => openTicket(t.id)}>
              <div>
                <div className="font-semibold text-sm text-ink-950">{t.subject}</div>
                <div className="text-xs text-ink-900/45 mt-1">{new Date(t.created_at).toLocaleDateString('ar-EG')}</div>
              </div>
              <Badge tone={statusTones[t.status]}>{statusLabels[t.status]}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
