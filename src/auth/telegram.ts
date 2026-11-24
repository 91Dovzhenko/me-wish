// Вход через Telegram (ТЗ 003-f) — без стандартного виджета: своя кнопка по макету и переадресация.
// 1) Кнопка уводит на oauth.telegram.org/auth?bot_id=…&origin=…&return_to=… — подтверждение в Telegram.
// 2) Telegram возвращает на return_to с #tgAuthResult=<base64 JSON с подписанными данными>.
// 3) Edge Function telegram-auth проверяет подпись токеном бота и отдаёт одноразовый token_hash.
// 4) verifyOtp меняет его на обычную сессию Supabase. Подробно — docs/tech/telegram-login.md.
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseUrl } from '../lib/supabase.ts'

export type TelegramAuthData = {
  id: number | string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number | string
  hash: string
}

const FIELDS = ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash']

export const TELEGRAM_BOT_ID = import.meta.env.VITE_TELEGRAM_BOT_ID ?? ''

/** Куда Telegram вернёт пользователя: корень приложения (там index.html, без перехода через 404.html). */
function returnTo() {
  return `${window.location.origin}${import.meta.env.BASE_URL}`
}

/** Уйти на подтверждение в Telegram. false — бот не настроен (нет VITE_TELEGRAM_BOT_ID). */
export function startTelegramLogin(): boolean {
  if (!/^[0-9]+$/.test(TELEGRAM_BOT_ID)) {
    console.warn('Вход через Telegram: не задан VITE_TELEGRAM_BOT_ID')
    return false
  }
  const url = new URL('https://oauth.telegram.org/auth')
  url.searchParams.set('bot_id', TELEGRAM_BOT_ID)
  url.searchParams.set('origin', window.location.origin)
  url.searchParams.set('return_to', returnTo())
  window.location.assign(url.toString())
  return true
}

/** base64 / base64url → строка UTF-8 (имена бывают кириллицей). */
function decodeBase64(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

function pickFields(src: Record<string, unknown>): TelegramAuthData | null {
  const out: Record<string, string | number> = {}
  for (const k of FIELDS) {
    const v = src[k]
    if (v !== undefined && v !== null && v !== '') out[k] = v as string | number
  }
  return out.id && out.auth_date && out.hash ? (out as unknown as TelegramAuthData) : null
}

/**
 * Разбор адреса после возврата из Telegram (один раз при загрузке, до роутера); служебное убирается из строки.
 * null — это не возврат из Telegram; 'refused' — отказ или испорченный ответ.
 */
export function readTelegramCallback(): TelegramAuthData | 'refused' | null {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const result = hash.get('tgAuthResult')

  if (result !== null) {
    window.history.replaceState(window.history.state, '', url.pathname + url.search)
    try {
      const parsed: unknown = JSON.parse(decodeBase64(result))
      if (!parsed || typeof parsed !== 'object') return 'refused'
      return pickFields(parsed as Record<string, unknown>) ?? 'refused'
    } catch {
      return 'refused'
    }
  }

  // Другой вариант ответа Telegram — поля в параметрах адреса (?id=…&hash=…)
  if (url.searchParams.has('hash') && url.searchParams.has('auth_date')) {
    const src = Object.fromEntries(url.searchParams.entries())
    for (const k of FIELDS) url.searchParams.delete(k)
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    return pickFields(src) ?? 'refused'
  }
  return null
}

/** Подписанные данные → проверка в Edge Function → одноразовый токен → сессия Supabase. */
export async function exchangeTelegram(data: TelegramAuthData): Promise<Session | null> {
  const res = await fetch(`${supabaseUrl}/functions/v1/telegram-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const body = (await res.json().catch(() => ({}))) as { token_hash?: string; error?: string }
  if (!res.ok || !body.token_hash)
    throw new Error(`telegram-auth: ${res.status} ${body.error ?? ''}`)
  const { data: out, error } = await supabase!.auth.verifyOtp({
    token_hash: body.token_hash,
    type: 'magiclink',
  })
  if (error) throw error
  return out.session
}
