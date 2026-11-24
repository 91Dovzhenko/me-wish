// Вход через Telegram (ТЗ 003-f). У Supabase нет провайдера Telegram, поэтому:
// 1) браузер получает от oauth.telegram.org подписанные данные пользователя (id, имя, фото, auth_date, hash);
// 2) эта функция проверяет подпись по токену бота (алгоритм Telegram) и свежесть auth_date;
// 3) находит или создаёт пользователя Supabase с служебной почтой telegram-<id>@me-wish.invalid
//    (Admin API, service role) и выпускает одноразовый токен входа (generateLink → hashed_token);
// 4) браузер меняет токен на обычную сессию: supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }).
// Секреты: TELEGRAM_BOT_TOKEN (supabase secrets), SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY Supabase передаёт сам.
// В браузер уходит только одноразовый token_hash; ключи и токен бота — никогда.
import { createClient } from 'npm:@supabase/supabase-js@2'

/** Данные входа не старше 5 минут (плюс минута на расхождение часов). */
const MAX_AGE_SEC = 5 * 60
const FUTURE_SKEW_SEC = 60
const FIELDS = ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash']

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

const enc = new TextEncoder()

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Сравнение без утечки по времени. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Проверка по https://core.telegram.org/widgets/login#checking-authorization:
 * secret_key = SHA256(bot_token); hash = hex(HMAC_SHA256(secret_key, data_check_string)),
 * data_check_string — все полученные поля, кроме hash, «ключ=значение», по алфавиту, через \n.
 */
async function validSignature(data: Record<string, string>, botToken: string) {
  const check = Object.keys(data)
    .filter((k) => k !== 'hash')
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('\n')
  const secret = await crypto.subtle.digest('SHA-256', enc.encode(botToken))
  const key = await crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = hex(await crypto.subtle.sign('HMAC', key, enc.encode(check)))
  return safeEqual(sig, String(data.hash ?? '').toLowerCase())
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!botToken) return json({ error: 'not_configured' }, 500)

  // Публичный id бота (часть токена до двоеточия) — для кнопки входа и проверки настройки
  if (req.method === 'GET') return json({ bot_id: Number(botToken.split(':')[0]) })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  let raw: Record<string, unknown>
  try {
    raw = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  if (!raw || typeof raw !== 'object') return json({ error: 'bad_request' }, 400)

  // Лишние поля не принимаем: подпись считается по всем полученным полям
  const data: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!FIELDS.includes(k)) return json({ error: 'bad_request' }, 400)
    if (v === null || v === undefined) continue
    data[k] = String(v)
  }
  if (!/^[0-9]{1,20}$/.test(data.id ?? '') || !/^[0-9]{1,12}$/.test(data.auth_date ?? '')) {
    return json({ error: 'bad_request' }, 400)
  }
  if (!(await validSignature(data, botToken))) return json({ error: 'bad_signature' }, 401)

  const now = Math.floor(Date.now() / 1000)
  const authDate = Number(data.auth_date)
  if (now - authDate > MAX_AGE_SEC || authDate - now > FUTURE_SKEW_SEC) {
    return json({ error: 'expired' }, 401)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const telegramId = data.id
  const email = `telegram-${telegramId}@me-wish.invalid`
  const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ').trim()

  // Аккаунт Telegram — тот, у кого в профиле этот telegram_id (его ставит только сервер, из app_metadata).
  // Почта служебная, но по почте одной не доверяем: её мог кто-то занять обычной регистрацией.
  const findOwner = async () => {
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

  let isNew = false
  try {
    let owner = await findOwner()
    if (!owner) {
      // Первый вход — создаём пользователя; профиль, «Мои желания» и telegram_id ставит триггер первого входа
      const created = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: fullName || data.username || 'Без имени',
          ...(data.photo_url ? { avatar_url: data.photo_url } : {}),
        },
        app_metadata: { telegram_id: telegramId },
      })
      if (created.error) {
        // одновременный первый вход с двух устройств — пользователь уже создан; иначе почту кто-то занял
        owner = await findOwner()
        if (!owner) {
          console.error('createUser:', created.error)
          return json({ error: 'account_conflict' }, 409)
        }
      } else {
        isNew = true
        owner = created.data.user.id
        // Supabase добавляет app_metadata уже после вставки пользователя, поэтому триггер первого входа
        // telegram_id не видит — ставим его сами (уникальный индекс не даст привязать один Telegram дважды)
        const { error: tgErr } = await admin
          .from('profiles')
          .update({ telegram_id: telegramId })
          .eq('id', owner)
        if (tgErr) {
          console.error('telegram_id:', tgErr)
          await admin.auth.admin.deleteUser(owner)
          owner = await findOwner()
          if (!owner) return json({ error: 'server' }, 500)
          isNew = false
        }
      }
    }
    if (owner === 'mismatch') {
      console.error('telegram_id принадлежит пользователю с другой почтой', telegramId)
      return json({ error: 'account_conflict' }, 409)
    }
  } catch (e) {
    console.error('Поиск пользователя:', e)
    return json({ error: 'server' }, 500)
  }

  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = link.data?.properties?.hashed_token
  if (link.error || !tokenHash) {
    console.error('generateLink:', link.error)
    return json({ error: 'server' }, 500)
  }

  return json({ token_hash: tokenHash, new_user: isNew })
})
