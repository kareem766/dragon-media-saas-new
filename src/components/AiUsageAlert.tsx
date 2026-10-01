import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface UsageSummary {
  used_messages: number
  plan_messages: number
  purchased_messages: number
  total_limit: number
  remaining_messages: number
  usage_percent: number
  reset_at: string
  plan_remaining: number
  purchased_remaining: number
  next_credit_expiry_at: string | null
  next_credit_expires_in_seconds: number | null
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${days}ي ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`
}

export default function AiUsageAlert() {
  const { organizationId } = useOrganization()
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!organizationId || !supabase) return
    let cancelled = false
    const sb = supabase
    const load = async () => {
      const { data, error } = await sb.rpc('get_ryan_ai_usage_summary', { p_organization_id: organizationId })
      if (!cancelled && !error && data?.[0]) setUsage(data[0] as UsageSummary)
    }
    void load()
    const refresh = window.setInterval(() => void load(), 30_000)
    return () => { cancelled = true; window.clearInterval(refresh) }
  }, [organizationId])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  if (!usage || usage.total_limit <= 0) return null
  const baseExhausted = usage.plan_remaining <= 0
  const extraExhausted = usage.purchased_remaining <= 0
  const extraActive = usage.purchased_remaining > 0
  const shouldWarn = usage.usage_percent >= 80 || usage.remaining_messages <= 10 || (baseExhausted && extraActive)
  if (!shouldWarn) return null
  const exhausted = usage.remaining_messages <= 0
  const critical = exhausted || usage.usage_percent >= 90 || usage.remaining_messages <= 10 || baseExhausted
  const resetMs = new Date(usage.reset_at).getTime() - now
  const creditExpiryMs = usage.next_credit_expiry_at ? new Date(usage.next_credit_expiry_at).getTime() - now : 0

  return (
    <div dir="rtl" className={`rounded-2xl border px-4 py-3.5 shadow-sm dm-fade-up ${exhausted ? 'border-red-200 bg-red-50' : critical ? 'border-amber-200 bg-amber-50' : 'border-gold-200 bg-gold-50'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${exhausted ? 'bg-red-100 text-red-700' : critical ? 'bg-amber-100 text-amber-700' : 'bg-gold-100 text-gold-700'}`}>!</div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink-900"{exhausted ? 'رصيد رسائل Ryan انتهى' : baseExhausted ? 'الباقة الأساسية انتهت — يتم استخدام الرصيد الإضافي' : 'رصيد رسائل Ryan يقترب من النفاد'}</p>
            <p className="mt-0.5 text-xs leading-5 text-ink-600">{exhausted ? `استهلكت جميع الرسائل المتاحة حاليًا (${usage.total_limit.toLocaleString('ar-EG')} رسالة).` : baseExhausted ? `اكتملت الباقة الأساسية، والمتبقي ${usage.purchased_remaining.toLocaleString('ar-EG')} رسالة من الرصيد الإضافي.` : `متبقي ${usage.remaining_messages.toLocaleString('ar-EG')} رسالة (${usage.usage_percent}%).`}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-ink-600"><span>{baseExhausted && extraActive ? 'تجديد الباقة الأساسية خلال' : 'إعادة الضبط خلال'}</span><span className="rounded-lg bg-white/70 px-2 py-1 font-mono tabular-nums" aria-live="polite">{resetMs > 0 ? formatCountdown(resetMs) : 'جارٍ التحديث'}</span>{usage.next_credit_expiry_at && <><span>· انتهاء الإضافي</span><span className="rounded-lg bg-white/70 px-2 py-1 font-mono tabular-nums" aria-live="polite">{creditExpiryMs > 0 ? formatCountdown(creditExpiryMs) : 'منتهية'}</span></>}</div>
          </div>
        </div>
        <Link to="/ryan" className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-xl bg-ink-950 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-ink-800">{exhausted ? 'شراء رصيد Ryan' : 'إدارة Ryan'}</Link>
      </div>
    </div>
  )
}
