import React, { useEffect, useState } from 'react'
import { Card, Badge } from '../components/ui'
import { supabase } from '../lib/supabaseClient'

interface LogRow {
  id: string
  action: string
  entity: string
  created_at: string
  organizations: { name: string } | null
  actor: { full_name: string } | null
  new_value: any
}

const actionLabels: Record<string, string> = {
  approve_payment: 'موافقة على دفعة',
  reject_payment: 'رفض دفعة',
  suspend_organization: 'تعليق شركة',
  activate_organization: 'تفعيل شركة',
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!supabase) return
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch('/api/admin/audit-logs', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok) { setError(json.error); setLoading(false); return }
      setLogs(json.logs)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) return <div className="text-center py-20 text-sm text-red-600">{error}</div>

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink-950">سجل النشاط</h2>
      {logs.length === 0 ? (
        <div className="text-center py-16 text-sm text-ink-900/40">لا يوجد نشاط مسجّل بعد</div>
      ) : (
        <div className="space-y-2">
          {logs.map(l => (
            <Card key={l.id} className="p-3.5 flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-sm font-semibold text-ink-950">
                  <Badge tone="gold">{actionLabels[l.action] ?? l.action}</Badge>
                  <span className="mr-2">{l.organizations?.name ?? '—'}</span>
                </div>
                <div className="text-xs text-ink-900/45 mt-1">بواسطة: {l.actor?.full_name ?? 'النظام'}</div>
              </div>
              <span className="text-xs text-ink-900/40 whitespace-nowrap">{new Date(l.created_at).toLocaleString('ar-EG')}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
