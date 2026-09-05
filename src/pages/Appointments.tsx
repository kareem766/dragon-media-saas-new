import React, { useEffect, useState } from 'react'
import { Card, Badge, Button, Table, statusTone } from '../components/ui'
import { IconPlus } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface DBAppointment {
  id: string
  appointment_date: string | null
  appointment_time: string | null
  status: string
  notes: string | null
  customers: { name: string } | null
  services: { name: string } | null
}

interface Option {
  id: string
  name: string
}

export default function Appointments() {
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization()
  const [appointments, setAppointments] = useState<DBAppointment[]>([])
  const [customers, setCustomers] = useState<Option[]>([])
  const [services, setServices] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ customerId: '', serviceId: '', date: '', time: '' })

  const loadData = async () => {
    if (!supabase || !organizationId) return
    setLoading(true)
    const [apRes, custRes, servRes] = await Promise.all([
      supabase.from('appointments').select('*, customers(name), services(name)').eq('organization_id', organizationId).order('appointment_date', { ascending: true }),
      supabase.from('customers').select('id, name').eq('organization_id', organizationId),
      supabase.from('services').select('id, name').eq('organization_id', organizationId),
    ])
    if (apRes.data) setAppointments(apRes.data as unknown as DBAppointment[])
    if (custRes.data) setCustomers(custRes.data as Option[])
    if (servRes.data) setServices(servRes.data as Option[])
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
    const { error } = await supabase.from('appointments').insert({
      organization_id: organizationId,
      customer_id: form.customerId || null,
      service_id: form.serviceId || null,
      appointment_date: form.date || null,
      appointment_time: form.time || null,
      status: 'قيد الانتظار',
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ customerId: '', serviceId: '', date: '', time: '' })
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
          <span className="inline-flex items-center gap-2"><IconPlus className="w-4 h-4" /> حجز موعد</span>
        </Button>
      </div>

      {showForm && (
        <Card className="p-5">
          <form onSubmit={handleAdd} className="grid sm:grid-cols-2 gap-3">
            <select value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white">
              <option value="">اختر عميل</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={form.serviceId} onChange={e => setForm({ ...form, serviceId: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white">
              <option value="">اختر خدمة</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
            {error && <div className="sm:col-span-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</div>}
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-2 sm:p-4">
        {appointments.length === 0 ? (
          <div className="text-center py-12 text-sm text-ink-900/40">لا توجد مواعيد بعد</div>
        ) : (
          <Table head={['العميل', 'الخدمة', 'التاريخ', 'الوقت', 'الحالة']}>
            {appointments.map(a => (
              <tr key={a.id} className="hover:bg-sand-50">
                <td className="py-3 px-3 font-semibold text-ink-950 whitespace-nowrap">{a.customers?.name ?? '—'}</td>
                <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{a.services?.name ?? '—'}</td>
                <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{a.appointment_date ?? '—'}</td>
                <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{a.appointment_time ?? '—'}</td>
                <td className="py-3 px-3"><Badge tone={statusTone(a.status)}>{a.status}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
