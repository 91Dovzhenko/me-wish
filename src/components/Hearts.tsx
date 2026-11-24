import { priorityLabel } from '../lib/priority.ts'
import { HEART_PATH } from './Icons.tsx'

export function Heart({ on, size }: { on: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={on ? 'var(--heart)' : 'none'}
      stroke={on ? 'var(--heart)' : 'var(--heart-off)'}
      strokeWidth={1.6}
      strokeLinejoin="round"
    >
      <path d={HEART_PATH} />
    </svg>
  )
}

/** Сердечки приоритета для показа — Hearts.dc.html. */
export default function Hearts({
  level,
  size = 14,
  gap = 2,
}: {
  level: number
  size?: number
  gap?: number
}) {
  return (
    <span
      role="img"
      aria-label={`Приоритет: ${priorityLabel(level)}`}
      className="inline-flex items-center"
      style={{ gap }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Heart key={i} on={i <= level} size={size} />
      ))}
    </span>
  )
}
