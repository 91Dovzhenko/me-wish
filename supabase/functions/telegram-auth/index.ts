// Вход через Telegram-бота по одноразовому коду (ТЗ 003-f2, D-111). Вызывается браузером до входа.
//   POST { action: 'start' }                    → { code, secret, expires_at }
//     создаёт запрос: код (увидит бот в /start login_<код>) и секрет устройства (в базе — только sha256).
//   POST { action: 'poll', code, secret }        → { status: 'pending' | 'expired' | 'ok', token_hash? }
//     без верного секрета код бесполезен. Подтверждённый ботом запрос используется один раз:
//     находит или создаёт пользователя Supabase по telegram_id и выдаёт одноразовый token_hash,
//     браузер меняет его на сессию: supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }).
// Подтверждение делает telegram-webhook. Секреты: TELEGRAM_BOT_TOKEN (supabase secrets),
// SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY Supabase передаёт сам. Подробно — docs/tech/telegram-login.md.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/** Случайная строка без похожих символов (код — 12 знаков, ~70 бит). */
function randomCode(len: number) {
  const out: string[] = []
  // отбрасываем байты, которые дали бы перекос распределения
  const limit = 256 - (256 % ALPHABET.length)
  while (out.length < len) {
    for (const b of crypto.getRandomValues(new Uint8Array(len * 2))) {
      if (b < limit && out.length < len) out.push(ALPHABET[b % ALPHABET.length])
    }
  }
  return out.join('')
}

function hex(buf: ArrayBuffer | Uint8Array) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(s: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

type LoginRequest = {
  id: string
  secret_hash: string
  status: 'pending' | 'confirmed' | 'used'
  expires_at: string
  telegram_id: number | null
  first_name: string | null
  last_name: string | null
  username: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  if (body?.action === 'start') {
    const code = randomCode(12)
    const secret = hex(crypto.getRandomValues(new Uint8Array(32)))
    const { data, error } = await admin
      .from('telegram_login_requests')
      .insert({ code, secret_hash: await sha256(secret) })
      .select('expires_at')
      .single()
    if (error) {
      console.error('start:', error)
      return json({ error: 'server' }, 500)
    }
    return json({ code, secret, expires_at: data.expires_at })
  }

  if (body?.action !== 'poll') return json({ error: 'bad_request' }, 400)

  const code = String(body.code ?? '')
  const secret = String(body.secret ?? '')
  if (!/^[A-Za-z0-9]{8,32}$/.test(code) || !/^[0-9a-f]{64}$/.test(secret)) {
    return json({ error: 'bad_request' }, 400)
  }

  const { data: row, error } = await admin
    .from('telegram_login_requests')
    .select('id, secret_hash, status, expires_at, telegram_id, first_name, last_name, username')
    .eq('code', code)
    .maybeSingle<LoginRequest>()
  if (error) {
    console.error('poll:', error)
    return json({ error: 'server' }, 500)
  }
  // нет запроса или чужой секрет — одинаковый ответ, чтобы не подсказывать, какие коды существуют
  if (!row || !safeEqual(row.secret_hash, await sha256(secret))) {
    return json({ error: 'not_found' }, 404)
  }
  if (row.status === 'used') return json({ status: 'expired' })
  if (row.status === 'pending') {
    return json({ status: Date.parse(row.expires_at) < Date.now() ? 'expired' : 'pending' })
  }

  // confirmed → забираем один раз (одновременный второй опрос получит 0 строк)
  const { data: claimed, error: claimErr } = await admin
    .from('telegram_login_requests')
    .update({ status: 'used', used_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('status', 'confirmed')
    .select('id')
  if (claimErr || !claimed?.length || !row.telegram_id) return json({ status: 'expired' })

  try {
    const tokenHash = await issueSession(admin, row)
    return json({ status: 'ok', token_hash: tokenHash })
  } catch (e) {
    console.error('Выдача сессии:', e)
    return json({ error: 'server' }, 500)
  }
})

/**
 * Найти или создать пользователя Supabase для telegram_id и выпустить одноразовый токен входа.
 * Аккаунт Telegram — тот, у кого в профиле этот telegram_id (ставит только сервер), со служебной почтой
 * telegram-<id>@me-wish.invalid. Почте одной не доверяем: её мог занять кто-то обычной регистрацией.
 */
async function issueSession(admin: SupabaseClient, r: LoginRequest): Promise<string> {
  const telegramId = String(r.telegram_id)
  const email = `telegram-${telegramId}@me-wish.invalid`

  const findOwner = async (): Promise<string | 'mismatch' | null> => {
    const { data: prof, error } = await admin
      .from('profiles')
      .select('id')
      .eq('telegram_id', telegramId)
      .maybeSingle()
    if (error) throw error
    if (!prof) return null
    const { data: u, error: uErr } = await admin.auth.admin.getUserById(prof.id)
    if (uErr) throw uErr
    return u.user?.email?.toLowerCase() === email ? prof.id : 'mismatch'
  }

  let owner = await findOwner()
  if (!owner) {
    const fullName = [r.first_name, r.last_name].filter(Boolean).join(' ').trim()
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName || r.username || 'Без имени' },
      app_metadata: { telegram_id: telegramId },
    })
    if (created.error) {
      // одновременный первый вход с двух устройств — пользователь уже есть; иначе почту кто-то занял
      owner = await findOwner()
      if (!owner) throw new Error(`createUser: ${created.error.message}`)
    } else {
      owner = created.data.user.id
      // app_metadata Supabase добавляет после вставки — триггер первого входа telegram_id не видит
      const { error: tgErr } = await admin
        .from('profiles')
        .update({ telegram_id: telegramId })
        .eq('id', owner)
      if (tgErr) {
        await admin.auth.admin.deleteUser(owner)
        throw new Error(`telegram_id: ${tgErr.message}`)
      }
      await saveTelegramAvatar(admin, owner, telegramId).catch((e) =>
        console.warn('Аватар из Telegram не сохранён:', e),
      )
    }
  }
  if (owner === 'mismatch') throw new Error(`telegram_id ${telegramId} у пользователя с другой почтой`)

  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = link.data?.properties?.hashed_token
  if (link.error || !tokenHash) throw new Error(`generateLink: ${link.error?.message}`)
  return tokenHash
}

