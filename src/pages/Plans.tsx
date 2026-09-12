import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button } from '../components/ui'
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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadPlans = async () => {
      if (!supabase) {
        setLoading(false)
        setError('قاعدة البيانات غير متاحة حاليًا.')
        return
      }

      setLoading(true)
      setError(null)

      const { data, error: queryError } = await supabase
        .from('plans')
        .select('*')
        .eq('status', 'active')
        .order('sort_order', { ascending: true })

      if (cancelled) return

      if (queryError) {
        setPlans([])
        setError('تعذر تحميل الباقات حاليًا.')
      } else {
        setPlans((data ?? []) as DBPlan[])
      }

      setLoading(false)
    }

    loadPlans()

    return () => {
      cancelled = true
    }
  }, [])

  const hasYearlyPricing = plans.some(
    (plan) => plan.yearly_price !== null && plan.yearly_price > 0
  )

  const handleSelect = async (plan: DBPlan) => {
    if (!supabase) {
      setError('قاعدة البيانات غير متاحة حاليًا.')
      return
    }

    if (cycle === 'yearly' && (!plan.yearly_price || plan.yearly_price <= 0)) {
      setError('الاشتراك السنوي غير متاح لهذه الباقة حاليًا.')
      return
    }

    setSelecting(plan.id)
    setError(null)

    /*
     * Do not change the active subscription here.
     *
     * The selected plan is carried to the payment page.
     * The subscription remains unchanged until the payment request
     * is reviewed and approved by the platform admin.
     */
    setSelecting(null)

    navigate(
      `/billing/pay?cycle=${cycle}&plan_id=${encodeURIComponent(plan.id)}`
    )
  }

  const allFeatureKeys = Array.from(
    new Set(plans.flatMap((plan) => Object.keys(plan.features ?? {})))
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-sm text-ink-900/50">
          {error ?? 'لا توجد باقات متاحة حاليًا'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10 max-w-5xl mx-auto">
      <div className="text-center space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink-950">
          اختر الباقة المناسبة لعملك
        </h1>

        <p className="text-sm text-ink-900/55">
          اختر دورة الفوترة المناسبة لك وابدأ اشتراكك
        </p>

        <div className="inline-flex items-center bg-white border border-sand-200 rounded-full p-1">
          <button
            type="button"
            onClick={() => {
              setCycle('monthly')
              setError(null)
            }}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              cycle === 'monthly'
                ? 'text-sand-50'
                : 'text-ink-900/60'
            }`}
            style={
              cycle === 'monthly'
                ? { backgroundColor: 'var(--brand-primary, #0F3D3A)' }
                : {}
            }
          >
            شهري
          </button>

          <button
            type="button"
            onClick={() => {
              if (!hasYearlyPricing) return

              setCycle('yearly')
              setError(null)
            }}
            disabled={!hasYearlyPricing}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              cycle === 'yearly'
                ? 'text-sand-50'
                : 'text-ink-900/60'
            } ${
              !hasYearlyPricing
                ? 'opacity-40 cursor-not-allowed'
                : ''
            }`}
            style={
              cycle === 'yearly'
                ? { backgroundColor: 'var(--brand-primary, #0F3D3A)' }
                : {}
            }
          >
            سنوي
          </button>
        </div>

        {!hasYearlyPricing && (
          <p className="text-xs text-ink-900/40">
            الاشتراك السنوي غير متاح حاليًا
          </p>
        )}

        {error && (
          <div className="max-w-lg mx-auto text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
            {error}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-5 items-start">
        {plans.map((plan) => {
          const isCurrentPlan =
            subscription?.plan?.id === plan.id &&
            (subscription?.status === 'active' ||
              subscription?.status === 'trialing')

          const hasYearlyPrice =
            plan.yearly_price !== null &&
            plan.yearly_price > 0

          const monthlyEquivalent =
            cycle === 'yearly' && hasYearlyPrice
              ? Math.round((plan.yearly_price as number) / 12)
              : plan.price

          const displayPrice =
            cycle === 'yearly' && hasYearlyPrice
              ? (plan.yearly_price as number)
              : plan.price

          const savingsPercent =
            cycle === 'yearly' && hasYearlyPrice
              ? Math.max(
                  0,
                  Math.round(
                    100 -
                      ((plan.yearly_price as number) /
                        (plan.price * 12)) *
                        100
                  )
                )
              : 0

          const yearlyUnavailable =
            cycle === 'yearly' && !hasYearlyPrice

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl p-6 flex flex-col relative border ${
                plan.is_popular
                  ? 'border-2'
                  : 'border-sand-200'
              }`}
              style={
                plan.is_popular
                  ? {
                      borderColor:
                        'var(--brand-accent, #B4903D)',
                    }
                  : undefined
              }
            >
              {plan.is_popular && (
                <div
                  className="absolute -top-3 right-6 text-xs font-bold text-white px-3 py-1 rounded-full"
                  style={{
                    backgroundColor:
                      'var(--brand-accent, #B4903D)',
                  }}
                >
                  الأكثر شعبية
                </div>
              )}

              <h3 className="font-bold text-lg text-ink-950 mt-2">
                {plan.name}
              </h3>

              {plan.tagline && (
                <p className="text-xs text-ink-900/50 mt-1">
                  {plan.tagline}
                </p>
              )}

              <div className="mt-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-ink-950">
                    {monthlyEquivalent.toLocaleString('ar-EG')}
                  </span>

                  <span className="text-sm text-ink-900/50">
                    {plan.currency} / شهريًا
                  </span>
                </div>

                {cycle === 'yearly' && hasYearlyPrice ? (
                  <div className="text-xs text-ink-900/45 mt-1">
                    {displayPrice.toLocaleString('ar-EG')}{' '}
                    {plan.currency} تُدفع سنويًا

                    {savingsPercent > 0 && (
                      <span
                        className="mr-1 font-semibold"
                        style={{
                          color:
                            'var(--brand-accent, #B4903D)',
                        }}
                      >
                        — وفر {savingsPercent}%
                      </span>
                    )}
                  </div>
                ) : cycle === 'yearly' && yearlyUnavailable ? (
                  <div className="text-xs text-red-600 mt-1">
                    الاشتراك السنوي غير متاح لهذه الباقة
                  </div>
                ) : (
                  plan.trial_days > 0 && (
                    <div className="text-xs text-ink-900/45 mt-1">
                      تجربة مجانية {plan.trial_days} أيام
                    </div>
                  )
                )}
              </div>

              <ul className="mt-5 space-y-2 text-sm text-ink-900/70 flex-1">
                {Object.entries(plan.features ?? {})
                  .filter(([, value]) => value)
                  .map(([key]) => (
                    <li
                      key={key}
                      className="flex items-center gap-2"
                    >
                      <span
                        style={{
                          color:
                            'var(--brand-primary, #0F3D3A)',
                        }}
                      >
                        ✓
                      </span>

                      {featureLabels[key] ?? key}
                    </li>
                  ))}

                <li className="pt-2 border-t border-sand-100 mt-2 text-xs text-ink-900/45">
                  حتى {plan.limits?.users ?? '—'} مستخدمين ·{' '}
                  {plan.limits?.customers ?? '—'} عميل
                </li>
              </ul>

              <Button
                onClick={() => handleSelect(plan)}
                disabled={
                  selecting === plan.id ||
                  isCurrentPlan ||
                  yearlyUnavailable
                }
                variant={plan.is_popular ? 'primary' : 'secondary'}
                className="mt-5"
              >
                {isCurrentPlan
                  ? 'باقتك الحالية'
                  : selecting === plan.id
                    ? 'جاري الاختيار...'
                    : yearlyUnavailable
                      ? 'السنوي غير متاح'
                      : subscription?.plan
                        ? 'ترقية الباقة'
                        : 'اشترك الآن'}
              </Button>
            </div>
          )
        })}
      </div>

      <div className="bg-white border border-sand-200 rounded-2xl p-2 sm:p-5 overflow-x-auto">
        <h2 className="font-bold text-ink-950 px-3 pt-3">
          مقارنة تفصيلية بين الباقات
        </h2>

        <table className="w-full text-sm mt-4">
          <thead>
            <tr className="text-ink-900/45 border-b border-sand-200">
              <th className="text-right font-medium py-3 px-3">
                الميزة
              </th>

              {plans.map((plan) => (
                <th
                  key={plan.id}
                  className="text-center font-medium py-3 px-3"
                >
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-sand-100">
            {allFeatureKeys.map((key) => (
              <tr key={key}>
                <td className="py-3 px-3 text-ink-900">
                  {featureLabels[key] ?? key}
                </td>

                {plans.map((plan) => (
                  <td
                    key={plan.id}
                    className="text-center py-3 px-3"
                  >
                    {plan.features?.[key] ? (
                      <span
                        style={{
                          color:
                            'var(--brand-primary, #0F3D3A)',
                        }}
                      >
                        ✓
                      </span>
                    ) : (
                      <span className="text-ink-900/25">
                        —
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}

            {Object.keys(limitLabels).map((key) => (
              <tr key={key}>
                <td className="py-3 px-3 text-ink-900">
                  {limitLabels[key]}
                </td>

                {plans.map((plan) => (
                  <td
                    key={plan.id}
                    className="text-center py-3 px-3 text-ink-900/70"
                  >
                    {plan.limits?.[key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
