import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { Card, Badge } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { useOrganization } from '../lib/useOrganization'

type Channel =
  | 'whatsapp'
  | 'messenger'
  | 'instagram'
  | 'telegram'
  | 'website'

type Conversation = {
  id: string
  organization_id: string
  customer_id: string | null
  channel: Channel
  handled_by: 'ai' | 'human'
  assigned_user_id: string | null
  last_message_at: string | null
  created_at: string
  status: 'open' | 'pending' | 'closed'
  subject: string | null
  unread_count: number
  metadata: Record<string, unknown>
  updated_at: string
  customer?: {
    id: string
    name: string
    company: string | null
    phone: string | null
    email: string | null
  } | null
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

const channelFilters: Array<{ label: string; value: 'all' | Channel }> = [
  { label: 'الكل', value: 'all' },
  { label: 'واتساب', value: 'whatsapp' },
  { label: 'ماسنجر', value: 'messenger' },
  { label: 'إنستجرام', value: 'instagram' },
  { label: 'تليجرام', value: 'telegram' },
  { label: 'الموقع', value: 'website' },
]

const channelLabels: Record<Channel, string> = {
  whatsapp: 'واتساب',
  messenger: 'ماسنجر',
  instagram: 'إنستجرام',
  telegram: 'تليجرام',
  website: 'الموقع',
}

const statusLabels: Record<Conversation['status'], string> = {
  open: 'مفتوحة',
  pending: 'معلقة',
  closed: 'مغلقة',
}

function normalizeCustomer(
  customer:
    | Conversation['customer']
    | Conversation['customer'][]
    | null
    | undefined,
) {
  if (!customer) return null
  return Array.isArray(customer) ? customer[0] ?? null : customer
}

function normalizeConversation(row: any): Conversation {
  return {
    id: row.id,
    organization_id: row.organization_id,
    customer_id: row.customer_id ?? null,
    channel: row.channel,
    handled_by: row.handled_by === 'human' ? 'human' : 'ai',
    assigned_user_id: row.assigned_user_id ?? null,
    last_message_at: row.last_message_at ?? null,
    created_at: row.created_at,
    status: row.status ?? 'open',
    subject: row.subject ?? null,
    unread_count: Number(row.unread_count ?? 0),
    metadata: row.metadata ?? {},
    updated_at: row.updated_at ?? row.created_at,
    customer: normalizeCustomer(row.customer),
  }
}

function formatTime(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('ar-EG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getConversationName(conversation: Conversation) {
  return conversation.customer?.name || 'محادثة بدون اسم'
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '؟'
  if (parts.length === 1) return parts[0].slice(0, 2)
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`
}

function ChannelIcon({ channel, className = 'w-4 h-4' }: { channel: Channel; className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      {channel === 'whatsapp' ? '◉' : channel === 'instagram' ? '◎' : channel === 'messenger' ? '◈' : channel === 'telegram' ? '➤' : '▣'}
    </span>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden="true">
      <path d="M21 3 10.5 13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m21 3-6.7 17-3.8-6.5L4 9.7 21 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

function MessageSquareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" aria-hidden="true">
      <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 2v-4.25A7.46 7.46 0 0 1 4.5 7.5 7.5 7.5 0 0 1 12 4h.5A7.5 7.5 0 0 1 20 11.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 11.5h8M8 15h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function getOutboundStatus(message: Message): 'sending' | 'sent' | 'delivered' | 'read' | 'failed' {
  const metadata = message.metadata ?? {}
  if (metadata.outbound_status === 'failed' || metadata.whatsapp_error) return 'failed'
  if (message.read_at) return 'read'
  if (message.delivered_at) return 'delivered'
  if (message.external_id || metadata.outbound_status === 'accepted') return 'sent'
  return 'sending'
}

function MessageDeliveryStatus({ message }: { message: Message }) {
  if (message.sender_type !== 'agent' || !message.external_id && !message.metadata?.outbound_status) return null

  const status = getOutboundStatus(message)
  const label =
    status === 'read'
      ? 'تمت القراءة'
      : status === 'delivered'
        ? 'تم التسليم'
        : status === 'sent'
          ? 'تم الإرسال'
          : status === 'failed'
            ? 'فشل الإرسال'
            : 'جاري الإرسال'

  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex items-center text-[11px] font-semibold ${
        status === 'failed'
          ? 'text-red-300'
          : status === 'read'
            ? 'text-sky-300'
            : 'text-sand-50/70'
      }`}
    >
      {status === 'failed' ? '⚠' : status === 'sending' ? '◷' : status === 'sent' ? '✓' : '✓✓'}
    </span>
  )
}

