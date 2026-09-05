import React, { useState } from 'react'
import { Card, Badge, Button } from '../components/ui'
import { IconSpark } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface ChatMessage {
  role: 'user' | 'model'
  text: string
  actionTaken?: string | null
}

export default function Ryan() {
  const { organizationId } = useOrganization()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !supabase) return
    const userMessage = input.trim()
    setInput('')
    setError(null)
    setMessages(prev => [...prev, { role: 'user', text: userMessage }])
    setSending(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      let companyName = 'الشركة'
      if (organizationId) {
        const { data: org } = await supabase.from('organizations').select('name').eq('id', organizationId).single()
        if (org?.name) companyName = org.name
      }

      const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }))
      const res = await fetch('/api/ryan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, history, companyName, accessToken }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(`${data.error || 'حدث خطأ'} — ${JSON.stringify(data.details ?? '')}`.slice(0, 300))
        return
      }
      setMessages(prev => [...prev, { role: 'model', text: data.reply, actionTaken: data.actionTaken }])
    } catch {
      setError('تعذر الاتصال بـ RYAN، حاول تاني')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-ink-950 text-sand-100 border-0">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gold-500 text-ink-950 flex items-center justify-center">
            <IconSpark className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold">RYAN AI</h2>
            <p className="text-sand-100/60 text-sm mt-1">موظف المبيعات وخدمة العملاء الذكي — بيقدر يسجّل عملاء محتملين فعليًا في CRM</p>
          </div>
          <Badge tone="success">يعمل الآن</Badge>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-ink-950 mb-4">جرّب RYAN مباشرة</h3>
        <div className="border border-sand-200 rounded-xl h-80 overflow-y-auto p-4 space-y-3 bg-sand-50/50">
          {messages.length === 0 && (
            <div className="text-sm text-ink-900/40 text-center py-10">
              جرّب تكتب حاجة زي: "أنا مهتم بالخدمة، اسمي محمد ورقمي 01012345678" وشوف ريان بيسجّلك فعليًا في CRM
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i}>
              <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${m.role === 'user' ? 'bg-white border border-sand-200 mr-auto rounded-tr-sm' : 'bg-ink-900 text-sand-50 ml-auto rounded-tl-sm'}`}>
                {m.text}
              </div>
              {m.actionTaken === 'create_lead' && (
                <div className="text-xs text-emerald-600 mt-1.5 mr-1">✅ تم تسجيل العميل في CRM تلقائيًا</div>
              )}
            </div>
          ))}
          {sending && <div className="text-xs text-ink-900/40">ريان بيكتب...</div>}
        </div>
        {error && <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</div>}
        <form onSubmit={handleSend} className="flex gap-2 mt-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="اكتب رسالة تجريبية..."
            className="flex-1 border border-sand-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-ink-700"
          />
          <Button type="submit" disabled={sending}>إرسال</Button>
        </form>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-ink-950 mb-3">قدرات RYAN الحالية</h3>
        <ul className="text-sm text-ink-900/55 space-y-2">
          <li>✅ الرد على استفسارات العملاء</li>
          <li>✅ تسجيل عميل محتمل جديد تلقائيًا في CRM عند إبداء اهتمام حقيقي</li>
          <li>⏳ إنشاء صفقة، حجز موعد، تلخيص المحادثة — قريبًا</li>
        </ul>
      </Card>
    </div>
  )
}
