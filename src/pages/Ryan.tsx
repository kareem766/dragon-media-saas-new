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

interface RyanSummary {
  base_limit: number
  monthly_used: number
  base_remaining: number
  purchased_remaining: number
  total_remaining: number
  usage_percent: number
}

interface RyanPackage {
  id: string
  name: string
  message_count: number
  price: number
  currency: string
  description?: string | null
}

interface PaymentMethod {
  method_key: string
  name: string
  details?: Record<string, unknown> | null
}

interface RyanPurchase {
  id: string
  package_name: string
  credits_purchased: number
  credits_remaining: number
  amount: number
  currency: string
  status: string
  rejection_reason?: string | null
  created_at: string
  approved_at?: string | null
}

const actionLabels: Record<string, string> = {
  create_lead: 'تم تسجيل العميل المحتمل في CRM',
  create_deal: 'تم إنشاء الصفقة في مسار المبيعات',
  book_appointment: 'تم تسجيل الموعد بنجاح',
  request_human_handoff: 'تم تحويل المحادثة إلى فريق الدعم',
}

const statusLabels: Record<string, string> = {
  pending_review: 'قيد المراجعة',
  approved: 'تم الاعتماد',
  rejected: 'مرفوض',
  cancelled: 'ملغي',
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('ar-EG')
}

function getPaymentDetails(method: PaymentMethod | null) {
  if (!method?.details) {
    return []
  }

  return Object.entries(method.details).filter(
    ([, value]) =>
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ''
  )
}

function formatMessageTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleDateString('ar-EG')
}

