import { Link } from 'react-router'
import { listColorVars, type ListColor, type ListIconName } from '../lib/listStyle.ts'
import ListIcon from './ListIcon.tsx'

type Props = {
  title: string
  meta: string
  /** метка даты события в углу («14 марта»), пусто — нет метки */
  date?: string
  icon: ListIconName
  color: ListColor
  /** 'icon' — всегда иконка; 'collage' — коллаж, если есть фото */
  coverMode?: 'collage' | 'icon'
  /** адреса фото последних добавленных желаний (новые первыми), берутся до 4; '' — фото ещё грузится */
  photos?: string[]
  /** адрес экрана списка; без него обложка не кликабельна */
  to?: string
  /** классы высоты обложки, по умолчанию телефон 132 / компьютер 180 */
  heightClass?: string
}

/**
 * Обложка списка — Cover.dc.html / Spec-Cards (D-089, D-095).
 * Коллаж: 1 фото — целиком; 2 — две колонки; 3 — большое слева и два справа; 4 — сетка 2×2.
 * Без фото или в режиме «Иконка» — иконка на цвете списка.
 */
export default function Cover({
  title,
  meta,
  date,
  icon,
  color,
  coverMode = 'collage',
  photos = [],
  to,
  heightClass = 'h-[132px] lg:h-[180px]',
}: Props) {
  const pics = coverMode === 'collage' ? photos.slice(0, 4) : []
  const n = pics.length

  const body = (
    <>
      <div className={`relative overflow-hidden rounded-[17px] ${heightClass}`}>
        {n > 0 ? (
          <div
            className={`grid size-full gap-[3px] ${n === 1 ? 'grid-cols-1' : 'grid-cols-2'} ${
              n >= 3 ? 'grid-rows-2' : 'grid-rows-1'
            }`}
          >
            {pics.map((src, i) => (
              <div
                key={i}
                className={`relative min-h-0 min-w-0 overflow-hidden bg-bg ${
                  n === 3 && i === 0 ? 'row-span-2' : ''
                }`}
              >
                {src ? (
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 block size-full object-cover"
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div
            className="flex size-full items-center justify-center"
            style={{ background: listColorVars(color).cover }}
          >
            <ListIcon icon={icon} color={color} size={26} box={52} />
          </div>
        )}
        {date ? (
          <span className="absolute top-2 left-2 rounded-full bg-surface px-[9px] py-1 text-[11px] font-bold whitespace-nowrap shadow-label">
            {date}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5 px-2 pb-2">
        <span className="truncate text-[15px] leading-tight font-semibold">{title}</span>
        <span className="truncate text-xs text-text-2">{meta}</span>
      </div>
    </>
  )

  const cls = 'flex w-full min-w-0 flex-col gap-2 rounded-card bg-surface p-1.5 text-text'

  if (to) {
    return (
      <Link
        to={to}
        aria-label={`${title}, ${meta}${date ? `, ${date}` : ''}`}
        className={`${cls} transition-shadow hover:shadow-[0_6px_20px_rgba(23,24,28,0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text`}
      >
        {body}
      </Link>
    )
  }
  return (
    <div className={cls} role="group" aria-label={`${title}, ${meta}`}>
      {body}
    </div>
  )
}
