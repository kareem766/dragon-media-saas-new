import React, { useEffect, useState } from 'react'
import { Card, Badge, Button, Table, statusTone } from '../components/ui'
import { IconPlus, IconSearch } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface DBLead {
  id: string
  name: string
  company: string | null
  phone: string | null
  source: string | null
  status: string
  created_at: string
}

interface DBCustomer {
  id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
  status: string
  total_spent: number
  tags: string[] | null
}

export default function CRM() {
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization()
  const [tab, setTab] = useState<'leads' | 'customers'>('leads')
  const [leads, setLeads] = useState<DBLead[]>([])
  const [customers, setCustomers] = useState<DBCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('الكل')
  const [form, setForm] = useState({ name: '', company: '', phone: '', source: '' })

  const loadData = async () => {
    if (!supabase || !organizationId) return
    setLoading(true)
    const [leadsRes, customersRes] = await Promise.all([
      supabase.from('leads').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
      supabase.from('customers').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
    ])
    if (leadsRes.data) setLeads(leadsRes.data as DBLead[])
    if (customersRes.data) setCustomers(customersRes.data as DBCustomer[])
    setLoading(false)
  }

  useEffect(() => {
    if (organizationId) loadData()
  }, [organizationId])

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !organizationId) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('leads').insert({
      organization_id: organizationId,
      name: form.name,
      company: form.company || null,
      phone: form.phone || null,
      source: form.source || null,
      status: 'جديد',
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ name: '', company: '', phone: '', source: '' })
    setShowForm(false)
    loadData()
  }

  const handleConvert = async (lead: DBLead) => {
    if (!supabase || !organizationId) return
    setConvertingId(lead.id)
    const { error } = await supabase.from('customers').insert({
      organization_id: organizationId,
      name: lead.name,
      company: lead.company,
      phone: lead.phone,
      status: 'نشط',
      total_spent: 0,
    })
    if (!error) {
      await supabase.from('leads').delete().eq('id', lead.id)
    }
    setConvertingId(null)
    loadData()
    if (!error) setTab('customers')
  }

  const q = search.trim().toLowerCase()
  const filteredLeads = leads.filter(l => {
    const matchesSearch = !q || l.name.toLowerCase().includes(q) || (l.phone ?? '').includes(q) || (l.company ?? '').toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'الكل' || l.status === statusFilter
    return matchesSearch && matchesStatus
  })
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = !q || c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q) || (c.email ?? '').toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'الكل' || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const leadStatuses = ['الكل', 'جديد', 'تم التواصل', 'مهتم', 'غير مهتم']
  const customerStatuses = ['الكل', 'نشط', 'غير نشط']

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex bg-white border border-sand-200 rounded-xl p-1">
          <button onClick={() => { setTab('leads'); setStatusFilter('الكل') }} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'leads' ? 'bg-ink-900 text-sand-50' : 'text-ink-900/60'}`}>العملاء المحتملون</button>
          <button onClick={() => { setTab('customers'); setStatusFilter('الكل') }} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'customers' ? 'bg-ink-900 text-sand-50' : 'text-ink-900/60'}`}>العملاء</button>
        </div>
        {tab === 'leads' && (
          <Button onClick={() => setShowForm(v => !v)}>
            <span className="inline-flex items-center gap-2"><IconPlus className="w-4 h-4" /> إضافة عميل محتمل</span>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white border border-sand-200 rounded-full px-4 py-2 flex-1 min-w-[220px]">
          <IconSearch className="w-4 h-4 text-ink-900/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم، الهاتف، أو الشركة..."
            className="bg-transparent outline-none text-sm w-full placeholder:text-ink-900/40"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-sand-200 rounded-full px-4 py-2 text-sm outline-none bg-white">
          {(tab === 'leads' ? leadStatuses : customerStatuses).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {showForm && (
        <Card className="p-5">
          <form onSubmit={handleAddLead} className="grid sm:grid-cols-2 gap-3">
            <input required placeholder="الاسم" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            <input placeholder="الشركة" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            <input placeholder="الهاتف" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" dir="ltr" />
            <input placeholder="المصدر (واتساب، فيسبوك...)" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            {error && <div className="sm:col-span-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</div>}
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-2 sm:p-4">
        {tab === 'leads' ? (
          filteredLeads.length === 0 ? (
            <div className="text-center py-12 text-sm text-ink-900/40">لا توجد نتائج مطابقة</div>
          ) : (
            <Table head={['الاسم', 'الشركة', 'الهاتف', 'المصدر', 'الحالة', 'تاريخ الإضافة', '']}>
              {filteredLeads.map(l => (
                <tr key={l.id} className="hover:bg-sand-50">
                  <td className="py-3 px-3 font-semibold text-ink-950 whitespace-nowrap">{l.name}</td>
                  <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{l.company ?? '—'}</td>
                  <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap" dir="ltr">{l.phone ?? '—'}</td>
                  <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{l.source ?? '—'}</td>
                  <td className="py-3 px-3"><Badge tone={statusTone(l.status)}>{l.status}</Badge></td>
                  <td className="py-3 px-3 text-ink-900/50 whitespace-nowrap">{new Date(l.created_at).toLocaleDateString('ar-EG')}</td>
                  <td className="py-3 px-3">
                    <button
                      onClick={() => handleConvert(l)}
                      disabled={convertingId === l.id}
                      className="text-xs font-semibold text-gold-600 hover:underline whitespace-nowrap disabled:opacity-50"
                    >
                      {convertingId === l.id ? 'جاري التحويل...' : 'تحويل لعميل'}
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
          )
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12 text-sm text-ink-900/40">لا توجد نتائج مطابقة</div>
        ) : (
          <Table head={['العميل', 'الهاتف', 'البريد الإلكتروني', 'إجمالي المبيعات', 'الوسوم', 'الحالة']}>
            {filteredCustomers.map(c => (
              <tr key={c.id} className="hover:bg-sand-50 cursor-pointer" onClick={() => { window.location.hash = `#/crm/customer/${c.id}` }}>
                <td className="py-3 px-3 font-semibold text-ink-950 whitespace-nowrap">{c.name}</td>
                <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap" dir="ltr">{c.phone ?? '—'}</td>
                <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap" dir="ltr">{c.email ?? '—'}</td>
                <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{c.total_spent.toLocaleString('ar-EG')} ج.م</td>
                <td className="py-3 px-3">
                  <div className="flex gap-1.5 flex-wrap">
                    {(c.tags ?? []).map(t => <Badge key={t}>{t}</Badge>)}
                  </div>
                </td>
                <td className="py-3 px-3"><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