export default function Ryan() {
  const { organizationId } = useOrganization()

  const {
    hasFeature,
    loading: subLoading,
  } = useSubscription()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)

  const [conversationId, setConversationId] =
    useState<string | null>(null)

  /*
   * Prevent sending before the existing conversation
   * has finished restoring from Supabase/localStorage.
   */
  const [conversationReady, setConversationReady] =
    useState(false)

  const [companyName, setCompanyName] =
    useState('الشركة')

  const [summary, setSummary] =
    useState<RyanSummary | null>(null)

  const [packages, setPackages] =
    useState<RyanPackage[]>([])

  const [paymentMethods, setPaymentMethods] =
    useState<PaymentMethod[]>([])

  const [purchases, setPurchases] =
    useState<RyanPurchase[]>([])

  const [loadingCredits, setLoadingCredits] =
    useState(true)

  const [creditsError, setCreditsError] =
    useState<string | null>(null)

  const [showPurchase, setShowPurchase] =
    useState(false)

  const [selectedPackage, setSelectedPackage] =
    useState<RyanPackage | null>(null)

  const [selectedMethod, setSelectedMethod] =
    useState('')

  const [reference, setReference] =
    useState('')

  const [paymentDate, setPaymentDate] =
    useState(
      new Date()
        .toISOString()
        .slice(0, 10)
    )

  const [paymentNote, setPaymentNote] =
    useState('')

  const [purchasing, setPurchasing] =
    useState(false)

  const [purchaseError, setPurchaseError] =
    useState<string | null>(null)

  /*
   * Every organization gets its own Ryan conversation key.
   *
   * This is only a pointer to the Supabase conversation ID.
   * The actual conversation/messages remain stored in Supabase.
   */
  const conversationStorageKey = useMemo(
    () =>
      organizationId
        ? `dragon-media-ryan-conversation:${organizationId}`
        : null,
    [organizationId]
  )

  /*
   * Load company name.
   */
  useEffect(() => {
    let cancelled = false

    async function loadCompany() {
      if (!supabase || !organizationId) {
        return
      }

      const { data } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .maybeSingle()

      if (!cancelled && data?.name) {
        setCompanyName(data.name)
      }
    }

    void loadCompany()

    return () => {
      cancelled = true
    }
  }, [organizationId])

  /*
   * Restore Ryan conversation.
   *
   * Priority:
   *
   * 1. Previously selected conversation from localStorage.
   * 2. Latest existing website conversation.
   * 3. Empty state if there is no conversation yet.
   *
   * This fixes:
   * - Refresh opening the wrong conversation.
   * - Returning to Ryan opening an unrelated conversation.
   * - New Conversation being overwritten after refresh.
   */
  useEffect(() => {
    let cancelled = false

    async function loadConversation() {
      setConversationReady(false)

      if (!supabase || !organizationId) {
        setConversationReady(true)
        return
      }

      try {
        const {
          data: authData,
          error: authError,
        } = await supabase.auth.getUser()

        if (
          authError ||
          !authData.user?.id
        ) {
          if (!cancelled) {
            setConversationReady(true)
          }

          return
        }

        const userEmail = authData.user.email

        if (!userEmail) {
          if (!cancelled) {
            setConversationReady(true)
          }

          return
        }

        const {
          data: customer,
          error: customerError,
        } = await supabase
          .from('customers')
          .select('id')
          .eq(
            'organization_id',
            organizationId
          )
          .eq('email', userEmail)
          .order('created_at', {
            ascending: false,
          })
          .limit(1)
          .maybeSingle()

        if (
          customerError ||
          !customer?.id ||
          cancelled
        ) {
          if (!cancelled) {
            setMessages([])
            setConversationId(null)
            setPaused(false)
            setConversationReady(true)
          }

          return
        }

        const storedConversationId =
          conversationStorageKey
            ? window.localStorage.getItem(
                conversationStorageKey
              )
            : null

        let conversation: any = null

        /*
         * First try the exact conversation saved locally.
         */
        if (storedConversationId) {
          const {
            data: storedConversation,
            error: storedConversationError,
          } = await supabase
            .from('conversations')
            .select(
              'id, handled_by, metadata, created_at'
            )
            .eq(
              'id',
              storedConversationId
            )
            .eq(
              'organization_id',
              organizationId
            )
            .eq(
              'customer_id',
              customer.id
            )
            .eq(
              'channel',
              'website'
            )
            .maybeSingle()

          if (
            !storedConversationError &&
            storedConversation?.id
          ) {
            conversation =
              storedConversation
          }
        }

        /*
         * If the stored conversation was removed or no pointer exists,
         * recover the latest existing Ryan conversation.
         */
        if (!conversation) {
          const {
            data: latestConversation,
            error: latestConversationError,
          } = await supabase
            .from('conversations')
            .select(
              'id, handled_by, metadata, created_at'
            )
            .eq(
              'organization_id',
              organizationId
            )
            .eq(
              'customer_id',
              customer.id
            )
            .eq(
              'channel',
              'website'
            )
            .order('created_at', {
              ascending: false,
            })
            .limit(1)
            .maybeSingle()

          if (
            latestConversationError ||
            !latestConversation?.id
          ) {
            if (
              conversationStorageKey
            ) {
              window.localStorage.removeItem(
                conversationStorageKey
              )
            }

            if (!cancelled) {
              setMessages([])
              setConversationId(null)
              setPaused(false)
              setConversationReady(true)
            }

            return
          }

          conversation =
            latestConversation
        }

        if (
          !conversation?.id ||
          cancelled
        ) {
          return
        }

        /*
         * Persist the exact conversation we restored.
         */
        if (conversationStorageKey) {
          window.localStorage.setItem(
            conversationStorageKey,
            conversation.id
          )
        }

        setConversationId(
          conversation.id
        )

        const {
          data: storedMessages,
          error: messagesError,
        } = await supabase
          .from('messages')
          .select('*')
          .eq(
            'conversation_id',
            conversation.id
          )
          .order('created_at', {
            ascending: true,
          })

        if (
          messagesError ||
          cancelled
        ) {
          if (!cancelled) {
            setConversationReady(true)
          }

          return
        }

        const restoredMessages: ChatMessage[] =
          (storedMessages || [])
            .map(
              (
                row: any
              ): ChatMessage | null => {
                const metadata =
                  row?.metadata &&
                  typeof row.metadata ===
                    'object'
                    ? row.metadata
                    : {}

                const senderType =
                  String(
                    row?.sender_type ||
                      row?.sender ||
                      row?.role ||
                      ''
                  ).toLowerCase()

                const isUser =
                  senderType ===
                    'customer' ||
                  senderType ===
                    'user' ||
                  senderType ===
                    'human'

                const text =
                  row?.content ??
                  row?.body ??
                  row?.text ??
                  row?.message ??
                  ''

                const createdAt =
                  row?.created_at ||
                  new Date().toISOString()

                if (
                  !String(text).trim()
                ) {
                  return null
                }

                return {
                  id: String(
                    row?.id ||
                      `restored-${createdAt}-${Math.random()}`
                  ),
                  role: isUser
                    ? 'user'
                    : 'model',
                  text: String(text),
                  createdAt:
                    String(
                      createdAt
                    ),
                  actionTaken:
                    metadata?.action_taken ||
                    metadata?.actionTaken ||
                    row?.action_taken ||
                    null,
                }
              }
            )
            .filter(
              (
                message
              ): message is ChatMessage =>
                message !== null
            )

        if (!cancelled) {
          setMessages(
            restoredMessages
          )
        }

        const metadata =
          conversation?.metadata &&
          typeof conversation.metadata ===
            'object'
            ? conversation.metadata
            : {}

        const handledBy =
          String(
            conversation?.handled_by ||
              ''
          ).toLowerCase()

        const handoffStatus =
          String(
            metadata?.status ||
              metadata?.handoff_status ||
              ''
          ).toLowerCase()

        const hasHumanHandoff =
          handledBy === 'human' ||
          handledBy === 'agent' ||
          handoffStatus === 'human' ||
          handoffStatus === 'pending'

        if (!cancelled) {
          setPaused(
            hasHumanHandoff
          )
          setConversationReady(true)
        }
      } catch (
        conversationLoadError
      ) {
        console.error(
          'Ryan conversation restore error:',
          conversationLoadError
        )

        if (!cancelled) {
          setConversationReady(true)
        }
      }
    }

    void loadConversation()

    return () => {
      cancelled = true
    }
  }, [
    organizationId,
    conversationStorageKey,
  ])

  /*
   * Load Ryan credits / packages / payment methods.
   */
  const loadRyanCredits =
    async () => {
      if (!supabase) {
        return
      }

      setLoadingCredits(true)
      setCreditsError(null)

      try {
        const {
          data: sessionData,
          error: sessionError,
        } =
          await supabase.auth.getSession()

        if (sessionError) {
          throw new Error(
            sessionError.message
          )
        }

        const accessToken =
          sessionData.session
            ?.access_token

        if (!accessToken) {
          throw new Error(
            'انتهت جلسة الدخول.'
          )
        }

        const response =
          await fetch(
            '/api/ryan-credits',
            {
              method: 'GET',
              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },
            }
          )

        const data =
          await response.json()

        if (!response.ok) {
          throw new Error(
            data?.error ||
              'تعذر تحميل بيانات Ryan'
          )
        }

        setSummary(
          data.summary || null
        )

        setPackages(
          Array.isArray(
            data.packages
          )
            ? data.packages
            : []
        )

        setPaymentMethods(
          Array.isArray(
            data.paymentMethods
          )
            ? data.paymentMethods
            : []
        )

        setPurchases(
          Array.isArray(
            data.purchases
          )
            ? data.purchases
            : []
        )
      } catch (
        loadError: any
      ) {
        setCreditsError(
          loadError?.message ||
            'تعذر تحميل بيانات Ryan'
        )
      } finally {
        setLoadingCredits(false)
      }
    }

  useEffect(() => {
    if (
      organizationId &&
      !subLoading &&
      hasFeature('ryan')
    ) {
      void loadRyanCredits()
    }
  }, [
    organizationId,
    subLoading,
  ])

  const messageCount =
    messages.length

  const lastMessageTime =
    useMemo(() => {
      const last =
        messages[
          messages.length - 1
        ]

      if (!last?.createdAt) {
        return null
      }

      return formatMessageTime(
        last.createdAt
      )
    }, [messages])

  const usagePercent =
    Math.min(
      100,
      Math.max(
        0,
        Number(
          summary?.usage_percent || 0
        )
      )
    )

  const approvedPurchases =
    useMemo(
      () =>
        purchases.filter(
          purchase =>
            purchase.status ===
            'approved'
        ),
      [purchases]
    )

  const pendingPurchases =
    useMemo(
      () =>
        purchases.filter(
          purchase =>
            purchase.status ===
            'pending_review'
        ),
      [purchases]
    )

  const selectedPaymentMethod =
    paymentMethods.find(
      method =>
        method.method_key ===
        selectedMethod
    ) || null

  const paymentDetails =
    getPaymentDetails(
      selectedPaymentMethod
    )

  const openPurchase = (
    pkg: RyanPackage
  ) => {
    setSelectedPackage(pkg)

    setSelectedMethod(
      paymentMethods[0]
        ?.method_key || ''
    )

    setReference('')

    setPaymentDate(
      new Date()
        .toISOString()
        .slice(0, 10)
    )

    setPaymentNote('')
    setPurchaseError(null)
    setShowPurchase(true)
  }

  const submitPurchase =
    async () => {
      if (
        !supabase ||
        !selectedPackage
      ) {
        return
      }

      if (!selectedMethod) {
        setPurchaseError(
          'اختر طريقة الدفع.'
        )
        return
      }

      if (!reference.trim()) {
        setPurchaseError(
          'أدخل رقم العملية.'
        )
        return
      }

      if (!paymentDate) {
        setPurchaseError(
          'اختر تاريخ الدفع.'
        )
        return
      }

      setPurchasing(true)
      setPurchaseError(null)

      try {
        const {
          data: sessionData,
          error: sessionError,
        } =
          await supabase.auth.getSession()

        if (sessionError) {
          throw new Error(
            sessionError.message
          )
        }

        const accessToken =
          sessionData.session
            ?.access_token

        if (!accessToken) {
          throw new Error(
            'انتهت جلسة الدخول.'
          )
        }

        const response =
          await fetch(
            '/api/ryan-credits',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
                Authorization:
                  `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                packageId:
                  selectedPackage.id,
                method:
                  selectedMethod,
                reference:
                  reference.trim(),
                paymentDate,
                note:
                  paymentNote.trim() ||
                  null,
              }),
            }
          )

        const data =
          await response.json()

        if (!response.ok) {
          throw new Error(
            data?.error ||
              'تعذر إرسال طلب الشراء'
          )
        }

        setShowPurchase(false)
        setSelectedPackage(null)
        setSelectedMethod('')
        setReference('')
        setPaymentNote('')

        void loadRyanCredits()
      } catch (
        purchaseRequestError: any
      ) {
        setPurchaseError(
          purchaseRequestError?.message ||
            'حدث خطأ أثناء إرسال الطلب'
        )
      } finally {
        setPurchasing(false)
      }
    }

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
      sending ||
      !conversationReady
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
        error: sessionError,
      } =
        await supabase.auth.getSession()

      if (sessionError) {
        throw new Error(
          sessionError.message
        )
      }

      const accessToken =
        sessionData.session
          ?.access_token

      if (!accessToken) {
        throw new Error(
          'انتهت جلسة الدخول، سجل الدخول مرة أخرى.'
        )
      }

      /*
       * Include the current message in history as well.
       * The API still receives `message` separately.
       */
      const history = [
        ...messages,
        optimisticMessage,
      ].map(message => ({
        role: message.role,
        parts: [
          {
            text: message.text,
          },
        ],
      }))

      const response =
        await fetch(
          '/api/ryan',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              message:
                userMessage,
              history,
              companyName,
              accessToken,
              conversationId,
            }),
          }
        )

      const data =
        await response.json()

      if (
        data?.conversationId
      ) {
        setConversationId(
          data.conversationId
        )

        if (
          conversationStorageKey
        ) {
          window.localStorage.setItem(
            conversationStorageKey,
            data.conversationId
          )
        }
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'حدث خطأ أثناء التواصل مع Ryan'
        )
      }

      const assistantMessage: ChatMessage = {
        id: `ryan-${Date.now()}`,
        role: 'model',
        text:
          data.reply ||
          'تم استلام رسالتك.',
        createdAt:
          new Date().toISOString(),
        actionTaken:
          data.actionTaken ||
          null,
      }

      setMessages(current => [
        ...current.filter(
          message =>
            message.id !==
            optimisticMessage.id
        ),
        optimisticMessage,
        assistantMessage,
      ])

      if (
        data.actionTaken ===
        'request_human_handoff'
      ) {
        setPaused(true)
      }

      /*
       * Credits refresh remains background-only.
       */
      void loadRyanCredits()
    } catch (
      requestError: any
    ) {
      setError(
        requestError?.message ||
          'تعذر الاتصال بـ RYAN'
      )

      void loadRyanCredits()
    } finally {
      setSending(false)
    }
  }

  const handleNewConversation =
    () => {
      if (!conversationReady || sending) {
        return
      }

      /*
       * Removing the pointer is important.
       * Otherwise refresh would restore the previous chat.
       */
      if (
        conversationStorageKey
      ) {
        window.localStorage.removeItem(
          conversationStorageKey
        )
      }

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
    <div
      dir="rtl"
      className="space-y-6 pb-8"
    >
      {/* =====================================================
          PREMIUM HERO
      ====================================================== */}

      <section className="relative overflow-hidden rounded-3xl bg-ink-950 text-sand-50 shadow-xl">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -end-20 h-80 w-80 rounded-full bg-gold-500/20 blur-3xl" />
          <div className="absolute -bottom-40 -start-20 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute top-1/2 start-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="relative p-6 md:p-8 lg:p-9">
          <div className="flex flex-col gap-7">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-500 text-ink-950 shadow-lg shadow-black/20">
                    <IconSpark className="h-8 w-8" />
                  </div>

                  <span className="absolute -bottom-1 -start-1 h-4 w-4 rounded-full border-2 border-ink-950 bg-emerald-400" />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                      RYAN AI
                    </h1>

                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      يعمل الآن
                    </span>
                  </div>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-sand-100/60">
                    مساعد المبيعات وخدمة العملاء الذكي داخل Dragon Media.
                    يتعامل مع العملاء، يسجل البيانات، يحجز المواعيد
                    ويتحول للموظف عند الحاجة.
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-lg bg-white/5 px-3 py-1.5 text-sand-100/60 ring-1 ring-inset ring-white/10">
                      {companyName}
                    </span>

                    <span className="rounded-lg bg-white/5 px-3 py-1.5 text-sand-100/60 ring-1 ring-inset ring-white/10">
                      {conversationId
                        ? 'المحادثة محفوظة'
                        : 'محادثة جديدة'}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                variant="secondary"
                onClick={
                  handleNewConversation
                }
                disabled={
                  !conversationReady ||
                  sending
                }
                className="shrink-0"
              >
                + محادثة جديدة
              </Button>
            </div>

            {/* HERO METRICS */}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                <div className="text-[11px] text-sand-100/45">
                  رسائل المحادثة
                </div>

                <div className="mt-2 text-xl font-bold">
                  {formatNumber(
                    messageCount
                  )}
                </div>

                <div className="mt-1 text-[10px] text-sand-100/35">
                  رسالة محفوظة
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                <div className="text-[11px] text-sand-100/45">
                  حد الخطة الشهري
                </div>

                <div className="mt-2 text-xl font-bold">
                  {loadingCredits
                    ? '—'
                    : formatNumber(
                        summary?.base_limit ||
                          0
                      )}
                </div>

                <div className="mt-1 text-[10px] text-sand-100/35">
                  رسالة
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                <div className="text-[11px] text-sand-100/45">
                  المستخدم هذا الشهر
                </div>

                <div className="mt-2 text-xl font-bold">
                  {loadingCredits
                    ? '—'
                    : formatNumber(
                        summary?.monthly_used ||
                          0
                      )}
                </div>

                <div className="mt-1 text-[10px] text-sand-100/35">
                  من حد الخطة
                </div>
              </div>

              <div className="rounded-2xl border border-gold-400/20 bg-gold-400/10 p-4">
                <div className="text-[11px] text-gold-100/60">
                  المتاح الإجمالي
                </div>

                <div className="mt-2 text-xl font-bold text-gold-300">
                  {loadingCredits
                    ? '—'
                    : formatNumber(
                        summary?.total_remaining ||
                          0
                      )}
                </div>

                <div className="mt-1 text-[10px] text-gold-100/45">
                  رسالة متاحة
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          USAGE
      ====================================================== */}

      <Card className="overflow-hidden border-sand-200/80 shadow-sm">
        <div className="p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-gold-500" />

                <h2 className="font-bold text-ink-950">
                  استهلاك RYAN
                </h2>
              </div>

              <p className="text-sm text-ink-900/45 mt-1.5">
                متابعة استخدام حد الخطة والرصيد الإضافي.
              </p>
            </div>

            {packages.length > 0 && (
              <Button
                onClick={() =>
                  openPurchase(
                    packages[0]
                  )
                }
              >
                شراء رصيد إضافي
              </Button>
            )}
          </div>

          {creditsError ? (
            <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              {creditsError}
            </div>
          ) : loadingCredits ? (
            <div className="mt-6 space-y-4">
              <div className="h-3 rounded-full bg-sand-100 animate-pulse" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[1, 2, 3].map(item => (
                  <div
                    key={item}
                    className="h-24 rounded-2xl bg-sand-50 animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 flex items-center justify-between text-sm">
                <span className="text-ink-900/55">
                  الاستخدام الشهري من حد الخطة
                </span>

                <span className="font-semibold text-ink-950">
                  {formatNumber(
                    summary?.monthly_used ||
                      0
                  )}
                  {' / '}
                  {formatNumber(
                    summary?.base_limit ||
                      0
                  )}
                </span>
              </div>

              <div className="mt-2 h-3 overflow-hidden rounded-full bg-sand-100">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-gold-500 to-ink-900 transition-all duration-700"
                  style={{
                    width: `${usagePercent}%`,
                  }}
                />
              </div>

              <div className="mt-2 flex justify-between text-xs text-ink-900/45">
                <span>
                  {usagePercent.toLocaleString(
                    'ar-EG',
                    {
                      maximumFractionDigits: 1,
                    }
                  )}
                  %
                </span>

                <span>
                  متبقي الخطة:{' '}
                  {formatNumber(
                    summary?.base_remaining ||
                      0
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
                <div className="rounded-2xl border border-sand-200 bg-sand-50/40 p-4">
                  <div className="text-xs text-ink-900/45">
                    المتبقي من الخطة
                  </div>

                  <div className="mt-1.5 text-xl font-bold text-ink-950">
                    {formatNumber(
                      summary?.base_remaining ||
                        0
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-sand-200 bg-sand-50/40 p-4">
                  <div className="text-xs text-ink-900/45">
                    الرصيد الإضافي
                  </div>

                  <div className="mt-1.5 text-xl font-bold text-ink-950">
                    {formatNumber(
                      summary?.purchased_remaining ||
                        0
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-gold-200 bg-gold-50/40 p-4">
                  <div className="text-xs text-ink-900/45">
                    المتاح الإجمالي
                  </div>

                  <div className="mt-1.5 text-xl font-bold text-ink-950">
                    {formatNumber(
                      summary?.total_remaining ||
                        0
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* =====================================================
          ACTIVE PURCHASED CREDITS
      ====================================================== */}

      {approvedPurchases.length > 0 && (
        <Card className="overflow-hidden border-emerald-200 bg-emerald-50/50">
          <div className="p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                  ✓
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-ink-950">
                      الباقات الإضافية المفعّلة
                    </h2>

                    <Badge tone="success">
                      مفعّلة
                    </Badge>
                  </div>

                  <p className="mt-1 text-sm text-ink-900/55">
                    تم تأكيد الدفع وإضافة الرصيد الإضافي إلى حسابك.
                  </p>
                </div>
              </div>

              <div className="text-sm text-ink-900/50">
                {formatNumber(
                  approvedPurchases.length
                )}{' '}
                باقة مفعّلة
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {approvedPurchases.map(
                purchase => (
                  <div
                    key={purchase.id}
                    className="rounded-2xl border border-emerald-100 bg-white p-4 md:p-5 shadow-sm"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-ink-950">
                            {purchase.package_name}
                          </h3>

                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            ✓ تم تفعيلها
                          </span>
                        </div>

                        <div className="mt-2 text-sm text-ink-900/50">
                          تم تأكيد دفع{' '}
                          <strong className="text-ink-950">
                            {Number(
                              purchase.amount
                            ).toLocaleString(
                              'ar-EG'
                            )}{' '}
                            {purchase.currency}
                          </strong>
                        </div>

                        {purchase.approved_at && (
                          <div className="mt-1 text-xs text-ink-900/40">
                            تاريخ التفعيل:{' '}
                            {formatDate(
                              purchase.approved_at
                            )}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 lg:min-w-[280px]">
                        <div className="rounded-xl border border-sand-200 bg-sand-50 p-3">
                          <div className="text-[11px] text-ink-900/40">
                            تم شراء
                          </div>

                          <div className="mt-1 text-lg font-bold text-ink-950">
                            {formatNumber(
                              purchase.credits_purchased
                            )}
                          </div>

                          <div className="text-[11px] text-ink-900/40">
                            رسالة
                          </div>
                        </div>

                        <div className="rounded-xl border border-sand-200 bg-sand-50 p-3">
                          <div className="text-[11px] text-ink-900/40">
                            المتبقي
                          </div>

                          <div className="mt-1 text-lg font-bold text-ink-950">
                            {formatNumber(
                              purchase.credits_remaining
                            )}
                          </div>

                          <div className="text-[11px] text-ink-900/40">
                            رسالة
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </Card>
      )}

      {/* =====================================================
          PENDING PURCHASE
      ====================================================== */}

      {pendingPurchases.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60 p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 font-bold text-amber-700">
              !
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-ink-950">
                  لديك طلب شراء قيد المراجعة
                </h2>

                <Badge>
                  {formatNumber(
                    pendingPurchases.length
                  )}{' '}
                  طلب
                </Badge>
              </div>

              <p className="mt-1 text-sm leading-6 text-ink-900/55">
                تم استلام طلب الدفع الخاص بك، وسيتم تفعيل الرسائل الإضافية بعد اعتماد الدفع من إدارة Dragon Media.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* =====================================================
          CREDIT PACKAGES
      ====================================================== */}

      <Card className="border-sand-200/80 shadow-sm">
        <div className="p-5 md:p-6">
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gold-500" />

              <h2 className="font-bold text-ink-950">
                باقات رصيد Ryan
              </h2>
            </div>

            <p className="mt-1.5 text-sm text-ink-900/45">
              اشترِ رسائل إضافية بدون تغيير حد الرسائل الأساسي في خطتك.
            </p>
          </div>

          {loadingCredits ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(item => (
                <div
                  key={item}
                  className="h-44 rounded-2xl bg-sand-50 animate-pulse"
                />
              ))}
            </div>
          ) : packages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-sand-200 p-6 text-center text-sm text-ink-900/50">
              لا توجد باقات رصيد متاحة حاليًا.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {packages.map(
                (
                  pkg,
                  index
                ) => (
                  <div
                    key={pkg.id}
                    className={`group relative overflow-hidden rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                      index === 1
                        ? 'border-gold-300 bg-gold-50/30'
                        : 'border-sand-200 bg-white hover:border-ink-300'
                    }`}
                  >
                    {index === 1 && (
                      <span className="absolute top-0 start-0 rounded-ee-xl bg-gold-500 px-3 py-1.5 text-[10px] font-bold text-ink-950">
                        الأكثر طلبًا
                      </span>
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-ink-950">
                          {pkg.name}
                        </h3>

                        <div className="mt-1 text-sm text-ink-900/50">
                          {formatNumber(
                            pkg.message_count
                          )}{' '}
                          رسالة
                        </div>
                      </div>

                      <div className="text-start shrink-0">
                        <div className="text-lg font-bold text-ink-950">
                          {Number(
                            pkg.price
                          ).toLocaleString(
                            'ar-EG'
                          )}{' '}
                          {pkg.currency}
                        </div>
                      </div>
                    </div>

                    {pkg.description && (
                      <p className="mt-4 min-h-[40px] text-xs leading-5 text-ink-900/45">
                        {pkg.description}
                      </p>
                    )}

                    <div className="mt-5 border-t border-sand-100 pt-4">
                      <Button
                        className="w-full"
                        onClick={() =>
                          openPurchase(
                            pkg
                          )
                        }
                      >
                        شراء الباقة
                      </Button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </Card>

      {/* =====================================================
          PURCHASE HISTORY
      ====================================================== */}

      {purchases.length > 0 && (
        <Card className="border-sand-200/80 shadow-sm">
          <div className="p-5 md:p-6">
            <div className="mb-5">
              <h2 className="font-bold text-ink-950">
                سجل طلبات رصيد Ryan
              </h2>

              <p className="mt-1 text-sm text-ink-900/45">
                جميع الطلبات السابقة وحالتها الحالية.
              </p>
            </div>

            <div className="space-y-3">
              {purchases.map(
                purchase => (
                  <div
                    key={purchase.id}
                    className="rounded-2xl border border-sand-200 bg-white p-4 transition hover:border-sand-300"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <div className="font-semibold text-ink-950">
                          {purchase.package_name}
                        </div>

                        <div className="mt-1 text-xs text-ink-900/45">
                          {formatNumber(
                            purchase.credits_purchased
                          )}{' '}
                          رسالة ·{' '}
                          {Number(
                            purchase.amount
                          ).toLocaleString(
                            'ar-EG'
                          )}{' '}
                          {purchase.currency}
                        </div>

                        <div className="mt-1 text-[11px] text-ink-900/35">
                          {formatDate(
                            purchase.created_at
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col md:items-end gap-2">
                        {purchase.status ===
                        'approved' ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                              ✓ تم تأكيد الدفع
                            </span>

                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                              مفعّلة
                            </span>
                          </div>
                        ) : (
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${
                              purchase.status ===
                              'pending_review'
                                ? 'bg-amber-100 text-amber-700'
                                : purchase.status ===
                                  'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-sand-100 text-ink-900/60'
                            }`}
                          >
                            {statusLabels[
                              purchase.status
                            ] ||
                              purchase.status}
                          </span>
                        )}

                        {purchase.status ===
                          'approved' && (
                          <span className="text-xs text-ink-900/50">
                            الرصيد المتبقي:{' '}
                            <strong className="text-ink-950">
                              {formatNumber(
                                purchase.credits_remaining
                              )}
                            </strong>{' '}
                            رسالة
                          </span>
                        )}

                        {purchase.status ===
                          'rejected' &&
                          purchase.rejection_reason && (
                            <span className="text-xs text-red-600">
                              السبب:{' '}
                              {
                                purchase.rejection_reason
                              }
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </Card>
      )}

      {/* =====================================================
          CHAT + SIDEBAR
      ====================================================== */}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <Card className="overflow-hidden border-sand-200/80 shadow-lg">
          {/* CHAT HEADER */}

          <div className="border-b border-sand-100 bg-white p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-950 text-gold-400 shadow-sm">
                  <IconSpark className="h-5 w-5" />

                  <span className="absolute -bottom-0.5 -start-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-ink-950">
                      محادثة RYAN
                    </h2>

                    {conversationId && (
                      <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                        محفوظة
                      </span>
                    )}
                  </div>

                  <p className="mt-1 truncate text-xs text-ink-900/45">
                    يتم حفظ المحادثة تلقائيًا في Inbox.
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-semibold ${
                    paused
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      paused
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                  />

                  {paused
                    ? 'محولة للبشر'
                    : 'متصل'}
                </span>
              </div>
            </div>
          </div>

          {/* CHAT BODY */}

          <div className="relative h-[520px] overflow-y-auto bg-gradient-to-b from-sand-50/70 to-white p-4 md:p-6">
            {!conversationReady ? (
              <div className="flex h-full items-center justify-center">
                <div className="w-full max-w-xs text-center">
                  <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-ink-900/10" />

                  <div className="mx-auto mt-4 h-3 w-40 animate-pulse rounded-full bg-ink-900/10" />

                  <div className="mx-auto mt-2 h-2 w-56 animate-pulse rounded-full bg-ink-900/5" />

                  <p className="mt-4 text-xs text-ink-900/40">
                    جاري استعادة المحادثة...
                  </p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md text-center">
                  <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-950 text-gold-400 shadow-lg">
                    <IconSpark className="h-7 w-7" />

                    <span className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
                  </div>

                  <h3 className="font-bold text-ink-950">
                    ابدأ محادثة مع Ryan
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-ink-900/45">
                    اختبر المبيعات وخدمة العملاء والحجز وتحويل المحادثة للموظف من هنا.
                  </p>

                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {[
                      'عايز أعرف الخدمات',
                      'عايز أحجز خدمة',
                      'عايز أتكلم مع موظف',
                    ].map(suggestion => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() =>
                          setInput(
                            suggestion
                          )
                        }
                        className="rounded-full border border-sand-200 bg-white px-3 py-2 text-xs text-ink-900/65 transition hover:border-ink-300 hover:bg-sand-50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map(
                  message => {
                    const isUser =
                      message.role ===
                      'user'

                    return (
                      <div
                        key={
                          message.id
                        }
                        className={`flex ${
                          isUser
                            ? 'justify-start'
                            : 'justify-end'
                        }`}
                      >
                        <div
                          className={`flex max-w-[88%] md:max-w-[72%] items-end gap-2 ${
                            isUser
                              ? 'flex-row'
                              : 'flex-row-reverse'
                          }`}
                        >
                          {!isUser && (
                            <div className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-950 text-gold-400 shadow-sm">
                              <IconSpark className="h-4 w-4" />
                            </div>
                          )}

                          <div
                            className={`relative px-4 py-3 shadow-sm ${
                              isUser
                                ? 'rounded-2xl rounded-tr-md border border-sand-200 bg-white text-ink-900'
                                : 'rounded-2xl rounded-tl-md bg-ink-950 text-sand-50'
                            }`}
                          >
                            <div className="whitespace-pre-wrap text-sm leading-6">
                              {
                                message.text
                              }
                            </div>

                            <div
                              className={`mt-2 flex items-center justify-end gap-2 text-[10px] ${
                                isUser
                                  ? 'text-ink-900/30'
                                  : 'text-sand-50/40'
                              }`}
                            >
                              <span>
                                {formatMessageTime(
                                  message.createdAt
                                )}
                              </span>

                              {isUser && (
                                <span>
                                  ✓
                                </span>
                              )}
                            </div>

                            {message.actionTaken &&
                              actionLabels[
                                message
                                  .actionTaken
                              ] && (
                                <div
                                  className={`mt-3 border-t pt-2 text-[11px] ${
                                    isUser
                                      ? 'border-ink-900/10 text-ink-900/55'
                                      : 'border-white/10 text-sand-50/55'
                                  }`}
                                >
                                  {
                                    actionLabels[
                                      message.actionTaken
                                    ]
                                  }
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    )
                  }
                )}

                {sending && (
                  <div className="flex justify-end">
                    <div className="flex items-end gap-2">
                      <div className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-950 text-gold-400">
                        <IconSpark className="h-4 w-4" />
                      </div>

                      <div className="rounded-2xl rounded-tl-md bg-ink-950 px-4 py-3 text-sand-50 shadow-sm">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-400" />
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-400 [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-400 [animation-delay:300ms]" />

                          <span className="mr-1 text-[11px] text-sand-50/50">
                            ريان بيكتب...
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* HANDOFF */}

          {paused && (
            <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm text-ink-950">
                    تم تحويل المحادثة لفريق بشري
                  </div>

                  <div className="mt-1 text-xs leading-5 text-ink-900/50">
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
            </div>
          )}

          {/* ERROR */}

          {error && (
            <div className="mx-4 mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* INPUT */}

          <form
            onSubmit={
              handleSend
            }
            className="border-t border-sand-100 bg-white p-4 md:p-5"
          >
            <div className="rounded-2xl border border-sand-200 bg-sand-50/50 p-2 transition focus-within:border-ink-300 focus-within:bg-white focus-within:shadow-sm">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={event =>
                    setInput(
                      event.target
                        .value
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
                        conversationReady &&
                        input.trim()
                      ) {
                        event.currentTarget.form?.requestSubmit()
                      }
                    }
                  }}
                  disabled={
                    paused ||
                    sending ||
                    !conversationReady
                  }
                  rows={1}
                  placeholder={
                    !conversationReady
                      ? 'جاري استعادة المحادثة...'
                      : paused
                        ? 'المحادثة محولة لفريق بشري...'
                        : 'اكتب رسالتك إلى RYAN...'
                  }
                  className="min-h-[48px] max-h-32 flex-1 resize-none border-0 bg-transparent px-3 py-3 text-sm text-ink-950 outline-none placeholder:text-ink-900/30 disabled:cursor-not-allowed disabled:opacity-60"
                />

                <Button
                  type="submit"
                  disabled={
                    paused ||
                    sending ||
                    !conversationReady ||
                    !input.trim()
                  }
                  className="shrink-0"
                >
                  {sending
                    ? 'جاري الإرسال...'
                    : 'إرسال'}
                </Button>
              </div>

              <div className="px-3 pb-1 pt-1 text-[10px] text-ink-900/30">
                Enter للإرسال · Shift + Enter لسطر جديد
              </div>
            </div>
          </form>
        </Card>

        {/* ===================================================
            SIDEBAR
        ==================================================== */}

        <div className="space-y-5">
          {/* STATUS */}

          <Card className="overflow-hidden border-sand-200/80 shadow-sm">
            <div className="border-b border-sand-100 bg-sand-50/50 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-ink-950">
                  حالة RYAN
                </h3>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  متصل
                </span>
              </div>
            </div>

            <div className="space-y-0 p-5 text-sm">
              <div className="flex items-center justify-between gap-3 border-b border-sand-100 py-3 first:pt-0">
                <span className="text-ink-900/45">
                  الشركة
                </span>

                <span className="max-w-[170px] truncate font-medium text-ink-950">
                  {companyName}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 border-b border-sand-100 py-3">
                <span className="text-ink-900/45">
                  Inbox
                </span>

                <span className="font-medium text-ink-950">
                  {conversationId
                    ? 'متصل'
                    : 'لم تبدأ'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 border-b border-sand-100 py-3">
                <span className="text-ink-900/45">
                  آخر نشاط
                </span>

                <span className="font-medium text-ink-950">
                  {lastMessageTime ||
                    'لم تبدأ بعد'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 pt-3">
                <span className="text-ink-900/45">
                  الرصيد الإضافي
                </span>

                <span className="font-semibold text-ink-950">
                  {loadingCredits
                    ? '—'
                    : formatNumber(
                        summary?.purchased_remaining ||
                          0
                      )}
                </span>
              </div>
            </div>
          </Card>

          {/* CAPABILITIES */}

          <Card className="border-sand-200/80 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-100 text-gold-700">
                <IconSpark className="h-4 w-4" />
              </span>

              <h3 className="font-bold text-ink-950">
                قدرات RYAN
              </h3>
            </div>

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
                  className="flex items-start gap-2.5"
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-950 text-gold-400">
                    <span className="text-[9px]">
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

          {/* MANAGEMENT */}

          <Card className="border-sand-200/80 p-5 shadow-sm">
            <h3 className="font-bold text-ink-950">
              إدارة RYAN
            </h3>

            <p className="mt-2 mb-4 text-xs leading-5 text-ink-900/45">
              إدارة المعرفة ومتابعة طلبات التحويل تتم من الأقسام المخصصة.
            </p>

            <div className="space-y-2">
              <a
                href="#/ryan/knowledge"
                className="group flex items-center justify-between rounded-xl border border-sand-200 px-4 py-3 text-sm font-medium text-ink-950 transition hover:border-ink-300 hover:bg-sand-50"
              >
                <span>
                  قاعدة المعرفة
                </span>

                <span className="text-ink-900/30 transition group-hover:text-ink-900/60">
                  ←
                </span>
              </a>

              <a
                href="#/ryan/handoff"
                className="group flex items-center justify-between rounded-xl border border-sand-200 px-4 py-3 text-sm font-medium text-ink-950 transition hover:border-ink-300 hover:bg-sand-50"
              >
                <span>
                  طلبات التحويل
                </span>

                <span className="text-ink-900/30 transition group-hover:text-ink-900/60">
                  ←
                </span>
              </a>

              <a
                href="#/inbox"
                className="flex items-center justify-center rounded-xl bg-ink-950 px-4 py-3 text-sm font-semibold text-sand-50 shadow-sm transition hover:bg-ink-800"
              >
                فتح Inbox
              </a>
            </div>
          </Card>
        </div>
      </div>

      {/* =====================================================
          PURCHASE MODAL
      ====================================================== */}

      {showPurchase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm"
          onMouseDown={event => {
            if (
              event.target ===
                event.currentTarget &&
              !purchasing
            ) {
              setShowPurchase(
                false
              )
            }
          }}
        >
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-white shadow-2xl">
            {/* MODAL HEADER */}

            <div className="sticky top-0 z-10 border-b border-sand-100 bg-white/95 p-5 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-950 text-gold-400">
                    <IconSpark className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="font-bold text-lg text-ink-950">
                      شراء رصيد Ryan
                    </h2>

                    <p className="mt-0.5 text-xs text-ink-900/45">
                      التفعيل بعد مراجعة واعتماد الدفع.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!purchasing) {
                      setShowPurchase(
                        false
                      )
                    }
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-lg text-ink-900/40 transition hover:bg-sand-100 hover:text-ink-950"
                  aria-label="إغلاق"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-5 p-5">
              {!selectedPackage ? (
                <div className="space-y-3">
                  {packages.map(
                    pkg => (
                      <button
                        key={
                          pkg.id
                        }
                        type="button"
                        onClick={() =>
                          setSelectedPackage(
                            pkg
                          )
                        }
                        className="w-full rounded-2xl border border-sand-200 bg-white p-4 text-start transition hover:border-ink-300 hover:bg-sand-50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-bold text-ink-950">
                              {
                                pkg.name
                              }
                            </div>

                            <div className="mt-1 text-sm text-ink-900/50">
                              {formatNumber(
                                pkg.message_count
                              )}{' '}
                              رسالة
                            </div>
                          </div>

                          <div className="shrink-0 font-bold text-ink-950">
                            {Number(
                              pkg.price
                            ).toLocaleString(
                              'ar-EG'
                            )}{' '}
                            {
                              pkg.currency
                            }
                          </div>
                        </div>
                      </button>
                    )
                  )}
                </div>
              ) : (
                <>
                  {/* SELECTED PACKAGE */}

                  <div className="rounded-2xl border border-gold-200 bg-gold-50/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-ink-900/45">
                          الباقة المختارة
                        </div>

                        <div className="mt-1 font-bold text-ink-950">
                          {
                            selectedPackage.name
                          }
                        </div>

                        <div className="mt-1 text-sm text-ink-900/55">
                          {formatNumber(
                            selectedPackage.message_count
                          )}{' '}
                          رسالة
                        </div>
                      </div>

                      <div className="text-start font-bold text-ink-950">
                        {Number(
                          selectedPackage.price
                        ).toLocaleString(
                          'ar-EG'
                        )}{' '}
                        {
                          selectedPackage.currency
                        }
                      </div>
                    </div>
                  </div>

                  {/* PAYMENT METHOD */}

                  <div>
                    <label className="mb-2 block text-sm font-medium text-ink-950">
                      طريقة الدفع
                    </label>

                    <select
                      value={
                        selectedMethod
                      }
                      onChange={event =>
                        setSelectedMethod(
                          event.target
                            .value
                        )
                      }
                      className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:ring-2 focus:ring-ink-900/5"
                    >
                      <option value="">
                        اختر طريقة الدفع
                      </option>

                      {paymentMethods.map(
                        method => (
                          <option
                            key={
                              method.method_key
                            }
                            value={
                              method.method_key
                            }
                          >
                            {
                              method.name
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {/* PAYMENT DETAILS */}

                  {selectedPaymentMethod && (
                    <div className="rounded-2xl border border-sand-200 bg-sand-50 p-4">
                      <div className="mb-3 text-xs font-semibold text-ink-900/60">
                        بيانات الدفع
                      </div>

                      {paymentDetails.length ===
                      0 ? (
                        <div className="text-sm leading-6 text-ink-900/50">
                          اتبع تعليمات الدفع الخاصة بالطريقة المختارة.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {paymentDetails.map(
                            ([
                              key,
                              value,
                            ]) => (
                              <div
                                key={
                                  key
                                }
                              >
                                <span className="block text-[11px] text-ink-900/40">
                                  {
                                    key
                                  }
                                </span>

                                <span className="mt-0.5 block break-words text-sm font-medium text-ink-950">
                                  {typeof value ===
                                  'object'
                                    ? JSON.stringify(
                                        value
                                      )
                                    : String(
                                        value
                                      )}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* REFERENCE */}

                  <div>
                    <label className="mb-2 block text-sm font-medium text-ink-950">
                      رقم العملية
                    </label>

                    <input
                      value={
                        reference
                      }
                      onChange={event =>
                        setReference(
                          event.target
                            .value
                        )
                      }
                      placeholder="أدخل رقم العملية"
                      className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/30 focus:border-ink-700 focus:ring-2 focus:ring-ink-900/5"
                    />
                  </div>

                  {/* DATE */}

                  <div>
                    <label className="mb-2 block text-sm font-medium text-ink-950">
                      تاريخ الدفع
                    </label>

                    <input
                      type="date"
                      value={
                        paymentDate
                      }
                      onChange={event =>
                        setPaymentDate(
                          event.target
                            .value
                        )
                      }
                      className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:ring-2 focus:ring-ink-900/5"
                    />
                  </div>

                  {/* NOTE */}

                  <div>
                    <label className="mb-2 block text-sm font-medium text-ink-950">
                      ملاحظة إضافية
                    </label>

                    <textarea
                      value={
                        paymentNote
                      }
                      onChange={event =>
                        setPaymentNote(
                          event.target
                            .value
                        )
                      }
                      rows={3}
                      placeholder="اختياري"
                      className="w-full resize-none rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/30 focus:border-ink-700 focus:ring-2 focus:ring-ink-900/5"
                    />
                  </div>

                  {purchaseError && (
                    <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm leading-5 text-red-700">
                      {purchaseError}
                    </div>
                  )}

                  {/* ACTIONS */}

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (
                          !purchasing
                        ) {
                          setSelectedPackage(
                            null
                          )

                          setPurchaseError(
                            null
                          )
                        }
                      }}
                      disabled={
                        purchasing
                      }
                    >
                      رجوع
                    </Button>

                    <Button
                      className="flex-1"
                      onClick={
                        submitPurchase
                      }
                      disabled={
                        purchasing ||
                        !selectedMethod ||
                        !reference.trim() ||
                        !paymentDate
                      }
                    >
                      {purchasing
                        ? 'جاري إرسال الطلب...'
                        : 'إرسال طلب الشراء'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