export default function Inbox() {
  const { user } = useAuth()
  const { organizationId, loading: organizationLoading, error: organizationError } = useOrganization()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | Channel>('all')
  const [search, setSearch] = useState('')
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [changingHandler, setChangingHandler] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [reply, setReply] = useState('')

  const activeConversation = useMemo(
    () => conversations.find(item => item.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  )

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase()
    return conversations.filter(conversation => {
      if (filter !== 'all' && conversation.channel !== filter) return false
      if (!q) return true
      return [
        getConversationName(conversation),
        conversation.customer?.company ?? '',
        conversation.customer?.phone ?? '',
        conversation.subject ?? '',
      ].some(value => value.toLowerCase().includes(q))
    })
  }, [conversations, filter, search])

  const unreadTotal = useMemo(
    () => conversations.reduce((total, item) => total + Math.max(0, item.unread_count), 0),
    [conversations],
  )
  const openTotal = useMemo(() => conversations.filter(item => item.status === 'open').length, [conversations])
  const aiTotal = useMemo(() => conversations.filter(item => item.handled_by === 'ai').length, [conversations])

  const loadConversations = useCallback(async () => {
    if (!supabase || !organizationId) {
      setConversations([])
      setLoadingConversations(false)
      return
    }
    setLoadingConversations(true)
    setError(null)
    const { data, error: queryError } = await supabase
      .from('conversations')
      .select(`
        id, organization_id, customer_id, channel, handled_by,
        assigned_user_id, last_message_at, created_at, status,
        subject, unread_count, metadata, updated_at,
        customer:customers(id, name, company, phone, email)
      `)
      .eq('organization_id', organizationId)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (queryError) {
      setError(queryError.message)
      setConversations([])
      setLoadingConversations(false)
      return
    }

    const normalized = (data ?? []).map(normalizeConversation)
    setConversations(normalized)
    setActiveConversationId(current => current && normalized.some(item => item.id === current) ? current : normalized[0]?.id ?? null)
    setLoadingConversations(false)
  }, [organizationId])

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!supabase) return
    setLoadingMessages(true)
    setMessageError(null)
    const { data, error: queryError } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_type, content, created_at, metadata, read_at, delivered_at, external_id')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (queryError) {
      setMessageError(queryError.message)
      setMessages([])
    } else {
      setMessages((data ?? []) as Message[])
    }
    setLoadingMessages(false)
  }, [])

  const markConversationRead = useCallback(async (conversationId: string) => {
    if (!supabase) return
    const { error: rpcError } = await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId })
    if (rpcError) {
      console.error('mark_conversation_read failed:', rpcError)
      return
    }
    setConversations(current => current.map(item => item.id === conversationId ? { ...item, unread_count: 0 } : item))
  }, [])

  const setRyanState = useCallback(async (conversation: Conversation, handledBy: 'ai' | 'human') => {
    if (!supabase) return
    setChangingHandler(true)
    setMessageError(null)
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ handled_by: handledBy, updated_at: new Date().toISOString() })
      .eq('id', conversation.id)
      .eq('organization_id', organizationId)

    if (updateError) {
      setMessageError(`تعذر ${handledBy === 'human' ? 'إيقاف' : 'تشغيل'} Ryan: ${updateError.message}`)
    } else {
      setConversations(current => current.map(item => item.id === conversation.id ? { ...item, handled_by: handledBy } : item))
    }
    setChangingHandler(false)
  }, [organizationId])

  useEffect(() => {
    if (organizationId) void loadConversations()
  }, [organizationId, loadConversations])

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      return
    }
    void loadMessages(activeConversationId)
    void markConversationRead(activeConversationId)
  }, [activeConversationId, loadMessages, markConversationRead])

  useEffect(() => {
    if (!supabase || !organizationId) return
    const conversationsChannel = supabase
      .channel(`inbox-conversations-${organizationId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'conversations',
        filter: `organization_id=eq.${organizationId}`,
      }, payload => {
        if (payload.eventType === 'DELETE') {
          const deletedId = String(payload.old?.id ?? '')
          setConversations(current => current.filter(item => item.id !== deletedId))
          setActiveConversationId(current => current === deletedId ? null : current)
          return
        }
        const normalized = normalizeConversation(payload.new)
        setConversations(current => {
          const index = current.findIndex(item => item.id === normalized.id)
          if (index === -1) return [normalized, ...current]
          const next = [...current]
          next[index] = { ...next[index], ...normalized }
          return next.sort((a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime())
        })
      })
      .subscribe()
    return () => { void supabase.removeChannel(conversationsChannel) }
  }, [organizationId])

  useEffect(() => {
    if (!supabase || !organizationId) return
    const messagesChannel = supabase
      .channel(`inbox-messages-${organizationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const newMessage = payload.new as Message
        if (newMessage.conversation_id !== activeConversationId) return
        setMessages(current => current.some(item => item.id === newMessage.id) ? current : [...current, newMessage])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, payload => {
        const updated = payload.new as Message
        if (updated.conversation_id !== activeConversationId) return
        setMessages(current => current.map(item => item.id === updated.id ? { ...item, ...updated } : item))
      })
      .subscribe()
    return () => { void supabase.removeChannel(messagesChannel) }
  }, [organizationId, activeConversationId])

  const handleSend = async (event: FormEvent) => {
    event.preventDefault()
    const content = reply.trim()
    if (!content || !activeConversationId || !organizationId || !supabase) return
    if (!user?.id) {
      setMessageError('يجب تسجيل الدخول لإرسال الرسائل.')
      return
    }

    setSending(true)
    setMessageError(null)

    const { error: handlerError } = await supabase
      .from('conversations')
      .update({ handled_by: 'human', updated_at: new Date().toISOString() })
      .eq('id', activeConversationId)
      .eq('organization_id', organizationId)

    if (handlerError) {
      setMessageError(`تعذر تحويل المحادثة للموظف: ${handlerError.message}`)
      setSending(false)
      return
    }

    const { data, error: insertError } = await supabase
      .from('messages')
      .insert({
        conversation_id: activeConversationId,
        sender_type: 'agent',
        content,
        metadata: { source: 'inbox', sent_by: user.id },
      })
      .select('id, conversation_id, sender_type, content, created_at, metadata, read_at, delivered_at, external_id')
      .single()

    if (insertError) {
      setMessageError(insertError.message)
      setSending(false)
      return
    }

    if (data) setMessages(current => current.some(item => item.id === data.id) ? current : [...current, data as Message])
    setConversations(current => current.map(item => item.id === activeConversationId ? { ...item, handled_by: 'human' } : item))
    setReply('')
    setSending(false)
    void loadConversations()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (!sending && reply.trim()) event.currentTarget.form?.requestSubmit()
    }
  }

  if (organizationLoading) {
    return (
      <div dir="rtl" className="min-h-screen space-y-5 bg-sand-50 p-4 sm:p-6">
        <div className="h-8 w-40 animate-pulse rounded-xl bg-sand-100" />
        <Card className="h-[calc(100vh-180px)] min-h-[560px] overflow-hidden">
          <div className="grid h-full grid-cols-1 md:grid-cols-[320px_1fr]">
            <div className="space-y-4 border-e border-sand-100 p-4">
              <div className="h-11 animate-pulse rounded-xl bg-sand-100" />
              <div className="h-8 animate-pulse rounded-xl bg-sand-100" />
              <div className="h-20 animate-pulse rounded-2xl bg-sand-100" />
            </div>
            <div className="hidden items-center justify-center bg-sand-50/50 md:flex"><div className="h-24 w-52 animate-pulse rounded-2xl bg-sand-100" /></div>
          </div>
        </Card>
      </div>
    )
  }

  if (organizationError) {
    return (
      <Card className="flex min-h-[500px] items-center justify-center p-6">
        <div className="max-w-md text-center" role="alert">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">!</div>
          <div className="font-bold text-ink-950">تعذر تحميل صندوق الوارد</div>
          <div className="mt-2 text-sm text-red-600">{organizationError}</div>
        </div>
      </Card>
    )
  }

  if (!organizationId) {
    return (
      <Card className="flex min-h-[500px] items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sand-100 text-ink-700"><MessageSquareIcon /></div>
          <div className="font-bold text-ink-950">لا توجد شركة مرتبطة بهذا الحساب</div>
          <div className="mt-1 text-sm text-ink-900/50">أكمل إعداد الشركة أولًا للوصول إلى صندوق الوارد.</div>
        </div>
      </Card>
    )
  }

  return (
    <div dir="rtl" className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink-950 text-sand-50 shadow-sm"><MessageSquareIcon /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-950 md:text-3xl">صندوق الوارد</h1>
            <p className="mt-1 text-sm text-ink-900/50">إدارة محادثات العملاء من مكان واحد.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="min-w-[86px] rounded-2xl border border-sand-200 bg-white px-3 py-2.5"><div className="text-[11px] text-ink-900/45">المحادثات</div><div className="mt-0.5 text-lg font-bold text-ink-950">{conversations.length}</div></div>
          <div className="min-w-[86px] rounded-2xl border border-sand-200 bg-white px-3 py-2.5"><div className="text-[11px] text-ink-900/45">غير مقروء</div><div className="mt-0.5 text-lg font-bold text-ink-950">{unreadTotal > 99 ? '99+' : unreadTotal}</div></div>
          <div className="min-w-[86px] rounded-2xl border border-sand-200 bg-white px-3 py-2.5"><div className="text-[11px] text-ink-900/45">Ryan AI</div><div className="mt-0.5 text-lg font-bold text-ink-950">{aiTotal}</div></div>
        </div>
      </div>

      <Card className="overflow-hidden border-sand-200 shadow-sm">
        <div className="grid h-[calc(100vh-255px)] min-h-[610px] grid-cols-1 lg:grid-cols-[350px_1fr]">
          <aside className="flex min-h-0 flex-col border-b border-sand-100 bg-white lg:border-b-0 lg:border-e">
            <div className="space-y-3 border-b border-sand-100 p-4">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-900/35"><SearchIcon /></div>
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث في المحادثات..." aria-label="البحث في المحادثات" className="w-full rounded-xl border border-sand-200 bg-sand-50/60 py-2.5 pl-4 pr-10 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:bg-white focus:ring-2 focus:ring-ink-900/5" />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {channelFilters.map(channel => (
                  <button key={channel.value} type="button" onClick={() => setFilter(channel.value)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === channel.value ? 'bg-ink-950 text-sand-50 shadow-sm' : 'bg-sand-100 text-ink-900/60 hover:bg-sand-200 hover:text-ink-950'}`}>{channel.label}</button>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1"><span className="text-xs text-ink-900/40">{filteredConversations.length} محادثة</span><span className="text-xs text-ink-900/40">{openTotal} مفتوحة</span></div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingConversations ? (
                <div className="space-y-3 p-4">{[1,2,3,4,5].map(item => <div key={item} className="flex gap-3 rounded-2xl p-3"><div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-sand-100" /><div className="flex-1 space-y-2"><div className="h-3.5 w-2/3 animate-pulse rounded bg-sand-100" /><div className="h-3 w-full animate-pulse rounded bg-sand-100" /></div></div>)}</div>
              ) : error ? (
                <div className="p-8 text-center"><div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">!</div><div className="text-sm font-semibold text-ink-950" role="alert">تعذر تحميل المحادثات</div><div className="mt-1 break-words text-xs text-red-600">{error}</div><button type="button" onClick={() => void loadConversations()} className="mt-4 rounded-xl bg-ink-950 px-4 py-2 text-xs font-semibold text-sand-50">إعادة المحاولة</button></div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sand-100 text-ink-700"><MessageSquareIcon /></div><div className="text-sm font-bold text-ink-950">لا توجد محادثات</div><div className="mt-1 text-xs leading-5 text-ink-900/45">ستظهر المحادثات هنا عند وصولها.</div></div>
              ) : (
                filteredConversations.map(conversation => {
                  const name = getConversationName(conversation)
                  const active = activeConversationId === conversation.id
                  return (
                    <button key={conversation.id} type="button" onClick={() => { setActiveConversationId(conversation.id); setMessageError(null); setReply('') }} className={`w-full border-b border-sand-100 p-4 text-right transition ${active ? 'bg-sand-100/80' : 'hover:bg-sand-50'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-bold ${active ? 'bg-ink-950 text-sand-50' : 'bg-sand-100 text-ink-800'}`}>{getInitials(name)}{conversation.unread_count > 0 && <span className="absolute -left-1 -top-1 h-4 w-4 rounded-full border-2 border-white bg-amber-500" />}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold text-ink-950">{name}</span><span className="shrink-0 text-[10px] text-ink-900/40">{formatTime(conversation.last_message_at)}</span></div>
                          {conversation.customer?.company && <div className="mt-0.5 truncate text-[11px] text-ink-900/40">{conversation.customer.company}</div>}
                          <div className="mt-1.5 flex items-center justify-between gap-2"><span className="truncate text-xs text-ink-900/50">{conversation.subject || 'محادثة'}</span>{conversation.unread_count > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-ink-950 px-1.5 text-[10px] font-bold text-sand-50">{conversation.unread_count > 99 ? '99+' : conversation.unread_count}</span>}</div>
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5"><span className="inline-flex items-center gap-1 rounded-lg bg-sand-100 px-2 py-1 text-[10px] font-semibold text-ink-900/60"><ChannelIcon channel={conversation.channel} className="w-3 h-3" />{channelLabels[conversation.channel]}</span>{conversation.handled_by === 'ai' ? <Badge tone="gold">RYAN AI</Badge> : <Badge tone="success">موظف</Badge>}<Badge>{statusLabels[conversation.status]}</Badge></div>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col bg-sand-50/40">
            {!activeConversation ? (
              <div className="flex flex-1 items-center justify-center p-6"><div className="max-w-sm text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-sand-200 bg-white text-ink-700 shadow-sm"><MessageSquareIcon /></div><div className="font-bold text-ink-950">صندوق المحادثات</div><div className="mt-1.5 text-sm leading-6 text-ink-900/45">اختر محادثة من القائمة لعرض الرسائل والرد على العميل.</div></div></div>
            ) : (
              <>
                <header className="flex items-center justify-between gap-3 border-b border-sand-100 bg-white p-4 md:px-5">
                  <div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink-950 text-xs font-bold text-sand-50">{getInitials(getConversationName(activeConversation))}</div><div className="min-w-0"><div className="truncate font-bold text-ink-950">{getConversationName(activeConversation)}</div><div className="mt-1 flex items-center gap-1.5 text-xs text-ink-900/45"><ChannelIcon channel={activeConversation.channel} className="w-3.5 h-3.5" /><span>{channelLabels[activeConversation.channel]}</span><span>·</span><span>{activeConversation.handled_by === 'ai' ? 'RYAN AI' : 'موظف'}</span></div></div></div>
                  <div className="flex shrink-0 items-center gap-2"><Badge>{statusLabels[activeConversation.status]}</Badge><button type="button" onClick={() => void setRyanState(activeConversation, activeConversation.handled_by === 'ai' ? 'human' : 'ai')} disabled={changingHandler} className={`min-h-10 rounded-xl px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${activeConversation.handled_by === 'ai' ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'}`} title={activeConversation.handled_by === 'ai' ? 'إيقاف Ryan عن الرد على هذه المحادثة' : 'إعادة Ryan للرد على هذه المحادثة'}>{changingHandler ? 'جاري...' : activeConversation.handled_by === 'ai' ? 'إيقاف Ryan' : 'تشغيل Ryan'}</button></div>
                </header>

                {activeConversation.handled_by === 'human' && <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 md:px-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-bold text-amber-900">Ryan متوقف عن الرد</div><div className="mt-0.5 text-xs leading-5 text-amber-800/70">المحادثة الآن تحت متابعة الموظف، ويمكن إعادة Ryan في أي وقت.</div></div><span className="text-xs font-bold text-amber-800">تحكم يدوي</span></div></div>}

                <div className="flex-1 space-y-3 overflow-y-auto p-4 md:p-6">
                  {loadingMessages ? (
                    <div className="mx-auto w-full max-w-md space-y-4 pt-8"><div className="flex justify-start"><div className="h-16 w-48 animate-pulse rounded-2xl border border-sand-200 bg-white" /></div><div className="flex justify-end"><div className="h-20 w-64 animate-pulse rounded-2xl bg-ink-900/10" /></div></div>
                  ) : messageError && messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center"><div className="max-w-sm text-center" role="alert"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">!</div><div className="text-sm font-semibold text-ink-950">تعذر تحميل الرسائل</div><div className="mt-1 break-words text-xs text-red-600">{messageError}</div><button type="button" onClick={() => void loadMessages(activeConversation.id)} className="mt-4 rounded-xl bg-ink-950 px-4 py-2 text-xs font-semibold text-sand-50">إعادة المحاولة</button></div></div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center"><div className="max-w-sm text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-sand-200 bg-white text-ink-700"><MessageSquareIcon /></div><div className="text-sm font-bold text-ink-950">لا توجد رسائل بعد</div><div className="mt-1.5 text-xs text-ink-900/45">ابدأ المحادثة من مربع الرد بالأسفل.</div></div></div>
                  ) : (
                    messages.map(message => {
                      const isCustomer = message.sender_type === 'customer'
                      const isAI = message.sender_type === 'ai'
                      return (
                        <div key={message.id} className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[88%] md:max-w-lg ${isCustomer ? 'rounded-2xl rounded-tr-sm border border-sand-200 bg-white text-ink-900 shadow-sm' : isAI ? 'rounded-2xl rounded-tl-sm border border-amber-200 bg-amber-50 text-ink-900' : 'rounded-2xl rounded-tl-sm bg-ink-950 text-sand-50 shadow-sm'} p-3.5 md:p-4`}>
                            {!isCustomer && <div className={`mb-1.5 text-[10px] font-bold ${isAI ? 'text-amber-700' : 'text-sand-50/55'}`}>{isAI ? 'RYAN AI' : 'فريق Dragon Media'}</div>}
                            <div className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</div>
                            <div className={`mt-2 flex items-center justify-between gap-3 text-[10px] ${isCustomer ? 'text-ink-900/35' : isAI ? 'text-ink-900/40' : 'text-sand-50/50'}`}>
                              <span>{formatDateTime(message.created_at)}</span>
                              <MessageDeliveryStatus message={message} />
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                  {messageError && messages.length > 0 && <div className="text-center text-xs text-red-600" role="alert">{messageError}</div>}
                </div>

                <form onSubmit={handleSend} className="border-t border-sand-100 bg-white p-3 md:p-4">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={reply}
                      onChange={event => setReply(event.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={sending}
                      rows={1}
                      placeholder={activeConversation.handled_by === 'human' ? 'اكتب رد الموظف هنا...' : 'اكتب ردك هنا...'}
                      aria-label="اكتب ردك هنا"
                      className="min-h-[48px] max-h-32 flex-1 resize-none rounded-2xl border border-sand-200 bg-sand-50/60 px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:bg-white focus:ring-2 focus:ring-ink-900/5 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <button type="submit" disabled={sending || !reply.trim()} className="inline-flex h-12 min-w-[94px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-ink-950 px-4 text-sm font-bold text-sand-50 shadow-sm transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40"><SendIcon />{sending ? 'جاري الإرسال...' : 'إرسال'}</button>
                  </div>
                  <div className="mt-2 px-1 text-[10px] text-ink-900/35">إرسال رد يدوي يحول التحكم للموظف ويوقف Ryan عن الرد على هذه المحادثة.</div>
                </form>
              </>
            )}
          </section>
        </div>
      </Card>
    </div>
  )
}
