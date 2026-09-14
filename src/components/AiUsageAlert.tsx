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
}

export default function AiUsageAlert() {
  const { organizationId } = useOrganization()
  const [usage, setUsage] = useState<UsageSummary | null>(null)

  useEffect(() => {
    if (!organizationId || !supabase) return

    let cancelled = false
    const sb = supabase

    const load = async () => {
      const { data, error } = await sb.rpc(
        'get_ryan_ai_usage_summary',
        {
          p_organization_id: organizationId,
        }
      )

      if (!cancelled && !error && data?.[0]) {
        setUsage(data[0] as UsageSummary)
      }
    }

    load()

    const interval = window.setInterval(load, 60_000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [organizationId])

  if (!usage || usage.total_limit <= 0) return null

  const shouldWarn =
    usage.usage_percent >= 80 ||
    usage.remaining_messages <= 10

  if (!shouldWarn) return null

  const exhausted = usage.remaining_messages <= 0

  const critical =
    exhausted ||
    usage.usage_percent >= 90 ||
    usage.remaining_messages <= 10

  return (
    <div
      dir="rtl"
      className={`rounded-2xl border px-4 py-3.5 shadow-sm ${
        exhausted
          ? 'border-red-200 bg-red-50'
          : critical
            ? 'border-amber-200 bg-amber-50'
            : 'border-gold-200 bg-gold-50'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              exhausted
                ? 'bg-red-100 text-red-700'
                : critical
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gold-100 text-gold-700'
            }`}
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M12 8V12M12 16H12.01"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M10.3 3.9L2.7 17C1.93 18.33 2.89 20 4.43 20H19.57C21.11 20 22.07 20 21.3 17L13.7 3.9C12.93 2.57 11.07 2.57 10.3 3.9Z"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-bold text-ink-900">
              {exhausted
                ? 'رصيد رسائل AI انتهى'
                : 'رصيد رسائل AI يقترب من النفاد'}
            </p>

            <p className="mt-0.5 text-xs leading-5 text-ink-600">
              {exhausted
                ? `استهلكت ${usage.used_messages.toLocaleString(
                    'ar-EG'
                  )} من أصل ${usage.total_limit.toLocaleString(
                    'ar-EG'
                  )} رسالة هذا الشهر.`
                : `متبقي ${usage.remaining_messages.toLocaleString(
                    'ar-EG'
                  )} رسالة من أصل ${usage.total_limit.toLocaleString(
                    'ar-EG'
                  )} هذا الشهر (${usage.usage_percent}%).`}
            </p>
          </div>
        </div>

        <Link
          to="/billing"
          className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-xl bg-ink-950 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-ink-800"
        >
          {exhausted
            ? 'ترقية أو شراء رصيد'
            : 'إدارة رصيد AI'}
        </Link>
      </div>
    </div>
  )
}
