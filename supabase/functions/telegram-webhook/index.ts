// Вебхук бота @me_wish_bot (ТЗ 003-f2). Пока бот умеет только подтверждать вход:
//   /start login_<код> → запрос на вход становится подтверждённым, к нему привязывается пользователь Telegram;
//   любое другое сообщение → короткая подсказка.
// Запросы принимаются только с заголовком X-Telegram-Bot-Api-Secret-Token (задаётся при setWebhook).
//
// Регистрация вебхука (один раз и после смены секрета): POST на эту же функцию с заголовком
// x-telegram-setup: <TELEGRAM_WEBHOOK_SECRET> — функция сама вызовет setWebhook с токеном из секретов.
// Секреты: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET (supabase secrets); SUPABASE_URL и
// SUPABASE_SERVICE_ROLE_KEY Supabase передаёт сам.
import { createClient } from 'npm:@supabase/supabase-js@2'

const TEXT_DONE = 'Готово! Вернитесь в ME:WISH — вход выполнится сам.'
const TEXT_EXPIRED =
  'Ссылка для входа устарела. Нажмите «Войти через Telegram» в ME:WISH ещё раз.'
const TEXT_INFO = 'Это бот для входа в ME:WISH. Добавление желаний через бота появится позже.'

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

type TgMessage = {
  chat?: { id: number; type?: string }
  from?: { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string }
  text?: string
}

Deno.serve(async (req) => {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  if (!token || !secret) return new Response('not configured', { status: 500 })
  if (req.method !== 'POST') return new Response('method', { status: 405 })

  const tg = (method: string, payload: unknown) =>
    fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    }).then((r) => r.json())

  // ── Регистрация вебхука
  const setup = req.headers.get('x-telegram-setup')
  if (setup !== null) {
    if (!safeEqual(setup, secret)) return new Response('forbidden', { status: 403 })
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-webhook`
    const set = await tg('setWebhook', {
      url,
      secret_token: secret,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    })
    const info = await tg('getWebhookInfo', {})
    // в ответе нет ни токена, ни секрета
    return Response.json({ setWebhook: set, info: info?.result ?? info })
  }

  // ── Обновление от Telegram
  if (!safeEqual(req.headers.get('x-telegram-bot-api-secret-token') ?? '', secret)) {
    return new Response('forbidden', { status: 403 })
  }

  let update: { message?: TgMessage }
  try {
    update = await req.json()
  } catch {
    return new Response('ok') // мусор — молча, чтобы Telegram не повторял
  }
  const msg = update.message
  // только личные сообщения от людей
  if (!msg?.chat || !msg.from || msg.from.is_bot || msg.chat.type !== 'private') {
    return new Response('ok')
  }

  const reply = (text: string) =>
    tg('sendMessage', { chat_id: msg.chat!.id, text }).catch((e) =>
      console.warn('sendMessage:', e),
    )

  const m = /^\/start(?:@\w+)?\s+login_([A-Za-z0-9]{8,32})\s*$/.exec(msg.text ?? '')
  if (!m) {
    await reply(TEXT_INFO)
    return new Response('ok')
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  // подтверждается только живой запрос в ожидании — один раз
  const { data, error } = await admin
    .from('telegram_login_requests')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      telegram_id: msg.from.id,
      first_name: msg.from.first_name?.slice(0, 100) ?? null,
      last_name: msg.from.last_name?.slice(0, 100) ?? null,
      username: msg.from.username?.slice(0, 64) ?? null,
    })
    .eq('code', m[1])
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .select('id')
  if (error) {
    console.error('confirm:', error)
    await reply(TEXT_EXPIRED)
    return new Response('ok')
  }
  await reply(data && data.length > 0 ? TEXT_DONE : TEXT_EXPIRED)
  return new Response('ok')
})
