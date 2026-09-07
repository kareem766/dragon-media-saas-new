import React, { useEffect, useState } from 'react'
import { Card, Badge, Button } from '../components/ui'
import { supabase } from '../lib/supabaseClient'

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

const statusTones: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  open: 'warning', pending: 'warning', resolved: 'success', closed: 'default',
}
const statusLabels: Record<string, string> = {
  open: 'مفتوحة', pending: 'قيد المتابعة', resolved: 'محلولة', closed: 'مغلقة',
}

export default function AdminTickets() {
  const [tickets, setTickets] = useState<DBTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<DBMessage[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  const getToken = async () => {
    if (!supabase) return ''
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? ''
  }

  const load = async () => {
    const token = await getToken()
    const res = await fetch('/api/admin/tickets', { headers: { Authorization: `Bearer ${token}` } })
    const json = await res.json()
    if (res.ok) setTickets(json.tickets)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openTicket = async (id: string) => {
    setActiveId(id)
    const token = await getToken()
    const res = await fetch(`/api/admin/tickets?messages=${id}`, { headers: { Authorization: `Bearer ${token}` } })
    const json = await res.json()
    if (res.ok) setMessages(json.messages)
  }

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeId || !reply.trim()) return
    setSending(true)
    const token = await getToken()
    await fetch('/api/admin/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'reply', ticketId: activeId, message: reply.trim() }),
    })
    setReply('')
    setSending(false)
    openTicket(activeId)
    load()
  }

  const setStatus = async (status: string) => {
    if (!activeId) return
    const token = await getToken()
    await fetch('/api/admin/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'status', ticketId: activeId, status }),
    })
    load()
  }

  if (loading) {
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
        <button onClick={() => setActiveId(null)} className="text-sm text-ink-900/60 hover:underline">→ رجوع لكل التذاكر</button>
        <Card className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-ink-950">{ticket?.subject}</h3>
              <p className="text-xs text-ink-900/45 mt-1">{ticket?.organizations?.name}</p>
            </div>
            {ticket && <Badge tone={statusTones[ticket.status]}>{statusLabels[ticket.status]}</Badge>}
          </div>
          <div className="space-y-3 mt-4 max-h-80 overflow-y-auto">
            {messages.map(m => (
              <div key={m.id} className={`max-w-[85%] rounded-2xl p-3 text-sm ${m.sender_type === 'admin' ? 'bg-ink-900 text-sand-50 ml-auto rounded-tl-sm' : 'bg-sand-100 mr-auto rounded-tr-sm'}`}>
                <div>{m.message}</div>
                <div className="text-[10px] opacity-60 mt-1">{m.sender_type === 'admin' ? 'أنت (الدعم)' : 'العميل'}</div>
              </div>
            ))}
          </div>
          <form onSubmit={handleReply} className="flex gap-2 mt-4">
            <input value={reply} onChange={e => setReply(e.target.value)} placeholder="اكتب ردًا..." className="flex-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            <Button type="submit" disabled={sending}>إرسال</Button>
          </form>
          <div className="flex gap-2 mt-3">
            <Button variant="secondary" onClick={() => setStatus('resolved')}>تعليم كمحلولة</Button>
            <Button variant="secondary" onClick={() => setStatus('closed')}>إغلاق</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink-950">تذاكر الدعم — كل الشركات</h2>
      {tickets.length === 0 ? (
        <div className="text-center py-16 text-sm text-ink-900/40">لا توجد تذاكر</div>
      ) : (
        <div className="space-y-3">
          {tickets.map(t => (
            <Card key={t.id} className="p-4 flex items-center justify-between flex-wrap gap-3 cursor-pointer hover:border-ink-700" onClick={() => openTicket(t.id)}>
              <div>
                <div className="font-semibold text-sm text-ink-950">{t.subject}</div>
                <div className="text-xs text-ink-900/45 mt-1">{t.organizations?.name} · {t.priority}</div>
              </div>
              <Badge tone={statusTones[t.status]}>{statusLabels[t.status]}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
