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

export default function Support() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) return
    supabase.from('platform_settings').select('support_phone, support_email, support_whatsapp').eq('id', 1).single()
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
              <a href={`https://wa.me/2${settings.support_whatsapp}`} target="_blank" rel="noreferrer" className="flex items-center justify-between border border-sand-200 rounded-xl px-4 py-3.5 hover:bg-sand-50">
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
          </div>
        )}

        <Link to="/login" className="block text-center text-sm text-ink-900/50 hover:underline mt-6">→ العودة لتسجيل الدخول</Link>
      </Card>
    </div>
  )
}
