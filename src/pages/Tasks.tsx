import React from 'react'
import { Card, Badge, Button, Table, statusTone } from '../components/ui'
import { tasks } from '../data/sampleData'
import { IconPlus } from '../components/Icon'

export default function Tasks() {
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button><span className="inline-flex items-center gap-2"><IconPlus className="w-4 h-4" /> مهمة جديدة</span></Button>
      </div>
      <Card className="p-2 sm:p-4">
        <Table head={['المهمة', 'المسؤول', 'تاريخ الاستحقاق', 'الأولوية', 'الحالة']}>
          {tasks.map(t => (
            <tr key={t.id} className="hover:bg-sand-50">
              <td className="py-3 px-3 font-semibold text-ink-950 whitespace-nowrap">{t.title}</td>
              <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{t.assignedTo}</td>
              <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{t.dueDate}</td>
              <td className="py-3 px-3"><Badge tone={t.priority === 'عالية' ? 'danger' : t.priority === 'متوسطة' ? 'warning' : 'default'}>{t.priority}</Badge></td>
              <td className="py-3 px-3"><Badge tone={statusTone(t.status)}>{t.status}</Badge></td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}
