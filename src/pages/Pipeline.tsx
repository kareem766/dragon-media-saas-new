import React from 'react'
import { Card, Badge } from '../components/ui'
import { deals, pipelineStages } from '../data/sampleData'

export default function Pipeline() {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {pipelineStages.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage)
          const total = stageDeals.reduce((s, d) => s + d.value, 0)
          return (
            <div key={stage} className="w-72 shrink-0">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="font-bold text-ink-950 text-sm">{stage}</h3>
                <span className="text-xs text-ink-900/45">{stageDeals.length}</span>
              </div>
              <div className="text-xs text-ink-900/45 mb-3 px-1">{total.toLocaleString('ar-EG')} ج.م</div>
              <div className="space-y-3">
                {stageDeals.map(d => (
                  <Card key={d.id} className="p-3.5">
                    <div className="font-semibold text-sm text-ink-950 leading-snug">{d.title}</div>
                    <div className="text-xs text-ink-900/50 mt-1.5">{d.customer}</div>
                    <div className="flex items-center justify-between mt-3">
                      <Badge tone="gold">{d.value.toLocaleString('ar-EG')} ج.م</Badge>
                      <span className="text-[11px] text-ink-900/40">{d.owner}</span>
                    </div>
                  </Card>
                ))}
                {stageDeals.length === 0 && (
                  <div className="text-xs text-ink-900/30 text-center py-6 border border-dashed border-sand-200 rounded-xl">لا توجد صفقات</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
