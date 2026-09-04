import React, { useState } from 'react'
import { Card, Badge, Button, Table, statusTone } from '../components/ui'
import { leads, customers } from '../data/sampleData'
import { IconPlus } from '../components/Icon'

export default function CRM() {
  const [tab, setTab] = useState<'leads' | 'customers'>('leads')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex bg-white border border-sand-200 rounded-xl p-1">
          <button onClick={() => setTab('leads')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'leads' ? 'bg-ink-900 text-sand-50' : 'text-ink-900/60'}`}>العملاء المحتملون</button>
          <button onClick={() => setTab('customers')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'customers' ? 'bg-ink-900 text-sand-50' : 'text-ink-900/60'}`}>العملاء</button>
        </div>
        <Button><span className="inline-flex items-center gap-2"><IconPlus className="w-4 h-4" /> {tab === 'leads' ? 'إضافة عميل محتمل' : 'إضافة عميل'}</span></Button>
      </div>

      <Card className="p-2 sm:p-4">
        {tab === 'leads' ? (
          <Table head={['الاسم', 'الشركة', 'الهاتف', 'المصدر', 'الحالة', 'المسؤول', 'تاريخ الإضافة']}>
            {leads.map(l => (
              <tr key={l.id} className="hover:bg-sand-50">
                <td className="py-3 px-3 font-semibold text-ink-950 whitespace-nowrap">{l.name}</td>
                <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{l.company}</td>
                <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap" dir="ltr">{l.phone}</td>
                <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{l.source}</td>
                <td className="py-3 px-3"><Badge tone={statusTone(l.status)}>{l.status}</Badge></td>
                <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{l.assignedTo}</td>
                <td className="py-3 px-3 text-ink-900/50 whitespace-nowrap">{l.createdAt}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Table head={['العميل', 'الهاتف', 'البريد الإلكتروني', 'إجمالي المبيعات', 'الوسوم', 'الحالة']}>
            {customers.map(c => (
              <tr key={c.id} className="hover:bg-sand-50">
                <td className="py-3 px-3 font-semibold text-ink-950 whitespace-nowrap">{c.name}</td>
                <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap" dir="ltr">{c.phone}</td>
                <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap" dir="ltr">{c.email}</td>
                <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{c.totalSpent.toLocaleString('ar-EG')} ج.م</td>
                <td className="py-3 px-3">
                  <div className="flex gap-1.5 flex-wrap">
                    {c.tags.map(t => <Badge key={t}>{t}</Badge>)}
                  </div>
                </td>
                <td className="py-3 px-3"><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
