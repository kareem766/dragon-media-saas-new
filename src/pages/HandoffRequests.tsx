import React, { useEffect, useState } from 'react'
import { Card, Badge, Button } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface DBRequest {
  id: string
  customer_name: string | null
  reason: string | null
  status: string
  created_at: string
}

export default function HandoffRequests() {
  const { organizationId, loading: orgLoading } = useOrganization()
  const [requests, setRequests] = useState<DBRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const load = async () => {
    if (!supabase || !organizationId) return
    setLoading(true)
    const { data } = await supabase.from('human_handoff_requests').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false })
    if (data) setRequests(data as DBRequest[])
    setLoading(false)
  }

  useEffect(() => { if (organizationId) load() }, [organizationId])

  const resolve = async (id: string) => {
    if (!supabase) return
    setResolvingId(id)
    await supabase.from('human_handoff_requests').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id)
    setResolvingId(null)
    load()
  }

  if (orgLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  const open = requests.filter(r => r.status === 'open')
  const resolved = requests.filter(r => r.status === 'resolved')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-950">طلبات التحويل للدعم البشري</h2>
        <p className="text-sm text-ink-900/50 mt-1">عملاء طلبوا من ريان التحدث مع موظف حقيقي.</p>
      </div>

      {open.length === 0 ? (
        <div className="text-center py-10 text-sm text-ink-900/40">لا توجد طلبات مفتوحة 🎉</div>
      ) : (
        <div className="space-y-3">
          {open.map(r => (
            <Card key={r.id} className="p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-semibold text-sm text-ink-950">{r.customer_name ?? 'عميل غير معروف'}</div>
                <div className="text-xs text-ink-900/50 mt-1">{r.reason ?? '—'}</div>
                <div className="text-xs text-ink-900/40 mt-1">{new Date(r.created_at).toLocaleString('ar-EG')}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone="warning">مفتوح</Badge>
                <Button onClick={() => resolve(r.id)} disabled={resolvingId === r.id}>تم التعامل معه</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <h3 className="font-bold text-ink-950 mb-3 mt-6">طلبات تم حلها</h3>
          <div className="space-y-2">
            {resolved.map(r => (
              <Card key={r.id} className="p-3.5 flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm text-ink-900">{r.customer_name ?? 'عميل غير معروف'} — {r.reason}</div>
                <Badge tone="success">تم الحل</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
