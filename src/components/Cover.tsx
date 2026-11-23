import { listColorVars, type ListColor, type ListIconName } from '../lib/listStyle.ts'
import ListIcon from './ListIcon.tsx'

type Props = {
  title: string
  meta: string
  /** метка даты события в углу («14 марта»), пусто — нет метки */
  date?: string
  icon: ListIconName
  color: ListColor
  /** классы высоты обложки, по умолчанию телефон 132 / компьютер 180 */
  heightClass?: string
}

/**
 * Обложка списка (Cover.dc.html). На этом ТЗ — только пустая обложка с иконкой и меткой даты;
 * коллаж из фото — вместе с карточками желаний (003-c/d).
 * Нажатие пока ничего не делает — экран списка появится в 003-b.
 */
export default function Cover({
  title,
  meta,
  date,
  icon,
  color,
  heightClass = 'h-[132px] lg:h-[180px]',
}: Props) {
  return (
    <div
      className="flex w-full flex-col gap-2 rounded-card bg-surface p-1.5 text-text"
      aria-label={`${title}, ${meta}`}
      role="group"
    >
      <div className={`relative overflow-hidden rounded-[17px] ${heightClass}`}>
        <div
          className="flex size-full items-center justify-center"
          style={{ background: listColorVars(color).cover }}
        >
          <ListIcon icon={icon} color={color} size={26} box={52} />
        </div>
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
    </div>
  )
}