/**
 * Первый вход: фото профиля Telegram (Bot API getUserProfilePhotos + getFile) → бакет avatars,
 * как своё фото. Размер — ближайший к 400 px из тех, что даёт Telegram (обычно 160/320/640), JPEG.
 * Нет фото или оно скрыто настройками приватности — останутся инициалы.
 */
async function saveTelegramAvatar(admin: SupabaseClient, userId: string, telegramId: string) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!token) return
  const api = (method: string, params: Record<string, string>) =>
    fetch(`https://api.telegram.org/bot${token}/${method}?${new URLSearchParams(params)}`, {
      signal: AbortSignal.timeout(5000),
    }).then((r) => r.json())

  const photos = await api('getUserProfilePhotos', { user_id: telegramId, limit: '1' })
  const sizes: { file_id: string; width: number; file_size?: number }[] =
    photos?.result?.photos?.[0] ?? []
  if (sizes.length === 0) return
  const sorted = [...sizes].sort((a, b) => a.width - b.width)
  const pick = sorted.find((s) => s.width >= 400) ?? sorted[sorted.length - 1]
  if (pick.file_size && pick.file_size > 1_000_000) return

  const file = await api('getFile', { file_id: pick.file_id })
  const filePath: string | undefined = file?.result?.file_path
  if (!filePath) return
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`, {
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) return
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length === 0 || bytes.length > 1_000_000) return

  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const up = await admin.storage.from('avatars').upload(path, bytes, { contentType: 'image/jpeg' })
  if (up.error) throw up.error
  const { error } = await admin.from('profiles').update({ avatar_path: path }).eq('id', userId)
  if (error) {
    await admin.storage.from('avatars').remove([path])
    throw error
  }
}
