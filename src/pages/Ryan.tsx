import React, {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Card,
  Badge,
  Button,
} from '../components/ui'
import { IconSpark } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'
import { useSubscription } from '../lib/useSubscription'
import FeatureLocked from '../components/FeatureLocked'

interface ChatMessage {
  id: string
  role: 'user' | 'model'
  text: string
  createdAt: string
  actionTaken?: string | null
}

const actionLabels: Record<string, string> = {
  create_lead:
    'تم تسجيل العميل المحتمل في CRM',
  create_deal:
    'تم إنشاء الصفقة في مسار المبيعات',
  book_appointment:
    'تم تسجيل الموعد بنجاح',
  request_human_handoff:
    'تم تحويل المحادثة إلى فريق الدعم',
}

export default function Ryan() {
  const {
    organizationId,
  } = useOrganization()

  const {
    hasFeature,
    loading: subLoading,
  } = useSubscription()

  const [
    messages,
    setMessages,
  ] = useState<ChatMessage[]>([])

  const [
    input,
    setInput,
  ] = useState('')

  const [
    sending,
    setSending,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState<string | null>(null)

  const [
    paused,
    setPaused,
  ] = useState(false)

  const [
    conversationId,
    setConversationId,
  ] = useState<string | null>(null)

  const [
    companyName,
    setCompanyName,
  ] = useState('الشركة')

  useEffect(() => {
    let cancelled = false

    async function loadCompany() {
      if (!supabase || !organizationId) {
        return
      }

      const {
        data,
      } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .maybeSingle()

      if (!cancelled && data?.name) {
        setCompanyName(data.name)
      }
    }

    loadCompany()

    return () => {
      cancelled = true
    }
  }, [organizationId])

  const messageCount = messages.length

  const lastMessageTime = useMemo(() => {
    const last =
      messages[messages.length - 1]

    if (!last?.createdAt) {
      return null
    }

    const date =
      new Date(last.createdAt)

    if (Number.isNaN(date.getTime())) {
      return null
    }

    return date.toLocaleTimeString(
      'ar-EG',
      {
        hour: '2-digit',
        minute: '2-digit',
      }
    )
  }, [messages])

  const handleSend = async (
    event: React.FormEvent
  ) => {
    event.preventDefault()

    const userMessage =
      input.trim()

    if (
      !userMessage ||
      !supabase ||
      paused ||
      sending
    ) {
      return
    }

    setInput('')
    setError(null)
    setSending(true)

    const optimisticMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      text: userMessage,
      createdAt:
        new Date().toISOString(),
    }

    setMessages(current => [
      ...current,
      optimisticMessage,
    ])

    try {
      const {
        data: sessionData,
      } = await supabase.auth.getSession()

      const accessToken =
        sessionData.session?.access_token

      if (!accessToken) {
        throw new Error(
          'انتهت جلسة الدخول، سجل الدخول مرة أخرى.'
        )
      }

      const history = messages.map(
        message => ({
          role: message.role,
          parts: [
            {
              text: message.text,
            },
          ],
        })
      )

      const response = await fetch(
        '/api/ryan',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            message: userMessage,
            history,
            companyName,
            accessToken,
            conversationId,
          }),
        }
      )

      const data =
        await response.json()

      if (!response.ok) {
        if (
          data?.conversationId
        ) {
          setConversationId(
            data.conversationId
          )
        }

        throw new Error(
          data?.error ||
            'حدث خطأ أثناء التواصل مع Ryan'
        )
      }

      if (
        data?.conversationId
      ) {
        setConversationId(
          data.conversationId
        )
      }

      const assistantMessage: ChatMessage = {
        id: `ryan-${Date.now()}`,
        role: 'model',
        text: data.reply,
        createdAt:
          new Date().toISOString(),
        actionTaken:
          data.actionTaken || null,
      }

      setMessages(current => [
        ...current.filter(
          message =>
            message.id !==
            optimisticMessage.id
        ),
        {
          ...optimisticMessage,
        },
        assistantMessage,
      ])

      if (
        data.actionTaken ===
        'request_human_handoff'
      ) {
        setPaused(true)
      }
    } catch (requestError: any) {
      setError(
        requestError?.message ||
          'تعذر الاتصال بـ RYAN'
      )
    } finally {
      setSending(false)
    }
  }

  const handleNewConversation =
    () => {
      setMessages([])
      setConversationId(null)
      setPaused(false)
      setError(null)
      setInput('')
    }

  if (
    !subLoading &&
    !hasFeature('ryan')
  ) {
    return (
      <FeatureLocked
        featureName="RYAN AI"
      />
    )
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 bg-ink-950 text-sand-50 shadow-sm">
        <div className="relative p-6 md:p-8">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute -top-20 -end-20 w-64 h-64 rounded-full bg-gold-500 blur-3xl" />
            <div className="absolute -bottom-24 -start-24 w-72 h-72 rounded-full bg-white blur-3xl" />
          </div>

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gold-500 text-ink-950 flex items-center justify-center shadow-lg">
                <IconSpark className="w-8 h-8" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold tracking-tight">
                    RYAN AI
                  </h1>

                  <Badge tone="success">
                    يعمل الآن
                  </Badge>
                </div>

                <p className="text-sand-100/60 text-sm mt-1.5 max-w-2xl">
                  مساعد المبيعات وخدمة العملاء الذكي داخل Dragon Media.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={handleNewConversation}
              >
                محادثة جديدة
              </Button>
            </div>
          </div>

          <div className="relative grid grid-cols-2 md:grid-cols-3 gap-3 mt-7">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="text-xs text-sand-100/45">
                الرسائل
              </div>

              <div className="text-lg font-bold mt-1">
                {messageCount}
              </div>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="text-xs text-sand-100/45">
                الحالة
              </div>

              <div className="text-sm font-semibold mt-1">
                {paused
                  ? 'تحويل بشري'
                  : 'متاح'}
              </div>
            </div>

            <div className="hidden md:block rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="text-xs text-sand-100/45">
                آخر نشاط
              </div>

              <div className="text-sm font-semibold mt-1">
                {lastMessageTime ||
                  'لم تبدأ بعد'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <Card className="overflow-hidden">
          <div className="p-5 border-b border-sand-100 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-ink-950">
                محادثة RYAN
              </h2>

              <p className="text-xs text-ink-900/45 mt-1">
                المحادثة التي تجريها هنا يتم حفظها تلقائيًا في Inbox.
              </p>
            </div>

            {conversationId && (
              <Badge>
                متصلة بالـInbox
              </Badge>
            )}
          </div>

          <div className="h-[520px] overflow-y-auto p-4 md:p-6 space-y-4 bg-sand-50/40">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-ink-900 text-sand-50 flex items-center justify-center mb-4">
                    <IconSpark className="w-6 h-6" />
                  </div>

                  <h3 className="font-bold text-ink-950">
                    ابدأ محادثة جديدة
                  </h3>

                  <p className="text-sm text-ink-900/45 mt-2 leading-6">
                    جرّب سؤالًا حقيقيًا عن خدمات الشركة أو اطلب التحدث مع موظف.
                  </p>
                </div>
              </div>
            ) : (
              messages.map(
                message => (
                  <div
                    key={message.id}
                    className={
                      message.role ===
                      'user'
                        ? 'flex justify-start'
                        : 'flex justify-end'
                    }
                  >
                    <div
                      className={`max-w-[85%] md:max-w-[70%] ${
                        message.role ===
                        'user'
                          ? 'bg-white border border-sand-200 text-ink-900 rounded-2xl rounded-tr-sm'
                          : 'bg-ink-900 text-sand-50 rounded-2xl rounded-tl-sm'
                      } px-4 py-3`}
                    >
                      <div className="text-sm leading-6 whitespace-pre-wrap">
                        {message.text}
                      </div>

                      <div
                        className={`text-[10px] mt-2 ${
                          message.role ===
                          'user'
                            ? 'text-ink-900/35'
                            : 'text-sand-50/45'
                        }`}
                      >
                        {new Date(
                          message.createdAt
                        ).toLocaleTimeString(
                          'ar-EG',
                          {
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        )}
                      </div>

                      {message.actionTaken &&
                        actionLabels[
                          message.actionTaken
                        ] && (
                          <div className="mt-2 pt-2 border-t border-current/10 text-[11px] opacity-70">
                            {
                              actionLabels[
                                message.actionTaken
                              ]
                            }
                          </div>
                        )}
                    </div>
                  </div>
                )
              )
            )}

            {sending && (
              <div className="flex justify-end">
                <div className="bg-ink-900/90 text-sand-50 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
                    <span className="text-xs text-sand-50/60 mr-1">
                      ريان بيكتب...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {paused && (
            <div className="mx-4 mt-4 rounded-xl border border-gold-500/30 bg-gold-500/10 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="font-semibold text-sm text-ink-950">
                  تم تحويل المحادثة لفريق بشري
                </div>

                <div className="text-xs text-ink-900/50 mt-1">
                  المحادثة محفوظة في Inbox ويمكن للموظف متابعتها.
                </div>
              </div>

              <Button
                variant="secondary"
                onClick={() =>
                  setPaused(false)
                }
              >
                استئناف الاختبار
              </Button>
            </div>
          )}

          {error && (
            <div className="mx-4 mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSend}
            className="p-4 border-t border-sand-100 bg-white mt-4"
          >
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={event =>
                  setInput(
                    event.target.value
                  )
                }
                onKeyDown={event => {
                  if (
                    event.key ===
                      'Enter' &&
                    !event.shiftKey
                  ) {
                    event.preventDefault()

                    if (
                      !sending &&
                      input.trim()
                    ) {
                      event.currentTarget.form?.requestSubmit()
                    }
                  }
                }}
                disabled={
                  paused ||
                  sending
                }
                rows={1}
                placeholder={
                  paused
                    ? 'المحادثة محولة لفريق بشري...'
                    : 'اكتب رسالتك إلى RYAN...'
                }
                className="flex-1 resize-none min-h-[48px] max-h-32 border border-sand-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-ink-700 disabled:bg-sand-100"
              />

              <Button
                type="submit"
                disabled={
                  paused ||
                  sending ||
                  !input.trim()
                }
              >
                {sending
                  ? 'جاري الإرسال...'
                  : 'إرسال'}
              </Button>
            </div>

            <div className="text-[10px] text-ink-900/35 mt-2">
              Enter للإرسال · Shift + Enter لسطر جديد
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-bold text-ink-950">
                حالة RYAN
              </h3>

              <Badge tone="success">
                متصل
              </Badge>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-900/50">
                  الشركة
                </span>

                <span className="font-medium text-ink-950 truncate max-w-[170px]">
                  {companyName}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-ink-900/50">
                  Inbox
                </span>

                <span className="font-medium text-ink-950">
                  {conversationId
                    ? 'متصل'
                    : 'لم تبدأ'}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-bold text-ink-950 mb-4">
              قدرات RYAN
            </h3>

            <div className="space-y-3">
              {[
                'الرد على استفسارات العملاء باستخدام قاعدة المعرفة',
                'تسجيل العملاء المحتملين في CRM',
                'إنشاء الصفقات داخل Pipeline',
                'حجز المواعيد',
                'تحويل المحادثة لموظف بشري',
              ].map(item => (
                <div
                  key={item}
                  className="flex gap-2.5 items-start"
                >
                  <div className="w-5 h-5 rounded-full bg-ink-900 text-sand-50 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px]">
                      ✓
                    </span>
                  </div>

                  <span className="text-sm leading-5 text-ink-900/65">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-bold text-ink-950 mb-2">
              إدارة RYAN
            </h3>

            <p className="text-xs leading-5 text-ink-900/45 mb-4">
              إدارة المعرفة ومتابعة طلبات التحويل تتم من الأقسام المخصصة.
            </p>

            <div className="space-y-2">
              <a
                href="#/ryan/knowledge"
                className="block rounded-xl border border-sand-200 px-4 py-3 text-sm font-medium text-ink-950 hover:bg-sand-50 transition"
              >
                قاعدة المعرفة
              </a>

              <a
                href="#/ryan/handoff"
                className="block rounded-xl border border-sand-200 px-4 py-3 text-sm font-medium text-ink-950 hover:bg-sand-50 transition"
              >
                طلبات التحويل
              </a>

              <a
                href="#/inbox"
                className="block rounded-xl bg-ink-900 text-sand-50 px-4 py-3 text-sm font-medium text-center hover:bg-ink-800 transition"
              >
                فتح Inbox
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
