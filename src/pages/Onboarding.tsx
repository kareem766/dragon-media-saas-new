import React, { useState } from 'react'
import { Card, Button } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useBranding } from '../hooks/useBranding'

export default function Onboarding({
  onDone,
}: {
  onDone: () => void
}) {
  const { branding, logoUrl } = useBranding()

  const [name, setName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const platformName =
    branding?.platform_name?.trim() || 'Dragon Media'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!supabase) {
      setError('تعذر الاتصال بالخدمة حاليًا. حاول مرة أخرى.')
      return
    }

    if (!name.trim()) {
      setError('اكتب اسم الشركة أو النشاط.')
      return
    }

    if (!businessType) {
      setError('اختر نوع النشاط.')
      return
    }

    if (!address.trim()) {
      setError('اكتب عنوان مقر الشركة.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { data: organizationId, error: createError } =
        await supabase.rpc('create_organization_for_user', {
          p_name: name.trim(),
          p_business_type: businessType,
          p_phone: phone.trim(),
        })

      if (createError) {
        setError(createError.message)
        return
      }

      if (!organizationId) {
        setError(
          'تم إنشاء الحساب ولكن تعذر تحديد مساحة العمل. حاول مرة أخرى.'
        )
        return
      }

      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          address: address.trim(),
        })
        .eq('id', organizationId)

      if (updateError) {
        setError(
          'تم إنشاء مساحة العمل، ولكن تعذر حفظ عنوان الشركة. حاول مرة أخرى.'
        )
        return
      }

      onDone()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء إعداد مساحة العمل.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:py-10"
    >
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl items-center justify-center">
        <div className="w-full">
          <SignupStepper />

          <Card className="overflow-hidden border border-slate-200 bg-white p-0 shadow-xl shadow-slate-900/5">
            <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-6 py-7 sm:px-8">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <img
                    src={logoUrl}
                    alt={platformName}
                    className="h-10 w-10 object-contain"
                  />
                </div>

                <div className="min-w-0">
                  <p className="mb-1 text-xs font-bold text-blue-600">
                    الخطوة الأخيرة في التسجيل
                  </p>

                  <h1 className="text-xl font-black text-slate-950 sm:text-2xl">
                    أهلًا بيك في {platformName}
                  </h1>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    خلينا نجهز مساحة العمل الخاصة بشركتك في خطوات بسيطة.
                  </p>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 px-6 py-7 sm:px-8 sm:py-8"
            >
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  اسم الشركة / النشاط
                </label>

                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  placeholder="مثال: عيادة النور"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  نوع النشاط
                </label>

                <select
                  required
                  value={businessType}
                  onChange={(e) =>
                    setBusinessType(e.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="">
                    اختر نوع النشاط
                  </option>
                  <option value="عقارات">عقارات</option>
                  <option value="مطاعم">مطاعم</option>
                  <option value="عيادات">عيادات</option>
                  <option value="تعليم">مراكز تعليمية</option>
                  <option value="سيارات">معارض سيارات</option>
                  <option value="تجارة إلكترونية">
                    تجارة إلكترونية
                  </option>
                  <option value="سوشيال ميديا">
                    تسويق وسوشيال ميديا
                  </option>
                  <option value="خدمات">خدمات</option>
                  <option value="تجزئة">تجزئة</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  رقم الهاتف
                  <span className="mr-1 text-xs font-normal text-slate-400">
                    اختياري
                  </span>
                </label>

                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  placeholder="01000000000"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  عنوان مقر الشركة
                </label>

                <textarea
                  required
                  value={address}
                  onChange={(e) =>
                    setAddress(e.target.value)
                  }
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  placeholder="مثال: 15 شارع التحرير، سموحة، الإسكندرية"
                />
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm leading-6 text-red-700">
                  {error}
                </div>
              )}

              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs font-black text-blue-700">
                    ✓
                  </div>

                  <p className="text-xs leading-6 text-blue-800">
                    بيانات الشركة دي هتستخدم لتجهيز مساحة العمل الخاصة بيك
                    وتخصيص تجربة {platformName} حسب نشاطك.
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl py-3.5 text-sm font-black"
              >
                {saving
                  ? 'جاري تجهيز مساحة العمل...'
                  : 'إنشاء مساحة العمل والمتابعة'}
              </Button>
            </form>
          </Card>

          <p className="mt-5 text-center text-xs text-slate-400">
            يمكنك تعديل بيانات الشركة لاحقًا من إعدادات مساحة العمل.
          </p>
        </div>
      </div>
    </div>
  )
}

function SignupStepper() {
  const steps = [
    {
      number: 1,
      title: 'إنشاء الحساب',
      completed: true,
    },
    {
      number: 2,
      title: 'تأكيد البريد',
      completed: true,
    },
    {
      number: 3,
      title: 'بيانات الشركة',
      completed: false,
    },
  ]

  return (
    <div className="mb-7 rounded-3xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6">
      <div className="flex items-start">
        {steps.map((step, index) => {
          const isCurrent = step.number === 3

          return (
            <React.Fragment key={step.number}>
              <div className="flex min-w-0 flex-1 flex-col items-center">
                <div
                  className={[
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-black transition',
                    step.completed
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : isCurrent
                        ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                        : 'border-slate-200 bg-white text-slate-400',
                  ].join(' ')}
                >
                  {step.completed
                    ? '✓'
                    : step.number}
                </div>

                <span
                  className={[
                    'mt-2 text-center text-[11px] font-bold sm:text-xs',
                    step.completed || isCurrent
                      ? 'text-slate-800'
                      : 'text-slate-400',
                  ].join(' ')}
                >
                  {step.title}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div className="mt-5 h-0.5 flex-1 overflow-hidden bg-slate-200">
                  <div className="h-full w-full bg-emerald-500 transition-all duration-500" />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
