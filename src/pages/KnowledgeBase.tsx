import React, { useEffect, useState } from 'react'
import { Card, Button } from '../components/ui'
import { IconPlus } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface DBEntry {
  id: string
  title: string
  content: string
}

export default function KnowledgeBase() {
  const { organizationId, loading: orgLoading } = useOrganization()
  const [entries, setEntries] = useState<DBEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', content: '' })

  const loadData = async () => {
    if (!supabase || !organizationId) return
    setLoading(true)
    const { data } = await supabase.from('knowledge_base').select('id, title, content').eq('organization_id', organizationId).order('created_at', { ascending: false })
    if (data) setEntries(data as DBEntry[])
    setLoading(false)
  }

  useEffect(() => {
    if (organizationId) loadData()
  }, [organizationId])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !organizationId) return
    setSaving(true)
    await supabase.from('knowledge_base').insert({
      organization_id: organizationId,
      title: form.title,
      content: form.content,
    })
    setSaving(false)
    setForm({ title: '', content: '' })
    setShowForm(false)
    loadData()
  }

  const handleDelete = async (id: string) => {
    if (!supabase) return
    await supabase.from('knowledge_base').delete().eq('id', id)
    loadData()
  }

  if (orgLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-950">قاعدة معرفة RYAN</h2>
          <p className="text-sm text-ink-900/50 mt-1">أضف معلومات عن شركتك عشان ريان يستخدمها في الرد على العملاء — أسئلة شائعة، سياسات، تفاصيل خدمات.</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)}>
          <span className="inline-flex items-center gap-2"><IconPlus className="w-4 h-4" /> إضافة معلومة</span>
        </Button>
      </div>

      {showForm && (
        <Card className="p-5">
          <form onSubmit={handleAdd} className="space-y-3">
            <input required placeholder="العنوان (مثال: سياسة الاسترجاع)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            <textarea required placeholder="المحتوى بالتفصيل..." rows={4} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="w-full border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </form>
        </Card>
      )}

      {entries.length === 0 ? (
        <div className="text-center py-16 text-sm text-ink-900/40">لا توجد معلومات مضافة بعد — ريان بيشتغل بمعلومات عامة بس دلوقتي</div>
      ) : (
        <div className="space-y-3">
          {entries.map(e => (
            <Card key={e.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-sm text-ink-950">{e.title}</h3>
                  <p className="text-sm text-ink-900/60 mt-1.5 leading-relaxed">{e.content}</p>
                </div>
                <button onClick={() => handleDelete(e.id)} className="text-xs text-red-500 hover:underline whitespace-nowrap">حذف</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
