import React, { useEffect, useState } from 'react'
import { Card } from '../components/ui'
import { supabase } from '../lib/supabaseClient'

type Plan = {
  id: string
  name: string
  price: number
  yearly_price: number | null
  status: string
  limits: Record<string, number> | null
}

export default function AdminRyanPackages() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase) { setError('قاعدة البيانات غير متاحة.'); setLoading(false); return }
      const { data, error: queryError } = await supabase
        .from('plans')
        .select('id,name,price,yearly_price,status,limits')
        .order('sort_order', { ascending: true })
      if (cancelled) return
      if (queryError) setError('تعذر تحميل إعدادات باقات Ryan.')
      else setPlans((data ?? []) as Plan[])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div dir="rtl" className="space-y-6 dm-page-enter">
      <div className="rounded-3xl border border-ink-900/10 bg-gradient-to-br from-ink-950 via-ink-900 to-slate-800 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex rounded-full border border-gold-300/20 bg-gold-300/10 px-3 py-1 text-xs font-semibold text-gold-200">RYAN AI</span>
            <h1 className="mt-3 text-2xl font-black">باقات وحدود Ryan</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-white/65">هذه الصفحة تعرض حدود رسائل Ryan المضمنة في الباقات الحالية. التفعيل الفعلي للحدود يتم من إعدادات الباقات الأساسية لضمان مصدر واحد للصلاحيات.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">عداد الرسائل مرتبط بـ limits.ai_messages</div>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1,2,3].map((item) => <div key={item} className="h-56 animate-pulse rounded-3xl bg-ink-900/5" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const messages = plan.limits?.ai_messages ?? 0
            const users = plan.limits?.users ?? 0
            return (
              <Card key={plan.id} className="group relative overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="absolute -left-10 -top-10 h-24 w-24 rounded-full bg-gold-400/10 blur-2xl transition-transform duration-500 group-hover:scale-150" />
                <div className="relative">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-black text-ink-950">{plan.name}</h2>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{plan.status === 'active' ? 'فعالة' : 'غير فعالة'}</span>
                  </div>
                  <div className="mt-5 text-3xl font-black text-ink-950">{messages.toLocaleString('ar-EG')} <span className="text-sm font-semibold text-ink-900/50">رسالة Ryan / شهر</span></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-2xl bg-ink-900/5 p-3"><div className="text-ink-900/45">المستخدمون</div><div className="mt-1 font-bold">{users.toLocaleString('ar-EG')}</div></div>
                    <div className="rounded-2xl bg-ink-900/5 p-3"><div className="text-ink-900/45">السعر</div><div className="mt-1 font-bold">{Number(plan.price || 0).toLocaleString('ar-EG')} EGP</div></div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
