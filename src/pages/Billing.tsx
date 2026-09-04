import React from 'react'
import { Card, Badge, Table, statusTone, StatCard } from '../components/ui'
import { invoices } from '../data/sampleData'

const plans = [
  { name: 'أساسي', price: '2,500', features: ['CRM أساسي', 'خدمة عملاء عبر قناة واحدة', 'تقارير شهرية'] },
  { name: 'النمو', price: '6,000', features: ['كل مميزات الأساسي', 'RYAN AI', 'صندوق محادثات موحد', 'حملات تسويقية'], highlighted: true },
  { name: 'المؤسسات', price: 'حسب الطلب', features: ['كل مميزات النمو', 'وكلاء AI متعددون', 'صلاحيات متقدمة', 'دعم مخصص'] },
]

export default function Billing() {
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        {plans.map(p => (
          <Card key={p.name} className={`p-6 ${p.highlighted ? 'border-gold-500 border-2' : ''}`}>
            {p.highlighted && <Badge tone="gold">الأكثر طلبًا</Badge>}
            <h3 className="font-bold text-lg text-ink-950 mt-2">{p.name}</h3>
            <div className="text-2xl font-bold text-ink-950 mt-2">{p.price} {p.price !== 'حسب الطلب' && <span className="text-sm font-normal text-ink-900/50">ج.م / شهريًا</span>}</div>
            <ul className="mt-4 space-y-2 text-sm text-ink-900/60">
              {p.features.map(f => <li key={f}>• {f}</li>)}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="p-2 sm:p-4">
        <div className="p-3 font-bold text-ink-950">سجل الفواتير</div>
        <Table head={['رقم الفاتورة', 'العميل', 'الباقة', 'المبلغ', 'الحالة', 'تاريخ الاستحقاق']}>
          {invoices.map(i => (
            <tr key={i.id} className="hover:bg-sand-50">
              <td className="py-3 px-3 font-semibold text-ink-950 whitespace-nowrap">{i.id}</td>
              <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{i.customer}</td>
              <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{i.plan}</td>
              <td className="py-3 px-3 text-ink-900/70 whitespace-nowrap">{i.amount.toLocaleString('ar-EG')} ج.م</td>
              <td className="py-3 px-3"><Badge tone={statusTone(i.status)}>{i.status}</Badge></td>
              <td className="py-3 px-3 text-ink-900/50 whitespace-nowrap">{i.dueDate}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}
