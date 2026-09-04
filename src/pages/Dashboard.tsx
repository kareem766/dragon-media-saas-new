import React from 'react'
import { Card, StatCard, Badge, statusTone } from '../components/ui'
import { leads, deals, tasks, campaigns, conversations, customers } from '../data/sampleData'

export default function Dashboard() {
  const pipelineValue = deals.reduce((s, d) => s + d.value, 0)
  const activeCustomers = customers.filter(c => c.status === 'نشط').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="عملاء محتملون جدد" value={String(leads.length)} sub="آخر 7 أيام" accent="gold" />
        <StatCard label="قيمة مسار المبيعات" value={`${pipelineValue.toLocaleString('ar-EG')} ج.م`} sub={`${deals.length} صفقة نشطة`} />
        <StatCard label="عملاء نشطون" value={String(activeCustomers)} sub={`من إجمالي ${customers.length}`} accent="clay" />
        <StatCard label="مهام متأخرة" value={String(tasks.filter(t => t.status === 'متأخرة').length)} sub="تحتاج متابعة فورية" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-ink-950">أداء الحملات النشطة</h2>
            <span className="text-xs text-ink-900/45">آخر تحديث اليوم</span>
          </div>
          <div className="space-y-4">
            {campaigns.map(c => (
              <div key={c.id} className="flex items-center justify-between border-b border-sand-100 last:border-0 pb-4 last:pb-0">
                <div>
                  <div className="font-semibold text-sm text-ink-950">{c.name}</div>
                  <div className="text-xs text-ink-900/45 mt-1">{c.channel} · {c.audience}</div>
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-ink-900">{c.sentCount.toLocaleString('ar-EG')} رسالة</div>
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-bold text-ink-950 mb-4">أحدث المحادثات</h2>
          <div className="space-y-3.5">
            {conversations.map(c => (
              <div key={c.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-ink-950 truncate">{c.customerName}</span>
                    {c.unread && <span className="w-2 h-2 rounded-full bg-clay-500 shrink-0" />}
                  </div>
                  <div className="text-xs text-ink-900/50 truncate mt-0.5">{c.lastMessage}</div>
                </div>
                <span className="text-[11px] text-ink-900/40 whitespace-nowrap">{c.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-ink-950">مهام اليوم والمتابعات</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {tasks.map(t => (
            <div key={t.id} className="border border-sand-200 rounded-xl p-3.5">
              <Badge tone={statusTone(t.status)}>{t.status}</Badge>
              <div className="font-semibold text-sm text-ink-950 mt-2.5 leading-snug">{t.title}</div>
              <div className="text-xs text-ink-900/45 mt-2">{t.assignedTo} · {t.dueDate}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
