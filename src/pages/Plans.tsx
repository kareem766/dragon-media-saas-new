import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Badge, Button } from '../components/ui'
import { supabase } from '../lib/supabaseClient'

interface DBPlan {
  id: string
  name: string
  price: number
  currency: string
  billing_cycle: string
  features: Record<string, boolean>
  limits: Record<string, number>
  trial_days: number
}

const featureLabels: Record<string, string> = {
  crm: 'إدارة العملاء (CRM)',
  ryan: 'RYAN AI',
  campaigns: 'الحملات التسويقية',
  automations: 'الأتمتة',
  advanced_reports: 'تقارير متقدمة',
}

export default function Plans() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<DBPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.from('plans').select('*').eq('status', 'active').order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data) setPlans(data as DBPlan[])
        setLoading(false)
      })
  }, [])

  const handleSelect = async (planId: string) => {
    if (!supabase) return
    setSelecting(planId)
    const { error } = await supabase.rpc('select_plan', { p_plan_id: planId })
    setSelecting(null)
    if (!error) navigate('/billing/pay')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-950">اختر باقتك</h1>
        <p className="text-sm text-ink-900/50 mt-1">اختر الباقة المناسبة لحجم عملك، وتقدر تطلب ترقية أو تخفيض في أي وقت.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        {plans.map(p => (
          <Card key={p.id} className="p-6 flex flex-col">
            <h3 className="font-bold text-lg text-ink-950">{p.name}</h3>
            <div className="text-2xl font-bold text-ink-950 mt-2">
              {p.price.toLocaleString('ar-EG')} {p.currency}
              <span className="text-sm font-normal text-ink-900/50"> / {p.billing_cycle === 'monthly' ? 'شهريًا' : 'سنويًا'}</span>
            </div>
            {p.trial_days > 0 && <Badge tone="gold">تجربة مجانية {p.trial_days} أيام</Badge>}
            <ul className="mt-4 space-y-2 text-sm text-ink-900/60 flex-1">
              {Object.entries(p.features).filter(([, v]) => v).map(([k]) => (
                <li key={k}>✓ {featureLabels[k] ?? k}</li>
              ))}
              <li className="text-ink-900/40 pt-2 border-t border-sand-100 mt-2">
                حتى {p.limits.users ?? '—'} مستخدمين · {p.limits.customers ?? '—'} عميل
              </li>
            </ul>
            <Button onClick={() => handleSelect(p.id)} disabled={selecting === p.id} className="mt-4">
              {selecting === p.id ? 'جاري الاختيار...' : 'اختيار هذه الباقة'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
