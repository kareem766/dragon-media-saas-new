import React from 'react'
import { Card, Badge, Button, Table, statusTone } from '../components/ui'
import { appointments } from '../data/sampleData'
import { IconPlus } from '../components/Icon'

export default function Appointments() {
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button><span className="inline-flex items-center gap-2"><IconPlus className="w-4 h-4" /> حجز موعد</span></Button>
      </div>
      <Card className="p-2 sm:p-4">
        <Table head={['العميل', 'الخدمة', 'التاريخ', 'الوقت', 'الحالة']}>
          {appointments.map(a => (
            <tr key={a.id} className="hover:bg-sand-50">
              <td className="py-3 px-3 font-semibold text-ink-950 whitespace-nowrap">{a.customer}</td>
              <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{a.service}</td>
              <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{a.date}</td>
              <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{a.time}</td>
              <td className="py-3 px-3"><Badge tone={statusTone(a.status)}>{a.status}</Badge></td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}
