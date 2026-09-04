import React from 'react'
import { Card, Badge, Button, Table, statusTone } from '../components/ui'
import { campaigns } from '../data/sampleData'
import { IconPlus } from '../components/Icon'

export default function Campaigns() {
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button><span className="inline-flex items-center gap-2"><IconPlus className="w-4 h-4" /> إنشاء حملة جديدة</span></Button>
      </div>
      <Card className="p-2 sm:p-4">
        <Table head={['اسم الحملة', 'القناة', 'الجمهور المستهدف', 'الحالة', 'عدد الرسائل', 'نسبة الفتح', 'موعد الإرسال']}>
          {campaigns.map(c => (
            <tr key={c.id} className="hover:bg-sand-50">
              <td className="py-3 px-3 font-semibold text-ink-950 whitespace-nowrap">{c.name}</td>
              <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{c.channel}</td>
              <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{c.audience}</td>
              <td className="py-3 px-3"><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
              <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{c.sentCount.toLocaleString('ar-EG')}</td>
              <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{c.openRate}%</td>
              <td className="py-3 px-3 text-ink-900/50 whitespace-nowrap">{c.scheduledAt}</td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card className="p-5">
        <h3 className="font-bold text-ink-950 mb-2">موافقة التسويق (Opt-in / Opt-out)</h3>
        <p className="text-sm text-ink-900/55">كل جهة اتصال في الحملات لازم تكون موافقة صراحة على استقبال رسائل تسويقية. العملاء اللي عملوا Opt-out بيتم استبعادهم تلقائيًا من أي حملة جديدة.</p>
      </Card>
    </div>
  )
}
