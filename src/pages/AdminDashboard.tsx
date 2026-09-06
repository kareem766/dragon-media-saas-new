import React, { useEffect, useState } from 'react'
import { Card, StatCard, Badge, Button } from '../components/ui'
import { supabase } from '../lib/supabaseClient'

interface OrgRow {
  id: string
  name: string
  business_type: string | null
  plan: string
  created_at: string
  usersCount: number
  leadsCount: number
  customersCount: number
  dealsValue: number
  suspended?: boolean
}

interface Overview {
  totals: { organizations: number; users: number; leads: number; customers: number; dealsValue: number }
  organizations: OrgRow[]
}

export default function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = async () => {
    if (!supabase) return
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const [overviewRes, orgsRes] = await Promise.all([
      fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${token}` } }),
      supabase.from('organizations').select('id, suspended'),
    ])
    const json = await overviewRes.json()
    if (!overviewRes.ok) { setError(json.error || 'حدث خطأ'); setLoading(false); return }
    const suspendedMap = new Map((orgsRes.data ?? []).map((o: any) => [o.id, o.suspended]))
    json.organizations = json.organizations.map((o: OrgRow) => ({ ...o, suspended: suspendedMap.get(o.id) }))
    setData(json)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const handleAction = async (org: OrgRow) => {
    const willSuspend = !org.suspended
    const confirmed = window.confirm(
      willSuspend ? 'هل أنت متأكد من تعليق هذه الشركة؟' : 'هل أنت متأكد من تفعيل هذه الشركة؟'
    )
    if (!confirmed) return

    if (!supabase) return
    setActingId(org.id)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const res = await fetch('/api/admin/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: willSuspend ? 'suspend' : 'activate', organizationId: org.id }),
    })
    setActingId(null)

    if (!res.ok) {
      setToast('حدث خطأ أثناء تنفيذ العملية')
      return
    }

    setData(prev => prev ? {
      ...prev,
      organizations: prev.organizations.map(o => o.id === org.id ? { ...o, suspended: willSuspend } : o),
    } : prev)

    setToast(willSuspend ? `تم تعليق شركة "${org.name}" بنجاح` : `تم تفعيل شركة "${org.name}" بنجاح`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return <div className="text-center py-20 text-sm text-red-600">{error}</div>
  }

  return (
    <div dir="rtl" className="min-h-screen bg-sand-50 p-6 space-y-6 relative">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-ink-950 text-sand-50 text-sm px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-ink-950">لوحة تحكم Dragon Media — إدارة المنصة</h1>
        <div className="flex gap-4">
          <a href="#/admin/payments" className="text-sm font-semibold text-gold-600 hover:underline">مراجعة طلبات الدفع ←</a>
          <a href="#/admin/audit-logs" className="text-sm font-semibold text-gold-600 hover:underline">سجل النشاط ←</a>
          <a href="#/admin/settings" className="text-sm font-semibold text-gold-600 hover:underline">إعدادات المنصة ←</a>
          <a href="#/admin/plans" className="text-sm font-semibold text-gold-600 hover:underline">إدارة الباقات ←</a>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="عدد الشركات" value={String(data.totals.organizations)} accent="gold" />
        <StatCard label="إجمالي المستخدمين" value={String(data.totals.users)} />
        <StatCard label="إجمالي العملاء المحتملين" value={String(data.totals.leads)} />
        <StatCard label="إجمالي العملاء" value={String(data.totals.customers)} accent="clay" />
        <StatCard label="إجمالي قيمة الصفقات" value={`${data.totals.dealsValue.toLocaleString('ar-EG')} ج.م`} />
      </div>

      <Card className="p-2 sm:p-4">
        <div className="p-3 font-bold text-ink-950">الشركات المسجلة على المنصة</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-900/45 border-b border-sand-200">
                <th className="text-right font-medium py-3 px-3">الشركة</th>
                <th className="text-right font-medium py-3 px-3">النشاط</th>
                <th className="text-right font-medium py-3 px-3">الباقة</th>
                <th className="text-right font-medium py-3 px-3">المستخدمين</th>
                <th className="text-right font-medium py-3 px-3">العملاء</th>
                <th className="text-right font-medium py-3 px-3">قيمة الصفقات</th>
                <th className="text-right font-medium py-3 px-3">الحالة</th>
                <th className="text-right font-medium py-3 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {data.organizations.map(o => (
                <tr key={o.id} className="hover:bg-sand-50">
                  <td className="py-3 px-3 font-semibold text-ink-950 whitespace-nowrap">{o.name}</td>
                  <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{o.business_type ?? '—'}</td>
                  <td className="py-3 px-3"><Badge tone="gold">{o.plan}</Badge></td>
                  <td className="py-3 px-3 text-ink-900/70">{o.usersCount}</td>
                  <td className="py-3 px-3 text-ink-900/70">{o.customersCount}</td>
                  <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{o.dealsValue.toLocaleString('ar-EG')} ج.م</td>
                  <td className="py-3 px-3"><Badge tone={o.suspended ? 'danger' : 'success'}>{o.suspended ? 'موقوفة' : 'نشطة'}</Badge></td>
                  <td className="py-3 px-3">
                    <Button variant="secondary" onClick={() => handleAction(o)} disabled={actingId === o.id}>
                      {actingId === o.id ? '...' : o.suspended ? 'تفعيل' : 'تعليق'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
