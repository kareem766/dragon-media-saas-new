import React, { useEffect, useState } from 'react'
import { Card, Button } from '../components/ui'
import { supabase } from '../lib/supabaseClient'

interface PermRow {
  id: string
  role: string
  resource: string
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
}

const roleLabels: Record<string, string> = {
  super_admin: 'مدير عام', admin: 'أدمن', sales: 'مبيعات', support: 'خدمة عملاء', employee: 'موظف',
}
const resourceLabels: Record<string, string> = {
  leads: 'العملاء المحتملون', customers: 'العملاء', deals: 'الصفقات', tasks: 'المهام',
  appointments: 'المواعيد', campaigns: 'الحملات', settings: 'الإعدادات', users: 'المستخدمون',
}

export default function AdminRoles() {
  const [rows, setRows] = useState<PermRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = async () => {
    if (!supabase) return
    const { data } = await supabase.from('role_permissions').select('*').order('role', { ascending: true })
    if (data) setRows(data as PermRow[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggle = async (row: PermRow, field: 'can_view' | 'can_edit' | 'can_delete') => {
    if (!supabase) return
    setSavingId(row.id)
    const updated = { ...row, [field]: !row[field] }
    await supabase.from('role_permissions').update({ [field]: updated[field] }).eq('id', row.id)
    setRows(prev => prev.map(r => r.id === row.id ? updated : r))
    setSavingId(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  const roles = [...new Set(rows.map(r => r.role))]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-950">إدارة الأدوار والصلاحيات</h2>
        <p className="text-sm text-ink-900/50 mt-1">تحكم في صلاحيات كل دور عبر كل الشركات على المنصة — التغييرات فورية.</p>
      </div>
      {roles.map(role => (
        <Card key={role} className="p-4">
          <h3 className="font-bold text-ink-950 mb-3">{roleLabels[role] ?? role}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-900/45 border-b border-sand-200">
                  <th className="text-right font-medium py-2 px-2">المورد</th>
                  <th className="text-center font-medium py-2 px-2">عرض</th>
                  <th className="text-center font-medium py-2 px-2">تعديل</th>
                  <th className="text-center font-medium py-2 px-2">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {rows.filter(r => r.role === role).map(r => (
                  <tr key={r.id}>
                    <td className="py-2 px-2 text-ink-900">{resourceLabels[r.resource] ?? r.resource}</td>
                    {(['can_view', 'can_edit', 'can_delete'] as const).map(field => (
                      <td key={field} className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={r[field]}
                          disabled={savingId === r.id}
                          onChange={() => toggle(r, field)}
                          className="w-4 h-4 accent-ink-900"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  )
}
