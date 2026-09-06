import React, { useEffect, useState } from 'react'
import { Card, Badge, Button } from '../components/ui'
import { IconPlus } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'
import { useSubscription } from '../lib/useSubscription'
import FeatureLocked from '../components/FeatureLocked'

interface DBAutomation {
  id: string
  name: string
  trigger_event: string
  config: { hours?: number }
  action_type: string
  action_config: { title_template?: string; priority?: string }
  active: boolean
}

export default function Automations() {
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization()
  const { hasFeature, loading: subLoading } = useSubscription()
  const [automations, setAutomations] = useState<DBAutomation[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', hours: '24', priority: 'عالية' })

  const loadData = async () => {
    if (!supabase || !organizationId) return
    setLoading(true)
    const { data } = await supabase.from('automations').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false })
    if (data) setAutomations(data as DBAutomation[])
    setLoading(false)
  }

  useEffect(() => {
    if (organizationId) loadData()
  }, [organizationId])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !organizationId) return
    setSaving(true)
    await supabase.from('automations').insert({
      organization_id: organizationId,
      name: form.name,
      trigger_event: 'lead_stale',
      config: { hours: Number(form.hours) },
      action_type: 'create_task',
      action_config: { title_template: 'تابع مع {name} - عميل محتمل بدون رد', priority: form.priority },
    })
    setSaving(false)
    setForm({ name: '', hours: '24', priority: 'عالية' })
    setShowForm(false)
    loadData()
  }

  const toggleActive = async (a: DBAutomation) => {
    if (!supabase) return
    await supabase.from('automations').update({ active: !a.active }).eq('id', a.id)
    loadData()
  }

  if (!subLoading && !hasFeature('automations')) {
    return <FeatureLocked featureName="الأتمتة" />
  }

  if (orgLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (orgError || !organizationId) {
    return <div className="text-center py-20 text-sm text-red-600">{orgError ?? 'تعذر تحديد المؤسسة'}</div>
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(v => !v)}>
          <span className="inline-flex items-center gap-2"><IconPlus className="w-4 h-4" /> أتمتة جديدة</span>
        </Button>
      </div>

      {showForm && (
        <Card className="p-5">
          <h3 className="font-bold text-ink-950 mb-3">متابعة تلقائية للعملاء المحتملين الراكدين</h3>
          <form onSubmit={handleAdd} className="grid sm:grid-cols-2 gap-3">
            <input required placeholder="اسم الأتمتة" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 sm:col-span-2" />
            <div>
              <label className="text-xs text-ink-900/50">لو العميل المحتمل فضل "جديد" أكتر من (ساعة)</label>
              <input type="number" required value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            </div>
            <div>
              <label className="text-xs text-ink-900/50">أولوية مهمة المتابعة</label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white">
                <option value="عالية">عالية</option>
                <option value="متوسطة">متوسطة</option>
                <option value="منخفضة">منخفضة</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </form>
        </Card>
      )}

      {automations.length === 0 ? (
        <div className="text-center py-16 text-sm text-ink-900/40">لا توجد أتمتة مضافة بعد</div>
      ) : (
        <div className="space-y-3">
          {automations.map(a => (
            <Card key={a.id} className="p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-semibold text-sm text-ink-950">{a.name}</div>
                <div className="text-xs text-ink-900/45 mt-1">
                  لو عميل محتمل فضل "جديد" أكتر من {a.config?.hours ?? 24} ساعة ← يتعمل مهمة متابعة أولوية {a.action_config?.priority}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={a.active ? 'success' : 'default'}>{a.active ? 'مفعّلة' : 'متوقفة'}</Badge>
                <button onClick={() => toggleActive(a)} className="text-xs font-semibold text-ink-900 hover:underline">
                  {a.active ? 'إيقاف' : 'تفعيل'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
