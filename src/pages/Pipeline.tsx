import React, { useEffect, useState } from 'react'
import { Card, Badge, Button } from '../components/ui'
import { IconPlus } from '../components/Icon'
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
  customers: { name: string } | null
}

interface DBCustomerOption {
  id: string
  name: string
}

export default function Pipeline() {
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization()
  const [stages, setStages] = useState<Stage[]>([])
  const [deals, setDeals] = useState<DBDeal[]>([])
  const [customers, setCustomers] = useState<DBCustomerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', value: '', customerId: '', stageId: '' })

  const loadData = async () => {
    if (!supabase || !organizationId) return
    setLoading(true)
    const [stagesRes, dealsRes, customersRes] = await Promise.all([
      supabase.from('pipeline_stages').select('*').eq('organization_id', organizationId).order('order_index', { ascending: true }),
      supabase.from('deals').select('*, customers(name)').eq('organization_id', organizationId).order('created_at', { ascending: false }),
      supabase.from('customers').select('id, name').eq('organization_id', organizationId).order('name', { ascending: true }),
    ])
    if (stagesRes.data) setStages(stagesRes.data as Stage[])
    if (dealsRes.data) setDeals(dealsRes.data as unknown as DBDeal[])
    if (customersRes.data) setCustomers(customersRes.data as DBCustomerOption[])
    setLoading(false)
  }

  useEffect(() => {
    if (organizationId) loadData()
  }, [organizationId])

  const handleAddDeal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !organizationId) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('deals').insert({
      organization_id: organizationId,
      title: form.title,
      value: form.value ? Number(form.value) : 0,
      customer_id: form.customerId || null,
      stage_id: form.stageId || stages[0]?.id,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ title: '', value: '', customerId: '', stageId: '' })
    setShowForm(false)
    loadData()
  }

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (orgError || !organizationId) {
    return (
      <div className="text-center py-20 text-sm text-red-600">
        {orgError ?? 'تعذر تحديد المؤسسة الخاصة بحسابك'}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(v => !v)}>
          <span className="inline-flex items-center gap-2"><IconPlus className="w-4 h-4" /> إضافة صفقة</span>
        </Button>
      </div>

      {showForm && (
        <Card className="p-5">
          <form onSubmit={handleAddDeal} className="grid sm:grid-cols-2 gap-3">
            <input required placeholder="عنوان الصفقة" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 sm:col-span-2" />
            <input placeholder="القيمة (ج.م)" type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            <select value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white">
              <option value="">اختر عميل (اختياري)</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={form.stageId} onChange={e => setForm({ ...form, stageId: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white sm:col-span-2">
              <option value="">اختر مرحلة (افتراضيًا: {stages[0]?.name ?? 'جديد'})</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {error && <div className="sm:col-span-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</div>}
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </form>
        </Card>
      )}

      {stages.length === 0 ? (
        <div className="text-center py-16 text-sm text-ink-900/40">
          لا توجد مراحل مبيعات بعد لهذه المؤسسة
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {stages.map(stage => {
              const stageDeals = deals.filter(d => d.stage_id === stage.id)
              const total = stageDeals.reduce((s, d) => s + Number(d.value), 0)
              return (
                <div key={stage.id} className="w-72 shrink-0">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="font-bold text-ink-950 text-sm">{stage.name}</h3>
                    <span className="text-xs text-ink-900/45">{stageDeals.length}</span>
                  </div>
                  <div className="text-xs text-ink-900/45 mb-3 px-1">{total.toLocaleString('ar-EG')} ج.م</div>
                  <div className="space-y-3">
                    {stageDeals.map(d => (
                      <Card key={d.id} className="p-3.5">
                        <div className="font-semibold text-sm text-ink-950 leading-snug">{d.title}</div>
                        <div className="text-xs text-ink-900/50 mt-1.5">{d.customers?.name ?? 'بدون عميل'}</div>
                        <div className="flex items-center justify-between mt-3">
                          <Badge tone="gold">{Number(d.value).toLocaleString('ar-EG')} ج.م</Badge>
                        </div>
                      </Card>
                    ))}
                    {stageDeals.length === 0 && (
                      <div className="text-xs text-ink-900/30 text-center py-6 border border-dashed border-sand-200 rounded-xl">لا توجد صفقات</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
