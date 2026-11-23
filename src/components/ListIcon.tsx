import {
  LIST_ICON_PATHS,
  listColorVars,
  type ListColor,
  type ListIconName,
} from '../lib/listStyle.ts'

type Props = {
  icon: ListIconName
  color: ListColor
  /** размер значка */
  size?: number
  /** размер подложки */
  box?: number
  selected?: boolean
}

/** Иконка списка на его цвете (ListIcon.dc.html). */
export default function ListIcon({ icon, color, size = 16, box = 28, selected }: Props) {
  const c = listColorVars(color)
  return (
    <span
      className="inline-flex flex-none items-center justify-center"
      style={{
        width: box,
        height: box,
        borderRadius: Math.round(box * 0.32),
        background: c.bg,
        boxShadow: selected ? '0 0 0 2px var(--text)' : undefined,
      }}
      aria-hidden="true"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={c.fg}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={LIST_ICON_PATHS[icon]} />
      </svg>
    </span>
  )
}
