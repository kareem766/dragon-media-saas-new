import React, { useEffect, useState } from 'react'
import { Card, Button } from '../components/ui'
import { supabase } from '../lib/supabaseClient'

export default function AdminSettings() {
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.from('platform_settings').select('support_phone, support_email, support_whatsapp').eq('id', 1).single()
      .then(({ data }) => {
        if (data) {
          setPhone(data.support_phone ?? '')
          setWhatsapp(data.support_whatsapp ?? '')
          setEmail(data.support_email ?? '')
        }
        setLoading(false)
      })
  }, [])

  const handleSave = async () => {
    if (!supabase) return
    setSaving(true)
    setSaved(false)
    await supabase.from('platform_settings').update({
      support_phone: phone,
      support_whatsapp: whatsapp,
      support_email: email,
    }).eq('id', 1)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-md space-y-6">
      <h2 className="text-xl font-bold text-ink-950">إعدادات المنصة العامة</h2>
      <Card className="p-6 space-y-4">
        <div>
          <label className="text-xs text-ink-900/50">رقم هاتف الدعم</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} dir="ltr" className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
        </div>
        <div>
          <label className="text-xs text-ink-900/50">رقم واتساب الدعم</label>
          <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} dir="ltr" className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
        </div>
        <div>
          <label className="text-xs text-ink-900/50">البريد الإلكتروني للدعم</label>
          <input value={email} onChange={e => setEmail(e.target.value)} dir="ltr" className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700" />
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
          {saved && <span className="text-sm text-emerald-600">تم الحفظ ✓</span>}
        </div>
      </Card>
    </div>
  )
}
