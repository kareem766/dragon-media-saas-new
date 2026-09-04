import React from 'react'
import { Card, Badge, Button } from '../components/ui'
import { services } from '../data/sampleData'
import { IconPlus } from '../components/Icon'

export default function Services() {
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button><span className="inline-flex items-center gap-2"><IconPlus className="w-4 h-4" /> إضافة خدمة</span></Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map(s => (
          <Card key={s.id} className="p-5 flex flex-col">
            <Badge>{s.category}</Badge>
            <h3 className="font-bold text-ink-950 mt-3">{s.name}</h3>
            <p className="text-sm text-ink-900/55 mt-2 leading-relaxed flex-1">{s.description}</p>
            <div className="text-sm font-semibold text-gold-600 mt-4 pt-4 border-t border-sand-100">{s.price}</div>
          </Card>
        ))}
      </div>
    </div>
  )
}
