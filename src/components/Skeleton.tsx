// Скелетоны загрузки — Spec-Feedback.dc.html: цвета #EEEDE8 / #F2F1EC, мягкий перелив.

type BlockProps = {
  className?: string
  tone?: 'base' | 'soft' | 'line' | 'line-2'
  style?: React.CSSProperties
}

const TONES = {
  base: 'bg-skeleton',
  soft: 'bg-skeleton-2',
  line: 'bg-skeleton-line',
  'line-2': 'bg-skeleton-line-2',
}

export function SkeletonBlock({ className = '', tone = 'base', style }: BlockProps) {
  return (
    <div
      className={`skeleton-pulse ${TONES[tone]} ${className}`}
      style={style}
      aria-hidden="true"
    />
  )
}

/** Скелетон обложки списка. */
export function CoverSkeleton({
  heightClass = 'h-[132px] lg:h-[180px]',
}: {
  heightClass?: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface p-1.5" aria-hidden="true">
      <SkeletonBlock className={`rounded-[17px] ${heightClass}`} />
      <SkeletonBlock className="mx-2 h-3.5 w-[70%] rounded-[7px]" />
      <SkeletonBlock className="mx-2 mb-2 h-2.5 w-1/2 rounded-[5px]" tone="soft" />
    </div>
  )
}
