import React from 'react'
import { Card, Badge, Button, Table } from '../components/ui'
import { teamUsers } from '../data/sampleData'
import { IconPlus } from '../components/Icon'

const roles = [
  { name: 'مدير عام', desc: 'صلاحية كاملة على كل الوحدات والإعدادات' },
  { name: 'أدمن', desc: 'إدارة المستخدمين، الإعدادات، والفوترة' },
  { name: 'مبيعات', desc: 'CRM، مسار المبيعات، والمهام الخاصة به' },
  { name: 'خدمة عملاء', desc: 'صندوق المحادثات، RYAN AI، والمواعيد' },
  { name: 'موظف', desc: 'وصول محدود حسب المهام الموكلة إليه' },
]

export default function Users() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button><span className="inline-flex items-center gap-2"><IconPlus className="w-4 h-4" /> دعوة مستخدم</span></Button>
      </div>

      <Card className="p-2 sm:p-4">
        <Table head={['الاسم', 'الدور', 'البريد الإلكتروني', 'الحالة']}>
          {teamUsers.map(u => (
            <tr key={u.id} className="hover:bg-sand-50">
              <td className="py-3 px-3 font-semibold text-ink-950 whitespace-nowrap">{u.name}</td>
              <td className="py-3 px-3"><Badge tone="gold">{u.role}</Badge></td>
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
