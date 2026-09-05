import React, { useEffect, useState } from 'react'
import { Card, Badge, Button } from '../components/ui'
import { IconPlus } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface DBService {
  id: string
  name: string
  description: string | null
  category: string | null
  price: string | null
}

export default function Services() {
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization()
  const [services, setServices] = useState<DBService[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', category: '', price: '' })

  const loadData = async () => {
    if (!supabase || !organizationId) return
    setLoading(true)
    const { data } = await supabase.from('services').select('*').eq('organization_id', organizationId).order('name', { ascending: true })
    if (data) setServices(data as DBService[])
    setLoading(false)
  }

  useEffect(() => {
    if (organizationId) loadData()
  }, [organizationId])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !organizationId) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('services').insert({
      organization_id: organizationId,
      name: form.name,
      description: form.description || null,
      category: form.category || null,
      price: form.price || null,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ name: '', description: '', category: '', price: '' })
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
          <span className="inline-flex items-center gap-2"><IconPlus className="w-4 h-4" /> إضافة خدمة</span>
        </Button>
      </div>

      {showForm && (
        <Card className="p-5">
          <form onSubmit={handleAdd} className="grid sm:grid-cols-2 gap-3">
            <input required placeholder="اسم الخدمة" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 sm:col-span-2" />
            <input placeholder="التصنيف" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            <input placeholder="السعر" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            <textarea placeholder="الوصف" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 sm:col-span-2" rows={2} />
            {error && <div className="sm:col-span-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</div>}
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </form>
        </Card>
      )}

      {services.length === 0 ? (
        <div className="text-center py-16 text-sm text-ink-900/40">لا توجد خدمات مضافة بعد</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map(s => (
            <Card key={s.id} className="p-5 flex flex-col">
              {s.category && <Badge>{s.category}</Badge>}
              <h3 className="font-bold text-ink-950 mt-3">{s.name}</h3>
              {s.description && <p className="text-sm text-ink-900/55 mt-2 leading-relaxed flex-1">{s.description}</p>}
              {s.price && <div className="text-sm font-semibold text-gold-600 mt-4 pt-4 border-t border-sand-100">{s.price}</div>}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
