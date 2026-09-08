import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Badge } from '../components/ui'
import { IconSearch } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface Result { id: string; label: string; sub: string; href: string; type: string }

export default function Search() {
  const { organizationId } = useOrganization()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)

  const runSearch = async (query: string) => {
    setQ(query)
    if (!supabase || !organizationId || query.trim().length < 2) { setResults([]); return }
    setLoading(true)
    const term = `%${query.trim()}%`
    const [custRes, leadRes, dealRes, taskRes] = await Promise.all([
      supabase.from('customers').select('id, name, phone').eq('organization_id', organizationId).ilike('name', term).limit(5),
      supabase.from('leads').select('id, name, phone').eq('organization_id', organizationId).ilike('name', term).limit(5),
      supabase.from('deals').select('id, title, value').eq('organization_id', organizationId).ilike('title', term).limit(5),
      supabase.from('tasks').select('id, title').eq('organization_id', organizationId).ilike('title', term).limit(5),
    ])
    const r: Result[] = [
      ...(custRes.data ?? []).map((c: any) => ({ id: c.id, label: c.name, sub: c.phone ?? '', href: `#/crm/customer/${c.id}`, type: 'عميل' })),
      ...(leadRes.data ?? []).map((l: any) => ({ id: l.id, label: l.name, sub: l.phone ?? '', href: `#/crm`, type: 'عميل محتمل' })),
      ...(dealRes.data ?? []).map((d: any) => ({ id: d.id, label: d.title, sub: `${d.value ?? 0} ج.م`, href: `#/pipeline/deal/${d.id}`, type: 'صفقة' })),
      ...(taskRes.data ?? []).map((t: any) => ({ id: t.id, label: t.title, sub: '', href: `#/tasks`, type: 'مهمة' })),
    ]
    setResults(r)
    setLoading(false)
  }

  return (
    <div className="space-y-5 max-w-lg">
      <div className="flex items-center gap-2 bg-white border border-sand-200 rounded-full px-4 py-3">
        <IconSearch className="w-5 h-5 text-ink-900/40" />
        <input
          value={q}
          onChange={e => runSearch(e.target.value)}
          placeholder="ابحث في العملاء، الصفقات، المهام..."
          className="bg-transparent outline-none text-sm w-full"
          autoFocus
        />
      </div>

      {loading && <div className="text-sm text-ink-900/40 text-center py-6">جاري البحث...</div>}

      {!loading && q.trim().length >= 2 && results.length === 0 && (
        <div className="text-sm text-ink-900/40 text-center py-6">لا توجد نتائج</div>
      )}

      <div className="space-y-2">
        {results.map(r => (
          <a key={`${r.type}-${r.id}`} href={r.href}>
            <Card className="p-3.5 flex items-center justify-between hover:border-ink-700">
              <div>
                <div className="font-semibold text-sm text-ink-950">{r.label}</div>
                {r.sub && <div className="text-xs text-ink-900/45 mt-0.5">{r.sub}</div>}
              </div>
              <Badge>{r.type}</Badge>
            </Card>
          </a>
        ))}
      </div>
    </div>
  )
}
