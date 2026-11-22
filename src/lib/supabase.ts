import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

// Публичный ключ (publishable / anon) — его можно отдавать в браузер, доступ ограничивает RLS.
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null

/** Проверка связи: запрос к health-эндпоинту Auth проекта. */
export async function checkSupabaseConnection(signal?: AbortSignal): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: supabaseKey },
      signal,
    })
    return res.ok
  } catch {
    return false
  }
}
