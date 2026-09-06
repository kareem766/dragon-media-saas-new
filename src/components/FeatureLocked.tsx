import React from 'react'
import { Link } from 'react-router-dom'
import { Card, Button } from './ui'

export default function FeatureLocked({ featureName }: { featureName: string }) {
  return (
    <Card className="p-10 text-center max-w-md mx-auto">
      <div className="text-3xl mb-3">🔒</div>
      <h3 className="font-bold text-ink-950 text-lg mb-2">{featureName} غير متاحة في باقتك الحالية</h3>
      <p className="text-sm text-ink-900/55 mb-5">قم بترقية باقتك للوصول إلى هذه الميزة والمزيد.</p>
      <Link to="/plans"><Button>عرض الباقات والترقية</Button></Link>
    </Card>
  )
}
