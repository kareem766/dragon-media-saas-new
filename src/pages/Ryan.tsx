import React from 'react'
import { Card, Badge, Button, StatCard } from '../components/ui'
import { IconSpark } from '../components/Icon'

export default function Ryan() {
  return (
    <div className="space-y-6">
      <Card className="p-6 bg-ink-950 text-sand-100 border-0">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gold-500 text-ink-950 flex items-center justify-center">
            <IconSpark className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold">RYAN AI</h2>
            <p className="text-sand-100/60 text-sm mt-1">مساعد المبيعات وخدمة العملاء الذكي الخاص بـ Dragon Media</p>
          </div>
          <Badge tone="success">يعمل الآن</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="محادثات اليوم" value="142" accent="gold" />
        <StatCard label="معدل الرد الفوري" value="98%" />
        <StatCard label="عملاء تم تحويلهم للمبيعات" value="23" accent="clay" />
        <StatCard label="رضا العملاء" value="4.7 / 5" />
      </div>

      <Card className="p-5">
        <h3 className="font-bold text-ink-950 mb-4">قاعدة المعرفة (Knowledge Base)</h3>
        <p className="text-sm text-ink-900/55 mb-4">كل عميل من عملاء Dragon Media بيقدر يكون له وكيل RYAN خاص بيه، بقاعدة معرفة مستقلة عن باقي العملاء.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {['أسئلة شائعة عن الخدمات', 'سياسة الأسعار والباقات', 'إجراءات التصعيد للموظفين'].map(item => (
            <div key={item} className="border border-sand-200 rounded-xl p-3.5 text-sm font-medium text-ink-900">{item}</div>
          ))}
        </div>
        <Button variant="secondary" className="mt-4">إدارة قاعدة المعرفة</Button>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-ink-950 mb-3">شخصية RYAN</h3>
        <p className="text-sm text-ink-900/55 leading-relaxed">
          ريان بيتكلم باللهجة المصرية العامية، وبيخاطب العملاء بـ"حضرتك" و"أستاذ / أستاذة" متبوعة بالاسم. الأسلوب ودود واحترافي في نفس الوقت، ومصمم عشان يمثل صوت Dragon Media في كل قنوات التواصل.
        </p>
      </Card>
    </div>
  )
}
