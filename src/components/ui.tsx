import React from 'react'

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-sand-200 rounded-2xl ${className}`}>{children}</div>
}

export function StatCard({ label, value, sub, accent = 'ink' }: { label: string; value: string; sub?: string; accent?: 'ink' | 'gold' | 'clay' }) {
  const accentColor = accent === 'gold' ? 'text-gold-500' : accent === 'clay' ? 'text-clay-500' : 'text-ink-900'
  return (
    <Card className="p-5">
      <div className="text-sm text-ink-900/55">{label}</div>
      <div className={`text-3xl font-bold mt-2 ${accentColor}`}>{value}</div>
      {sub && <div className="text-xs text-ink-900/45 mt-1.5">{sub}</div>}
    </Card>
  )
}

export function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'success' | 'warning' | 'danger' | 'gold' }) {
  const tones: Record<string, string> = {
    default: 'bg-sand-200 text-ink-900/70',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-600',
    gold: 'bg-gold-400/15 text-gold-600',
  }
  return <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${tones[tone]}`}>{children}</span>
}

export function Button({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const variants: Record<string, string> = {
    primary: 'bg-ink-900 text-sand-50 hover:bg-ink-800',
    secondary: 'bg-white border border-sand-200 text-ink-900 hover:bg-sand-100',
    ghost: 'text-ink-900/70 hover:bg-sand-100',
  }
  return (
    <button className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-ink-900/45 border-b border-sand-200">
            {head.map(h => <th key={h} className="text-right font-medium py-3 px-3 whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-sand-100">{children}</tbody>
      </table>
    </div>
  )
}

export function statusTone(status: string): 'default' | 'success' | 'warning' | 'danger' | 'gold' {
  const success = ['نشط', 'مؤكد', 'مدفوعة', 'مكتملة', 'تم التعاقد']
  const warning = ['قيد الانتظار', 'مجدولة', 'قيد التنفيذ', 'جديد']
  const danger = ['متأخرة', 'ملغي', 'غير نشط', 'مغلق - خسرنا', 'غير مهتم']
  if (success.includes(status)) return 'success'
  if (warning.includes(status)) return 'warning'
  if (danger.includes(status)) return 'danger'
  return 'default'
}
