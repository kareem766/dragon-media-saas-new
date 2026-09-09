import React, { useEffect, useState } from 'react'
import { Card, Button, Badge } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

const tabs = [
  'بيانات الشركة',
  'الإشعارات',
  'التكاملات',
  'إعدادات واتساب',
  'إعدادات الذكاء الاصطناعي',
  'الفوترة',
]

interface OrgData {
  name: string
  manager_name: string
  phone: string
  email: string
  address: string
  timezone: string
  business_type: string
  logo_url: string
}

const initialOrg: OrgData = {
  name: '',
  manager_name: '',
  phone: '',
  email: '',
  address: '',
  timezone: 'Africa/Cairo',
  business_type: '',
  logo_url: '',
}

export default function Settings() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization()

  const [active, setActive] = useState(tabs[0])
  const [org, setOrg] = useState<OrgData>(initialOrg)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const updateOrg = (field: keyof OrgData, value: string) => {
    setOrg(prev => ({
      ...prev,
      [field]: value,
    }))

    setSaved(false)
    setError('')
  }

  useEffect(() => {
    const loadOrganization = async () => {
      if (!organizationId || !supabase) return

      setLoading(true)
      setError('')

      try {
        const { data, error: fetchError } = await supabase
          .from('organizations')
          .select(
            'name, manager_name, phone, email, address, timezone, business_type, logo_url'
          )
          .eq('id', organizationId)
          .single()

        if (fetchError) {
          throw fetchError
        }

        if (data) {
          setOrg({
            name: data.name ?? '',
            manager_name: data.manager_name ?? '',
            phone: data.phone ?? '',
            email: data.email ?? '',
            address: data.address ?? '',
            timezone: data.timezone ?? 'Africa/Cairo',
            business_type: data.business_type ?? '',
            logo_url: data.logo_url ?? '',
          })
        }
      } catch (err: any) {
        setError(
          err?.message || 'تعذر تحميل بيانات الشركة.'
        )
      } finally {
        setLoading(false)
      }
    }

    loadOrganization()
  }, [organizationId])

  const validate = () => {
    if (!org.name.trim()) {
      return 'اسم الشركة مطلوب.'
    }

    if (org.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

      if (!emailRegex.test(org.email.trim())) {
        return 'يرجى إدخال بريد إلكتروني صحيح.'
      }
    }

    if (org.phone.trim()) {
  const normalizedPhone = org.phone
    .trim()
    .replace(/[\s()-]/g, '')

  const phoneRegex = /^\+?[1-9]\d{7,14}$/

  if (!phoneRegex.test(normalizedPhone)) {
    return 'يرجى إدخال رقم هاتف صحيح، مثل +201012345678.'
  }
}

    return null
  }

  const handleSave = async () => {
    if (!supabase || !organizationId) return

    setSaved(false)
    setError('')

    const validationError = validate()

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)

    try {
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          name: org.name.trim(),
          manager_name: org.manager_name.trim() || null,
          phone: org.phone.trim() || null,
          email: org.email.trim() || null,
          address: org.address.trim() || null,
          timezone: org.timezone || 'Africa/Cairo',
          business_type: org.business_type || null,
          logo_url: org.logo_url.trim() || null,
        })
        .eq('id', organizationId)

      if (updateError) {
        throw updateError
      }

      setSaved(true)

      window.setTimeout(() => {
        setSaved(false)
      }, 2500)
    } catch (err: any) {
      setError(
        err?.message || 'تعذر حفظ بيانات الشركة. حاول مرة أخرى.'
      )
    } finally {
      setSaving(false)
    }
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
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`w-full text-right px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              active === tab
                ? 'bg-ink-900 text-sand-50'
                : 'text-ink-900/60 hover:bg-sand-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      <Card className="p-6">
        {active === 'بيانات الشركة' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 className="text-lg font-semibold text-ink-900">
                بيانات الشركة
              </h2>

              <p className="text-sm text-ink-900/50 mt-1">
                هذه البيانات مرتبطة بحساب مؤسستك ويتم استخدامها داخل Dragon Media.
              </p>
            </div>

            {/* Logo */}
            <div className="border border-sand-200 rounded-xl p-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border border-sand-200 bg-sand-50 flex items-center justify-center overflow-hidden">
                  {org.logo_url ? (
                    <img
                      src={org.logo_url}
                      alt={org.name || 'شعار الشركة'}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-ink-900/40 text-center px-2">
                      لا يوجد شعار
                    </span>
                  )}
                </div>

                <div className="flex-1">
                  <label className="text-xs text-ink-900/50">
                    رابط شعار الشركة
                  </label>

                  <input
                    value={org.logo_url}
                    onChange={e =>
                      updateOrg('logo_url', e.target.value)
                    }
                    placeholder="https://..."
                    dir="ltr"
                    className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700"
                  />

                  <p className="text-xs text-ink-900/40 mt-1.5">
                    يمكن ربط الشعار برابط صورة عام. رفع الملفات إلى Storage يمكن إضافته لاحقًا بدون تغيير بيانات الشركة الحالية.
                  </p>
                </div>
              </div>
            </div>

            {/* Company name */}
            <Field
              label="اسم الشركة"
              required
              value={org.name}
              onChange={value => updateOrg('name', value)}
            />

            {/* Manager */}
            <Field
              label="اسم المسؤول / المدير"
              value={org.manager_name}
              onChange={value => updateOrg('manager_name', value)}
            />

            {/* Business type */}
            <div>
              <label className="text-xs text-ink-900/50">
                نوع النشاط
              </label>

              <select
                value={org.business_type}
                onChange={e =>
                  updateOrg('business_type', e.target.value)
                }
                className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white"
              >
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

            {/* Email */}
            <Field
              label="البريد الإلكتروني للتواصل"
              value={org.email}
              onChange={value => updateOrg('email', value)}
              type="email"
              dir="ltr"
            />

            {/* Phone */}
            <Field
              label="رقم الهاتف"
              value={org.phone}
              onChange={value => updateOrg('phone', value)}
              type="tel"
              dir="ltr"
            />

            {/* Address */}
            <div>
              <label className="text-xs text-ink-900/50">
                عنوان مقر الشركة
              </label>

              <textarea
                value={org.address}
                onChange={e =>
                  updateOrg('address', e.target.value)
                }
                rows={3}
                placeholder="أدخل عنوان مقر الشركة"
                className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 resize-none"
              />
            </div>

            {/* Timezone */}
            <div>
              <label className="text-xs text-ink-900/50">
                المنطقة الزمنية
              </label>

              <select
                value={org.timezone}
                onChange={e =>
                  updateOrg('timezone', e.target.value)
                }
                className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white"
              >
                <option value="Africa/Cairo">
                  القاهرة — Africa/Cairo
                </option>
                <option value="Asia/Riyadh">
                  الرياض — Asia/Riyadh
                </option>
                <option value="Asia/Dubai">
                  دبي — Asia/Dubai
                </option>
                <option value="UTC">
                  UTC
                </option>
              </select>
            </div>

            {/* Messages */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {saved && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                تم حفظ بيانات الشركة بنجاح.
              </div>
            )}

            {/* Save */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </Button>

              {saving && (
                <span className="text-xs text-ink-900/40">
                  يتم حفظ البيانات...
                </span>
              )}
            </div>
          </div>
        )}

        {active === 'الإشعارات' && (
          <div className="space-y-3 max-w-md">
            {[
              'إشعار عند وجود عميل محتمل جديد',
              'إشعار عند رسالة جديدة في الإنبوكس',
              'تذكير بالمهام المتأخرة',
              'تقرير أداء أسبوعي بالبريد',
            ].map(n => (
              <label
                key={n}
                className="flex items-center justify-between border border-sand-200 rounded-xl px-4 py-3"
              >
                <span className="text-sm text-ink-900">
                  {n}
                </span>

                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 accent-ink-900"
                />
              </label>
            ))}

            <p className="text-xs text-ink-900/40">
              إعدادات الإشعارات دي شكلية حاليًا — هتشتغل فعليًا لما نربط نظام إرسال إشعارات حقيقي.
            </p>
          </div>
        )}

        {active === 'التكاملات' && (
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              'واتساب بيزنس',
              'فيسبوك ماسنجر',
              'إنستجرام',
              'تليجرام',
              'بوابة الدفع',
            ].map(i => (
              <div
                key={i}
                className="border border-sand-200 rounded-xl p-4 flex items-center justify-between"
              >
                <span className="text-sm font-medium text-ink-900">
                  {i}
                </span>

                <Badge>
                  غير متصل
                </Badge>
              </div>
            ))}

            <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 flex items-center justify-between">
              <span className="text-sm font-medium text-ink-900">
                Supabase (قاعدة البيانات)
              </span>

              <Badge tone="success">
                متصل
              </Badge>
            </div>
          </div>
        )}

        {active === 'إعدادات واتساب' && (
          <div className="max-w-md">
            <p className="text-sm text-ink-900/55">
              سيتم تفعيل هذا القسم بعد ربط حساب Meta Business الحقيقي.
            </p>
          </div>
        )}

        {active === 'إعدادات الذكاء الاصطناعي' && (
          <div className="max-w-md">
            <p className="text-sm text-ink-900/55">
              RYAN يعمل حاليًا بـ Google Gemini. إعدادات مخصصة أكثر ستُضاف لاحقًا.
            </p>
          </div>
        )}

        {active === 'الفوترة' && (
          <div className="max-w-md">
            <p className="text-sm text-ink-900/55">
              سيتم تفعيل هذا القسم بعد ربط بوابة دفع حقيقية.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  dir,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  dir?: 'rtl' | 'ltr'
  required?: boolean
}) {
  return (
    <div>
      <label className="text-xs text-ink-900/50">
        {label}

        {required && (
          <span className="text-red-500 mr-1">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        value={value}
        dir={dir}
        onChange={e => onChange(e.target.value)}
        className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700"
      />
    </div>
  )
}
