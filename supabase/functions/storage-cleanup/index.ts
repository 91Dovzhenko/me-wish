// Уборка Storage (ТЗ 003-e): удаляет файлы, на которые ничего не ссылается и которые не менялись больше суток —
// фото удалённых навсегда желаний, брошенные при добавлении фото, старые аватары.
// Вызывается раз в сутки из pg_cron (net.http_post) с заголовком x-cleanup-secret.
// Секреты: CLEANUP_SECRET (supabase secrets set), SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY Supabase передаёт сам.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CHUNK = 100

Deno.serve(async (req) => {
  const secret = Deno.env.get('CLEANUP_SECRET')
  if (!secret || req.headers.get('x-cleanup-secret') !== secret) {
    return new Response('forbidden', { status: 403 })
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await db.rpc('storage_orphans')
  if (error) {
    console.error('storage_orphans:', error)
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  const byBucket = new Map<string, string[]>()
  for (const row of (data ?? []) as { bucket_id: string; name: string }[]) {
    const names = byBucket.get(row.bucket_id) ?? []
    names.push(row.name)
    byBucket.set(row.bucket_id, names)
  }

  const removed: Record<string, number> = {}
  const failed: string[] = []
  for (const [bucket, names] of byBucket) {
    removed[bucket] = 0
    for (let i = 0; i < names.length; i += CHUNK) {
      const part = names.slice(i, i + CHUNK)
      const res = await db.storage.from(bucket).remove(part)
      if (res.error) {
        console.error(`remove ${bucket}:`, res.error)
        failed.push(...part)
      } else {
        removed[bucket] += res.data?.length ?? 0
      }
    }
  }

  console.log('storage-cleanup:', JSON.stringify({ removed, failed: failed.length }))
  return Response.json({ ok: failed.length === 0, removed, failed: failed.length })
})
