import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Badge, Button } from '../components/ui'
import { useSubscription } from '../lib/useSubscription'

const statusLabels: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'default' }> = {
  trialing: { label: 'فترة تجريبية', tone: 'success' },
  pending_payment: { label: 'بانتظار الدفع', tone: 'warning' },
  pending_review: { label: 'قيد المراجعة', tone: 'warning' },
  active: { label: 'نشط', tone: 'success' },
  past_due: { label: 'متأخر السداد', tone: 'danger' },
  expired: { label: 'منتهي', tone: 'danger' },
  cancelled: { label: 'ملغي', tone: 'default' },
  suspended: { label: 'موقوف', tone: 'danger' },
  no_subscription: { label: 'بدون اشتراك', tone: 'default' },
}

export default function Billing() {
  const navigate = useNavigate()
  const { subscription, loading } = useSubscription()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  const status = subscription?.status ?? 'no_subscription'
  const info = statusLabels[status] ?? statusLabels.no_subscription

  return (
    <div className="space-y-6 max-w-lg">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-ink-900/45">حالة الاشتراك</div>
            <div className="text-lg font-bold text-ink-950 mt-1">{subscription?.plan?.name ?? 'لا توجد باقة'}</div>
          </div>
          <Badge tone={info.tone}>{info.label}</Badge>
        </div>
        {subscription?.plan && (
          <div className="text-sm text-ink-900/60 mt-3">{subscription.plan.price.toLocaleString('ar-EG')} ج.م / شهريًا</div>
        )}
        {subscription?.renewal_date && (
          <div className="text-xs text-ink-900/45 mt-2">التجديد القادم: {new Date(subscription.renewal_date).toLocaleDateString('ar-EG')}</div>
        )}
        <div className="flex gap-2 mt-4">
          <Button onClick={() => navigate('/plans')} variant={status === 'active' || status === 'trialing' ? 'secondary' : 'primary'}>
            {status === 'active' || status === 'trialing' ? 'تغيير الباقة' : 'اختيار باقة'}
          </Button>
          {status === 'pending_payment' && (
            <Button onClick={() => navigate('/billing/pay')}>إرسال بيانات الدفع</Button>
          )}
        </div>
      </Card>
    </div>
  )
}
