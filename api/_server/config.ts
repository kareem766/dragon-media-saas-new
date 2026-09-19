const env = (...names: string[]) =>
  names
    .map((name) => process.env[name])
    .find((value) => value && value.trim())
    ?.trim() || ''

// Public project URL; the server secret remains Vercel-only.
export const SUPABASE_URL =
  env('SUPABASE_URL', 'VITE_SUPABASE_URL') ||
  'https://pukqeiagqjqketcecipz.supabase.co'

export const SUPABASE_SERVICE_ROLE_KEY =
  env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'SUPABASE_SECRET_KEY')
