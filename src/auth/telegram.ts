// Вход через Telegram-бота по одноразовому коду (ТЗ 003-f2, D-111). Работает одинаково в Safari,
// в установленном приложении на iPhone и на Mac: результат приходит не переадресацией, а опросом сервера.
// 1) createTelegramLogin(): Edge Function telegram-auth создаёт код и секрет устройства (в базе — только хэш).
// 2) openTelegram(): открывается бот с /start login_<код>; пользователь жмёт «Start», вебхук подтверждает.
// 3) pollTelegram(): приложение раз в 1,5 с (и при возвращении) спрашивает код + секрет; после
//    подтверждения получает одноразовый token_hash → finishTelegram() меняет его на сессию Supabase.
// Подробно — docs/tech/telegram-login.md.
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseUrl } from '../lib/supabase.ts'

export const TELEGRAM_BOT_NAME = import.meta.env.VITE_TELEGRAM_BOT_NAME || 'me_wish_bot'

export type TelegramLogin = { code: string; secret: string; expiresAt: number }

const STORE_KEY = 'me-wish:tg-login'

async function call(body: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${supabaseUrl}/functions/v1/telegram-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return {
    status: res.status,
    data: (await res.json().catch(() => ({}))) as Record<string, unknown>,
  }
}

/** Новый запрос на вход (код + секрет устройства), живёт 10 минут. */
export async function createTelegramLogin(): Promise<TelegramLogin> {
  const { status, data } = await call({ action: 'start' })
  if (status !== 200 || typeof data.code !== 'string' || typeof data.secret !== 'string') {
    throw new Error(`telegram-auth start: ${status}`)
  }
  return {
    code: data.code,
    secret: data.secret,
    expiresAt: Date.parse(String(data.expires_at)) || Date.now() + 10 * 60_000,
  }
}

// ── Запрос, который ждёт подтверждения: храним в localStorage — iOS может выгрузить приложение,
// пока пользователь в Telegram, и после возвращения ожидание продолжится.
export function saveActiveLogin(l: TelegramLogin | null) {
  try {
    if (l) localStorage.setItem(STORE_KEY, JSON.stringify(l))
    else localStorage.removeItem(STORE_KEY)
  } catch {
    /* приватный режим — ожидание просто не переживёт перезагрузку */
  }
}

export function loadActiveLogin(): TelegramLogin | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const l = JSON.parse(raw) as TelegramLogin
    if (typeof l.code !== 'string' || typeof l.secret !== 'string' || !(l.expiresAt > Date.now())) {
      localStorage.removeItem(STORE_KEY)
      return null
    }
    return l
  } catch {
    return null
  }
}

/** iPhone и iPad (iPad с iPadOS 13+ представляется Mac с сенсорным экраном). */
function isIos() {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

export function telegramWebLink(code: string) {
  return `https://t.me/${TELEGRAM_BOT_NAME}?start=login_${code}`
}

/**
 * Открыть бота. На iPhone — схема tg:// (сразу приложение Telegram, страница ME:WISH остаётся на месте,
 * в том числе в установленном приложении). На компьютере — t.me в новой вкладке (оттуда Telegram Desktop
 * или веб-версия), чтобы вкладка ME:WISH продолжала ждать. Вызывать прямо в обработчике нажатия.
 */
export function openTelegram(code: string) {
  if (isIos()) {
    window.location.href = `tg://resolve?domain=${TELEGRAM_BOT_NAME}&start=login_${code}`
    return
  }
  // без 'noopener' в параметрах: с ним window.open всегда возвращает null и не понять, открылось ли окно
  const w = window.open(telegramWebLink(code), '_blank')
  if (w) w.opener = null
  else window.location.href = telegramWebLink(code)
}

export type PollResult =
  { status: 'pending' } | { status: 'expired' } | { status: 'ok'; tokenHash: string }

export async function pollTelegram(l: TelegramLogin): Promise<PollResult> {
  const { status, data } = await call({ action: 'poll', code: l.code, secret: l.secret })
  if (status === 404) return { status: 'expired' }
  if (status !== 200) throw new Error(`telegram-auth poll: ${status}`)
  if (data.status === 'ok' && typeof data.token_hash === 'string') {
    return { status: 'ok', tokenHash: data.token_hash }
  }
  return data.status === 'pending' ? { status: 'pending' } : { status: 'expired' }
}

/** Одноразовый токен → обычная сессия Supabase. */
export async function finishTelegram(tokenHash: string): Promise<Session | null> {
  const { data, error } = await supabase!.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  })
  if (error) throw error
  return data.session
}
