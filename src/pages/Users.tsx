import React, { useEffect, useState } from 'react'
import { Card, Badge, Button, Table } from '../components/ui'
import { IconPlus } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface TeamUser {
  id: string
  full_name: string
  email: string
  role: string
  active: boolean
}

interface InviteCode {
  id: string
  code: string
  role: string
  used_by: string | null
  created_at: string
}

const roleLabels: Record<string, string> = {
  super_admin: 'مدير عام',
  admin: 'أدمن',
  sales: 'مبيعات',
  support: 'خدمة عملاء',
  employee: 'موظف',
}

const roles = [
  { name: 'مدير عام', desc: 'صلاحية كاملة على كل الوحدات والإعدادات' },
  { name: 'أدمن', desc: 'إدارة المستخدمين، الإعدادات، والفوترة' },
  { name: 'مبيعات', desc: 'CRM، مسار المبيعات، والمهام الخاصة به' },
  { name: 'خدمة عملاء', desc: 'صندوق المحادثات، RYAN AI، والمواعيد' },
  { name: 'موظف', desc: 'وصول محدود حسب المهام الموكلة إليه' },
]

export default function Users() {
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization()
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])
  const [invites, setInvites] = useState<InviteCode[]>([])
  const [loading, setLoading] = useState(true)
  const [newRole, setNewRole] = useState('employee')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const loadData = async () => {
    if (!supabase || !organizationId) return
    setLoading(true)
    const [usersRes, invitesRes] = await Promise.all([
      supabase.from('users').select('id, full_name, email, role, active').eq('organization_id', organizationId),
      supabase.from('invite_codes').select('id, code, role, used_by, created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }),
    ])
    if (usersRes.data) setTeamUsers(usersRes.data as TeamUser[])
    if (invitesRes.data) setInvites(invitesRes.data as InviteCode[])
    setLoading(false)
  }

  useEffect(() => {
    if (organizationId) loadData()
  }, [organizationId])

  const handleGenerate = async () => {
    if (!supabase) return
    setGenerating(true)
    setGenError(null)
    const { error } = await supabase.rpc('generate_invite_code', { p_role: newRole })
    setGenerating(false)
    if (error) {
      setGenError(error.message)
      return
    }
    loadData()
  }

  if (orgLoading || loading) {
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

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h3 className="font-bold text-ink-950 mb-3">دعوة موظف جديد</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-ink-900/50">الدور</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value)} className="block mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white">
              <option value="admin">أدمن</option>
              <option value="sales">مبيعات</option>
              <option value="support">خدمة عملاء</option>
              <option value="employee">موظف</option>
            </select>
          </div>
          <Button onClick={handleGenerate} disabled={generating}>
            <span className="inline-flex items-center gap-2"><IconPlus className="w-4 h-4" /> {generating ? 'جاري التوليد...' : 'توليد كود دعوة'}</span>
          </Button>
        </div>
        {genError && <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{genError}</div>}
        <p className="text-xs text-ink-900/40 mt-3">ابعت الكود للموظف يدويًا (واتساب/إيميل)، وهو يدخله وقت إنشاء الحساب عشان ينضم لمؤسستك تلقائيًا.</p>

        {invites.length > 0 && (
          <div className="mt-4 space-y-2">
            {invites.map(inv => (
              <div key={inv.id} className="flex items-center justify-between border border-sand-200 rounded-lg px-3.5 py-2.5">
                <span className="font-mono text-sm text-ink-950">{inv.code}</span>
                <span className="text-xs text-ink-900/50">{roleLabels[inv.role] ?? inv.role}</span>
                <Badge tone={inv.used_by ? 'success' : 'warning'}>{inv.used_by ? 'مستخدم' : 'متاح'}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-2 sm:p-4">
        <div className="p-3 font-bold text-ink-950">أعضاء الفريق الحاليين</div>
        <Table head={['الاسم', 'الدور', 'البريد الإلكتروني', 'الحالة']}>
          {teamUsers.map(u => (
            <tr key={u.id} className="hover:bg-sand-50">
              <td className="py-3 px-3 font-semibold text-ink-950 whitespace-nowrap">{u.full_name}</td>
              <td className="py-3 px-3"><Badge tone="gold">{roleLabels[u.role] ?? u.role}</Badge></td>
              <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap" dir="ltr">{u.email}</td>
              <td className="py-3 px-3"><Badge tone={u.active ? 'success' : 'default'}>{u.active ? 'نشط' : 'موقوف'}</Badge></td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-ink-950 mb-4">الأدوار والصلاحيات</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {roles.map(r => (
            <div key={r.name} className="border border-sand-200 rounded-xl p-3.5">
              <div className="font-semibold text-sm text-ink-950">{r.name}</div>
              <div className="text-xs text-ink-900/50 mt-1">{r.desc}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
