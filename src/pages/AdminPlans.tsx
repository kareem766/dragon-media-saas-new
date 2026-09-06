import React, { useEffect, useState } from 'react'
import { Card, Badge, Button } from '../components/ui'
import { IconPlus } from '../components/Icon'
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
  status: string
  sort_order: number
}

const featureKeys = [
  { key: 'crm', label: 'إدارة العملاء (CRM)' },
  { key: 'ryan', label: 'RYAN AI' },
  { key: 'campaigns', label: 'الحملات التسويقية' },
  { key: 'automations', label: 'الأتمتة' },
  { key: 'advanced_reports', label: 'تقارير متقدمة' },
]

const limitKeys = [
  { key: 'users', label: 'حد المستخدمين' },
  { key: 'customers', label: 'حد العملاء' },
  { key: 'ai_messages', label: 'حد رسائل الذكاء الاصطناعي' },
]

const emptyPlan = {
  name: '', price: '0', currency: 'EGP', billing_cycle: 'monthly', trial_days: '7',
  features: Object.fromEntries(featureKeys.map(f => [f.key, false])) as Record<string, boolean>,
  limits: Object.fromEntries(limitKeys.map(l => [l.key, '0'])) as Record<string, string>,
}

export default function AdminPlans() {
  const [plans, setPlans] = useState<DBPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<any>(emptyPlan)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!supabase) return
    setLoading(true)
    const { data } = await supabase.from('plans').select('*').order('sort_order', { ascending: true })
    if (data) setPlans(data as DBPlan[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const startEdit = (p: DBPlan) => {
    setEditingId(p.id)
    setCreating(false)
    setForm({
      name: p.name,
      price: String(p.price),
      currency: p.currency,
      billing_cycle: p.billing_cycle,
      trial_days: String(p.trial_days),
      features: { ...Object.fromEntries(featureKeys.map(f => [f.key, false])), ...p.features },
      limits: Object.fromEntries(limitKeys.map(l => [l.key, String(p.limits?.[l.key] ?? 0)])),
    })
  }

  const startCreate = () => {
    setCreating(true)
    setEditingId(null)
    setForm(emptyPlan)
  }

  const cancel = () => {
    setEditingId(null)
    setCreating(false)
  }

  const buildPayload = () => ({
    name: form.name,
    price: Number(form.price),
    currency: form.currency,
    billing_cycle: form.billing_cycle,
    trial_days: Number(form.trial_days),
    features: form.features,
    limits: Object.fromEntries(limitKeys.map(l => [l.key, Number(form.limits[l.key])])),
  })

  const handleSave = async () => {
    if (!supabase) return
    setSaving(true)
    if (editingId) {
      await supabase.from('plans').update(buildPayload()).eq('id', editingId)
    } else {
      const maxOrder = plans.reduce((m, p) => Math.max(m, p.sort_order), 0)
      await supabase.from('plans').insert({ ...buildPayload(), status: 'active', sort_order: maxOrder + 1 })
    }
    setSaving(false)
    cancel()
    load()
  }

  const toggleStatus = async (p: DBPlan) => {
    if (!supabase) return
    await supabase.from('plans').update({ status: p.status === 'active' ? 'disabled' : 'active' }).eq('id', p.id)
    load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  const isEditing = editingId !== null || creating

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-ink-950">إدارة الباقات</h2>
        {!isEditing && (
          <Button onClick={startCreate}>
            <span className="inline-flex items-center gap-2"><IconPlus className="w-4 h-4" /> باقة جديدة</span>
          </Button>
        )}
      </div>

      {isEditing && (
        <Card className="p-6">
          <h3 className="font-bold text-ink-950 mb-4">{editingId ? 'تعديل الباقة' : 'باقة جديدة'}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-ink-900/50">اسم الباقة</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            </div>
            <div>
              <label className="text-xs text-ink-900/50">السعر (ج.م)</label>
              <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            </div>
            <div>
              <label className="text-xs text-ink-900/50">دورة الفوترة</label>
              <select value={form.billing_cycle} onChange={e => setForm({ ...form, billing_cycle: e.target.value })} className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white">
                <option value="monthly">شهري</option>
                <option value="yearly">سنوي</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-ink-900/50">أيام التجربة المجانية</label>
              <input type="number" value={form.trial_days} onChange={e => setForm({ ...form, trial_days: e.target.value })} className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs text-ink-900/50 mb-2">المميزات المتاحة</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {featureKeys.map(f => (
                <label key={f.key} className="flex items-center justify-between border border-sand-200 rounded-lg px-3.5 py-2.5">
                  <span className="text-sm text-ink-900">{f.label}</span>
                  <input type="checkbox" checked={Boolean(form.features[f.key])} onChange={e => setForm({ ...form, features: { ...form.features, [f.key]: e.target.checked } })} className="w-4 h-4 accent-ink-900" />
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs text-ink-900/50 mb-2">الحدود</div>
            <div className="grid sm:grid-cols-3 gap-3">
              {limitKeys.map(l => (
                <div key={l.key}>
                  <label className="text-xs text-ink-900/50">{l.label}</label>
                  <input type="number" value={form.limits[l.key]} onChange={e => setForm({ ...form, limits: { ...form.limits, [l.key]: e.target.value } })} className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
            <Button variant="secondary" onClick={cancel}>إلغاء</Button>
          </div>
        </Card>
      )}

      {!isEditing && (
        <div className="grid sm:grid-cols-3 gap-4">
          {plans.map(p => (
            <Card key={p.id} className="p-5 flex flex-col">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-ink-950">{p.name}</h3>
                <Badge tone={p.status === 'active' ? 'success' : 'default'}>{p.status === 'active' ? 'مفعّلة' : 'موقوفة'}</Badge>
              </div>
              <div className="text-xl font-bold text-ink-950 mt-2">{p.price.toLocaleString('ar-EG')} {p.currency}</div>
              <ul className="text-xs text-ink-900/55 mt-3 space-y-1 flex-1">
                {Object.entries(p.features).filter(([, v]) => v).map(([k]) => (
                  <li key={k}>✓ {featureKeys.find(f => f.key === k)?.label ?? k}</li>
                ))}
              </ul>
              <div className="flex gap-2 mt-4">
                <Button variant="secondary" onClick={() => startEdit(p)}>تعديل</Button>
                <Button variant="secondary" onClick={() => toggleStatus(p)}>{p.status === 'active' ? 'إيقاف' : 'تفعيل'}</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
