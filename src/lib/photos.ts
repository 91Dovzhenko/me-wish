// Фото в Supabase Storage: желания (бакет wish-photos — docs/tech/wishes.md) и аватары (бакет avatars — 003-e).
// Оба бакета закрытые. Путь: <user_id>/<uuid>.webp|jpg. Показ — по подписанным ссылкам на час, с кэшем в памяти.
import { useEffect, useState } from 'react'
import { supabase, supabaseUrl } from './supabase.ts'

export const PHOTO_BUCKET = 'wish-photos'
export const AVATAR_BUCKET = 'avatars'
export type Bucket = typeof PHOTO_BUCKET | typeof AVATAR_BUCKET
const SIGN_SECONDS = 60 * 60
/** ссылку перевыпускаем заранее, за 10 минут до конца срока */
const SIGN_MARGIN_MS = 10 * 60 * 1000

export function photoPath(userId: string, wishId: string, ext: 'webp' | 'jpg') {
  return `${userId}/${wishId}.${ext}`
}

// ─── Подписанные ссылки ─────────────────────────────────────

type Signed = { url: string; expires: number }
// ключ кэша — бакет + путь
const cache = new Map<string, Signed>()
const pending = new Map<string, Promise<void>>()
const k = (bucket: Bucket, path: string) => `${bucket}:${path}`

/** Только что загруженное фото показываем из памяти браузера — без запроса к Storage. */
export function rememberLocalPhoto(path: string, blob: Blob, bucket: Bucket = PHOTO_BUCKET) {
  cache.set(k(bucket, path), { url: URL.createObjectURL(blob), expires: Number.POSITIVE_INFINITY })
}

function fresh(bucket: Bucket, path: string): string | null {
  const s = cache.get(k(bucket, path))
  return s && s.expires - SIGN_MARGIN_MS > Date.now() ? s.url : null
}

async function signMissing(bucket: Bucket, paths: string[]) {
  const missing = paths.filter((p) => !fresh(bucket, p) && !pending.has(k(bucket, p)))
  if (missing.length > 0 && supabase) {
    const job = supabase.storage
      .from(bucket)
      .createSignedUrls(missing, SIGN_SECONDS)
      .then(({ data, error }) => {
        if (error) throw error
        const expires = Date.now() + SIGN_SECONDS * 1000
        for (const item of data ?? []) {
          if (item.path && item.signedUrl)
            cache.set(k(bucket, item.path), { url: item.signedUrl, expires })
        }
      })
      .finally(() => missing.forEach((p) => pending.delete(k(bucket, p))))
    missing.forEach((p) => pending.set(k(bucket, p), job))
  }
  await Promise.all(paths.map((p) => pending.get(k(bucket, p))).filter(Boolean))
}

function snapshot(bucket: Bucket, paths: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of paths) {
    const url = fresh(bucket, p)
    if (url) out[p] = url
  }
  return out
}

/** Адреса для показа фото по путям в Storage. Пока ссылка не получена — пути нет в ответе. */
export function usePhotoUrls(
  paths: (string | null | undefined)[],
  bucket: Bucket = PHOTO_BUCKET,
): Record<string, string> {
  const list = [...new Set(paths.filter((p): p is string => !!p))].sort()
  const key = list.join('|')
  const [urls, setUrls] = useState<Record<string, string>>(() => snapshot(bucket, list))

  useEffect(() => {
    const wanted = key ? key.split('|') : []
    let alive = true
    const update = () => alive && setUrls(snapshot(bucket, wanted))
    update()
    signMissing(bucket, wanted)
      .then(update)
      .catch((e) => console.warn('Не удалось получить ссылки на фото:', e))
    // перевыпуск ссылок, пока экран открыт дольше срока
    const timer = window.setInterval(
      () => {
        signMissing(bucket, wanted)
          .then(update)
          .catch(() => {})
      },
      SIGN_SECONDS * 1000 - SIGN_MARGIN_MS,
    )
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [key, bucket])

  return urls
}

// ─── Загрузка и удаление ────────────────────────────────────

export class UploadAbortedError extends Error {}

/**
 * Загрузка с прогрессом. supabase-js прогресс не отдаёт, поэтому — XMLHttpRequest
 * в тот же REST Storage с токеном пользователя (права проверяет RLS бакета).
 * x-upsert: повторная обрезка или «Другое фото» до сохранения перезаписывают тот же путь.
 */
export async function uploadPhoto(
  path: string,
  blob: Blob,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
  bucket: Bucket = PHOTO_BUCKET,
): Promise<void> {
  const db = supabase
  if (!db) throw new Error('Supabase не настроен')
  const { data } = await db.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Нет сессии')
  const apikey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${supabaseUrl}/storage/v1/object/${bucket}/${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', apikey)
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.setRequestHeader('cache-control', 'max-age=31536000')
    xhr.setRequestHeader('Content-Type', blob.type)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        resolve()
      } else reject(new Error(`Storage ${xhr.status}: ${xhr.responseText.slice(0, 200)}`))
    }
    xhr.onerror = () => reject(new Error('Сеть недоступна'))
    xhr.onabort = () => reject(new UploadAbortedError('Отменено'))
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(blob)
  })
}

/** Сохранённое фото — для повторной обрезки при редактировании. */
export async function downloadPhoto(path: string): Promise<Blob> {
  const { data, error } = await supabase!.storage.from(PHOTO_BUCKET).download(path)
  if (error) throw error
  return data
}

/** Удаление загруженного, но не сохранённого фото (или старого — после замены). Ошибки не мешают — это уборка. */
export function removePhoto(path: string, bucket: Bucket = PHOTO_BUCKET) {
  removePhotos([path], bucket)
}

export function removePhotos(paths: string[], bucket: Bucket = PHOTO_BUCKET) {
  if (paths.length === 0) return
  paths.forEach((p) => cache.delete(k(bucket, p)))
  supabase?.storage
    .from(bucket)
    .remove(paths)
    .then(({ error }) => {
      if (error) console.warn('Не удалось удалить фото:', error)
    })
}
