import { useMemo, useState } from 'react'
import { formatDayMonth, MONTHS_NOM, toIsoDate } from '../lib/format.ts'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './Icons.tsx'

type Props = {
  /** выбранная дата 'YYYY-MM-DD' или null */
  value: string | null
  onChange: (value: string | null) => void
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

type Day = { iso: string; n: number; out: boolean; monthIndex: number }

/** 6 недель с понедельника, включая дни соседних месяцев. */
function buildMonth(year: number, month: number): Day[] {
  const first = new Date(year, month, 1)
  const shift = (first.getDay() + 6) % 7 // понедельник = 0
  const days: Day[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - shift + i)
    days.push({
      iso: toIsoDate(d),
      n: d.getDate(),
      out: d.getMonth() !== month,
      monthIndex: d.getMonth(),
    })
  }
  return days
}

/**
 * Календарь — DatePicker.dc.html (D-090): тёмное окно, неделя с понедельника,
 * сегодня — лаймом, выбранный день обведён, внизу «Убрать дату».
 */
export default function DatePicker({ value, onChange }: Props) {
  const today = toIsoDate(new Date())
  const start = value ?? today
  const [view, setView] = useState(() => {
    const [y, m] = start.split('-').map(Number)
    return { year: y, month: m - 1 }
  })
  const days = useMemo(() => buildMonth(view.year, view.month), [view])

  const step = (delta: number) =>
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })

  return (
    <div
      role="dialog"
      aria-label="Выбор даты"
      className="pop-in flex w-[320px] max-w-[calc(100vw-40px)] flex-col gap-1.5 rounded-[24px] bg-text px-3.5 pt-3.5 pb-2 text-white shadow-[0_20px_50px_rgba(23,24,28,0.35)]"
    >
      <div className="flex items-center justify-between px-1 pb-1">
        <button
          type="button"
          aria-label="Предыдущий месяц"
          onClick={() => step(-1)}
          className="flex size-10 cursor-pointer items-center justify-center rounded-item text-[#b5b6bb] hover:bg-[#2c2d33] hover:text-white"
        >
          <ChevronLeftIcon size={16} />
        </button>
        <span className="text-base font-bold" aria-live="polite">
          {MONTHS_NOM[view.month]} {view.year}
        </span>
        <button
          type="button"
          aria-label="Следующий месяц"
          onClick={() => step(1)}
          className="flex size-10 cursor-pointer items-center justify-center rounded-item bg-[#2c2d33] text-white hover:bg-[#3a3b42]"
        >
          <ChevronRightIcon size={16} />
        </button>
      </div>
      <div
        aria-hidden="true"
        className="grid grid-cols-7 pb-0.5 text-center text-xs text-[#8a8b90]"
      >
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div role="grid" className="grid grid-cols-7 gap-0.5">
        {days.map((d) => {
          const isToday = d.iso === today
          const isSel = d.iso === value
          return (
            <button
              key={d.iso}
              type="button"
              aria-label={`${formatDayMonth(d.n, d.monthIndex)}${isToday ? ', сегодня' : ''}`}
              aria-pressed={isSel}
              onClick={() => onChange(d.iso)}
              className={`h-[38px] cursor-pointer rounded-item text-[15px] ${
                isToday
                  ? 'bg-accent font-bold text-text'
                  : isSel
                    ? 'bg-[#2c2d33] font-bold'
                    : `font-medium hover:bg-[#2c2d33] ${d.out ? 'text-text-2' : 'text-white'}`
              } ${isSel ? 'shadow-[inset_0_0_0_2px_#ffffff]' : ''}`}
            >
              {d.n}
            </button>
          )
        })}
      </div>
      <div aria-hidden="true" className="mx-1 mt-1.5 h-px bg-[#2c2d33]" />
      <button
        type="button"
        onClick={() => onChange(null)}
        className="flex h-11 cursor-pointer items-center gap-2.5 rounded-item px-2.5 text-left text-[15px] text-[#b5b6bb] hover:bg-[#2c2d33] hover:text-white"
      >
        <CloseIcon size={16} />
        Убрать дату
      </button>
    </div>
  )
}
