import React, { useEffect, useState } from 'react'
import { Card, Button, Badge } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

const tabs = ['بيانات الشركة', 'الإشعارات', 'التكاملات', 'إعدادات واتساب', 'إعدادات الذكاء الاصطناعي', 'الفوترة']

interface OrgData {
  name: string
  phone: string | null
  email: string | null
  timezone: string | null
  business_type: string | null
}

export default function Settings() {
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization()
  const [active, setActive] = useState(tabs[0])
  const [org, setOrg] = useState<OrgData>({ name: '', phone: '', email: '', timezone: 'Africa/Cairo', business_type: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!organizationId || !supabase) return
    const sb = supabase
    sb.from('organizations').select('name, phone, email, timezone, business_type').eq('id', organizationId).single()
      .then(({ data }) => {
        if (data) setOrg(data as OrgData)
        setLoading(false)
      })
  }, [organizationId])

  const handleSave = async () => {
    if (!supabase || !organizationId) return
    setSaving(true)
    setSaved(false)
    await supabase.from('organizations').update({
      name: org.name,
      phone: org.phone,
      email: org.email,
      timezone: org.timezone,
      business_type: org.business_type,
    }).eq('id', organizationId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (orgLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (orgError || !organizationId) {
    return (
      <div className="text-center py-20 text-sm text-red-600">
        {orgError ?? 'تعذر تحديد المؤسسة الخاصة بحسابك'}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
      <nav className="space-y-1">
        {tabs.map(t => (
          <button key={t} onClick={() => setActive(t)}
            className={`w-full text-right px-4 py-2.5 rounded-lg text-sm font-medium ${active === t ? 'bg-ink-900 text-sand-50' : 'text-ink-900/60 hover:bg-sand-100'}`}>
            {t}
          </button>
        ))}
      </nav>

      <Card className="p-6">
        {active === 'بيانات الشركة' && (
          <div className="space-y-4 max-w-md">
            <Field label="اسم الشركة" value={org.name} onChange={v => setOrg({ ...org, name: v })} />
            <div>
              <label className="text-xs text-ink-900/50">نوع النشاط</label>
              <select value={org.business_type ?? ''} onChange={e => setOrg({ ...org, business_type: e.target.value })} className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white">
                <option value="">اختر نوع النشاط</option>
                <option value="عقارات">عقارات</option>
                <option value="مطاعم">مطاعم</option>
                <option value="عيادات">عيادات</option>
                <option value="تعليم">مراكز تعليمية</option>
                <option value="سيارات">معارض سيارات</option>
                <option value="تجارة إلكترونية">تجارة إلكترونية</option>
                <option value="سوشيال ميديا">تسويق وسوشيال ميديا</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>
            <Field label="البريد الإلكتروني للتواصل" value={org.email ?? ''} onChange={v => setOrg({ ...org, email: v })} />
            <Field label="رقم الهاتف" value={org.phone ?? ''} onChange={v => setOrg({ ...org, phone: v })} />
            <Field label="المنطقة الزمنية" value={org.timezone ?? ''} onChange={v => setOrg({ ...org, timezone: v })} />
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}</Button>
              {saved && <span className="text-sm text-emerald-600">تم الحفظ ✓</span>}
            </div>
          </div>
        )}
        {active === 'الإشعارات' && (
          <div className="space-y-3 max-w-md">
            {['إشعار عند وجود عميل محتمل جديد', 'إشعار عند رسالة جديدة في الإنبوكس', 'تذكير بالمهام المتأخرة', 'تقرير أداء أسبوعي بالبريد'].map(n => (
              <label key={n} className="flex items-center justify-between border border-sand-200 rounded-xl px-4 py-3">
                <span className="text-sm text-ink-900">{n}</span>
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-ink-900" />
              </label>
            ))}
            <p className="text-xs text-ink-900/40">إعدادات الإشعارات دي شكلية حاليًا — هتشتغل فعليًا لما نربط نظام إرسال إشعارات حقيقي.</p>
          </div>
        )}
        {active === 'التكاملات' && (
          <div className="grid sm:grid-cols-2 gap-3">
            {['واتساب بيزنس', 'فيسبوك ماسنجر', 'إنستجرام', 'تليجرام', 'بوابة الدفع'].map(i => (
              <div key={i} className="border border-sand-200 rounded-xl p-4 flex items-center justify-between">
                <span className="text-sm font-medium text-ink-900">{i}</span>
                <Badge>غير متصل</Badge>
              </div>
            ))}
            <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 flex items-center justify-between">
              <span className="text-sm font-medium text-ink-900">Supabase (قاعدة البيانات)</span>
              <Badge tone="success">متصل</Badge>
            </div>
          </div>
        )}
        {active === 'إعدادات واتساب' && (
          <div className="max-w-md">
            <p className="text-sm text-ink-900/55">سيتم تفعيل هذا القسم بعد ربط حساب Meta Business الحقيقي.</p>
          </div>
        )}
        {active === 'إعدادات الذكاء الاصطناعي' && (
          <div className="max-w-md">
            <p className="text-sm text-ink-900/55">RYAN يعمل حاليًا بـ Google Gemini. إعدادات مخصصة أكثر ستُضاف لاحقًا.</p>
          </div>
        )}
        {active === 'الفوترة' && (
          <div className="max-w-md">
            <p className="text-sm text-ink-900/55">سيتم تفعيل هذا القسم بعد ربط بوابة دفع حقيقية.</p>
          </div>
        )}
      </Card>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-ink-900/50">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
    </div>
  )
}
