// Карточка приглашения до принятия (ТЗ 004-a): POST { token } → данные для экрана «… приглашает вас».
// Только по действующему токену и только минимум: название, иконка, цвет, число желаний, роль,
// имя и аватар пригласившего, до 4 фото обложки. Список целиком по токену не открывается.
// Фото — закрытые бакеты, поэтому функция (service role) отдаёт подписанные ссылки на 10 минут.
// Работает и до входа (экран входа с карточкой приглашения), поэтому без проверки JWT.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const SIGN_SECONDS = 600

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  let token = ''
  try {
    token = String((await req.json())?.token ?? '')
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  // токен — 64 hex; что-то другое не ищем вовсе
  if (!/^[0-9a-f]{64}$/.test(token)) return json({ status: 'invalid' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await admin.rpc('invite_preview', { p_token: token })
  if (error) {
    console.error('invite_preview:', error)
    return json({ error: 'server' }, 500)
  }
  const row = (data as Record<string, unknown>[] | null)?.[0]
  if (!row) return json({ status: 'invalid' })

  const photos = (row.cover_photos as string[] | null) ?? []
  let coverUrls: string[] = []
  if (photos.length > 0 && row.cover_mode !== 'icon') {
    const signed = await admin.storage.from('wish-photos').createSignedUrls(photos, SIGN_SECONDS)
    coverUrls = (signed.data ?? []).map((s) => s.signedUrl).filter((u): u is string => !!u)
  }
  let inviterAvatar = (row.inviter_avatar_url as string | null) ?? null
  if (row.inviter_avatar_path) {
    const a = await admin.storage
      .from('avatars')
      .createSignedUrl(String(row.inviter_avatar_path), SIGN_SECONDS)
    if (a.data?.signedUrl) inviterAvatar = a.data.signedUrl
  }

  return json({
    status: 'ok',
    list_id: row.list_id,
    title: row.title,
    icon: row.icon,
    color: row.color,
    cover_mode: row.cover_mode,
    item_count: row.item_count,
    cover_urls: coverUrls,
    role: row.role,
    inviter_name: row.inviter_name,
    inviter_avatar: inviterAvatar,
    expires_at: row.expires_at,
  })
})
