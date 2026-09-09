import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Badge, Button } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useSubscription } from '../lib/useSubscription'

interface DBPlan {
  id: string
  name: string
  tagline: string | null
  price: number
  yearly_price: number | null
  currency: string
  features: Record<string, boolean>
  limits: Record<string, number>
  trial_days: number
  is_popular: boolean
}

const featureLabels: Record<string, string> = {
  crm: 'إدارة العملاء (CRM)',
  ryan: 'RYAN AI',
  campaigns: 'الحملات التسويقية',
  automations: 'الأتمتة',
  advanced_reports: 'تقارير متقدمة',
}
const limitLabels: Record<string, string> = {
  users: 'المستخدمون',
  customers: 'العملاء',
  ai_messages: 'رسائل الذكاء الاصطناعي شهريًا',
}

export default function Plans() {
  const navigate = useNavigate()
  const { subscription } = useSubscription()
  const [plans, setPlans] = useState<DBPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')

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

  const allFeatureKeys = Array.from(new Set(plans.flatMap(p => Object.keys(p.features))))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (plans.length === 0) {
    return <div className="text-center py-20 text-sm text-ink-900/40">لا توجد باقات متاحة حاليًا</div>
  }

  return (
    <div className="space-y-10 max-w-5xl mx-auto">
      <div className="text-center space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink-950">اختر الباقة المناسبة لعملك</h1>
        <p className="text-sm text-ink-900/55">ترقية أو تخفيض في أي وقت — من غير أي التزام طويل</p>

        <div className="inline-flex items-center bg-white border border-sand-200 rounded-full p-1">
          <button
            onClick={() => setCycle('monthly')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${cycle === 'monthly' ? 'text-sand-50' : 'text-ink-900/60'}`}
            style={cycle === 'monthly' ? { backgroundColor: 'var(--brand-primary, #0F3D3A)' } : {}}
          >
            شهري
          </button>
          <button
            onClick={() => setCycle('yearly')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${cycle === 'yearly' ? 'text-sand-50' : 'text-ink-900/60'}`}
            style={cycle === 'yearly' ? { backgroundColor: 'var(--brand-primary, #0F3D3A)' } : {}}
          >
            سنوي
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-5 items-start">
        {plans.map(p => {
          const isCurrentPlan = subscription?.plan?.id === p.id && (subscription?.status === 'active' || subscription?.status === 'trialing')
          const monthlyEquivalent = cycle === 'yearly' && p.yearly_price ? Math.round(p.yearly_price / 12) : p.price
          const displayPrice = cycle === 'yearly' && p.yearly_price ? p.yearly_price : p.price
          const savingsPercent = cycle === 'yearly' && p.yearly_price
            ? Math.round(100 - (p.yearly_price / (p.price * 12)) * 100)
            : 0

          return (
            <div key={p.id} style={p.is_popular ? { borderColor: 'var(--brand-accent, #B4903D)' } as React.CSSProperties : undefined}>
            <Card
              className={`p-6 flex flex-col relative ${p.is_popular ? 'border-2' : ''}`}
            >
              {p.is_popular && (
                <div
                  className="absolute -top-3 right-6 text-xs font-bold text-white px-3 py-1 rounded-full"
                  style={{ backgroundColor: 'var(--brand-accent, #B4903D)' }}
                >
                  الأكثر شعبية
                </div>
              )}
              <h3 className="font-bold text-lg text-ink-950 mt-2">{p.name}</h3>
              {p.tagline && <p className="text-xs text-ink-900/50 mt-1">{p.tagline}</p>}

              <div className="mt-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-ink-950">{monthlyEquivalent.toLocaleString('ar-EG')}</span>
                  <span className="text-sm text-ink-900/50">{p.currency} / شهريًا</span>
                </div>
                {cycle === 'yearly' && p.yearly_price ? (
                  <div className="text-xs text-ink-900/45 mt-1">
                    {displayPrice.toLocaleString('ar-EG')} {p.currency} تُدفع سنويًا
                    {savingsPercent > 0 && (
                      <span className="mr-1 font-semibold" style={{ color: 'var(--brand-accent, #B4903D)' }}>— وفر {savingsPercent}%</span>
                    )}
                  </div>
                ) : (
                  p.trial_days > 0 && <div className="text-xs text-ink-900/45 mt-1">تجربة مجانية {p.trial_days} أيام</div>
                )}
              </div>

              <ul className="mt-5 space-y-2 text-sm text-ink-900/70 flex-1">
                {Object.entries(p.features).filter(([, v]) => v).map(([k]) => (
                  <li key={k} className="flex items-center gap-2">
                    <span style={{ color: 'var(--brand-primary, #0F3D3A)' }}>✓</span> {featureLabels[k] ?? k}
                  </li>
                ))}
                <li className="pt-2 border-t border-sand-100 mt-2 text-xs text-ink-900/45">
                  حتى {p.limits.users ?? '—'} مستخدمين · {p.limits.customers ?? '—'} عميل
                </li>
              </ul>

              <Button
                onClick={() => handleSelect(p.id)}
                disabled={selecting === p.id || isCurrentPlan}
                variant={p.is_popular ? 'primary' : 'secondary'}
                className="mt-5"
              >
                {isCurrentPlan ? 'باقتك الحالية' : selecting === p.id ? 'جاري الاختيار...' : subscription?.plan ? 'ترقية الباقة' : 'اشترك الآن'}
              </Button>
            </Card>
          )
        })}
      </div>

      <Card className="p-2 sm:p-5 overflow-x-auto">
        <h2 className="font-bold text-ink-950 px-3 pt-3">مقارنة تفصيلية بين الباقات</h2>
        <table className="w-full text-sm mt-4">
          <thead>
            <tr className="text-ink-900/45 border-b border-sand-200">
              <th className="text-right font-medium py-3 px-3">الميزة</th>
              {plans.map(p => <th key={p.id} className="text-center font-medium py-3 px-3">{p.name}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-100">
            {allFeatureKeys.map(key => (
              <tr key={key}>
                <td className="py-3 px-3 text-ink-900">{featureLabels[key] ?? key}</td>
                {plans.map(p => (
                  <td key={p.id} className="text-center py-3 px-3">
                    {p.features[key] ? <span style={{ color: 'var(--brand-primary, #0F3D3A)' }}>✓</span> : <span className="text-ink-900/25">—</span>}
                  </td>
                ))}
              </tr>
            ))}
            {Object.keys(limitLabels).map(key => (
              <tr key={key}>
                <td className="py-3 px-3 text-ink-900">{limitLabels[key]}</td>
                {plans.map(p => (
                  <td key={p.id} className="text-center py-3 px-3 text-ink-900/70">{p.limits?.[key] ?? '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
