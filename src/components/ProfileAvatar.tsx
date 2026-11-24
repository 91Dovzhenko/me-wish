import { useAppData } from '../data/AppData.tsx'
import { AVATAR_BUCKET, usePhotoUrls } from '../lib/photos.ts'
import Avatar from './Avatar.tsx'
import { SkeletonBlock } from './Skeleton.tsx'

/**
 * Аватар вошедшего пользователя: своё фото (бакет avatars) → фото из Google → инициалы (D-091).
 * Шапка телефона, боковое меню, профиль — везде один и тот же.
 */
export default function ProfileAvatar({ size }: { size: number }) {
  const data = useAppData()
  const path = data.status === 'ready' ? data.profile.avatarPath : null
  const urls = usePhotoUrls([path], AVATAR_BUCKET)
  if (data.status !== 'ready') {
    return (
      <SkeletonBlock className="flex-none rounded-full" style={{ width: size, height: size }} />
    )
  }
  // пока подписанная ссылка на своё фото не получена — инициалы, а не старое фото из Google
  const src = path ? (urls[path] ?? null) : data.profile.avatarUrl
  return <Avatar name={data.profile.displayName} src={src} size={size} />
}
