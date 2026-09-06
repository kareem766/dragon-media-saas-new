import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useSubscription } from '../lib/useSubscription'

const methods = [
  { value: 'vodafone_cash', label: 'فودافون كاش' },
  { value: 'instapay', label: 'InstaPay' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
]

export default function PaymentRequest() {
  const navigate = useNavigate()
  const { subscription, loading: subLoading } = useSubscription()
  const [method, setMethod] = useState('vodafone_cash')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !subscription?.plan) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.rpc('submit_payment_request', {
      p_plan_id: subscription.plan.id,
      p_amount: subscription.plan.price,
      p_method: method,
      p_reference: reference,
      p_date: date,
      p_note: note || null,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/billing')
  }

  if (subLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (!subscription?.plan) {
    return (
      <Card className="p-6">
        <p className="text-sm text-ink-900/60">لازم تختار باقة الأول.</p>
        <Button className="mt-3" onClick={() => navigate('/plans')}>اختيار باقة</Button>
      </Card>
    )
  }

  return (
    <div className="max-w-lg space-y-6">
      <Card className="p-5 bg-ink-950 text-sand-100 border-0">
        <div className="text-sm text-sand-100/60">الباقة المختارة</div>
        <div className="text-xl font-bold mt-1">{subscription.plan.name} — {subscription.plan.price.toLocaleString('ar-EG')} ج.م</div>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-ink-950 mb-1">بيانات التحويل</h3>
        <p className="text-xs text-ink-900/45 mb-4">حوّل المبلغ على أحد الحسابات التالية ثم أرسل بيانات التحويل هنا للمراجعة:</p>
        <div className="text-sm text-ink-900/70 space-y-1 bg-sand-50 rounded-lg p-3.5 border border-sand-200">
          <div>فودافون كاش: 01000000000</div>
          <div>InstaPay: dragonmedia@instapay</div>
          <div>تحويل بنكي: البنك الأهلي — 1234567890</div>
        </div>
      </Card>

      <Card className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-ink-900/50">طريقة الدفع</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white">
              {methods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-ink-900/50">رقم العملية / المرجع</label>
            <input required value={reference} onChange={e => setReference(e.target.value)} className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
          </div>
          <div>
            <label className="text-xs text-ink-900/50">تاريخ التحويل</label>
            <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
          </div>
          <div>
            <label className="text-xs text-ink-900/50">ملاحظات (اختياري)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</div>}
          <Button type="submit" disabled={saving} className="w-full">{saving ? 'جاري الإرسال...' : 'إرسال طلب الدفع للمراجعة'}</Button>
        </form>
      </Card>
    </div>
  )
}
