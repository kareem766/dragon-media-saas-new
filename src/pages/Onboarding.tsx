import React, { useEffect, useRef, useState } from 'react'
import { Card, Button } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { useBranding } from '../hooks/useBranding'
import { useAuth } from '../lib/AuthContext'

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { branding, logoUrl } = useBranding()
  const { signOut } = useAuth()
  const [inviteCode, setInviteCode] = useState('')
  const [checkingInvite, setCheckingInvite] = useState(true)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const inviteAcceptanceStarted = useRef(false)

  const [name, setName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const platformName = branding?.platform_name?.trim() || 'Dragon Media'

  useEffect(() => {
    const code = localStorage.getItem('dragon_media_invite_code')?.trim().toUpperCase() || ''
    setInviteCode(code)

    if (!code || !supabase || inviteAcceptanceStarted.current) {
      setCheckingInvite(false)
      return
    }

    let cancelled = false
    inviteAcceptanceStarted.current = true

    const acceptInvite = async () => {
      setCheckingInvite(true)
      setInviteError(null)
      const client = supabase
      if (!client) {
        inviteAcceptanceStarted.current = false
        setCheckingInvite(false)
        return
      }

      const { data, error: acceptError } = await client.rpc('accept_invite_code', {
        p_code: code,
      })

      if (cancelled) return

      if (acceptError) {
        await cleanupFailedSignup()
        if (cancelled) return
        setInviteError(acceptError.message)
        setCheckingInvite(false)
        return
      }

      if (!data?.organization_id) {
        await cleanupFailedSignup()
        if (cancelled) return
        setInviteError('تعذر ربط الحساب بالشركة. حاول مرة أخرى.')
        setCheckingInvite(false)
        return
      }

      localStorage.removeItem('dragon_media_invite_code')
      setCheckingInvite(false)
      onDone()
    }

    acceptInvite()
    return () => {
      cancelled = true
    }
  }, [onDone])

  const cleanupFailedSignup = async () => {
    try {
      const { data: sessionData } = await supabase?.auth.getSession() || { data: { session: null } }
      const accessToken = sessionData.session?.access_token || ''
      if (accessToken) {
        await fetch('/api/admin/rollback-signup?route=rollback-signup', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      }
    } catch {
      // Cleanup is best-effort; signOut below still prevents the failed session from lingering.
    } finally {
      localStorage.removeItem('dragon_media_invite_code')
      await signOut()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const client = supabase
    if (!client) {
      setError('تعذر الاتصال بالخدمة حاليًا. حاول مرة أخرى.')
      return
    }
    if (!name.trim()) return setError('اكتب اسم الشركة أو النشاط.')
    if (!businessType) return setError('اختر نوع النشاط.')
    if (!address.trim()) return setError('اكتب عنوان مقر الشركة.')
    if (!termsAccepted || !privacyAccepted) {
      return setError('يجب الموافقة على شروط الاستخدام وسياسة الخصوصية لاستكمال إنشاء مساحة العمل.')
    }

    setSaving(true)
    setError(null)

    try {
      const consentTimestamp = new Date().toISOString()
      const { error: consentError } = await client.auth.updateUser({
        data: {
          terms_accepted_at: consentTimestamp,
          terms_version: '1.0',
          privacy_policy_accepted_at: consentTimestamp,
          privacy_policy_version: '1.0',
        },
      })
      if (consentError) {
        await cleanupFailedSignup()
        setError('تعذر حفظ الموافقة على الشروط والسياسة. تم إلغاء التسجيل، ويمكنك المحاولة مرة أخرى.')
        return
      }

      const { data: organizationId, error: createError } = await client.rpc('create_organization_onboarding', {
        p_name: name.trim(),
        p_business_type: businessType,
        p_phone: phone.trim(),
        p_address: address.trim(),
      })
      if (createError) {
        await cleanupFailedSignup()
        setError(`تعذر إنشاء مساحة العمل. تم إلغاء التسجيل، ويمكنك المحاولة مرة أخرى. ${createError.message}`)
        return
      }
      if (!organizationId) {
        await cleanupFailedSignup()
        setError('تعذر إنشاء مساحة العمل. تم إلغاء التسجيل، ويمكنك المحاولة مرة أخرى.')
        return
      }

      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء إعداد مساحة العمل.')
    } finally {
      setSaving(false)
    }
  }


  if (checkingInvite && inviteCode) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl items-center justify-center">
          <Card className="w-full p-8 text-center shadow-xl shadow-slate-900/5">
            <img src={logoUrl} alt={platformName} className="mx-auto h-16 w-16 rounded-2xl object-contain" />
            <h1 className="mt-5 text-2xl font-black text-slate-950">جاري ربط حسابك بالشركة</h1>
            <p className="mt-3 text-sm leading-7 text-slate-500">تم اكتشاف كود دعوة موظف. بنضم حسابك مباشرة لمساحة عمل الشركة بدون إنشاء شركة جديدة.</p>
            <div className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          </Card>
        </div>
      </div>
    )
  }

  if (inviteCode && inviteError) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl items-center justify-center">
          <Card className="w-full p-8 text-center shadow-xl shadow-slate-900/5">
            <img src={logoUrl} alt={platformName} className="mx-auto h-16 w-16 rounded-2xl object-contain" />
            <h1 className="mt-5 text-2xl font-black text-slate-950">تعذر قبول دعوة الشركة</h1>
            <p className="mt-3 text-sm leading-7 text-red-600">{inviteError}</p>
            <p className="mt-3 text-xs leading-6 text-slate-400">تأكد من استخدام كود دعوة صالح ولم يتم استخدامه من قبل.</p>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl items-center justify-center">
        <div className="w-full">
          <SignupStepper />
          <Card className="overflow-hidden border border-slate-200 bg-white p-0 shadow-xl shadow-slate-900/5">
            <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-6 py-7 sm:px-8">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <img src={logoUrl} alt={platformName} className="h-10 w-10 rounded-full object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="mb-1 text-xs font-bold text-blue-600">الخطوة الأخيرة في التسجيل</p>
                  <h1 className="text-xl font-black text-slate-950 sm:text-2xl">أهلًا بيك في {platformName}</h1>
                  <p className="mt-2 text-sm leading-6 text-slate-500">خلينا نجهز مساحة العمل الخاصة بشركتك في خطوات بسيطة.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 px-6 py-7 sm:px-8 sm:py-8">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">اسم الشركة / النشاط</label>
                <input required value={name} onChange={e => setName(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" placeholder="مثال: عيادة النور" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">نوع النشاط</label>
                <select required value={businessType} onChange={e => setBusinessType(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10">
                  <option value="">اختر نوع النشاط</option><option value="عقارات">عقارات</option><option value="مطاعم">مطاعم</option><option value="عيادات">عيادات</option><option value="تعليم">مراكز تعليمية</option><option value="سيارات">معارض سيارات</option><option value="تجارة إلكترونية">تجارة إلكترونية</option><option value="سوشيال ميديا">تسويق وسوشيال ميديا</option><option value="خدمات">خدمات</option><option value="تجزئة">تجزئة</option><option value="أخرى">أخرى</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">رقم الهاتف <span className="mr-1 text-xs font-normal text-slate-400">اختياري</span></label>
                <input value={phone} onChange={e => setPhone(e.target.value)} dir="ltr" inputMode="tel" autoComplete="tel" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" placeholder="01000000000" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">عنوان مقر الشركة</label>
                <textarea required value={address} onChange={e => setAddress(e.target.value)} rows={3} className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm leading-6 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" placeholder="مثال: 15 شارع التحرير، سموحة، الإسكندرية" />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-sm font-bold text-slate-700">الموافقة على شروط الاستخدام</p>
                <div className="space-y-3">
                  <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-600"><input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" /><span>أوافق على <a href="/#/terms" target="_blank" rel="noreferrer" className="font-bold text-blue-600 hover:underline">شروط الاستخدام</a>.</span></label>
                  <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-600"><input type="checkbox" checked={privacyAccepted} onChange={e => setPrivacyAccepted(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" /><span>أوافق على <a href="/#/privacy" target="_blank" rel="noreferrer" className="font-bold text-blue-600 hover:underline">سياسة الخصوصية</a>.</span></label>
                </div>
              </div>
              {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm leading-6 text-red-700">{error}</div>}
              <Button type="submit" disabled={saving} className="w-full rounded-2xl py-3.5 text-sm font-black">{saving ? 'جاري تجهيز مساحة العمل...' : 'إنشاء مساحة العمل والمتابعة'}</Button>
            </form>
          </Card>
          <p className="mt-5 text-center text-xs text-slate-400">يمكنك تعديل بيانات الشركة لاحقًا من إعدادات مساحة العمل.</p>
        </div>
      </div>
    </div>
  )
}

function SignupStepper() {
  const steps = [{ number: 1, title: 'إنشاء الحساب', completed: true }, { number: 2, title: 'تأكيد البريد', completed: true }, { number: 3, title: 'بيانات الشركة', completed: false }]
  return <div className="mb-7 rounded-3xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6"><div className="flex items-start">{steps.map((step, index) => { const isCurrent = step.number === 3; return <React.Fragment key={step.number}><div className="flex min-w-0 flex-1 flex-col items-center"><div className={['flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-black transition', step.completed ? 'border-emerald-500 bg-emerald-500 text-white' : isCurrent ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'border-slate-200 bg-white text-slate-400'].join(' ')}>{step.completed ? '✓' : step.number}</div><span className={['mt-2 text-center text-[11px] font-bold sm:text-xs', step.completed || isCurrent ? 'text-slate-800' : 'text-slate-400'].join(' ')}>{step.title}</span></div>{index < steps.length - 1 && <div className="mt-5 h-0.5 flex-1 overflow-hidden bg-slate-200"><div className="h-full w-full bg-blue-500" /></div>}</React.Fragment> })}</div></div>
}
