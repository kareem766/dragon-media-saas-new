import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
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
  signUp: (email: string, password: string, fullName: string, consent?: SignupConsent) => Promise<SignUpResult>
  resendConfirmation: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function isEmailConfirmed(user: User | null) {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // Supabase's INITIAL_SESSION is the source of truth for the initial
    // browser session. Do not run getSession() in parallel: on slower
    // desktop browsers it can race with a fresh sign-in and overwrite it.
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      if (event === 'INITIAL_SESSION') setLoading(false)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: 'لم يتم ربط قاعدة البيانات بعد' }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const message = error.message.toLowerCase()
      if (message.includes('email not confirmed') || message.includes('email_not_confirmed')) {
        return { error: 'البريد الإلكتروني غير مؤكد. افتح رسالة التأكيد ثم حاول تسجيل الدخول مرة أخرى.' }
      }
      return { error: error.message }
    }

    // signInWithPassword already rejects an unconfirmed account when email
    // confirmation is required. Keep the returned session as-is so desktop
    // browsers cannot lose it because of a stale/missing confirmation field.
    if (!data.session) {
      return { error: 'تعذر إنشاء جلسة تسجيل الدخول. حاول مرة أخرى.' }
    }

    setSession(data.session)
    return { error: null }
  }

  const signUp = async (email: string, password: string, fullName: string, consent?: SignupConsent): Promise<SignUpResult> => {
    if (!supabase) return { error: 'لم يتم ربط قاعدة البيانات بعد', needsEmailConfirmation: false }
    const metadata: Record<string, string> = { full_name: fullName }
    if (consent) {
      metadata.terms_accepted_at = consent.termsAcceptedAt
      metadata.terms_version = consent.termsVersion
      metadata.privacy_policy_accepted_at = consent.privacyAcceptedAt
      metadata.privacy_policy_version = consent.privacyVersion
    }
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: metadata, emailRedirectTo: `${window.location.origin}/#/login?verified=1` },
    })
    if (error) return { error: error.message, needsEmailConfirmation: false }
    const needsEmailConfirmation = Boolean(data.user && !isEmailConfirmed(data.user))
    if (needsEmailConfirmation && data.session) await supabase.auth.signOut()
    return { error: null, needsEmailConfirmation }
  }

  const resendConfirmation = async (email: string) => {
    if (!supabase) return { error: 'لم يتم ربط قاعدة البيانات بعد' }
    const { error } = await supabase.auth.resend({
      type: 'signup', email,
      options: { emailRedirectTo: `${window.location.origin}/#/login?verified=1` },
    })
    return { error: error ? error.message : null }
  }

  const signOut = async () => { if (supabase) await supabase.auth.signOut() }

  return <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signIn, signUp, resendConfirmation, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
