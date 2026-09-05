import React, { useState } from 'react'
import { Card, Button } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { IconDragon } from '../components/Icon'

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.rpc('create_organization_for_user', {
      p_name: name,
      p_business_type: businessType,
      p_phone: phone,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    onDone()
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-sand-50 p-6">
      <Card className="p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-gold-500 flex items-center justify-center text-ink-950">
            <IconDragon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-ink-950">أهلًا بيك في Dragon Media</h1>
            <p className="text-xs text-ink-900/50">خلينا نجهزلك مساحة عملك في دقيقة</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-ink-900/50">اسم الشركة / النشاط</label>
            <input required value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" placeholder="مثال: عيادة النور" />
          </div>
          <div>
            <label className="text-xs text-ink-900/50">نوع النشاط</label>
            <select required value={businessType} onChange={e => setBusinessType(e.target.value)} className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white">
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
          <div>
            <label className="text-xs text-ink-900/50">رقم الهاتف</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} dir="ltr" className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" placeholder="01000000000" />
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</div>}

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? 'جاري الإعداد...' : 'إنشاء مساحة العمل'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
