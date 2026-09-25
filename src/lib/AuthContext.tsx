import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

interface SignupConsent {
  termsAcceptedAt: string
  termsVersion: string
  privacyAcceptedAt: string
  privacyVersion: string
}
interface SignUpResult { error: string | null; needsEmailConfirmation: boolean }
interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string, consent?: SignupConsent, inviteCode?: string) => Promise<SignUpResult>
  resendConfirmation: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function isEmailConfirmed(user: User | null) {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at)
}

function normalizeAuthError(message: string) {
  const normalized = message.toLowerCase().trim()
  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid_credentials') ||
    normalized.includes('invalid credentials')
  ) {
    return 'خطأ في اسم المستخدم أو كلمة المرور.'
  }
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const updateSession = (next: Session | null) => {
    sessionRef.current = next
    setSession(next)
  }

  useEffect(() => {
    if (!supabase) {
      updateSession(null)
      setLoading(false)
      return
    }

    let mounted = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      updateSession(error ? null : data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return
      updateSession(newSession)
      if (
        event === 'INITIAL_SESSION' ||
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: 'لم يتم ربط قاعدة البيانات بعد' }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const message = error.message.toLowerCase()
      if (message.includes('email not confirmed') || message.includes('email_not_confirmed')) {
        return { error: 'البريد الإلكتروني غير مؤكد. افتح رسالة التأكيد ثم حاول تسجيل الدخول مرة أخرى.' }
      }
      return { error: normalizeAuthError(error.message) }
    }

    if (!data.session || !data.user) {
      return { error: 'تعذر إنشاء جلسة تسجيل الدخول. حاول مرة أخرى.' }
    }

    if (!isEmailConfirmed(data.user)) {
      await supabase.auth.signOut()
      updateSession(null)
      setLoading(false)
      return { error: 'البريد الإلكتروني غير مؤكد. افتح رسالة التأكيد ثم حاول تسجيل الدخول مرة أخرى.' }
    }

    updateSession(data.session)
    setLoading(false)
    return { error: null }
  }

  const signInWithGoogle = async () => {
    if (!supabase) return { error: 'لم يتم ربط قاعدة البيانات بعد' }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })

    return { error: error ? normalizeAuthError(error.message) : null }
  }

  const signUp = async (email: string, password: string, fullName: string, consent?: SignupConsent, inviteCode?: string): Promise<SignUpResult> => {
    if (!supabase) return { error: 'لم يتم ربط قاعدة البيانات بعد', needsEmailConfirmation: false }

    const metadata: Record<string, string> = { full_name: fullName }
    if (inviteCode?.trim()) metadata.invite_code = inviteCode.trim().toUpperCase()
    if (consent) {
      metadata.terms_accepted_at = consent.termsAcceptedAt
      metadata.terms_version = consent.termsVersion
      metadata.privacy_policy_accepted_at = consent.privacyAcceptedAt
      metadata.privacy_policy_version = consent.privacyVersion
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) return { error: normalizeAuthError(error.message), needsEmailConfirmation: false }

    const needsEmailConfirmation = Boolean(data.user && !isEmailConfirmed(data.user))

    if (data.session) await supabase.auth.signOut()
    updateSession(null)
    setLoading(false)

    if (!data.user) {
      return { error: 'تعذر إنشاء حساب المستخدم. حاول مرة أخرى.', needsEmailConfirmation: false }
    }

    return { error: null, needsEmailConfirmation }
  }

  const resendConfirmation = async (email: string) => {
    if (!supabase) return { error: 'لم يتم ربط قاعدة البيانات بعد' }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: window.location.origin },
    })

    return { error: error ? normalizeAuthError(error.message) : null }
  }

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
    updateSession(null)
    setLoading(false)
  }

  return <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signIn, signInWithGoogle, signUp, resendConfirmation, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
