import { createClient } from '@supabase/supabase-js'

// ضيف المتغيرات دي في ملف .env (شوف .env.example) لما تربط قاعدة بيانات Supabase الحقيقية
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const isSupabaseConnected = () => supabase !== null
