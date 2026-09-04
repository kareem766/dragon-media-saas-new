import React, { useState } from 'react'
import { Card, Badge } from '../components/ui'
import { conversations } from '../data/sampleData'

const channels = ['الكل', 'واتساب', 'ماسنجر', 'إنستجرام', 'تليجرام', 'الموقع']

export default function Inbox() {
  const [active, setActive] = useState(conversations[0])
  const [filter, setFilter] = useState('الكل')

  const filtered = filter === 'الكل' ? conversations : conversations.filter(c => c.channel === filter)

  return (
    <Card className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-[calc(100vh-160px)] overflow-hidden">
      <div className="border-e border-sand-200 flex flex-col">
        <div className="p-3 border-b border-sand-100 flex gap-1.5 overflow-x-auto">
          {channels.map(ch => (
            <button key={ch} onClick={() => setFilter(ch)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${filter === ch ? 'bg-ink-900 text-sand-50' : 'bg-sand-100 text-ink-900/60'}`}>
              {ch}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map(c => (
            <button key={c.id} onClick={() => setActive(c)}
              className={`w-full text-right p-4 border-b border-sand-100 hover:bg-sand-50 ${active.id === c.id ? 'bg-sand-100' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-ink-950">{c.customerName}</span>
                <span className="text-[11px] text-ink-900/40">{c.time}</span>
              </div>
              <div className="text-xs text-ink-900/50 truncate mt-1">{c.lastMessage}</div>
              <div className="flex items-center gap-1.5 mt-2">
                <Badge>{c.channel}</Badge>
                {c.handledBy === 'RYAN AI' && <Badge tone="gold">RYAN AI</Badge>}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col">
        <div className="p-4 border-b border-sand-100 flex items-center justify-between">
          <div>
            <div className="font-bold text-ink-950">{active.customerName}</div>
            <div className="text-xs text-ink-900/45">{active.channel} · يتم الرد بواسطة {active.handledBy}</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-sand-50/50">
          <div className="max-w-md bg-white border border-sand-200 rounded-2xl rounded-tr-sm p-3.5 text-sm text-ink-900">
            {active.lastMessage}
          </div>
          <div className="max-w-md mr-auto bg-ink-900 text-sand-50 rounded-2xl rounded-tl-sm p-3.5 text-sm">
            أهلًا بحضرتك، تحت أمرك 🌟 ممكن أبعتلك تفاصيل الباقات دلوقتي؟
          </div>
        </div>
        <div className="p-4 border-t border-sand-100">
          <input placeholder="اكتب ردك هنا..." className="w-full border border-sand-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-ink-700" />
        </div>
      </div>
    </Card>
  )
}
