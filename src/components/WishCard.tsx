import { formatRub } from '../lib/format.ts'
import { priorityLabel } from '../lib/priority.ts'
import Hearts from './Hearts.tsx'
import { CheckIcon, GiftIcon } from './Icons.tsx'

type Props = {
  title: string
  price: number | null
  /** адрес фото; null — без фото (заглушка), undefined — фото ещё грузится */
  photoUrl: string | null | undefined
  priority: number
  status: 'active' | 'booked' | 'purchased' | 'gifted'
}

/**
 * Карточка в сетке — WishCard.dc.html / Spec-Cards.
 * Квадрат фото → цена (или «Без цены») → название до 2 строк → сердечки; у «Очень хочу» и «Мечта» — лаймовая метка.
 * Белая на сером фоне, без рамки (Desktop-List, D-103). Нажатие открывает карточку (ссылка — в ListPage).
 */
export default function WishCard({ title, price, photoUrl, priority, status }: Props) {
  const isDone = status === 'purchased' || status === 'gifted'
  const hot = !isDone && priority >= 4
  return (
    <article
      aria-label={`${title}, ${price != null ? formatRub(price) : 'без цены'}, ${
        isDone ? (status === 'gifted' ? 'подарили' : 'куплено') : priorityLabel(priority)
      }`}
      className="flex h-full min-w-0 flex-col gap-2 rounded-[20px] bg-surface px-1.5 pt-1.5 pb-2.5"
    >
      <div className="relative">
        <PhotoSquare url={photoUrl} alt={title} dim={isDone} radius={15} />
        {hot ? (
          <span className="absolute top-1.5 left-1.5 rounded-full bg-accent px-2 py-[3px] text-[11px] font-bold whitespace-nowrap text-text">
            {priorityLabel(priority)}
          </span>
        ) : null}
        {isDone ? (
          <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-text py-[3px] pr-2 pl-1.5 text-[11px] font-bold whitespace-nowrap text-white">
            <CheckIcon size={11} strokeWidth={3} className="text-accent" />
            {status === 'gifted' ? 'Подарили' : 'Куплено'}
          </span>
        ) : null}
      </div>
      <div className={`flex flex-col gap-[3px] px-1.5 ${isDone ? 'opacity-60' : ''}`}>
        <span
          className={`text-base font-bold tracking-[-0.01em] ${price != null ? 'text-text' : 'text-[#6b6d73]'}`}
        >
          {price != null ? formatRub(price) : 'Без цены'}
        </span>
        <span className="line-clamp-2 min-h-[2.6em] text-[13px] leading-[1.3] [overflow-wrap:anywhere]">
          {title}
        </span>
        <span className="mt-0.5 flex">
          <Hearts level={priority} size={11} gap={0} />
        </span>
      </div>
    </article>
  )
}

/** Квадратное фото товара (Photo.dc.html); без фото — серая заглушка с подарком. */
export function PhotoSquare({
  url,
  alt,
  dim,
  radius = 16,
  iconSize = 40,
}: {
  url: string | null | undefined
  alt: string
  dim?: boolean
  radius?: number
  iconSize?: number
}) {
  return (
    <div
      className="relative aspect-square w-full overflow-hidden bg-bg"
      style={{ borderRadius: radius }}
    >
      {url ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 block size-full object-cover"
          style={{ opacity: dim ? 0.5 : 1 }}
        />
      ) : url === null ? (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-2 text-text-3">
          <GiftIcon size={iconSize} />
        </div>
      ) : null}
    </div>
  )
}
