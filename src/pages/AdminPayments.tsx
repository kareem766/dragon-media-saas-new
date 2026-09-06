import React, { useEffect, useState } from 'react'
import { Card, Badge, Button } from '../components/ui'
import { supabase } from '../lib/supabaseClient'

interface PaymentRequestRow {
  id: string
  amount: number
  method: string
  reference: string
  payment_date: string
  status: string
  rejection_reason: string | null
  organizations: { name: string } | null
  plans: { name: string; price: number } | null
}

const methodLabels: Record<string, string> = {
  bank_transfer: 'تحويل بنكي',
  vodafone_cash: 'فودافون كاش',
  instapay: 'InstaPay',
}

export default function AdminPayments() {
  const [requests, setRequests] = useState<PaymentRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  const load = async () => {
    if (!supabase) return
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const res = await fetch('/api/admin/payments', { headers: { Authorization: `Bearer ${token}` } })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setLoading(false); return }
    setRequests(json.requests)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const act = async (requestId: string, action: 'approve' | 'reject') => {
    if (!supabase) return
    let reason: string | undefined
    if (action === 'reject') {
      reason = window.prompt('سبب الرفض؟') || 'غير محدد'
    }
    setActingId(requestId)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    await fetch('/api/admin/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, requestId, reason }),
    })
    setActingId(null)
    load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) return <div className="text-center py-20 text-sm text-red-600">{error}</div>

  const pending = requests.filter(r => r.status === 'pending_review')
  const reviewed = requests.filter(r => r.status !== 'pending_review')

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-ink-950">مراجعة طلبات الدفع</h2>

      {pending.length === 0 ? (
        <div className="text-sm text-ink-900/40 text-center py-10">لا توجد طلبات بانتظار المراجعة</div>
      ) : (
        <div className="space-y-3">
          {pending.map(r => (
            <Card key={r.id} className="p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-semibold text-sm text-ink-950">{r.organizations?.name} — {r.plans?.name}</div>
                <div className="text-xs text-ink-900/45 mt-1">
                  {methodLabels[r.method]} · مرجع: {r.reference} · {r.payment_date} · {r.amount.toLocaleString('ar-EG')} ج.م
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => act(r.id, 'approve')} disabled={actingId === r.id}>موافقة</Button>
                <Button variant="secondary" onClick={() => act(r.id, 'reject')} disabled={actingId === r.id}>رفض</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <div>
          <h3 className="font-bold text-ink-950 mb-3">طلبات تمت مراجعتها</h3>
          <div className="space-y-2">
            {reviewed.map(r => (
              <Card key={r.id} className="p-3.5 flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm text-ink-900">{r.organizations?.name} — {r.plans?.name}</div>
                <Badge tone={r.status === 'approved' ? 'success' : 'danger'}>{r.status === 'approved' ? 'تمت الموافقة' : `مرفوض: ${r.rejection_reason}`}</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
