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
  create_lead:
    'تم تسجيل العميل المحتمل في CRM',

  create_deal:
    'تم إنشاء الصفقة في مسار المبيعات',

  book_appointment:
    'تم تسجيل الموعد بنجاح',

  request_human_handoff:
    'تم تحويل المحادثة إلى فريق الدعم',
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

function getPaymentDetails(
  method: PaymentMethod | null
) {
  if (!method?.details) {
    return []
  }

  return Object.entries(
    method.details
  ).filter(
    ([, value]) =>
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ''
  )
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

  const [
    summary,
    setSummary,
  ] = useState<RyanSummary | null>(null)

  const [
    packages,
    setPackages,
  ] = useState<RyanPackage[]>([])

  const [
    paymentMethods,
    setPaymentMethods,
  ] = useState<PaymentMethod[]>([])

  const [
    purchases,
    setPurchases,
  ] = useState<RyanPurchase[]>([])

  const [
    loadingCredits,
    setLoadingCredits,
  ] = useState(true)

  const [
    creditsError,
    setCreditsError,
  ] = useState<string | null>(null)

  const [
    showPurchase,
    setShowPurchase,
  ] = useState(false)

  const [
    selectedPackage,
    setSelectedPackage,
  ] = useState<RyanPackage | null>(null)

  const [
    selectedMethod,
    setSelectedMethod,
  ] = useState('')

  const [
    reference,
    setReference,
  ] = useState('')

  const [
    paymentDate,
    setPaymentDate,
  ] = useState(
    new Date()
      .toISOString()
      .slice(0, 10)
  )

  const [
    paymentNote,
    setPaymentNote,
  ] = useState('')

  const [
    purchasing,
    setPurchasing,
  ] = useState(false)

  const [
    purchaseError,
    setPurchaseError,
  ] = useState<string | null>(null)

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

      if (
        !cancelled &&
        data?.name
      ) {
        setCompanyName(data.name)
      }
    }

    loadCompany()

    return () => {
      cancelled = true
    }
  }, [organizationId])

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
          Array.isArray(data.packages)
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
          Array.isArray(data.purchases)
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
      loadRyanCredits()
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

      const date =
        new Date(
          last.createdAt
        )

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
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

        await loadRyanCredits()
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

      const history =
        messages.map(
          message => ({
            role:
              message.role,
            parts: [
              {
                text:
                  message.text,
              },
            ],
          })
        )

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
        text:
          data.reply,
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

      await loadRyanCredits()
    } catch (
      requestError: any
    ) {
      setError(
        requestError?.message ||
          'تعذر الاتصال بـ RYAN'
      )

      await loadRyanCredits()
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

      {/* HERO */}

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

            <Button
              variant="secondary"
              onClick={
                handleNewConversation
              }
            >
              محادثة جديدة
            </Button>

          </div>

          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mt-7">

            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="text-xs text-sand-100/45">
                رسائل المحادثة
              </div>

              <div className="text-lg font-bold mt-1">
                {formatNumber(
                  messageCount
                )}
              </div>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="text-xs text-sand-100/45">
                حد الخطة الشهري
              </div>

              <div className="text-lg font-bold mt-1">
                {loadingCredits
                  ? '—'
                  : formatNumber(
                      summary?.base_limit ||
                        0
                    )}
              </div>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="text-xs text-sand-100/45">
                المستخدم هذا الشهر
              </div>

              <div className="text-lg font-bold mt-1">
                {loadingCredits
                  ? '—'
                  : formatNumber(
                      summary?.monthly_used ||
                        0
                    )}
              </div>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="text-xs text-sand-100/45">
                المتاح الإجمالي
              </div>

              <div className="text-lg font-bold mt-1">
                {loadingCredits
                  ? '—'
                  : formatNumber(
                      summary?.total_remaining ||
                        0
                    )}
              </div>
            </div>

          </div>

        </div>
      </Card>

      {/* USAGE */}

      <Card className="p-5 md:p-6">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          <div>

            <h2 className="font-bold text-ink-950">
              استهلاك RYAN
            </h2>

            <p className="text-sm text-ink-900/45 mt-1">
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

          <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {creditsError}
          </div>

        ) : loadingCredits ? (

          <div className="mt-6 space-y-3">

            <div className="h-3 rounded-full bg-sand-100 animate-pulse" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

              <div className="h-20 rounded-xl bg-sand-50 animate-pulse" />
              <div className="h-20 rounded-xl bg-sand-50 animate-pulse" />
              <div className="h-20 rounded-xl bg-sand-50 animate-pulse" />

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
                )}{' '}
                /{' '}
                {formatNumber(
                  summary?.base_limit ||
                    0
                )}
              </span>

            </div>

            <div className="mt-2 h-3 rounded-full bg-sand-100 overflow-hidden">

              <div
                className="h-full bg-ink-900 rounded-full transition-all duration-500"
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
                )}%
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

              <div className="rounded-xl border border-sand-200 p-4">

                <div className="text-xs text-ink-900/45">
                  المتبقي من الخطة
                </div>

                <div className="text-xl font-bold text-ink-950 mt-1">
                  {formatNumber(
                    summary?.base_remaining ||
                      0
                  )}
                </div>

              </div>

              <div className="rounded-xl border border-sand-200 p-4">

                <div className="text-xs text-ink-900/45">
                  الرصيد الإضافي
                </div>

                <div className="text-xl font-bold text-ink-950 mt-1">
                  {formatNumber(
                    summary?.purchased_remaining ||
                      0
                  )}
                </div>

              </div>

              <div className="rounded-xl border border-sand-200 p-4">

                <div className="text-xs text-ink-900/45">
                  المتاح الإجمالي
                </div>

                <div className="text-xl font-bold text-ink-950 mt-1">
                  {formatNumber(
                    summary?.total_remaining ||
                      0
                  )}
                </div>

              </div>

            </div>

          </>
        )}

      </Card>

      {/* CREDIT PACKAGES */}

      <Card className="p-5 md:p-6">

        <div className="mb-5">

          <h2 className="font-bold text-ink-950">
            باقات رصيد Ryan
          </h2>

          <p className="text-sm text-ink-900/45 mt-1">
            اشترِ رسائل إضافية بدون تغيير حد الرسائل الأساسي في خطتك.
          </p>

        </div>

        {loadingCredits ? (

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {[1, 2, 3].map(
              item => (
                <div
                  key={item}
                  className="h-36 rounded-2xl bg-sand-50 animate-pulse"
                />
              )
            )}

          </div>

        ) : packages.length === 0 ? (

          <div className="rounded-xl border border-sand-200 p-5 text-sm text-ink-900/50">
            لا توجد باقات رصيد متاحة حاليًا.
          </div>

        ) : (

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

            {packages.map(
              pkg => (
                <div
                  key={pkg.id}
                  className="rounded-2xl border border-sand-200 p-5 hover:border-ink-300 transition"
                >

                  <div className="flex items-start justify-between gap-3">

                    <div>

                      <h3 className="font-bold text-ink-950">
                        {pkg.name}
                      </h3>

                      <div className="text-sm text-ink-900/50 mt-1">
                        {formatNumber(
                          pkg.message_count
                        )}{' '}
                        رسالة
                      </div>

                    </div>

                    <div className="text-left shrink-0">

                      <div className="font-bold text-lg text-ink-950">
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
                    <p className="text-xs text-ink-900/45 leading-5 mt-3">
                      {pkg.description}
                    </p>
                  )}

                  <Button
                    className="w-full mt-5"
                    onClick={() =>
                      openPurchase(
                        pkg
                      )
                    }
                  >
                    شراء الباقة
                  </Button>

                </div>
              )
            )}

          </div>

        )}

      </Card>

      {/* PURCHASE HISTORY */}

      {purchases.length > 0 && (
        <Card className="p-5 md:p-6">

          <div className="mb-5">

            <h2 className="font-bold text-ink-950">
              سجل طلبات رصيد Ryan
            </h2>

            <p className="text-sm text-ink-900/45 mt-1">
              جميع الطلبات السابقة وحالتها الحالية.
            </p>

          </div>

          <div className="space-y-3">

            {purchases.map(
              purchase => (
                <div
                  key={purchase.id}
                  className="rounded-xl border border-sand-200 p-4"
                >

                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                    <div>

                      <div className="font-semibold text-ink-950">
                        {purchase.package_name}
                      </div>

                      <div className="text-xs text-ink-900/45 mt-1">
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

                      <div className="text-[11px] text-ink-900/35 mt-1">
                        {new Date(
                          purchase.created_at
                        ).toLocaleDateString(
                          'ar-EG'
                        )}
                      </div>

                    </div>

                    <div className="flex flex-col md:items-end gap-1">

                      <span className="text-sm font-semibold">
                        {purchase.status ===
                        'approved'
                          ? `متبقي ${formatNumber(
                              purchase.credits_remaining
                            )} رسالة`
                          : statusLabels[
                              purchase.status
                            ] ||
                            purchase.status}
                      </span>

                      {purchase.status ===
                        'rejected' &&
                        purchase.rejection_reason && (
                          <span className="text-xs text-red-600">
                            السبب: {purchase.rejection_reason}
                          </span>
                        )}

                    </div>

                  </div>

                </div>
              )
            )}

          </div>

        </Card>
      )}

      {/* CHAT */}

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

        {/* SIDEBAR */}

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

              <div className="flex items-center justify-between gap-3">

                <span className="text-ink-900/50">
                  الشركة
                </span>

                <span className="font-medium text-ink-950 truncate max-w-[170px]">
                  {companyName}
                </span>

              </div>

              <div className="flex items-center justify-between gap-3">

                <span className="text-ink-900/50">
                  Inbox
                </span>

                <span className="font-medium text-ink-950">
                  {conversationId
                    ? 'متصل'
                    : 'لم تبدأ'}
                </span>

              </div>

              <div className="flex items-center justify-between gap-3">

                <span className="text-ink-900/50">
                  آخر نشاط
                </span>

                <span className="font-medium text-ink-950">
                  {lastMessageTime ||
                    'لم تبدأ بعد'}
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
              ].map(
                item => (
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
                )
              )}

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

      {/* PURCHASE MODAL */}

      {showPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/50">

          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">

            <div className="p-5 border-b border-sand-100">

              <div className="flex items-center justify-between gap-3">

                <div>

                  <h2 className="font-bold text-lg text-ink-950">
                    شراء رصيد Ryan
                  </h2>

                  <p className="text-xs text-ink-900/45 mt-1">
                    سيتم إضافة الرصيد بعد مراجعة الدفع واعتماده من الإدارة.
                  </p>

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
                  className="w-8 h-8 rounded-lg hover:bg-sand-100 text-ink-900/50"
                  aria-label="إغلاق"
                >
                  ×
                </button>

              </div>

            </div>

            <div className="p-5 space-y-5">

              {!selectedPackage ? (

                <div className="space-y-3">

                  {packages.map(
                    pkg => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() =>
                          setSelectedPackage(
                            pkg
                          )
                        }
                        className="w-full text-right rounded-xl border border-sand-200 p-4 hover:bg-sand-50 transition"
                      >

                        <div className="flex items-center justify-between gap-3">

                          <div>

                            <div className="font-bold text-ink-950">
                              {pkg.name}
                            </div>

                            <div className="text-sm text-ink-900/50 mt-1">
                              {formatNumber(
                                pkg.message_count
                              )}{' '}
                              رسالة
                            </div>

                          </div>

                          <div className="font-bold text-ink-950 shrink-0">
                            {Number(
                              pkg.price
                            ).toLocaleString(
                              'ar-EG'
                            )}{' '}
                            {pkg.currency}
                          </div>

                        </div>

                      </button>
                    )
                  )}

                </div>

              ) : (

                <>

                  <div className="rounded-xl bg-sand-50 border border-sand-200 p-4">

                    <div className="flex items-center justify-between gap-3">

                      <div>

                        <div className="text-xs text-ink-900/45">
                          الباقة المختارة
                        </div>

                        <div className="font-bold text-ink-950 mt-1">
                          {selectedPackage.name}
                        </div>

                        <div className="text-sm text-ink-900/55 mt-1">
                          {formatNumber(
                            selectedPackage.message_count
                          )}{' '}
                          رسالة
                        </div>

                      </div>

                      <div className="text-left font-bold text-ink-950">
                        {Number(
                          selectedPackage.price
                        ).toLocaleString(
                          'ar-EG'
                        )}{' '}
                        {selectedPackage.currency}
                      </div>

                    </div>

                  </div>

                  <div>

                    <label className="block text-sm font-medium text-ink-950 mb-2">
                      طريقة الدفع
                    </label>

                    <select
                      value={
                        selectedMethod
                      }
                      onChange={event =>
                        setSelectedMethod(
                          event.target.value
                        )
                      }
                      className="w-full border border-sand-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-ink-700"
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
                            {method.name}
                          </option>
                        )
                      )}

                    </select>

                  </div>

                  {selectedPaymentMethod && (
                    <div className="rounded-xl border border-sand-200 bg-sand-50 p-4">

                      <div className="text-xs font-semibold text-ink-900/60 mb-3">
                        بيانات الدفع
                      </div>

                      {paymentDetails.length ===
                      0 ? (

                        <div className="text-sm text-ink-900/50">
                          اتبع تعليمات الدفع الخاصة بالطريقة المختارة.
                        </div>

                      ) : (

                        <div className="space-y-2">

                          {paymentDetails.map(
                            ([key, value]) => (
                              <div
                                key={key}
                                className="flex flex-col gap-0.5"
                              >

                                <span className="text-[11px] text-ink-900/40">
                                  {key}
                                </span>

                                <span className="text-sm font-medium text-ink-950 break-words">
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

                  <div>

                    <label className="block text-sm font-medium text-ink-950 mb-2">
                      رقم العملية
                    </label>

                    <input
                      value={
                        reference
                      }
                      onChange={event =>
                        setReference(
                          event.target.value
                        )
                      }
                      placeholder="أدخل رقم العملية"
                      className="w-full border border-sand-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-ink-700"
                    />

                  </div>

                  <div>

                    <label className="block text-sm font-medium text-ink-950 mb-2">
                      تاريخ الدفع
                    </label>

                    <input
                      type="date"
                      value={
                        paymentDate
                      }
                      onChange={event =>
                        setPaymentDate(
                          event.target.value
                        )
                      }
                      className="w-full border border-sand-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-ink-700"
                    />

                  </div>

                  <div>

                    <label className="block text-sm font-medium text-ink-950 mb-2">
                      ملاحظة إضافية
                    </label>

                    <textarea
                      value={
                        paymentNote
                      }
                      onChange={event =>
                        setPaymentNote(
                          event.target.value
                        )
                      }
                      rows={3}
                      placeholder="اختياري"
                      className="w-full border border-sand-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-ink-700 resize-none"
                    />

                  </div>

                  {purchaseError && (
                    <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                      {purchaseError}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">

                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (!purchasing) {
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
