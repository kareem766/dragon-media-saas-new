import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

interface SignupConsent {
  termsAcceptedAt: string
  termsVersion: string
  privacyAcceptedAt: string
  privacyVersion: string
}

interface SignUpResult {
  error: string | null
  needsEmailConfirmation: boolean
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    fullName: string,
    consent?: SignupConsent
  ) => Promise<SignUpResult>
  resendConfirmation: (
    email: string
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
)

export function AuthProvider({
  children,
}: {
  children: ReactNode
}) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: listener,
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (
    email: string,
    password: string
  ) => {
    if (!supabase) {
      return {
        error: 'لم يتم ربط قاعدة البيانات بعد',
      }
    }

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    if (!error) {
      return { error: null }
    }

    const normalizedMessage =
      error.message.toLowerCase()

    if (
      normalizedMessage.includes(
        'email not confirmed'
      ) ||
      normalizedMessage.includes(
        'email_not_confirmed'
      )
    ) {
      return {
        error:
          'البريد الإلكتروني غير مؤكد. افتح رسالة التأكيد التي أرسلناها إلى بريدك الإلكتروني ثم حاول تسجيل الدخول مرة أخرى.',
      }
    }

    return {
      error: error.message,
    }
  }

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    consent?: SignupConsent
  ): Promise<SignUpResult> => {
    if (!supabase) {
      return {
        error: 'لم يتم ربط قاعدة البيانات بعد',
        needsEmailConfirmation: false,
      }
    }

    const metadata: Record<string, string> = {
      full_name: fullName,
    }

    /*
     * Store consent as Auth metadata.
     *
     * The database functions:
     * create_organization_for_user
     * redeem_invite_code
     *
     * read these values from auth.users.raw_user_meta_data
     * and persist them into public.users.
     */
    if (consent) {
      metadata.terms_accepted_at =
        consent.termsAcceptedAt

      metadata.terms_version =
        consent.termsVersion

      metadata.privacy_policy_accepted_at =
        consent.privacyAcceptedAt

      metadata.privacy_policy_version =
        consent.privacyVersion
    }

    const {
      data,
      error,
    } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/#/login?verified=1`,
      },
    })

    if (error) {
      return {
        error: error.message,
        needsEmailConfirmation: false,
      }
    }

    /*
     * When Supabase Confirm Email is enabled:
     *
     * data.user exists
     * data.session is null
     *
     * Therefore the user must verify the email first.
     */
    const needsEmailConfirmation =
      !!data.user && !data.session

    return {
      error: null,
      needsEmailConfirmation,
    }
  }

  const resendConfirmation = async (
    email: string
  ) => {
    if (!supabase) {
      return {
        error: 'لم يتم ربط قاعدة البيانات بعد',
      }
    }

    const { error } =
      await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/#/login?verified=1`,
        },
      })

    return {
      error: error ? error.message : null,
    }
  }

  const signOut = async () => {
    if (!supabase) return

    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signIn,
        signUp,
        resendConfirmation,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)

  if (!ctx) {
    throw new Error(
      'useAuth must be used within AuthProvider'
    )
  }

  return ctx
}
