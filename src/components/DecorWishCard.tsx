import { HEART_PATH } from './Icons.tsx'

// Декоративная карточка желания для экрана входа (WishCard.dc.html в упрощённом виде).
// Вместо фото с маркетплейсов — свои простые иллюстрации.

const LEVEL_LABELS = {
  1: 'Можно и без',
  2: 'Было бы неплохо',
  3: 'Хочу',
  4: 'Очень хочу',
  5: 'Мечта',
}

type Level = 1 | 2 | 3 | 4 | 5

export function Hearts({ level, size = 11 }: { level: Level; size?: number }) {
  return (
    <span className="inline-flex items-center" aria-label={`Приоритет: ${LEVEL_LABELS[level]}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={i <= level ? 'var(--heart)' : 'none'}
          stroke={i <= level ? 'var(--heart)' : 'var(--heart-off)'}
          strokeWidth={1.5}
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d={HEART_PATH} />
        </svg>
      ))}
    </span>
  )
}

type Props = {
  title: string
  price: string
  level: Level
  art: 'tripod' | 'glasses'
  /** крупная версия для компьютера */
  large?: boolean
}

export default function DecorWishCard({ title, price, level, art, large }: Props) {
  return (
    <div className="flex w-full flex-col gap-2 rounded-[20px] bg-surface px-1.5 pt-1.5 pb-2.5 text-text">
      <div className="relative aspect-square w-full overflow-hidden rounded-[15px]">
        {art === 'tripod' ? <TripodArt /> : <GlassesArt />}
        {level >= 4 ? (
          <span className="absolute top-1.5 left-1.5 rounded-full bg-accent px-2 py-[3px] text-[11px] font-bold whitespace-nowrap">
            {LEVEL_LABELS[level]}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-[3px] px-1.5">
        <span className={`${large ? 'text-lg' : 'text-base'} font-bold tracking-[-0.01em]`}>
          {price}
        </span>
        <span className="line-clamp-2 min-h-[2.6em] text-[13px] leading-[1.3]">{title}</span>
        <span className="mt-0.5">
          <Hearts level={level} />
        </span>
      </div>
    </div>
  )
}

function TripodArt() {
  return (
    <svg viewBox="0 0 200 200" className="size-full" aria-hidden="true">
      <rect width="200" height="200" fill="#EEE9FF" />
      <circle cx="150" cy="48" r="26" fill="#C8F56A" opacity="0.7" />
      {/* камера */}
      <rect x="66" y="44" width="68" height="42" rx="9" fill="#17181C" />
      <rect x="80" y="36" width="22" height="12" rx="4" fill="#17181C" />
      <circle cx="100" cy="65" r="14" fill="#5E6066" />
      <circle cx="100" cy="65" r="8" fill="#B9A8FF" />
      <circle cx="124" cy="53" r="3" fill="#C8F56A" />
      {/* головка и ноги штатива */}
      <rect x="92" y="86" width="16" height="12" rx="3" fill="#3A3B40" />
      <rect x="97" y="98" width="6" height="34" fill="#3A3B40" />
      <path d="M100 130 L62 178" stroke="#3A3B40" strokeWidth="6" strokeLinecap="round" />
      <path d="M100 130 L138 178" stroke="#3A3B40" strokeWidth="6" strokeLinecap="round" />
      <path d="M100 130 L100 182" stroke="#3A3B40" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

function GlassesArt() {
  return (
    <svg viewBox="0 0 200 200" className="size-full" aria-hidden="true">
      <rect width="200" height="200" fill="#FFEEDD" />
      <circle cx="52" cy="150" r="30" fill="#C8F56A" opacity="0.6" />
      <circle cx="160" cy="40" r="18" fill="#FFFFFF" opacity="0.8" />
      {/* дужка-перемычка */}
      <path
        d="M88 96 Q100 86 112 96"
        stroke="#17181C"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M30 92 L22 84" stroke="#17181C" strokeWidth="6" strokeLinecap="round" />
      <path d="M170 92 L178 84" stroke="#17181C" strokeWidth="6" strokeLinecap="round" />
      {/* линзы */}
      <path d="M28 92 h62 v14 a28 28 0 0 1 -56 0 z" fill="#17181C" />
      <path d="M110 92 h62 v14 a28 28 0 0 1 -56 0 z" fill="#17181C" />
      <path
        d="M42 100 l12 -4"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M124 100 l12 -4"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  )
}
