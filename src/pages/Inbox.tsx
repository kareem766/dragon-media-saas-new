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

const channelFilters: Array<{
  label: string
  value: 'all' | Channel
}> = [
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
    | undefined
) {
  if (!customer) return null

  if (Array.isArray(customer)) {
    return customer[0] ?? null
  }

  return customer
}

function normalizeConversation(row: any): Conversation {
  return {
    id: row.id,
    organization_id: row.organization_id,
    customer_id: row.customer_id ?? null,
    channel: row.channel,
    handled_by: row.handled_by,
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

  return date.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  })
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

  if (parts.length === 0) return '؟'

  if (parts.length === 1) {
    return parts[0].slice(0, 2)
  }

  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`
}

function ChannelIcon({
  channel,
  className = 'w-4 h-4',
}: {
  channel: Channel
  className?: string
}) {
  if (channel === 'whatsapp') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={className}
        aria-hidden="true"
      >
        <path
          d="M20.1 3.9A9.9 9.9 0 0 0 12.05 1C6.6 1 2.17 5.42 2.17 10.87c0 1.73.45 3.42 1.31 4.91L2 22l6.36-1.66a9.87 9.87 0 0 0 3.69.72h.01c5.45 0 9.87-4.43 9.87-9.88a9.82 9.82 0 0 0-1.83-5.28Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M8.55 7.35c.18-.4.38-.41.69-.42h.58c.18 0 .39.07.5.34l.76 1.83c.09.22.06.4-.08.58l-.47.61c-.14.18-.28.31-.12.58.17.28.73 1.2 1.58 1.95.95.84 1.75 1.1 2.02 1.22.28.12.44.1.61-.08l.68-.79c.17-.2.34-.16.58-.09l1.74.82c.24.12.4.18.46.29.06.11.06.65-.15 1.25-.21.6-1.03 1.16-1.43 1.23-.37.07-.84.1-1.36-.07-.31-.1-.7-.23-1.21-.45-.5-.22-2.96-1.23-4.92-3.91-1.52-2.08-1.75-3.63-1.75-4.02 0-.39.13-.78.27-1.07Z"
          fill="currentColor"
        />
      </svg>
    )
  }

  if (channel === 'instagram') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={className}
        aria-hidden="true"
      >
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="5"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <circle
          cx="12"
          cy="12"
          r="4"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <circle cx="17.4" cy="6.7" r="1" fill="currentColor" />
      </svg>
    )
  }

  if (channel === 'messenger') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={className}
        aria-hidden="true"
      >
        <path
          d="M12 3.2c-5.3 0-9.2 3.76-9.2 8.56 0 2.7 1.24 5.08 3.25 6.67v3.15l3-1.65c.92.25 1.9.39 2.95.39 5.3 0 9.2-3.76 9.2-8.56S17.3 3.2 12 3.2Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="m7.55 13.05 2.9-3.08 2.13 1.64 3.91-2.1-2.9 3.08-2.13-1.64-3.91 2.1Z"
          fill="currentColor"
        />
      </svg>
    )
  }

  if (channel === 'telegram') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={className}
        aria-hidden="true"
      >
        <path
          d="m21 4-3.1 15.1c-.23 1.07-.86 1.34-1.75.84l-4.84-3.57-2.34 2.25c-.26.26-.48.48-.99.48l.35-4.94 8.99-8.12c.39-.35-.09-.54-.6-.19L5.6 12.85.84 11.36c-1.04-.32-1.06-1.04.22-1.54L19.67 2.7C20.56 2.38 21.33 2.91 21 4Z"
          fill="currentColor"
        />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5v-13Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M7 7h10M7 11h7M7 15h5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <circle
        cx="11"
        cy="11"
        r="6.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="m16 16 4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path
        d="M21 3 10.5 13.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="m21 3-6.7 17-3.8-6.5L4 9.7 21 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MessageSquareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="w-6 h-6"
      aria-hidden="true"
    >
      <path
        d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 2v-4.25A7.46 7.46 0 0 1 4.5 7.5 7.5 7.5 0 0 1 12 4h.5A7.5 7.5 0 0 1 20 11.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M8 11.5h8M8 15h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function Inbox() {
  const { user } = useAuth()

  const {
    organizationId,
    loading: organizationLoading,
    error: organizationError,
  } = useOrganization()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [activeConversationId, setActiveConversationId] =
    useState<string | null>(null)

  const [filter, setFilter] = useState<'all' | Channel>('all')
  const [search, setSearch] = useState('')

  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [messageError, setMessageError] = useState<string | null>(null)

  const [reply, setReply] = useState('')

  const activeConversation = useMemo(
    () =>
      conversations.find(
        conversation => conversation.id === activeConversationId
      ) ?? null,
    [conversations, activeConversationId]
  )

  const filteredConversations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return conversations.filter(conversation => {
      const matchesChannel =
        filter === 'all' || conversation.channel === filter

      if (!matchesChannel) return false

      if (!normalizedSearch) return true

      const customerName =
        getConversationName(conversation).toLowerCase()
      const company =
        conversation.customer?.company?.toLowerCase() ?? ''
      const phone =
        conversation.customer?.phone?.toLowerCase() ?? ''
      const subject =
        conversation.subject?.toLowerCase() ?? ''

      return (
        customerName.includes(normalizedSearch) ||
        company.includes(normalizedSearch) ||
        phone.includes(normalizedSearch) ||
        subject.includes(normalizedSearch)
      )
    })
  }, [conversations, filter, search])

  const unreadTotal = useMemo(
    () =>
      conversations.reduce(
        (total, conversation) =>
          total + Math.max(0, conversation.unread_count),
        0
      ),
    [conversations]
  )

  const openTotal = useMemo(
    () =>
      conversations.filter(
        conversation => conversation.status === 'open'
      ).length,
    [conversations]
  )

  const aiTotal = useMemo(
    () =>
      conversations.filter(
        conversation => conversation.handled_by === 'ai'
      ).length,
    [conversations]
  )

  const loadConversations = useCallback(async () => {
    const client = supabase

    if (!client || !organizationId) {
      setConversations([])
      setLoadingConversations(false)
      return
    }

    setLoadingConversations(true)
    setError(null)

    const { data, error: queryError } = await client
      .from('conversations')
      .select(`
        id,
        organization_id,
        customer_id,
        channel,
        handled_by,
        assigned_user_id,
        last_message_at,
        created_at,
        status,
        subject,
        unread_count,
        metadata,
        updated_at,
        customer:customers(
          id,
          name,
          company,
          phone,
          email
        )
      `)
      .eq('organization_id', organizationId)
      .order('last_message_at', {
        ascending: false,
        nullsFirst: false,
      })

    if (queryError) {
      setError(queryError.message)
      setConversations([])
      setLoadingConversations(false)
      return
    }

    const normalized = (data ?? []).map(normalizeConversation)

    setConversations(normalized)

    setActiveConversationId(current => {
      if (
        current &&
        normalized.some(item => item.id === current)
      ) {
        return current
      }

      return normalized[0]?.id ?? null
    })

    setLoadingConversations(false)
  }, [organizationId])

  const loadMessages = useCallback(
    async (conversationId: string) => {
      const client = supabase

      if (!client) return

      setLoadingMessages(true)
      setMessageError(null)

      const { data, error: queryError } = await client
        .from('messages')
        .select(`
          id,
          conversation_id,
          sender_type,
          content,
          created_at,
          metadata,
          read_at,
          delivered_at,
          external_id
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', {
          ascending: true,
        })

      if (queryError) {
        setMessageError(queryError.message)
        setMessages([])
        setLoadingMessages(false)
        return
      }

      setMessages((data ?? []) as Message[])
      setLoadingMessages(false)
    },
    []
  )

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      const client = supabase

      if (!client) return

      const { error: rpcError } = await client.rpc(
        'mark_conversation_read',
        {
          p_conversation_id: conversationId,
        }
      )

      if (rpcError) {
        console.error(
          'mark_conversation_read failed:',
          rpcError
        )
        return
      }

      setConversations(current =>
        current.map(conversation =>
          conversation.id === conversationId
            ? {
                ...conversation,
                unread_count: 0,
              }
            : conversation
        )
      )

      setMessages(current =>
        current.map(message =>
          message.sender_type === 'customer' &&
          !message.read_at
            ? {
                ...message,
                read_at: new Date().toISOString(),
              }
            : message
        )
      )
    },
    []
  )

  useEffect(() => {
    if (!organizationId) return

    loadConversations()
  }, [organizationId, loadConversations])

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      return
    }

    loadMessages(activeConversationId)
    markConversationRead(activeConversationId)
  }, [
    activeConversationId,
    loadMessages,
    markConversationRead,
  ])

  useEffect(() => {
    const client = supabase

    if (!client || !organizationId) return

    const conversationsChannel = client
      .channel(`inbox-conversations-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `organization_id=eq.${organizationId}`,
        },
        payload => {
          if (payload.eventType === 'DELETE') {
            const deletedId = String(payload.old?.id ?? '')

            setConversations(current =>
              current.filter(
                conversation =>
                  conversation.id !== deletedId
              )
            )

            setActiveConversationId(current =>
              current === deletedId ? null : current
            )

            return
          }

          const normalized = normalizeConversation(
            payload.new
          )

          setConversations(current => {
            const existingIndex = current.findIndex(
              conversation =>
                conversation.id === normalized.id
            )

            if (existingIndex === -1) {
              return [normalized, ...current]
            }

            const next = [...current]

            next[existingIndex] = {
              ...next[existingIndex],
              ...normalized,
            }

            return next.sort((a, b) => {
              const aTime = a.last_message_at
                ? new Date(a.last_message_at).getTime()
                : 0

              const bTime = b.last_message_at
                ? new Date(b.last_message_at).getTime()
                : 0

              return bTime - aTime
            })
          })
        }
      )
      .subscribe()

    return () => {
      client.removeChannel(conversationsChannel)
    }
  }, [organizationId])

  useEffect(() => {
    const client = supabase

    if (!client || !organizationId) return

    const messagesChannel = client
      .channel(`inbox-messages-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        payload => {
          const newMessage = payload.new as Message

          if (
            newMessage.conversation_id ===
            activeConversationId
          ) {
            setMessages(current => {
              if (
                current.some(
                  message => message.id === newMessage.id
                )
              ) {
                return current
              }

              return [...current, newMessage]
            })

            if (newMessage.sender_type === 'customer') {
              markConversationRead(
                newMessage.conversation_id
              )
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        payload => {
          const updatedMessage = payload.new as Message

          if (
            updatedMessage.conversation_id !==
            activeConversationId
          ) {
            return
          }

          setMessages(current =>
            current.map(message =>
              message.id === updatedMessage.id
                ? {
                    ...message,
                    ...updatedMessage,
                  }
                : message
            )
          )
        }
      )
      .subscribe()

    return () => {
      client.removeChannel(messagesChannel)
    }
  }, [
    organizationId,
    activeConversationId,
    markConversationRead,
  ])

  const handleSelectConversation = (
    conversationId: string
  ) => {
    setActiveConversationId(conversationId)
    setMessageError(null)
    setReply('')
  }

  const handleSend = async (event: FormEvent) => {
    event.preventDefault()

    const content = reply.trim()

    if (
      !content ||
      !activeConversationId ||
      !organizationId ||
      !supabase
    ) {
      return
    }

    if (!user?.id) {
      setMessageError(
        'يجب تسجيل الدخول لإرسال الرسائل.'
      )
      return
    }

    setSending(true)
    setMessageError(null)

    const client = supabase

    const { data, error: insertError } = await client
      .from('messages')
      .insert({
        conversation_id: activeConversationId,
        sender_type: 'agent',
        content,
        metadata: {
          source: 'inbox',
          sent_by: user.id,
        },
      })
      .select(`
        id,
        conversation_id,
        sender_type,
        content,
        created_at,
        metadata,
        read_at,
        delivered_at,
        external_id
      `)
      .single()

    if (insertError) {
      setMessageError(insertError.message)
      setSending(false)
      return
    }

    if (data) {
      setMessages(current => {
        if (
          current.some(message => message.id === data.id)
        ) {
          return current
        }

        return [...current, data as Message]
      })
    }

    setReply('')
    setSending(false)

    await loadConversations()
  }

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()

      if (!sending && reply.trim()) {
        event.currentTarget.form?.requestSubmit()
      }
    }
  }

  if (organizationLoading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-40 rounded-xl bg-sand-100 animate-pulse" />
        <Card className="h-[calc(100vh-180px)] min-h-[560px] overflow-hidden">
          <div className="grid h-full grid-cols-1 md:grid-cols-[320px_1fr]">
            <div className="border-e border-sand-100 p-4 space-y-4">
              <div className="h-11 rounded-xl bg-sand-100 animate-pulse" />
              <div className="h-8 rounded-xl bg-sand-100 animate-pulse" />
              <div className="h-20 rounded-2xl bg-sand-100 animate-pulse" />
              <div className="h-20 rounded-2xl bg-sand-100 animate-pulse" />
              <div className="h-20 rounded-2xl bg-sand-100 animate-pulse" />
            </div>
            <div className="hidden md:flex items-center justify-center bg-sand-50/50">
              <div className="h-24 w-52 rounded-2xl bg-sand-100 animate-pulse" />
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (organizationError) {
    return (
      <Card className="min-h-[500px] flex items-center justify-center p-6">
        <div
          className="text-center max-w-md"
          role="alert"
        >
          <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-6 h-6"
              aria-hidden="true"
            >
              <path
                d="M12 8v5M12 16.5v.1"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="1.7"
              />
            </svg>
          </div>

          <div className="font-bold text-ink-950">
            تعذر تحميل صندوق الوارد
          </div>

          <div className="text-sm text-red-600 mt-2">
            {organizationError}
          </div>
        </div>
      </Card>
    )
  }

  if (!organizationId) {
    return (
      <Card className="min-h-[500px] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-sand-100 text-ink-700 flex items-center justify-center">
            <MessageSquareIcon />
          </div>

          <div className="font-bold text-ink-950">
            لا توجد شركة مرتبطة بهذا الحساب
          </div>

          <div className="text-sm text-ink-900/50 mt-1">
            أكمل إعداد الشركة أولًا للوصول إلى صندوق الوارد.
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-ink-950 text-sand-50 flex items-center justify-center shadow-sm">
              <MessageSquareIcon />
            </div>

            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink-950">
                صندوق الوارد
              </h1>
              <p className="text-sm text-ink-900/50 mt-1">
                إدارة محادثات العملاء من مكان واحد.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-2xl border border-sand-200 bg-white px-3 py-2.5 min-w-[86px]">
            <div className="text-[11px] text-ink-900/45">
              المحادثات
            </div>
            <div className="text-lg font-bold text-ink-950 mt-0.5">
              {conversations.length}
            </div>
          </div>

          <div className="rounded-2xl border border-sand-200 bg-white px-3 py-2.5 min-w-[86px]">
            <div className="text-[11px] text-ink-900/45">
              غير مقروء
            </div>
            <div className="text-lg font-bold text-ink-950 mt-0.5">
              {unreadTotal > 99 ? '99+' : unreadTotal}
            </div>
          </div>

          <div className="rounded-2xl border border-sand-200 bg-white px-3 py-2.5 min-w-[86px]">
            <div className="text-[11px] text-ink-900/45">
              Ryan AI
            </div>
            <div className="text-lg font-bold text-ink-950 mt-0.5">
              {aiTotal}
            </div>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden border-sand-200 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] h-[calc(100vh-255px)] min-h-[610px]">
          <aside className="border-b lg:border-b-0 lg:border-e border-sand-100 flex flex-col min-h-0 bg-white">
            <div className="p-4 border-b border-sand-100 space-y-3">
              <div className="relative">
                <div className="absolute inset-y-0 right-3 flex items-center text-ink-900/35 pointer-events-none">
                  <SearchIcon />
                </div>

                <input
                  value={search}
                  onChange={event =>
                    setSearch(event.target.value)
                  }
                  placeholder="ابحث في المحادثات..."
                  aria-label="البحث في المحادثات"
                  className="w-full border border-sand-200 rounded-xl bg-sand-50/60 pr-10 pl-4 py-2.5 text-sm text-ink-950 placeholder:text-ink-900/35 outline-none transition focus:bg-white focus:border-ink-700 focus:ring-2 focus:ring-ink-900/5"
                />
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {channelFilters.map(channel => (
                  <button
                    key={channel.value}
                    type="button"
                    onClick={() =>
                      setFilter(channel.value)
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                      filter === channel.value
                        ? 'bg-ink-950 text-sand-50 shadow-sm'
                        : 'bg-sand-100 text-ink-900/60 hover:bg-sand-200 hover:text-ink-950'
                    }`}
                  >
                    {channel.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-ink-900/40">
                  {filteredConversations.length} محادثة
                </span>

                <span className="text-xs text-ink-900/40">
                  {openTotal} مفتوحة
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingConversations ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4, 5].map(item => (
                    <div
                      key={item}
                      className="flex gap-3 p-3 rounded-2xl"
                    >
                      <div className="w-10 h-10 rounded-full bg-sand-100 animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-2/3 bg-sand-100 rounded animate-pulse" />
                        <div className="h-3 w-full bg-sand-100 rounded animate-pulse" />
                        <div className="h-3 w-1/2 bg-sand-100 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="p-8 text-center">
                  <div className="mx-auto mb-3 w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="w-5 h-5"
                      aria-hidden="true"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      />
                      <path
                        d="M12 8v5M12 16.5v.1"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  <div
                    className="text-sm font-semibold text-ink-950"
                    role="alert"
                  >
                    تعذر تحميل المحادثات
                  </div>

                  <div className="text-xs text-red-600 mt-1 break-words">
                    {error}
                  </div>

                  <button
                    type="button"
                    onClick={loadConversations}
                    className="mt-4 px-4 py-2 rounded-xl bg-ink-950 text-sand-50 text-xs font-semibold hover:bg-ink-800 transition"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-sand-100 text-ink-700 flex items-center justify-center">
                    <MessageSquareIcon />
                  </div>

                  <div className="font-bold text-sm text-ink-950">
                    لا توجد محادثات
                  </div>

                  <div className="text-xs text-ink-900/45 mt-1 leading-5">
                    ستظهر المحادثات هنا عند وصولها.
                  </div>
                </div>
              ) : (
                filteredConversations.map(conversation => {
                  const name =
                    getConversationName(conversation)

                  const active =
                    activeConversationId === conversation.id

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() =>
                        handleSelectConversation(
                          conversation.id
                        )
                      }
                      className={`w-full text-right p-4 border-b border-sand-100 transition-all ${
                        active
                          ? 'bg-sand-100/80'
                          : 'hover:bg-sand-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`relative w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center text-xs font-bold ${
                            active
                              ? 'bg-ink-950 text-sand-50'
                              : 'bg-sand-100 text-ink-800'
                          }`}
                        >
                          {getInitials(name)}

                          {conversation.unread_count > 0 && (
                            <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-amber-500 border-2 border-white" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-ink-950 truncate">
                              {name}
                            </span>

                            <span className="text-[10px] text-ink-900/40 shrink-0">
                              {formatTime(
                                conversation.last_message_at
                              )}
                            </span>
                          </div>

                          {conversation.customer?.company && (
                            <div className="text-[11px] text-ink-900/40 mt-0.5 truncate">
                              {conversation.customer.company}
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2 mt-1.5">
                            <span className="text-xs text-ink-900/50 truncate">
                              {conversation.subject ||
                                'محادثة'}
                            </span>

                            {conversation.unread_count > 0 && (
                              <span className="min-w-5 h-5 px-1.5 rounded-full bg-ink-950 text-sand-50 text-[10px] font-bold flex items-center justify-center shrink-0">
                                {conversation.unread_count >
                                99
                                  ? '99+'
                                  : conversation.unread_count}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sand-100 text-[10px] font-semibold text-ink-900/60">
                              <ChannelIcon
                                channel={conversation.channel}
                                className="w-3 h-3"
                              />
                              {
                                channelLabels[
                                  conversation.channel
                                ]
                              }
                            </span>

                            {conversation.handled_by ===
                              'ai' && (
                              <Badge tone="gold">
                                RYAN AI
                              </Badge>
                            )}

                            <Badge>
                              {
                                statusLabels[
                                  conversation.status
                                ]
                              }
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </aside>

          <section className="flex flex-col min-w-0 min-h-0 bg-sand-50/40">
            {!activeConversation ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                  <div className="mx-auto mb-4 w-16 h-16 rounded-3xl bg-white border border-sand-200 text-ink-700 flex items-center justify-center shadow-sm">
                    <MessageSquareIcon />
                  </div>

                  <div className="font-bold text-ink-950">
                    صندوق المحادثات
                  </div>

                  <div className="text-sm text-ink-900/45 mt-1.5 leading-6">
                    اختر محادثة من القائمة لعرض الرسائل
                    والرد على العميل.
                  </div>
                </div>
              </div>
            ) : (
              <>
                <header className="p-4 md:px-5 border-b border-sand-100 bg-white flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 shrink-0 rounded-2xl bg-ink-950 text-sand-50 flex items-center justify-center text-xs font-bold">
                      {getInitials(
                        getConversationName(
                          activeConversation
                        )
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-bold text-ink-950 truncate">
                        {getConversationName(
                          activeConversation
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-ink-900/45 mt-1">
                        <ChannelIcon
                          channel={
                            activeConversation.channel
                          }
                          className="w-3.5 h-3.5"
                        />
                        <span>
                          {
                            channelLabels[
                              activeConversation.channel
                            ]
                          }
                        </span>
                        <span>·</span>
                        <span>
                          {activeConversation.handled_by ===
                          'ai'
                            ? 'RYAN AI'
                            : 'موظف'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge>
                      {
                        statusLabels[
                          activeConversation.status
                        ]
                      }
                    </Badge>
                  </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
                  {loadingMessages ? (
                    <div className="max-w-md mx-auto w-full pt-8 space-y-4">
                      <div className="flex justify-start">
                        <div className="w-48 h-16 rounded-2xl bg-white border border-sand-200 animate-pulse" />
                      </div>
                      <div className="flex justify-end">
                        <div className="w-64 h-20 rounded-2xl bg-ink-900/10 animate-pulse" />
                      </div>
                      <div className="flex justify-start">
                        <div className="w-56 h-16 rounded-2xl bg-white border border-sand-200 animate-pulse" />
                      </div>
                    </div>
                  ) : messageError &&
                    messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <div
                        className="text-center max-w-sm"
                        role="alert"
                      >
                        <div className="mx-auto mb-3 w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            className="w-5 h-5"
                            aria-hidden="true"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="9"
                              stroke="currentColor"
                              strokeWidth="1.7"
                            />
                            <path
                              d="M12 8v5M12 16.5v.1"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>

                        <div className="font-semibold text-sm text-ink-950">
                          تعذر تحميل الرسائل
                        </div>

                        <div className="text-xs text-red-600 mt-1 break-words">
                          {messageError}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            loadMessages(
                              activeConversation.id
                            )
                          }
                          className="mt-4 px-4 py-2 rounded-xl bg-ink-950 text-sand-50 text-xs font-semibold hover:bg-ink-800 transition"
                        >
                          إعادة المحاولة
                        </button>
                      </div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center max-w-sm">
                        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-white border border-sand-200 text-ink-700 flex items-center justify-center">
                          <MessageSquareIcon />
                        </div>

                        <div className="font-bold text-sm text-ink-950">
                          لا توجد رسائل بعد
                        </div>

                        <div className="text-xs text-ink-900/45 mt-1.5">
                          ابدأ المحادثة من مربع الرد بالأسفل.
                        </div>
                      </div>
                    </div>
                  ) : (
                    messages.map(message => {
                      const isCustomer =
                        message.sender_type ===
                        'customer'

                      const isAI =
                        message.sender_type === 'ai'

                      return (
                        <div
                          key={message.id}
                          className={`flex ${
                            isCustomer
                              ? 'justify-start'
                              : 'justify-end'
                          }`}
                        >
                          <div
                            className={`max-w-[88%] md:max-w-lg ${
                              isCustomer
                                ? 'bg-white border border-sand-200 text-ink-900 rounded-2xl rounded-tr-sm shadow-sm'
                                : isAI
                                  ? 'bg-amber-50 border border-amber-200 text-ink-900 rounded-2xl rounded-tl-sm'
                                  : 'bg-ink-950 text-sand-50 rounded-2xl rounded-tl-sm shadow-sm'
                            } p-3.5 md:p-4`}
                          >
                            {!isCustomer && (
                              <div
                                className={`text-[10px] font-bold mb-1.5 ${
                                  isAI
                                    ? 'text-amber-700'
                                    : 'text-sand-50/55'
                                }`}
                              >
                                {isAI
                                  ? 'RYAN AI'
                                  : 'فريق Dragon Media'}
                              </div>
                            )}

                            <div className="text-sm whitespace-pre-wrap break-words leading-6">
                              {message.content}
                            </div>

                            <div
                              className={`text-[10px] mt-2 ${
                                isCustomer
                                  ? 'text-ink-900/35'
                                  : isAI
                                    ? 'text-ink-900/40'
                                    : 'text-sand-50/50'
                              }`}
                            >
                              {formatDateTime(
                                message.created_at
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}

                  {messageError &&
                    messages.length > 0 && (
                      <div
                        className="text-center text-xs text-red-600"
                        role="alert"
                      >
                        {messageError}
                      </div>
                    )}
                </div>

                <form
                  onSubmit={handleSend}
                  className="p-3 md:p-4 border-t border-sand-100 bg-white"
                >
                  <div className="flex items-end gap-2">
                    <textarea
                      value={reply}
                      onChange={event =>
                        setReply(event.target.value)
                      }
                      onKeyDown={handleKeyDown}
                      disabled={sending}
                      rows={1}
                      placeholder="اكتب ردك هنا..."
                      aria-label="اكتب ردك هنا"
                      className="flex-1 resize-none border border-sand-200 rounded-2xl bg-sand-50/60 px-4 py-3 text-sm text-ink-950 placeholder:text-ink-900/35 outline-none transition focus:bg-white focus:border-ink-700 focus:ring-2 focus:ring-ink-900/5 disabled:opacity-60 min-h-[48px] max-h-32"
                    />

                    <button
                      type="submit"
                      disabled={
                        sending || !reply.trim()
                      }
                      className="h-12 min-w-[94px] px-4 rounded-2xl bg-ink-950 text-sand-50 text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink-800 transition-all shadow-sm"
                    >
                      <SendIcon />
                      <span>
                        {sending
                          ? 'جاري الإرسال...'
                          : 'إرسال'}
                      </span>
                    </button>
                  </div>

                  <div className="text-[10px] text-ink-900/35 mt-2 px-1">
                    Enter للإرسال · Shift + Enter لسطر جديد
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      </Card>
    </div>
  )
}
