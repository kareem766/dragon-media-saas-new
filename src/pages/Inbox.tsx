import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Badge } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { useOrganization } from '../lib/useOrganization'

type Channel = 'whatsapp' | 'messenger' | 'instagram' | 'telegram' | 'website'
type ConversationStatus = 'open' | 'pending' | 'closed'
type QueueFilter = 'all' | 'unread' | 'ai' | 'human'

type Conversation = {
  id: string
  organization_id: string
  customer_id: string | null
  channel: Channel
  handled_by: 'ai' | 'human'
  assigned_user_id: string | null
  last_message_at: string | null
  created_at: string
  status: ConversationStatus
  subject: string | null
  unread_count: number
  metadata: Record<string, unknown>
  updated_at: string
  customer?: { id: string; name: string; company: string | null; phone: string | null; email: string | null } | null
}

type Message = {
  id: string
  conversation_id: string
  sender_type: 'customer' | 'ai' | 'agent'
  content: string
  created_at: string
  metadata: Record<string, unknown>
  read_at: string | null
  delivered_at: string | null
  external_id: string | null
}

const channelLabels: Record<Channel, string> = {
  whatsapp: 'واتساب', messenger: 'ماسنجر', instagram: 'إنستجرام', telegram: 'تليجرام', website: 'الموقع',
}
const statusLabels: Record<ConversationStatus, string> = { open: 'مفتوحة', pending: 'معلقة', closed: 'مغلقة' }

