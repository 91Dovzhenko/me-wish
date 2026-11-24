const rub = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

/** 186400 → «186 400 ₽» (пробелы неразрывные). */
export function formatRub(value: number): string {
  return `${rub.format(value).replace(/\s/g, '\u00a0')}\u00a0₽`
}

/** Склонение: plural(5, ['желание', 'желания', 'желаний']) → «желаний». */
export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]
  return forms[2]
}

/** Подпись под обложкой списка: «7 желаний · 24 760 ₽» или «Пока пусто». */
export function listMeta(count: number, total: number): string {
  if (count === 0) return 'Пока пусто'
  const base = `${count} ${plural(count, ['желание', 'желания', 'желаний'])}`
  return total > 0 ? `${base} · ${formatRub(total)}` : base
}

/** '2027-03-14' → «14 марта». */
export function formatEventDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

/** Инициалы для аватара: «Виталий Довженко» → «ВД», «Борис» → «Б». */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

/** Короткое имя для меню: первое слово. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Профиль'
}

const MONTHS_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

export const MONTHS_NOM = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

/** '2027-03-14' → «14 марта 2027» (поле даты в форме списка). */
export function formatFullDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return `${d} ${MONTHS_GEN[m - 1]} ${y}`
}

/** «14 марта» для подписи дня в календаре. */
export function formatDayMonth(d: number, monthIndex: number): string {
  return `${d} ${MONTHS_GEN[monthIndex]}`
}

/** Дата → 'YYYY-MM-DD' по местному времени. */
export function toIsoDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

/** «Активные 5 · 24 760 ₽»: число и сумма. */
export function countSum(count: number, sum: number): string {
  return `${count} · ${formatRub(sum)}`
}
