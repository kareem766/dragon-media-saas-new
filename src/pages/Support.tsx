import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { IconDragon } from '../components/Icon'

interface SettingsData {
  support_phone: string | null
  support_email: string | null
  support_whatsapp: string | null
}

const COMPANY_ADDRESS = 'الإسكندرية - مصر'

export default function Support() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase
      .from('platform_settings')
      .select('support_phone, support_email, support_whatsapp')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        setSettings(data as SettingsData)
        setLoading(false)
      })
  }, [])

  return (
    <div dir="rtl" className="min-h-screen bg-sand-50 flex items-center justify-center p-6">
      <Card className="p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-gold-500 flex items-center justify-center text-ink-950">
            <IconDragon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-ink-950">تواصل مع فريق الدعم</h1>
            <p className="text-xs text-ink-900/50">Dragon Media</p>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-ink-900/40 text-center py-6">جاري التحميل...</div>
        ) : (
          <div className="space-y-3">
            {settings?.support_phone && (
              <a href={`tel:${settings.support_phone}`} className="flex items-center justify-between border border-sand-200 rounded-xl px-4 py-3.5 hover:bg-sand-50">
                <span className="text-sm text-ink-900">اتصال هاتفي</span>
                <span className="text-sm font-semibold text-ink-950" dir="ltr">{settings.support_phone}</span>
              </a>
            )}
            {settings?.support_whatsapp && (
              <a href={`https://wa.me/20${settings.support_whatsapp.replace(/^0/, '')}`} target="_blank" rel="noreferrer" className="flex items-center justify-between border border-sand-200 rounded-xl px-4 py-3.5 hover:bg-sand-50">
                <span className="text-sm text-ink-900">واتساب</span>
                <span className="text-sm font-semibold text-ink-950" dir="ltr">{settings.support_whatsapp}</span>
              </a>
            )}
            {settings?.support_email && (
              <a href={`mailto:${settings.support_email}`} className="flex items-center justify-between border border-sand-200 rounded-xl px-4 py-3.5 hover:bg-sand-50">
                <span className="text-sm text-ink-900">البريد الإلكتروني</span>
                <span className="text-sm font-semibold text-ink-950" dir="ltr">{settings.support_email}</span>
              </a>
            )}

            <div className="border border-sand-200 rounded-xl px-4 py-3.5">
              <div className="text-sm text-ink-900">مقر الشركة</div>
              <div className="text-sm font-semibold text-ink-950 mt-1">{COMPANY_ADDRESS}</div>
            </div>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-sand-200 space-y-3">
          <div className="text-xs font-bold text-ink-900/50">سياسات الموقع</div>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link to="/terms" className="text-ink-900/65 hover:text-ink-950 hover:underline">الشروط والأحكام</Link>
            <Link to="/privacy" className="text-ink-900/65 hover:text-ink-950 hover:underline">سياسة الخصوصية</Link>
            <Link to="/refund-policy" className="text-ink-900/65 hover:text-ink-950 hover:underline">استرداد الأموال</Link>
          </div>
        </div>

        <Link to="/login" className="block text-center text-sm text-ink-900/50 hover:underline mt-6">→ العودة لتسجيل الدخول</Link>
      </Card>
    </div>
  )
}
