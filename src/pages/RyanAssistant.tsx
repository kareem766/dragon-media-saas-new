import React, { useState } from 'react'
import { Button, Card } from '../components/ui'
import { IconSpark } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'

interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

const quickQuestions = [
  'إزاي أضيف خدمة جديدة؟',
  'إزاي أضيف معلومة في قاعدة المعرفة؟',
  'إزاي أسجل عميل محتمل في CRM؟',
  'إزاي أحجز موعد لعميل؟',
  'إزاي أحول المحادثة لموظف؟',
  'إزاي أوصل WhatsApp أو Facebook؟',
]

async function readResponse(response: Response): Promise<Record<string, any>> {
  const body = await response.text()
  try {
    const parsed = body ? JSON.parse(body) : {}
    return parsed && typeof parsed === 'object' ? parsed : { error: String(parsed) }
  } catch {
    return {
      error: body?.trim()
        ? `الخادم أرسل استجابة غير صالحة. (${response.status})`
        : `تعذر الاتصال بالخادم. (${response.status})`,
    }
  }
}

export default function RyanAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: 'أهلًا بيك. أنا Ryan المساعد الداخلي للمنصة. اسألني عن أي خطوة داخل Dragon Media وهشرحها لك ببساطة ومنين تبدأ.',
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim()
    if (!text || sending || !supabase) return
    setInput('')
    setError('')
    setSending(true)
    const nextMessages = [...messages, { role: 'user' as const, text }]
    setMessages(nextMessages)

    try {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !data.session?.access_token) throw new Error('انتهت جلسة الدخول، سجل الدخول مرة أخرى.')

      const response = await fetch('/api/ryan-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-12),
        }),
      })

      const result = await readResponse(response)
      if (!response.ok) throw new Error(result?.error || 'تعذر الاتصال بـ Ryan')
      if (!result?.reply) throw new Error('Ryan لم يُرجع ردًا صالحًا.')
      setMessages([...nextMessages, { role: 'model', text: String(result.reply) }])
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء الاتصال بـ Ryan')
    } finally {
      setSending(false)
    }
  }

  return (
    <div dir="rtl" className="space-y-5 pb-8">
      <section className="rounded-3xl bg-ink-950 text-white shadow-xl overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gold-500 text-ink-950">
              <IconSpark className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Ryan — المساعد الداخلي</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                مساعدك داخل Dragon Media. اسأله «أعمل المهمة دي إزاي؟» وسيشرح لك الخطوات والقسم المناسب داخل المنصة.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden">
        <div className="border-b border-ink-900/10 p-4">
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => void send(question)}
                disabled={sending}
                className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-xs font-semibold text-ink-900 transition hover:bg-ink-50 disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[430px] max-h-[58vh] overflow-y-auto space-y-4 p-4 md:p-6 bg-ink-50/40" aria-live="polite">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 ${message.role === 'user' ? 'bg-white border border-ink-900/10 text-ink-900' : 'bg-ink-950 text-white'}`}>
                {message.text}
              </div>
            </div>
          ))}
          {sending && <div className="text-xs text-ink-500">Ryan بيجهز الرد…</div>}
        </div>

        {error && <div className="mx-4 mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void send()
          }}
          className="flex gap-2 border-t border-ink-900/10 p-4"
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="اسأل Ryan: أعمل المهمة دي إزاي؟"
            className="min-w-0 flex-1 rounded-xl border border-ink-900/10 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gold-500/30"
            disabled={sending}
          />
          <Button type="submit" disabled={sending || !input.trim()}>
            إرسال
          </Button>
        </form>
      </Card>
    </div>
  )
}