function normalizeCustomer(customer: Conversation['customer'] | Conversation['customer'][] | null | undefined) {
  if (!customer) return null
  return Array.isArray(customer) ? customer[0] ?? null : customer
}
function normalizeConversation(row: any): Conversation {
  const normalizedChannel: Channel = row.channel === 'facebook' ? 'messenger' : row.channel
  return {
    id: row.id, organization_id: row.organization_id, customer_id: row.customer_id ?? null,
    channel: normalizedChannel, handled_by: row.handled_by === 'human' ? 'human' : 'ai',
    assigned_user_id: row.assigned_user_id ?? null, last_message_at: row.last_message_at ?? null,
    created_at: row.created_at, status: row.status ?? 'open', subject: row.subject ?? null,
    unread_count: Number(row.unread_count ?? 0), metadata: row.metadata ?? {},
    updated_at: row.updated_at ?? row.created_at, customer: normalizeCustomer(row.customer),
  }
}
function formatTime(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
}
function formatDateTime(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function getName(c: Conversation) { return c.customer?.name || c.customer?.phone || (c.channel === 'messenger' ? 'عميل ماسنجر' : 'عميل بدون اسم') }
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '؟'
  if (parts.length === 1) return parts[0].slice(0, 2)
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`
}
function getOutboundStatus(message: Message): 'sending' | 'sent' | 'delivered' | 'read' | 'failed' {
  const metadata = message.metadata ?? {}
  if (metadata.outbound_status === 'failed' || metadata.whatsapp_error) return 'failed'
  if (message.read_at) return 'read'
  if (message.delivered_at) return 'delivered'
  if (message.external_id || metadata.outbound_status === 'accepted') return 'sent'
  return 'sending'
}

function Icon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></>,
    send: <><path d="M21 3 10.5 13.5"/><path d="m21 3-6.7 17-3.8-6.5L4 9.7 21 3Z"/></>,
    message: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 2v-4.25A7.46 7.46 0 0 1 4.5 7.5 7.5 7.5 0 0 1 12 4h.5A7.5 7.5 0 0 1 20 11.5Z"/><path d="M8 11.5h8M8 15h5"/></>,
    arrow: <><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
    phone: <><path d="M7.5 3.5 5 5c-.8.5-.9 1.5-.6 2.3 1.7 4.5 5.3 8.1 9.8 9.8.8.3 1.8.2 2.3-.6l1.5-2.5-3.1-1.8-1.6 1.5a12.2 12.2 0 0 1-4.1-4.1l1.5-1.6-1.8-3.1Z"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
    chevron: <path d="m6 9 6 6 6-6"/>,
    close: <><path d="M6 6l12 12M18 6 6 18"/></>,
    sparkle: <><path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Z"/><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z"/></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>
}
function ChannelMark({ channel }: { channel: Channel }) {
  const symbols: Record<Channel, string> = { whatsapp: 'WA', messenger: 'M', instagram: 'IG', telegram: 'TG', website: 'WEB' }
  return <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-sand-100 px-1 text-[8px] font-extrabold text-ink-800">{symbols[channel]}</span>
}
function Delivery({ message }: { message: Message }) {
  if (message.sender_type !== 'agent' || (!message.external_id && !message.metadata?.outbound_status)) return null
  const status = getOutboundStatus(message)
  const label = status === 'read' ? 'تمت القراءة' : status === 'delivered' ? 'تم التسليم' : status === 'sent' ? 'تم الإرسال' : status === 'failed' ? 'فشل الإرسال' : 'جاري الإرسال'
  return <span title={label} className={`text-[11px] font-bold ${status === 'failed' ? 'text-red-300' : status === 'read' ? 'text-sky-300' : 'text-sand-50/60'}`}>{status === 'failed' ? '⚠' : status === 'sending' ? '◷' : status === 'sent' ? '✓' : '✓✓'}</span>
}

export default function Inbox() {
  const { user } = useAuth()
  const { organizationId, loading: organizationLoading, error: organizationError } = useOrganization()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [channel, setChannel] = useState<'all' | Channel>('all')
  const [queue, setQueue] = useState<QueueFilter>('all')
  const [search, setSearch] = useState('')
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [changingHandler, setChangingHandler] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [showDetails, setShowDetails] = useState(false)

  const active = useMemo(() => conversations.find(c => c.id === activeConversationId) ?? null, [conversations, activeConversationId])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return conversations.filter(c => {
      if (channel !== 'all' && c.channel !== channel) return false
      if (queue === 'unread' && c.unread_count < 1) return false
      if (queue === 'ai' && c.handled_by !== 'ai') return false
      if (queue === 'human' && c.handled_by !== 'human') return false
      if (!q) return true
      return [getName(c), c.customer?.company ?? '', c.customer?.phone ?? '', c.customer?.email ?? '', c.subject ?? ''].some(v => v.toLowerCase().includes(q))
    })
  }, [conversations, channel, queue, search])
  const unreadTotal = useMemo(() => conversations.reduce((n, c) => n + Math.max(0, c.unread_count), 0), [conversations])
  const aiTotal = useMemo(() => conversations.filter(c => c.handled_by === 'ai').length, [conversations])
  const openTotal = useMemo(() => conversations.filter(c => c.status === 'open').length, [conversations])

  const loadConversations = useCallback(async () => {
    if (!supabase || !organizationId) { setConversations([]); setLoadingConversations(false); return }
    setLoadingConversations(true); setError(null)
    const { data, error: queryError } = await supabase.from('conversations').select(`id, organization_id, customer_id, channel, handled_by, assigned_user_id, last_message_at, created_at, status, subject, unread_count, metadata, updated_at, customer:customers(id, name, company, phone, email)`).eq('organization_id', organizationId).order('last_message_at', { ascending: false, nullsFirst: false })
    if (queryError) { setError(queryError.message); setConversations([]) } else {
      const normalized = (data ?? []).map(normalizeConversation)
      setConversations(normalized)
      setActiveConversationId(current => current && normalized.some(c => c.id === current) ? current : normalized[0]?.id ?? null)
    }
    setLoadingConversations(false)
  }, [organizationId])

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!supabase) return
    setLoadingMessages(true); setMessageError(null)
    const { data, error: queryError } = await supabase.from('messages').select('id, conversation_id, sender_type, content, created_at, metadata, read_at, delivered_at, external_id').eq('conversation_id', conversationId).order('created_at', { ascending: true })
    if (queryError) { setMessageError(queryError.message); setMessages([]) } else setMessages((data ?? []) as Message[])
    setLoadingMessages(false)
  }, [])

  const markRead = useCallback(async (id: string) => {
    if (!supabase) return
    const { error: rpcError } = await supabase.rpc('mark_conversation_read', { p_conversation_id: id })
    if (!rpcError) setConversations(current => current.map(c => c.id === id ? { ...c, unread_count: 0 } : c))
  }, [])

  const setRyan = useCallback(async (conversation: Conversation, handledBy: 'ai' | 'human') => {
    if (!supabase || !organizationId) return
    setChangingHandler(true); setMessageError(null)
    const { error: updateError } = await supabase.from('conversations').update({ handled_by: handledBy, updated_at: new Date().toISOString() }).eq('id', conversation.id).eq('organization_id', organizationId)
    if (updateError) setMessageError(`تعذر ${handledBy === 'human' ? 'إيقاف' : 'تشغيل'} Ryan: ${updateError.message}`)
    else setConversations(current => current.map(c => c.id === conversation.id ? { ...c, handled_by: handledBy } : c))
    setChangingHandler(false)
  }, [organizationId])

  useEffect(() => { if (organizationId) void loadConversations() }, [organizationId, loadConversations])
  useEffect(() => {
    if (!activeConversationId) { setMessages([]); return }
    void loadMessages(activeConversationId); void markRead(activeConversationId); setShowDetails(false)
  }, [activeConversationId, loadMessages, markRead])
  useEffect(() => {
    if (!supabase || !organizationId) return
    const channelRef = supabase.channel(`inbox-conversations-${organizationId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `organization_id=eq.${organizationId}` }, payload => {
      if (payload.eventType === 'DELETE') { const id = String(payload.old?.id ?? ''); setConversations(current => current.filter(c => c.id !== id)); setActiveConversationId(current => current === id ? null : current); return }
      const next = normalizeConversation(payload.new)
      setConversations(current => { const index = current.findIndex(c => c.id === next.id); if (index < 0) return [next, ...current]; const copy = [...current]; copy[index] = { ...copy[index], ...next }; return copy.sort((a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()) })
    }).subscribe()
    return () => { void supabase?.removeChannel(channelRef) }
  }, [organizationId])
  useEffect(() => {
    if (!supabase || !organizationId) return
    const channelRef = supabase.channel(`inbox-messages-${organizationId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const message = payload.new as Message
      if (message.conversation_id === activeConversationId) setMessages(current => current.some(m => m.id === message.id) ? current : [...current, message])
    }).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, payload => {
      const message = payload.new as Message
      if (message.conversation_id === activeConversationId) setMessages(current => current.map(m => m.id === message.id ? { ...m, ...message } : m))
    }).subscribe()
    return () => { void supabase?.removeChannel(channelRef) }
  }, [organizationId, activeConversationId])

  const handleSend = async (event: FormEvent) => {
    event.preventDefault()
    const content = reply.trim()
    if (!content || !activeConversationId || !organizationId || !supabase) return
    if (!user?.id) { setMessageError('يجب تسجيل الدخول لإرسال الرسائل.'); return }
    const client = supabase
    setSending(true); setMessageError(null)
    const { error: handlerError } = await client.from('conversations').update({ handled_by: 'human', updated_at: new Date().toISOString() }).eq('id', activeConversationId).eq('organization_id', organizationId)
    if (handlerError) { setMessageError(`تعذر تحويل المحادثة للموظف: ${handlerError.message}`); setSending(false); return }
    const { data, error: insertError } = await client.from('messages').insert({ conversation_id: activeConversationId, sender_type: 'agent', content, metadata: { source: 'inbox', sent_by: user.id } }).select('id, conversation_id, sender_type, content, created_at, metadata, read_at, delivered_at, external_id').single()
    if (insertError) { setMessageError(insertError.message); setSending(false); return }
    if (data) setMessages(current => current.some(m => m.id === data.id) ? current : [...current, data as Message])
    setConversations(current => current.map(c => c.id === activeConversationId ? { ...c, handled_by: 'human' } : c))
    setReply(''); setSending(false); void loadConversations()
  }
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (!sending && reply.trim()) event.currentTarget.form?.requestSubmit() }
  }

  if (organizationLoading) return <div dir="rtl" className="min-h-[70vh] space-y-4 p-2"><div className="h-10 w-44 animate-pulse rounded-2xl bg-sand-100"/><Card className="h-[calc(100vh-180px)] min-h-[600px] overflow-hidden"><div className="grid h-full grid-cols-3 gap-px bg-sand-100"><div className="bg-white p-5"><div className="h-12 animate-pulse rounded-2xl bg-sand-100"/></div><div className="bg-white"/><div className="bg-white"/></div></Card></div>
  if (organizationError) return <Card className="flex min-h-[500px] items-center justify-center p-6"><div className="text-center" role="alert"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">!</div><b>تعذر تحميل صندوق الوارد</b><div className="mt-2 text-sm text-red-600">{organizationError}</div></div></Card>
  if (!organizationId) return <Card className="flex min-h-[500px] items-center justify-center p-6"><div className="text-center"><Icon name="message" className="mx-auto mb-3 h-12 w-12 text-ink-700"/><b>لا توجد شركة مرتبطة بهذا الحساب</b><div className="mt-2 text-sm text-ink-900/50">أكمل إعداد الشركة أولًا للوصول إلى صندوق الوارد.</div></div></Card>

  return (
    <div dir="rtl" className="space-y-4 pb-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink-950 text-sand-50 shadow-sm"><Icon name="message"/></div>
          <div><h1 className="text-2xl font-bold tracking-tight text-ink-950">صندوق الوارد</h1><p className="mt-0.5 text-xs text-ink-900/45">كل محادثات عملائك في مساحة عمل واحدة.</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-sand-200 bg-white px-3 py-1.5 font-semibold text-ink-700">{conversations.length} محادثة</span>
          <span className="rounded-full border border-sand-200 bg-white px-3 py-1.5 font-semibold text-ink-700">{openTotal} مفتوحة</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-semibold text-amber-800">{aiTotal} مع Ryan</span>
          {unreadTotal > 0 && <span className="rounded-full bg-ink-950 px-3 py-1.5 font-bold text-sand-50">{unreadTotal > 99 ? '99+' : unreadTotal} غير مقروء</span>}
        </div>
      </div>

      <Card className="overflow-hidden border-sand-200 shadow-[0_10px_40px_rgba(32,28,22,0.06)]">
        <div className="grid min-h-[720px] grid-cols-1 lg:h-[calc(100vh-210px)] lg:min-h-[650px] lg:grid-cols-[330px_1fr] xl:grid-cols-[330px_1fr_285px]">
          <aside className={`${active && 'hidden lg:flex'} min-h-0 flex-col border-b border-sand-100 bg-white lg:border-b-0 lg:border-e`}>
            <div className="space-y-3 border-b border-sand-100 p-4">
              <div className="relative"><Icon name="search" className="absolute right-3 top-3.5 h-4 w-4 text-ink-900/35"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن اسم، هاتف أو شركة..." className="h-11 w-full rounded-xl border border-sand-200 bg-sand-50/60 pe-10 ps-3 text-sm outline-none transition focus:border-ink-700 focus:bg-white" aria-label="البحث في المحادثات"/></div>
              <div className="flex gap-1 overflow-x-auto pb-0.5">
                {([['all','الكل'],['unread','غير مقروء'],['ai','Ryan'],['human','موظف']] as Array<[QueueFilter,string]>).map(([value,label]) => <button key={value} type="button" onClick={() => setQueue(value)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition ${queue === value ? 'bg-ink-950 text-sand-50' : 'bg-sand-50 text-ink-900/55 hover:bg-sand-100'}`}>{label}{value === 'unread' && unreadTotal > 0 ? ` · ${unreadTotal > 9 ? '9+' : unreadTotal}` : ''}</button>)}
              </div>
              <select value={channel} onChange={e => setChannel(e.target.value as 'all' | Channel)} className="h-10 w-full rounded-xl border border-sand-200 bg-white px-3 text-xs font-semibold text-ink-800 outline-none"><option value="all">كل القنوات</option>{Object.entries(channelLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
              <div className="flex items-center justify-between text-[11px] text-ink-900/40"><span>{filtered.length} نتيجة</span><span>الأحدث أولًا</span></div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loadingConversations ? <div className="space-y-2 p-3">{[1,2,3,4,5,6].map(i => <div key={i} className="flex gap-3 rounded-2xl p-3"><div className="h-11 w-11 animate-pulse rounded-2xl bg-sand-100"/><div className="flex-1 space-y-2"><div className="h-3 w-2/3 animate-pulse rounded bg-sand-100"/><div className="h-3 w-full animate-pulse rounded bg-sand-100"/></div></div>)}</div> : error ? <div className="p-7 text-center"><div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">!</div><b className="text-sm">تعذر تحميل المحادثات</b><div className="mt-1 break-words text-xs text-red-600">{error}</div><button onClick={() => void loadConversations()} className="mt-4 rounded-xl bg-ink-950 px-4 py-2 text-xs font-bold text-sand-50">إعادة المحاولة</button></div> : filtered.length === 0 ? <div className="p-8 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sand-100 text-ink-700"><Icon name="message"/></div><b className="text-sm">لا توجد محادثات مطابقة</b><p className="mt-1 text-xs leading-5 text-ink-900/40">جرّب تغيير البحث أو الفلتر.</p></div> : filtered.map(c => {
                const name = getName(c); const isActive = c.id === activeConversationId
                return <button key={c.id} type="button" onClick={() => { setActiveConversationId(c.id); setMessageError(null); setReply('') }} className={`group w-full border-b border-sand-100 p-3.5 text-right transition ${isActive ? 'bg-sand-100/70' : 'hover:bg-sand-50'}`}>
                  <div className="flex gap-3"><div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-extrabold ${isActive ? 'bg-ink-950 text-sand-50' : 'bg-sand-100 text-ink-800'}`}>{getInitials(name)}{c.unread_count > 0 && <span className="absolute -left-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-500"/>}</div><div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><span className={`truncate text-sm ${c.unread_count ? 'font-extrabold text-ink-950' : 'font-bold text-ink-900'}`}>{name}</span><span className="shrink-0 text-[10px] text-ink-900/35">{formatTime(c.last_message_at)}</span></div>
                    <div className="mt-1 flex items-center gap-1.5"><ChannelMark channel={c.channel}/><span className="truncate text-[11px] text-ink-900/45">{c.customer?.company || channelLabels[c.channel]}</span></div>
                    <div className="mt-1.5 flex items-center justify-between gap-2"><span className="truncate text-xs text-ink-900/50">{c.subject || 'محادثة جديدة'}</span>{c.unread_count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ink-950 px-1.5 text-[10px] font-bold text-white">{c.unread_count > 99 ? '99+' : c.unread_count}</span>}</div>
                    <div className="mt-2 flex items-center gap-1.5"><span className={`rounded-md px-1.5 py-0.5 text-[9px] font-extrabold ${c.handled_by === 'ai' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>{c.handled_by === 'ai' ? 'RYAN AI' : 'موظف'}</span><span className="text-[9px] text-ink-900/35">{statusLabels[c.status]}</span></div>
                  </div></div>
                </button>
              })}
            </div>
          </aside>

          <section className={`${active ? 'flex' : 'hidden lg:flex'} min-h-0 min-w-0 flex-col bg-[#fbfaf7]`}>
            {!active ? <div className="flex flex-1 items-center justify-center p-8"><div className="max-w-sm text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-sand-200 bg-white text-ink-700 shadow-sm"><Icon name="message" className="h-7 w-7"/></div><b className="text-base text-ink-950">اختر محادثة للبدء</b><p className="mt-2 text-sm leading-6 text-ink-900/45">اختر عميلًا من القائمة لمشاهدة المحادثة والرد وإدارة حالة Ryan.</p></div></div> : <>
              <header className="flex min-h-[72px] items-center justify-between gap-3 border-b border-sand-100 bg-white px-3 py-3 md:px-5">
                <div className="flex min-w-0 items-center gap-2.5"><button type="button" onClick={() => setActiveConversationId(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sand-100 text-ink-700 lg:hidden" aria-label="العودة للقائمة"><Icon name="arrow" className="h-4 w-4"/></button><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink-950 text-xs font-extrabold text-white">{getInitials(getName(active))}</div><div className="min-w-0"><div className="truncate text-sm font-extrabold text-ink-950">{getName(active)}</div><div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-900/45"><ChannelMark channel={active.channel}/><span>{channelLabels[active.channel]}</span><span>·</span><span>{active.handled_by === 'ai' ? 'Ryan AI' : 'متابعة موظف'}</span></div></div></div>
                <div className="flex shrink-0 items-center gap-1.5"><span className="hidden rounded-lg bg-sand-100 px-2.5 py-1.5 text-[10px] font-bold text-ink-700 sm:inline-flex">{statusLabels[active.status]}</span><button type="button" onClick={() => setShowDetails(v => !v)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-sand-200 bg-white text-ink-700 xl:hidden" aria-label="بيانات العميل"><Icon name="info" className="h-4 w-4"/></button><button type="button" onClick={() => void setRyan(active, active.handled_by === 'ai' ? 'human' : 'ai')} disabled={changingHandler} className={`rounded-xl px-3 py-2 text-[11px] font-extrabold transition disabled:opacity-50 ${active.handled_by === 'ai' ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'}`}>{changingHandler ? 'جاري...' : active.handled_by === 'ai' ? 'إيقاف Ryan' : 'تشغيل Ryan'}</button></div>
              </header>
              {active.handled_by === 'human' && <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500"/><div><b className="text-xs text-amber-900">المحادثة تحت متابعة الموظف</b><span className="mr-2 hidden text-[10px] text-amber-800/65 sm:inline">Ryan لن يرسل ردودًا آلية حتى تعيد تشغيله.</span></div></div><span className="text-[10px] font-bold text-amber-800">تحكم يدوي</span></div></div>}
              <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-5">
                {loadingMessages ? <div className="mx-auto max-w-xl space-y-4 pt-10"><div className="h-16 w-52 animate-pulse rounded-2xl bg-white"/><div className="mr-auto h-20 w-72 animate-pulse rounded-2xl bg-ink-900/10"/><div className="h-14 w-64 animate-pulse rounded-2xl bg-white"/></div> : messageError && messages.length === 0 ? <div className="flex h-full items-center justify-center"><div className="text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">!</div><b className="text-sm">تعذر تحميل الرسائل</b><div className="mt-1 text-xs text-red-600">{messageError}</div><button onClick={() => void loadMessages(active.id)} className="mt-4 rounded-xl bg-ink-950 px-4 py-2 text-xs font-bold text-white">إعادة المحاولة</button></div></div> : messages.length === 0 ? <div className="flex h-full items-center justify-center"><div className="text-center"><div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-sand-200 bg-white text-ink-700"><Icon name="message"/></div><b className="text-sm text-ink-950">ابدأ المحادثة</b><p className="mt-1 text-xs text-ink-900/40">لا توجد رسائل بعد في هذه المحادثة.</p></div></div> : <div className="mx-auto flex max-w-3xl flex-col gap-2.5">{messages.map(message => {
                  const customer = message.sender_type === 'customer'; const ai = message.sender_type === 'ai'
                  return <div key={message.id} className={`flex ${customer ? 'justify-start' : 'justify-end'}`}><div className={`max-w-[88%] md:max-w-[70%] ${customer ? 'rounded-2xl rounded-tr-md border border-sand-200 bg-white text-ink-900 shadow-sm' : ai ? 'rounded-2xl rounded-tl-md border border-amber-200 bg-amber-50 text-ink-900' : 'rounded-2xl rounded-tl-md bg-ink-950 text-white shadow-sm'} px-3.5 py-3`}>
                    {!customer && <div className={`mb-1.5 flex items-center gap-1.5 text-[9px] font-extrabold ${ai ? 'text-amber-700' : 'text-white/55'}`}><span>{ai ? 'RYAN AI' : 'فريق Dragon Media'}</span>{ai && <span className="rounded bg-amber-200/60 px-1 py-0.5">AI</span>}</div>}
                    <div className="whitespace-pre-wrap break-words text-[13px] leading-6">{message.content}</div>
                    <div className={`mt-1.5 flex items-center justify-end gap-2 text-[9px] ${customer ? 'text-ink-900/30' : ai ? 'text-ink-900/35' : 'text-white/45'}`}><span>{formatDateTime(message.created_at)}</span><Delivery message={message}/></div>
                  </div></div>
                })}</div>}
                {messageError && messages.length > 0 && <div className="mx-auto mt-3 max-w-xl text-center text-[11px] text-red-600" role="alert">{messageError}</div>}
              </div>
              <form onSubmit={handleSend} className="border-t border-sand-100 bg-white p-3 md:p-4"><div className="mx-auto max-w-3xl"><div className="rounded-2xl border border-sand-200 bg-sand-50/70 p-1.5 transition focus-within:border-ink-500 focus-within:bg-white focus-within:shadow-sm"><div className="flex items-end gap-1.5"><textarea value={reply} onChange={e => setReply(e.target.value)} onKeyDown={handleKeyDown} disabled={sending} rows={1} placeholder={active.handled_by === 'human' ? 'اكتب ردك للعميل...' : 'اكتب ردًا وسيتم تحويل المحادثة للموظف...'} className="max-h-32 min-h-[46px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-ink-950 outline-none placeholder:text-ink-900/35 disabled:opacity-60" aria-label="اكتب ردك هنا"/><button type="submit" disabled={sending || !reply.trim()} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-ink-950 px-4 text-xs font-extrabold text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-35"><Icon name="send" className="h-4 w-4"/>{sending ? 'جاري...' : 'إرسال'}</button></div></div><div className="mt-1.5 flex items-center justify-between px-1 text-[9px] text-ink-900/35"><span>Enter للإرسال · Shift + Enter لسطر جديد</span><span className="hidden sm:inline">الرد اليدوي يوقف Ryan لهذه المحادثة</span></div></div></form>
            </>}
          </section>

          <aside className={`${showDetails ? 'flex' : 'hidden xl:flex'} absolute inset-x-4 bottom-4 top-auto z-20 max-h-[70vh] flex-col overflow-y-auto rounded-2xl border border-sand-200 bg-white shadow-2xl xl:static xl:max-h-none xl:rounded-none xl:border-0 xl:border-s xl:border-sand-100 xl:shadow-none`}>
            {active && <>
              <div className="flex items-center justify-between border-b border-sand-100 px-4 py-4"><div><div className="text-sm font-extrabold text-ink-950">بيانات العميل</div><div className="mt-0.5 text-[10px] text-ink-900/40">معلومات سريعة للمحادثة</div></div><button type="button" onClick={() => setShowDetails(false)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-sand-100 text-ink-700 xl:hidden" aria-label="إغلاق"><Icon name="close" className="h-4 w-4"/></button></div>
              <div className="space-y-5 overflow-y-auto p-4">
                <div className="text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-ink-950 text-lg font-extrabold text-white">{getInitials(getName(active))}</div><div className="mt-3 text-sm font-extrabold text-ink-950">{getName(active)}</div>{active.customer?.company && <div className="mt-1 text-[11px] text-ink-900/45">{active.customer.company}</div>}</div>
                <div className="space-y-2">
                  {active.customer?.phone && <a href={`tel:${active.customer.phone}`} className="flex items-center gap-3 rounded-xl border border-sand-200 p-3 text-right transition hover:bg-sand-50"><Icon name="phone" className="h-4 w-4 text-ink-700"/><div className="min-w-0"><div className="text-[9px] text-ink-900/35">الهاتف</div><div className="truncate text-xs font-bold text-ink-900">{active.customer.phone}</div></div></a>}
                  {active.customer?.email && <a href={`mailto:${active.customer.email}`} className="flex items-center gap-3 rounded-xl border border-sand-200 p-3 text-right transition hover:bg-sand-50"><Icon name="mail" className="h-4 w-4 text-ink-700"/><div className="min-w-0"><div className="text-[9px] text-ink-900/35">البريد الإلكتروني</div><div className="truncate text-xs font-bold text-ink-900">{active.customer.email}</div></div></a>}
                </div>
                <div className="rounded-2xl border border-sand-200 bg-sand-50/70 p-3.5"><div className="mb-3 text-[10px] font-extrabold text-ink-900/55">حالة المحادثة</div><div className="flex items-center justify-between"><span className="text-xs text-ink-900/55">القناة</span><span className="flex items-center gap-1.5 text-xs font-bold text-ink-900"><ChannelMark channel={active.channel}/>{channelLabels[active.channel]}</span></div><div className="mt-3 flex items-center justify-between"><span className="text-xs text-ink-900/55">الحالة</span><Badge>{statusLabels[active.status]}</Badge></div><div className="mt-3 flex items-center justify-between"><span className="text-xs text-ink-900/55">المسؤول</span><span className={`rounded-md px-2 py-1 text-[9px] font-extrabold ${active.handled_by === 'ai' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>{active.handled_by === 'ai' ? 'Ryan AI' : 'موظف'}</span></div></div>
                <div className="rounded-2xl border border-sand-200 p-3.5"><div className="flex items-center gap-2 text-[10px] font-extrabold text-ink-900/55"><Icon name="sparkle" className="h-4 w-4 text-amber-600"/>اقتراحات سريعة</div><div className="mt-3 space-y-2"><button type="button" onClick={() => setReply('أهلًا بك، كيف يمكننا مساعدتك اليوم؟')} className="w-full rounded-xl bg-sand-50 px-3 py-2 text-right text-[10px] font-semibold text-ink-700 hover:bg-sand-100">ترحيب بالعميل</button><button type="button" onClick={() => setReply('شكرًا لتواصلك معنا. يسعدني مساعدتك، ما الخدمة التي تحتاجها؟')} className="w-full rounded-xl bg-sand-50 px-3 py-2 text-right text-[10px] font-semibold text-ink-700 hover:bg-sand-100">تحديد احتياج العميل</button></div></div>
              </div>
            </>}
          </aside>
        </div>
      </Card>
    </div>
  )
}
