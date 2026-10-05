import React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Button } from './ui'

export default function PaymobVisibleBanner() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const planId = searchParams.get('plan_id')

  return (
    <Card className="mb-5 overflow-hidden border-2 border-blue-200 bg-white shadow-[0_12px_35px_rgba(15,61,58,0.12)]">
      <div className="bg-ink-950 px-5 py-4 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-sand-100/65">الدفع الإلكتروني</div>
            <h2 className="mt-1 text-xl font-black">ادفع بأمان عبر Paymob</h2>
            <p className="mt-1 text-sm text-sand-100/70">الدفع الإلكتروني متاح الآن عبر Paymob</p>
          </div>
          <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-ink-950">متاح الآن</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-ink-900/65">
          اختر الدفع عبر Paymob لإتمام الاشتراك إلكترونيًا وتفعيل الباقة تلقائيًا بعد تأكيد العملية.
        </p>
        <Button
          type="button"
          onClick={() => {
            const target = document.querySelector('[data-payment-method="paymob"]')
            if (target) {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' })
              return
            }
            navigate(planId ? `/billing/pay?plan_id=${encodeURIComponent(planId)}` : '/billing/pay')
          }}
          className="w-full shrink-0 sm:w-auto"
        >
          الدفع الآن عبر Paymob
        </Button>
      </div>
    </Card>
  )
}
