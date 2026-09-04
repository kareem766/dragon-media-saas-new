import React from 'react'
import { Card, StatCard } from '../components/ui'

const reports = [
  { title: 'تقرير العملاء المحتملين', desc: 'تحليل مصادر العملاء المحتملين ومعدلات التحويل' },
  { title: 'تقرير المبيعات', desc: 'أداء مسار المبيعات وقيمة الصفقات لكل مرحلة' },
  { title: 'تقرير العملاء', desc: 'نشاط العملاء وإجمالي الإنفاق والاحتفاظ' },
  { title: 'تقرير الحملات', desc: 'نسب الفتح والتفاعل لكل حملة تسويقية' },
  { title: 'تقرير الإيرادات', desc: 'الإيرادات الشهرية مقابل المستهدف' },
  { title: 'تقرير أداء الموظفين', desc: 'عدد الصفقات والمهام المنجزة لكل موظف' },
  { title: 'تقرير محادثات RYAN AI', desc: 'حجم المحادثات، معدل الحل الفوري، ورضا العملاء' },
]

export default function Reports() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="إيرادات الشهر" value="212,000 ج.م" sub="+18% عن الشهر الماضي" accent="gold" />
        <StatCard label="معدل تحويل العملاء" value="27%" />
        <StatCard label="متوسط قيمة الصفقة" value="31,600 ج.م" accent="clay" />
        <StatCard label="رضا العملاء" value="4.6 / 5" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {reports.map(r => (
          <Card key={r.title} className="p-5">
            <h3 className="font-bold text-ink-950">{r.title}</h3>
            <p className="text-sm text-ink-900/55 mt-1.5">{r.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
