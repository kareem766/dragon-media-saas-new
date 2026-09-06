import React, { useEffect, useState } from 'react'
import { Card, Badge, Button, Table, statusTone } from '../components/ui'
import { IconPlus } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'
import { useSubscription } from '../lib/useSubscription'
import FeatureLocked from '../components/FeatureLocked'

interface DBCampaign {
  id: string
  name: string
  channel: string
  audience: string | null
  status: string
  scheduled_at: string | null
}

const channelLabels: Record<string, string> = {
  whatsapp: 'واتساب',
  messenger: 'ماسنجر',
  instagram: 'إنستجرام',
  email: 'بريد إلكتروني',
}

export default function Campaigns() {
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization()
  const { hasFeature, loading: subLoading } = useSubscription()
  const [campaigns, setCampaigns] = useState<DBCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', channel: 'whatsapp', audience: '', scheduledAt: '' })

  const loadData = async () => {
    if (!supabase || !organizationId) return
    setLoading(true)
    const { data } = await supabase.from('campaigns').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false })
    if (data) setCampaigns(data as DBCampaign[])
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
    const { error } = await supabase.from('campaigns').insert({
      organization_id: organizationId,
      name: form.name,
      channel: form.channel,
      audience: form.audience || null,
      scheduled_at: form.scheduledAt || null,
      status: 'مجدولة',
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ name: '', channel: 'whatsapp', audience: '', scheduledAt: '' })
    setShowForm(false)
    loadData()
  }

  if (!subLoading && !hasFeature('campaigns')) {
    return <FeatureLocked featureName="الحملات التسويقية" />
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
          <span className="inline-flex items-center gap-2"><IconPlus className="w-4 h-4" /> إنشاء حملة جديدة</span>
        </Button>
      </div>

      {showForm && (
        <Card className="p-5">
          <form onSubmit={handleAdd} className="grid sm:grid-cols-2 gap-3">
            <input required placeholder="اسم الحملة" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 sm:col-span-2" />
            <select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white">
              <option value="whatsapp">واتساب</option>
              <option value="messenger">ماسنجر</option>
              <option value="instagram">إنستجرام</option>
              <option value="email">بريد إلكتروني</option>
            </select>
            <input placeholder="الجمهور المستهدف" value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            <input type="date" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 sm:col-span-2" />
            {error && <div className="sm:col-span-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</div>}
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-2 sm:p-4">
        {campaigns.length === 0 ? (
          <div className="text-center py-12 text-sm text-ink-900/40">لا توجد حملات بعد</div>
        ) : (
          <Table head={['اسم الحملة', 'القناة', 'الجمهور المستهدف', 'الحالة', 'موعد الإرسال']}>
            {campaigns.map(c => (
              <tr key={c.id} className="hover:bg-sand-50">
                <td className="py-3 px-3 font-semibold text-ink-950 whitespace-nowrap">{c.name}</td>
                <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{channelLabels[c.channel] ?? c.channel}</td>
                <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{c.audience ?? '—'}</td>
                <td className="py-3 px-3"><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
                <td className="py-3 px-3 text-ink-900/50 whitespace-nowrap">{c.scheduled_at ?? '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
