import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

// Публичный ключ (publishable / anon) — его можно отдавать в браузер, доступ ограничивает RLS.
// PKCE: Google возвращает ?code=…, обмен на сессию делает AuthProvider сам (detectSessionInUrl: false),
// чтобы показать «Входим…» и ошибку входа по макету.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null
