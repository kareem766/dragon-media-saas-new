import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Badge } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { useOrganization } from '../lib/useOrganization'

type Channel = 'whatsapp' | 'messenger' | 'instagram' | 'telegram' | 'website'

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

function normalizeCustomer(customer: Conversation['customer']): Conversation['customer'] {
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

  if (parts.length === 1) return parts[0].slice(0, 2)

  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`
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
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)

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

      const customerName = getConversationName(conversation).toLowerCase()
      const company = conversation.customer?.company?.toLowerCase() ?? ''
      const phone = conversation.customer?.phone?.toLowerCase() ?? ''
      const subject = conversation.subject?.toLowerCase() ?? ''

      return (
        customerName.includes(normalizedSearch) ||
        company.includes(normalizedSearch) ||
        phone.includes(normalizedSearch) ||
        subject.includes(normalizedSearch)
      )
    })
  }, [conversations, filter, search])

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
      if (current && normalized.some(item => item.id === current)) {
        return current
      }

      return normalized[0]?.id ?? null
    })

    setLoadingConversations(false)
  }, [organizationId])

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!supabase) return

    setLoadingMessages(true)
    setMessageError(null)

    const { data, error: queryError } = await supabase
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
  }, [])

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      if (!supabase) return

      const { error: rpcError } = await supabase.rpc(
        'mark_conversation_read',
        {
          p_conversation_id: conversationId,
        }
      )

      if (rpcError) {
        console.error('mark_conversation_read failed:', rpcError)
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
          message.sender_type === 'customer' && !message.read_at
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
    if (!supabase || !organizationId) return

    const conversationsChannel = supabase
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
              current.filter(conversation => conversation.id !== deletedId)
            )

            setActiveConversationId(current =>
              current === deletedId ? null : current
            )

            return
          }

          const normalized = normalizeConversation(payload.new)

          setConversations(current => {
            const existingIndex = current.findIndex(
              conversation => conversation.id === normalized.id
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
      supabase.removeChannel(conversationsChannel)
    }
  }, [organizationId])

  useEffect(() => {
    if (!supabase || !organizationId) return

    const messagesChannel = supabase
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

          if (newMessage.conversation_id === activeConversationId) {
            setMessages(current => {
              if (
                current.some(message => message.id === newMessage.id)
              ) {
                return current
              }

              return [...current, newMessage]
            })

            if (newMessage.sender_type === 'customer') {
              markConversationRead(newMessage.conversation_id)
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

          if (updatedMessage.conversation_id !== activeConversationId) {
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
      supabase.removeChannel(messagesChannel)
    }
  }, [
    organizationId,
    activeConversationId,
    markConversationRead,
  ])

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId)
    setMessageError(null)
    setReply('')
  }

  const handleSend = async (event: FormEvent) => {
    event.preventDefault()

    const content = reply.trim()

    if (!content || !activeConversationId || !organizationId || !supabase) {
      return
    }

    if (!user?.id) {
      setMessageError('يجب تسجيل الدخول لإرسال الرسائل.')
      return
    }

    setSending(true)
    setMessageError(null)

    const { data, error: insertError } = await supabase
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
        if (current.some(message => message.id === data.id)) {
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
      <Card className="h-[calc(100vh-160px)] flex items-center justify-center">
        <div className="text-sm text-ink-900/50">
          جاري تحميل صندوق الوارد...
        </div>
      </Card>
    )
  }

  if (organizationError) {
    return (
      <Card className="h-[calc(100vh-160px)] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="font-bold text-ink-950 mb-2">
            تعذر تحميل صندوق الوارد
          </div>
          <div className="text-sm text-red-600">
            {organizationError}
          </div>
        </div>
      </Card>
    )
  }

  if (!organizationId) {
    return (
      <Card className="h-[calc(100vh-160px)] flex items-center justify-center p-6">
        <div className="text-center text-sm text-ink-900/50">
          لا توجد شركة مرتبطة بهذا الحساب.
        </div>
      </Card>
    )
  }

  return (
    <Card className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-[calc(100vh-160px)] min-h-[600px] overflow-hidden">
      <div className="border-e border-sand-200 flex flex-col min-h-0">
        <div className="p-3 border-b border-sand-100 space-y-3">
          <div className="relative">
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="ابحث في المحادثات..."
              className="w-full border border-sand-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-ink-700 bg-white"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {channelFilters.map(channel => (
              <button
                key={channel.value}
                type="button"
                onClick={() => setFilter(channel.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  filter === channel.value
                    ? 'bg-ink-900 text-sand-50'
                    : 'bg-sand-100 text-ink-900/60 hover:bg-sand-200'
                }`}
              >
                {channel.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="p-6 text-center text-sm text-ink-900/50">
              جاري تحميل المحادثات...
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <div className="text-sm font-medium text-ink-950 mb-1">
                تعذر تحميل المحادثات
              </div>
              <div className="text-xs text-red-600">
                {error}
              </div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <div className="font-semibold text-sm text-ink-950">
                لا توجد محادثات
              </div>
              <div className="text-xs text-ink-900/45 mt-1">
                ستظهر المحادثات هنا عند وصولها.
              </div>
            </div>
          ) : (
            filteredConversations.map(conversation => {
              const name = getConversationName(conversation)

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() =>
                    handleSelectConversation(conversation.id)
                  }
                  className={`w-full text-right p-4 border-b border-sand-100 hover:bg-sand-50 transition ${
                    activeConversationId === conversation.id
                      ? 'bg-sand-100'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-ink-900 text-sand-50 flex items-center justify-center text-xs font-bold">
                      {getInitials(name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-ink-950 truncate">
                          {name}
                        </span>

                        <span className="text-[11px] text-ink-900/40 shrink-0">
                          {formatTime(conversation.last_message_at)}
                        </span>
                      </div>

                      {conversation.customer?.company && (
                        <div className="text-[11px] text-ink-900/40 mt-0.5 truncate">
                          {conversation.customer.company}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className="text-xs text-ink-900/50 truncate">
                          {conversation.subject || 'محادثة'}
                        </span>

                        {conversation.unread_count > 0 && (
                          <span className="min-w-5 h-5 px-1.5 rounded-full bg-ink-900 text-sand-50 text-[10px] flex items-center justify-center shrink-0">
                            {conversation.unread_count > 99
                              ? '99+'
                              : conversation.unread_count}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-2">
                        <Badge>
                          {channelLabels[conversation.channel]}
                        </Badge>

                        {conversation.handled_by === 'ai' && (
                          <Badge tone="gold">RYAN AI</Badge>
                        )}

                        <Badge>
                          {statusLabels[conversation.status]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      <div className="flex flex-col min-w-0 min-h-0">
        {!activeConversation ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <div className="font-bold text-ink-950">
                صندوق المحادثات
              </div>
              <div className="text-sm text-ink-900/45 mt-1">
                اختر محادثة لعرض الرسائل.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-sand-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-full bg-ink-900 text-sand-50 flex items-center justify-center text-xs font-bold">
                  {getInitials(
                    getConversationName(activeConversation)
                  )}
                </div>

                <div className="min-w-0">
                  <div className="font-bold text-ink-950 truncate">
                    {getConversationName(activeConversation)}
                  </div>

                  <div className="text-xs text-ink-900/45 mt-0.5">
                    {channelLabels[activeConversation.channel]}
                    {' · '}
                    {activeConversation.handled_by === 'ai'
                      ? 'RYAN AI'
                      : 'موظف'}
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <Badge>
                  {statusLabels[activeConversation.status]}
                </Badge>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 bg-sand-50/50">
              {loadingMessages ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-sm text-ink-900/50">
                    جاري تحميل الرسائل...
                  </div>
                </div>
              ) : messageError && messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="font-semibold text-sm text-ink-950">
                      تعذر تحميل الرسائل
                    </div>
                    <div className="text-xs text-red-600 mt-1">
                      {messageError}
                    </div>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="font-semibold text-sm text-ink-950">
                      لا توجد رسائل بعد
                    </div>
                    <div className="text-xs text-ink-900/45 mt-1">
                      ابدأ المحادثة من مربع الرد بالأسفل.
                    </div>
                  </div>
                </div>
              ) : (
                messages.map(message => {
                  const isCustomer = message.sender_type === 'customer'

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
                        className={`max-w-[85%] md:max-w-md ${
                          isCustomer
                            ? 'bg-white border border-sand-200 rounded-2xl rounded-tr-sm text-ink-900'
                            : 'bg-ink-900 text-sand-50 rounded-2xl rounded-tl-sm'
                        } p-3.5`}
                      >
                        <div className="text-sm whitespace-pre-wrap break-words leading-6">
                          {message.content}
                        </div>

                        <div
                          className={`text-[10px] mt-1.5 ${
                            isCustomer
                              ? 'text-ink-900/35'
                              : 'text-sand-50/50'
                          }`}
                        >
                          {formatDateTime(message.created_at)}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}

              {messageError && messages.length > 0 && (
                <div className="text-center text-xs text-red-600">
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
                  onChange={event => setReply(event.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                  rows={1}
                  placeholder="اكتب ردك هنا..."
                  className="flex-1 resize-none border border-sand-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-ink-700 disabled:opacity-60 min-h-[46px] max-h-32"
                />

                <button
                  type="submit"
                  disabled={sending || !reply.trim()}
                  className="px-5 py-3 rounded-xl bg-ink-900 text-sand-50 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink-800 transition"
                >
                  {sending ? 'جاري الإرسال...' : 'إرسال'}
                </button>
              </div>

              <div className="text-[10px] text-ink-900/35 mt-1.5">
                Enter للإرسال · Shift + Enter لسطر جديد
              </div>
            </form>
          </>
        )}
      </div>
    </Card>
  )
}
