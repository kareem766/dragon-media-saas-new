import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, Badge, statusTone } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface DBCustomer {
  id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
  status: string
  total_spent: number
  tags: string[] | null
  created_at: string
}

interface DBDeal {
  id: string
  title: string
  value: number
  stage_id: string
  pipeline_stages: { name: string } | null
}

interface DBAppointment {
  id: string
  appointment_date: string | null
  appointment_time: string | null
  status: string
  services: { name: string } | null
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const { organizationId, loading: orgLoading } = useOrganization()
  const [customer, setCustomer] = useState<DBCustomer | null>(null)
  const [deals, setDeals] = useState<DBDeal[]>([])
  const [appointments, setAppointments] = useState<DBAppointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !organizationId || !id) return
    const sb = supabase
    const load = async () => {
      setLoading(true)
      const [custRes, dealsRes, apRes] = await Promise.all([
        sb.from('customers').select('*').eq('id', id).eq('organization_id', organizationId).single(),
        sb.from('deals').select('*, pipeline_stages(name)').eq('customer_id', id).eq('organization_id', organizationId),
        sb.from('appointments').select('*, services(name)').eq('customer_id', id).eq('organization_id', organizationId),
      ])
      if (custRes.data) setCustomer(custRes.data as DBCustomer)
      if (dealsRes.data) setDeals(dealsRes.data as unknown as DBDeal[])
      if (apRes.data) setAppointments(apRes.data as unknown as DBAppointment[])
      setLoading(false)
    }
    load()
  }, [id, organizationId])

  if (orgLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (!customer) {
    return <div className="text-center py-20 text-sm text-red-600">العميل غير موجود</div>
  }

  const totalDealsValue = deals.reduce((s, d) => s + Number(d.value), 0)

  return (
    <div className="space-y-6">
      <Link to="/crm" className="text-sm text-ink-900/60 hover:underline inline-block">→ رجوع لـ CRM</Link>

      <Card className="p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink-950">{customer.name}</h2>
            {customer.company && <p className="text-sm text-ink-900/50 mt-1">{customer.company}</p>}
          </div>
          <Badge tone={statusTone(customer.status)}>{customer.status}</Badge>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-sand-100">
          <div>
            <div className="text-xs text-ink-900/45">الهاتف</div>
            <div className="text-sm font-medium text-ink-950 mt-1" dir="ltr">{customer.phone ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-ink-900/45">البريد الإلكتروني</div>
            <div className="text-sm font-medium text-ink-950 mt-1" dir="ltr">{customer.email ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-ink-900/45">عميل منذ</div>
            <div className="text-sm font-medium text-ink-950 mt-1">{new Date(customer.created_at).toLocaleDateString('ar-EG')}</div>
          </div>
        </div>
        {customer.tags && customer.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-4">
            {customer.tags.map(t => <Badge key={t}>{t}</Badge>)}
          </div>
        )}
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="text-xs text-ink-900/45">إجمالي المبيعات</div>
          <div className="text-2xl font-bold text-ink-950 mt-1">{customer.total_spent.toLocaleString('ar-EG')} ج.م</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-ink-900/45">قيمة الصفقات النشطة</div>
          <div className="text-2xl font-bold text-gold-600 mt-1">{totalDealsValue.toLocaleString('ar-EG')} ج.م</div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-bold text-ink-950 mb-4">الصفقات ({deals.length})</h3>
        {deals.length === 0 ? (
          <div className="text-sm text-ink-900/40 text-center py-6">لا توجد صفقات مرتبطة بهذا العميل</div>
        ) : (
          <div className="space-y-3">
            {deals.map(d => (
              <div key={d.id} className="flex items-center justify-between border border-sand-200 rounded-xl p-3.5">
                <div>
                  <div className="font-semibold text-sm text-ink-950">{d.title}</div>
                  <div className="text-xs text-ink-900/45 mt-1">{d.pipeline_stages?.name ?? '—'}</div>
                </div>
                <Badge tone="gold">{Number(d.value).toLocaleString('ar-EG')} ج.م</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-ink-950 mb-4">المواعيد ({appointments.length})</h3>
        {appointments.length === 0 ? (
          <div className="text-sm text-ink-900/40 text-center py-6">لا توجد مواعيد مرتبطة بهذا العميل</div>
        ) : (
          <div className="space-y-3">
            {appointments.map(a => (
              <div key={a.id} className="flex items-center justify-between border border-sand-200 rounded-xl p-3.5">
                <div>
                  <div className="font-semibold text-sm text-ink-950">{a.services?.name ?? 'موعد'}</div>
                  <div className="text-xs text-ink-900/45 mt-1">{a.appointment_date ?? '—'} · {a.appointment_time ?? '—'}</div>
                </div>
                <Badge tone={statusTone(a.status)}>{a.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
