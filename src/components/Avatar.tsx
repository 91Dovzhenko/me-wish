import { useState } from 'react'
import { initials } from '../lib/format.ts'

type Props = {
  name: string
  /** Ссылка на фото (из Google или своё). Если не загрузилось — инициалы. */
  src?: string | null
  size: number
  className?: string
}

/** Аватар: фото или инициалы на лавандовом градиенте. */
export default function Avatar({ name, src, size, className = '' }: Props) {
  const [failed, setFailed] = useState<string | null>(null)
  const showPhoto = Boolean(src) && failed !== src

  return (
    <span
      className={`relative flex flex-none items-center justify-center overflow-hidden rounded-full font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.32),
        background: 'linear-gradient(135deg, var(--accent-2), var(--accent-2-deep))',
      }}
      aria-hidden="true"
    >
      {/* Инициалы видны, пока фото грузится или если не загрузилось */}
      {initials(name)}
      {showPhoto ? (
        <img
          src={src!}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailed(src!)}
        />
      ) : null}
    </span>
  )
}
