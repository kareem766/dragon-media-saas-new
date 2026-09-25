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
  expires_at: string
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
      supabase.from('invite_codes').select('id, code, role, used_by, created_at, expires_at').eq('organization_id', organizationId).is('used_by', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
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
        <div className="mt-3 rounded-xl border border-blue-200/70 bg-blue-50/60 backdrop-blur-sm px-3.5 py-3 shadow-sm">
          <div className="text-sm font-semibold text-blue-900">صلاحية كود الدعوة</div>
          <p className="text-xs leading-6 text-blue-900/70 mt-1">
            كود الدعوة صالح لمدة <strong>24 ساعة فقط من وقت إنشائه</strong>. بعد انتهاء المدة لن يمكن استخدامه، وسيكون عليك إنشاء دعوة جديدة.
          </p>
          <p className="text-xs leading-6 text-blue-900/50 mt-1">
            شارك الكود مع الموظف عبر واتساب أو البريد الإلكتروني، ليستخدمه أثناء إنشاء حسابه والانضمام إلى مؤسستك تلقائيًا. يتم إخفاء الكود تلقائيًا بعد انتهاء صلاحيته.
          </p>
        </div>

        {invites.length > 0 && (
          <div className="mt-4 grid gap-3">
            {invites.map(inv => {
              const roleLabel = roleLabels[inv.role] ?? inv.role
              const roleDetails = roles.find(r => r.name === roleLabel)?.desc ?? 'صلاحيات حسب الدور المحدد داخل الشركة'
              const createdAt = new Date(inv.created_at)
              const expiresAt = new Date(inv.expires_at)

              return (
                <div key={inv.id} className="rounded-2xl border border-blue-200/70 bg-blue-50/50 backdrop-blur-sm p-4 shadow-sm">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold text-blue-900/55 mb-1">كود دعوة الموظف</div>
                        <div className="font-mono text-lg font-bold tracking-wider text-blue-950" dir="ltr">{inv.code}</div>
                      </div>
                      <Badge tone="gold">{roleLabel}</Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-blue-200/60 bg-white/55 px-3 py-2.5">
                        <div className="text-[11px] text-blue-900/50">تاريخ ووقت الإنشاء</div>
                        <div className="mt-1 text-sm font-semibold text-blue-950">
                          {createdAt.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        <div className="text-xs text-blue-900/60">
                          {createdAt.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </div>

                      <div className="rounded-xl border border-blue-200/60 bg-white/55 px-3 py-2.5">
                        <div className="text-[11px] text-blue-900/50">ينتهي في</div>
                        <div className="mt-1 text-sm font-semibold text-blue-950">
                          {expiresAt.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        <div className="text-xs font-medium text-blue-700">
                          الساعة {expiresAt.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-200/60 bg-white/45 px-3 py-2.5">
                      <div className="text-[11px] text-blue-900/50">صلاحيات الموظف</div>
                      <div className="mt-1 text-sm font-semibold text-blue-950">{roleLabel}</div>
                      <div className="mt-1 text-xs leading-5 text-blue-900/65">{roleDetails}</div>
                    </div>

                    <div className="text-[11px] text-blue-900/45">
                      الكود صالح لمدة 24 ساعة من وقت الإنشاء، ويختفي من هذه الصفحة تلقائيًا بعد انتهاء صلاحيته.
                    </div>
                  </div>
                </div>
              )
            })}
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
