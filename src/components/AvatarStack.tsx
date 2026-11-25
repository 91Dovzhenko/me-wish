import type { Person } from '../data/AppData.tsx'
import { AVATAR_BUCKET, usePhotoUrls } from '../lib/photos.ts'
import Avatar from './Avatar.tsx'

type Props = {
  people: (Person & { isMe?: boolean })[]
  size: number
  /** цвет обводки — под фон, на котором стоит ряд */
  ring?: string
  /** сколько аватаров показать до «+N» */
  max?: number
  className?: string
}

/**
 * Ряд аватаров участников — AvatarStack.dc.html: до 3 с наложением на 30 %, дальше «+N».
 * Обложка, шапка списка, боковое меню, выбор списка.
 */
export default function AvatarStack({
  people,
  size,
  ring = '#FFFFFF',
  max = 3,
  className = '',
}: Props) {
  const shown = people.slice(0, max)
  const more = people.length - shown.length
  const urls = usePhotoUrls(
    shown.map((p) => p.avatarPath),
    AVATAR_BUCKET,
  )
  const overlap = -Math.round(size * 0.3)
  return (
    <span
      role="img"
      aria-label={`Участники: ${people.map((p) => p.name).join(', ')}`}
      className={`inline-flex flex-none items-center ${className}`}
    >
      {shown.map((p, i) => (
        <span
          key={p.userId}
          className="inline-flex rounded-full"
          style={{ marginLeft: i === 0 ? 0 : overlap, boxShadow: `0 0 0 2px ${ring}` }}
        >
          <Avatar
            name={p.name}
            src={p.avatarPath ? (urls[p.avatarPath] ?? null) : p.avatarUrl}
            size={size}
            tone={p.isMe ? undefined : p.userId}
          />
        </span>
      ))}
      {more > 0 ? (
        <span
          aria-hidden="true"
          className="inline-flex flex-none items-center justify-center rounded-full bg-text-2 font-bold text-white"
          style={{
            width: size,
            height: size,
            marginLeft: overlap,
            fontSize: Math.round(size * 0.42),
            boxShadow: `0 0 0 2px ${ring}`,
          }}
        >
          +{more}
        </span>
      ) : null}
    </span>
  )
}
