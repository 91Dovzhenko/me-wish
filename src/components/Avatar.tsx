import { useState } from 'react'
import { initials } from '../lib/format.ts'

type Props = {
  name: string
  /** Ссылка на фото (из Google или своё). Если не загрузилось — инициалы. */
  src?: string | null
  size: number
  className?: string
  /** id участника: свой цвет фона инициалов (Avatar.dc.html), без него — лавандовый */
  tone?: string
}

const TONES = [
  'linear-gradient(135deg, var(--accent-2), var(--accent-2-deep))',
  'linear-gradient(135deg, #FFB98A, #F2766B)',
  'linear-gradient(135deg, #8FD3B6, #3E9C7A)',
  'linear-gradient(135deg, #8EC5FF, #4A7FD9)',
]

function toneOf(seed: string) {
  // FNV-1a — равномерно и для похожих id
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0
  return TONES[h % TONES.length]
}

/** Аватар: фото или инициалы на лавандовом градиенте. */
export default function Avatar({ name, src, size, className = '', tone }: Props) {
  const [failed, setFailed] = useState<string | null>(null)
  const showPhoto = Boolean(src) && failed !== src

  return (
    <span
      className={`relative flex flex-none items-center justify-center overflow-hidden rounded-full font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.32),
        background: tone ? toneOf(tone) : TONES[0],
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
