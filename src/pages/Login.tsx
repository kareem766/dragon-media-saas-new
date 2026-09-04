import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { IconDragon } from '../components/Icon'

export default function Login() {
  const { session, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error)
    } else {
      const { error } = await signUp(email, password, fullName)
      if (error) setError(error)
      else setInfo('تم إنشاء الحساب! تحقق من بريدك الإلكتروني لتأكيد التسجيل قبل الدخول.')
    }
    setSubmitting(false)
  }

  return (
    <div dir="rtl" className="min-h-screen flex bg-sand-50">
      <div className="hidden lg:flex lg:w-1/2 bg-ink-950 text-sand-100 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gold-500 flex items-center justify-center text-ink-950">
            <IconDragon className="w-6 h-6" />
          </div>
          <span className="font-bold text-xl">Dragon Media</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold leading-snug">
            منصة واحدة تدير بيها تسويقك، مبيعاتك، وخدمة عملائك
          </h1>
          <p className="text-sand-100/55 mt-4 leading-relaxed">
            CRM، مسار مبيعات، حملات تسويقية، وصندوق محادثات موحد — مع RYAN AI يشتغل معاك على مدار الساعة.
          </p>
        </div>
        <p className="text-xs text-sand-100/40">© 2026 Dragon Media</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-lg bg-gold-500 flex items-center justify-center text-ink-950">
              <IconDragon className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-ink-950">Dragon Media</span>
          </div>

          <h2 className="text-2xl font-bold text-ink-950">
            {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
          </h2>
          <p className="text-sm text-ink-900/50 mt-1.5">
            {mode === 'login' ? 'أهلًا بيك تاني، سجّل دخولك للمتابعة' : 'ابدأ في إدارة عملك من مكان واحد'}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="text-xs text-ink-900/50">الاسم الكامل</label>
                <input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white"
                  placeholder="اسمك بالكامل"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-ink-900/50">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                dir="ltr"
                className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white text-right"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="text-xs text-ink-900/50">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                dir="ltr"
                className="w-full mt-1 border border-sand-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink-700 bg-white text-right"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
                {error}
              </div>
            )}
            {info && (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3.5 py-2.5">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-ink-900 text-sand-50 rounded-lg py-3 text-sm font-semibold hover:bg-ink-800 transition-colors disabled:opacity-60"
            >
              {submitting ? 'جاري التنفيذ...' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
            </button>
          </form>

          <p className="text-sm text-ink-900/55 mt-6 text-center">
            {mode === 'login' ? 'مفيش عندك حساب؟' : 'عندك حساب بالفعل؟'}{' '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setInfo(null) }}
              className="text-ink-900 font-semibold hover:underline"
            >
              {mode === 'login' ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
