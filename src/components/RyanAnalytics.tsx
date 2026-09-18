import React, { useEffect, useMemo, useState } from 'react'
import { Card } from './ui'
import { supabase } from '../lib/supabaseClient'

interface RyanStats {
  leads: number
  qualified: number
  handoffs: number
  openHandoffs: number
  averageScore: number
  highScoreLeads: number
  overdueFollowUps: number
}

function n(value: number) {
  return value.toLocaleString('ar-EG')
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-sand-200/70 bg-white p-4">
      <p className="text-[11px] font-semibold text-ink-900/45">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink-950">{value}</p>
      <p className="mt-1 text-[11px] leading-5 text-ink-900/40">{sub}</p>
    </div>
  )
}

export default function RyanAnalytics({ organizationId }: { organizationId: string }) {
  const [stats, setStats] = useState<RyanStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!supabase || !organizationId) {
        setLoading(false)
        return
      }

      setLoading(true)
      const now = new Date().toISOString()

      const [leadsRes, qualifiedRes, handoffsRes, openHandoffsRes, scoresRes, overdueRes] =
        await Promise.all([
          supabase.from('leads').select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId).is('deleted_at', null),
          supabase.from('crm_activities').select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId).eq('activity_type', 'ai_qualified'),
          supabase.from('human_handoff_requests').select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId),
          supabase.from('human_handoff_requests').select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId).eq('status', 'open'),
          supabase.from('leads').select('lead_score')
            .eq('organization_id', organizationId).is('deleted_at', null),
          supabase.from('leads').select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId).is('deleted_at', null)
            .not('follow_up_at', 'is', null).lt('follow_up_at', now)
            .not('status', 'in', '(تم التعاقد,خسرنا)'),
        ])

      const error = leadsRes.error ?? qualifiedRes.error ?? handoffsRes.error ??
        openHandoffsRes.error ?? scoresRes.error ?? overdueRes.error

      if (error) {
        console.error('Ryan analytics load error:', error)
        if (!cancelled) setLoading(false)
        return
      }

      const scores = (scoresRes.data ?? [])
        .map((row: { lead_score: number | null }) => Number(row.lead_score ?? 0))
        .filter((score) => Number.isFinite(score))

      const averageScore = scores.length
        ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
        : 0

      if (!cancelled) {
        setStats({
          leads: leadsRes.count ?? 0,
          qualified: qualifiedRes.count ?? 0,
          handoffs: handoffsRes.count ?? 0,
          openHandoffs: openHandoffsRes.count ?? 0,
          averageScore,
          highScoreLeads: scores.filter((score) => score >= 70).length,
          overdueFollowUps: overdueRes.count ?? 0,
        })
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [organizationId])

  const qualificationRate = useMemo(() => {
    if (!stats?.leads) return 0
    return Math.min(100, Math.round((stats.qualified / stats.leads) * 100))
  }, [stats])

  if (loading || !stats) {
    return (
      <section className="space-y-3">
        <div className="h-5 w-48 animate-pulse rounded bg-sand-100" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Card key={item} className="h-28 animate-pulse border-sand-200/70 bg-sand-50" />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-ink-950">ذكاء المبيعات مع Ryan</h2>
          <p className="mt-1 text-xs leading-5 text-ink-900/45">
            مؤشرات حقيقية من الـ Leads والتأهيلات والتحويلات والمتابعات، بدون بيانات تجريبية.
          </p>
        </div>
        <span className="w-fit rounded-full border border-sand-200 bg-sand-50 px-2.5 py-1 text-[11px] font-semibold text-ink-900/50">
          مباشر من قاعدة البيانات
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Leads" value={n(stats.leads)} sub="إجمالي العملاء المحتملين النشطين" />
        <Stat label="Leads مؤهلة" value={n(stats.qualified)} sub={`معدل التأهيل ${qualificationRate}%`} />
        <Stat label="متوسط Lead Score" value={n(stats.averageScore)} sub={`High Score: ${n(stats.highScoreLeads)}`} />
        <Stat label="Handoff" value={n(stats.handoffs)} sub={`المفتوحة الآن: ${n(stats.openHandoffs)}`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-sand-200/80 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-ink-950">التأهيل والمتابعة</h3>
              <p className="mt-1 text-xs text-ink-900/45">قياس مباشر لجودة الـ Leads التي مرّت عبر CRM.</p>
            </div>
            <div className="text-sm font-bold text-ink-950">{qualificationRate}%</div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-sand-100">
            <div className="h-full rounded-full bg-ink-900 transition-all duration-500" style={{ width: `${qualificationRate}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-sand-50 p-3">
              <p className="text-[11px] text-ink-900/40">Qualified</p>
              <p className="mt-1 text-lg font-bold text-ink-950">{n(stats.qualified)}</p>
            </div>
            <div className="rounded-xl bg-sand-50 p-3">
              <p className="text-[11px] text-ink-900/40">High Score</p>
              <p className="mt-1 text-lg font-bold text-ink-950">{n(stats.highScoreLeads)}</p>
            </div>
          </div>
        </Card>

        <Card className="border-sand-200/80 p-5">
          <div>
            <h3 className="text-sm font-bold text-ink-950">المتابعات التي تحتاج تدخل</h3>
            <p className="mt-1 text-xs text-ink-900/45">Leads لها موعد متابعة متجاوز ولم تُغلق.</p>
          </div>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-bold tracking-tight text-ink-950">{n(stats.overdueFollowUps)}</p>
              <p className="mt-1 text-xs text-ink-900/45">متابعة متأخرة</p>
            </div>
            <div className="rounded-2xl bg-sand-50 px-4 py-3 text-right">
              <p className="text-[11px] text-ink-900/40">Handoff مفتوح</p>
              <p className="mt-1 text-lg font-bold text-ink-950">{n(stats.openHandoffs)}</p>
            </div>
          </div>
        </Card>
      </div>
    </section>
  )
}
