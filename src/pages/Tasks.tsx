import React, { useEffect, useState } from 'react'
import { Card, Badge, Button, Table, statusTone } from '../components/ui'
import { IconPlus } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface DBTask {
  id: string
  title: string
  due_date: string | null
  priority: string
  status: string
}

export default function Tasks() {
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization()
  const [tasks, setTasks] = useState<DBTask[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', dueDate: '', priority: 'متوسطة' })

  const loadData = async () => {
    if (!supabase || !organizationId) return
    setLoading(true)
    const { data } = await supabase.from('tasks').select('*').eq('organization_id', organizationId).order('due_date', { ascending: true })
    if (data) setTasks(data as DBTask[])
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
    const { error } = await supabase.from('tasks').insert({
      organization_id: organizationId,
      title: form.title,
      due_date: form.dueDate || null,
      priority: form.priority,
      status: 'قيد التنفيذ',
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ title: '', dueDate: '', priority: 'متوسطة' })
    setShowForm(false)
    loadData()
  }

  const toggleComplete = async (task: DBTask) => {
    if (!supabase) return
    const newStatus = task.status === 'مكتملة' ? 'قيد التنفيذ' : 'مكتملة'
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
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
          <span className="inline-flex items-center gap-2"><IconPlus className="w-4 h-4" /> مهمة جديدة</span>
        </Button>
      </div>

      {showForm && (
        <Card className="p-5">
          <form onSubmit={handleAdd} className="grid sm:grid-cols-2 gap-3">
            <input required placeholder="عنوان المهمة" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 sm:col-span-2" />
            <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white">
              <option value="عالية">عالية</option>
              <option value="متوسطة">متوسطة</option>
              <option value="منخفضة">منخفضة</option>
            </select>
            {error && <div className="sm:col-span-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</div>}
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-2 sm:p-4">
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-sm text-ink-900/40">لا توجد مهام بعد</div>
        ) : (
          <Table head={['المهمة', 'تاريخ الاستحقاق', 'الأولوية', 'الحالة', '']}>
            {tasks.map(t => (
              <tr key={t.id} className="hover:bg-sand-50">
                <td className="py-3 px-3 font-semibold text-ink-950 whitespace-nowrap">{t.title}</td>
                <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{t.due_date ?? '—'}</td>
                <td className="py-3 px-3"><Badge tone={t.priority === 'عالية' ? 'danger' : t.priority === 'متوسطة' ? 'warning' : 'default'}>{t.priority}</Badge></td>
                <td className="py-3 px-3"><Badge tone={statusTone(t.status)}>{t.status}</Badge></td>
                <td className="py-3 px-3">
                  <button onClick={() => toggleComplete(t)} className="text-xs font-semibold text-ink-900 hover:underline whitespace-nowrap">
                    {t.status === 'مكتملة' ? 'إعادة فتح' : 'تم الإنجاز'}
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
