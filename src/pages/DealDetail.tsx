import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, Badge, Button } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface Stage {
  id: string
  name: string
  order_index: number
}

interface DBDeal {
  id: string
  title: string
  value: number
  stage_id: string
  customer_id: string | null
  created_at: string
  updated_at: string
  customers: { id: string; name: string } | null
}

export default function DealDetail() {
  const { id } = useParams<{ id: string }>()
  const { organizationId, loading: orgLoading } = useOrganization()
  const [deal, setDeal] = useState<DBDeal | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedStage, setSelectedStage] = useState('')
  const [saved, setSaved] = useState(false)

  const load = async () => {
    if (!supabase || !organizationId || !id) return
    setLoading(true)
    const [dealRes, stagesRes] = await Promise.all([
      supabase.from('deals').select('*, customers(id, name)').eq('id', id).eq('organization_id', organizationId).single(),
      supabase.from('pipeline_stages').select('*').eq('organization_id', organizationId).order('order_index', { ascending: true }),
    ])
    if (dealRes.data) {
      setDeal(dealRes.data as unknown as DBDeal)
      setSelectedStage((dealRes.data as unknown as DBDeal).stage_id)
    }
    if (stagesRes.data) setStages(stagesRes.data as Stage[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [id, organizationId])

  const handleStageChange = async () => {
    if (!supabase || !id) return
    setSaving(true)
    setSaved(false)
    await supabase.from('deals').update({ stage_id: selectedStage, updated_at: new Date().toISOString() }).eq('id', id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    load()
  }

  if (orgLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (!deal) {
    return <div className="text-center py-20 text-sm text-red-600">الصفقة غير موجودة</div>
  }

  const currentStage = stages.find(s => s.id === deal.stage_id)

  return (
    <div className="space-y-6">
      <Link to="/pipeline" className="text-sm text-ink-900/60 hover:underline inline-block">→ رجوع لمسار المبيعات</Link>

      <Card className="p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink-950">{deal.title}</h2>
            {deal.customers && (
              <Link to={`/crm/customer/${deal.customers.id}`} className="text-sm text-ink-900/50 hover:underline mt-1 inline-block">
                {deal.customers.name}
              </Link>
            )}
          </div>
          <Badge tone="gold">{Number(deal.value).toLocaleString('ar-EG')} ج.م</Badge>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-5 pt-5 border-t border-sand-100">
          <div>
            <div className="text-xs text-ink-900/45">المرحلة الحالية</div>
            <div className="text-sm font-medium text-ink-950 mt-1">{currentStage?.name ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-ink-900/45">آخر تحديث</div>
            <div className="text-sm font-medium text-ink-950 mt-1">{new Date(deal.updated_at).toLocaleDateString('ar-EG')}</div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-ink-950 mb-4">تغيير مرحلة الصفقة</h3>
        <div className="flex flex-wrap items-end gap-3">
          <select
            value={selectedStage}
            onChange={e => setSelectedStage(e.target.value)}
            className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white min-w-[200px]"
          >
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button onClick={handleStageChange} disabled={saving || selectedStage === deal.stage_id}>
            {saving ? 'جاري التحديث...' : 'تحديث المرحلة'}
          </Button>
          {saved && <span className="text-sm text-emerald-600">تم التحديث ✓</span>}
        </div>
      </Card>
    </div>
  )
}
