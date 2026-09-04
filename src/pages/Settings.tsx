import React, { useState } from 'react'
import { Card, Button, Badge } from '../components/ui'

const tabs = ['بيانات الشركة', 'الإشعارات', 'التكاملات', 'إعدادات واتساب', 'إعدادات الذكاء الاصطناعي', 'الفوترة']

export default function Settings() {
  const [active, setActive] = useState(tabs[0])

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
            <Field label="اسم الشركة" value="Dragon Media" />
            <Field label="البريد الإلكتروني للتواصل" value="info@dragonmedia.com" />
            <Field label="رقم الهاتف" value="01000000000" />
            <Field label="المنطقة الزمنية" value="القاهرة (GMT+2)" />
            <Button className="mt-2">حفظ التغييرات</Button>
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
          </div>
        )}
        {active === 'التكاملات' && (
          <div className="grid sm:grid-cols-2 gap-3">
            {['واتساب بيزنس', 'فيسبوك ماسنجر', 'إنستجرام', 'تليجرام', 'Supabase', 'بوابة الدفع'].map(i => (
              <div key={i} className="border border-sand-200 rounded-xl p-4 flex items-center justify-between">
                <span className="text-sm font-medium text-ink-900">{i}</span>
                <Badge>غير متصل</Badge>
              </div>
            ))}
          </div>
        )}
        {active === 'إعدادات واتساب' && (
          <div className="space-y-4 max-w-md">
            <Field label="رقم واتساب بيزنس" value="غير مضاف بعد" />
            <Field label="معرّف رقم الهاتف (Phone Number ID)" value="—" />
            <p className="text-xs text-ink-900/45">هيتم تفعيل الربط الفعلي بعد توصيل حساب Meta Business.</p>
          </div>
        )}
        {active === 'إعدادات الذكاء الاصطناعي' && (
          <div className="space-y-4 max-w-md">
            <Field label="اسم الوكيل" value="RYAN" />
            <Field label="اللهجة" value="مصرية عامية" />
            <Field label="أسلوب المخاطبة" value="حضرتك / أستاذ + الاسم" />
            <Button className="mt-2">تعديل شخصية الوكيل</Button>
          </div>
        )}
        {active === 'الفوترة' && (
          <div className="max-w-md">
            <Field label="الباقة الحالية" value="النمو — 6,000 ج.م/شهريًا" />
            <Field label="طريقة الدفع" value="غير مضافة" />
          </div>
        )}
      </Card>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-xs text-ink-900/50">{label}</label>
      <input defaultValue={value} className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
    </div>
  )
}
