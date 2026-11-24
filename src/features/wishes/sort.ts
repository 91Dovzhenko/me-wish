import { useCallback, useState } from 'react'
import type { WishItem } from '../../data/AppData.tsx'

// Сортировка карточек списка (SPEC 3.4, Mobile-List-Sort / Desktop-List-Sort).
// Выбор запоминается для каждого списка на этом устройстве (localStorage).

export type SortKey = 'priority' | 'cheap' | 'expensive' | 'added' | 'status'

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'priority', label: 'По приоритету' },
  { key: 'cheap', label: 'Сначала дешёвые' },
  { key: 'expensive', label: 'Сначала дорогие' },
  { key: 'added', label: 'По дате добавления' },
  { key: 'status', label: 'По статусу' },
]

const STATUS_ORDER = { active: 0, booked: 1, purchased: 2, gifted: 3 } as const

/** Новые первыми; при равной дате — по id, чтобы порядок не прыгал. */
function newer(a: WishItem, b: WishItem) {
  if (a.addedAt !== b.addedAt) return a.addedAt < b.addedAt ? 1 : -1
  return a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0
}

/** По приоритету: сверху «Мечта», при равном — новые (D-057). */
function byPriority(a: WishItem, b: WishItem) {
  return b.priority - a.priority || newer(a, b)
}

/** По цене; «Без цены» — всегда в конце. */
function byPrice(dir: 1 | -1) {
  return (a: WishItem, b: WishItem) => {
    if (a.price == null || b.price == null) {
      if (a.price == null && b.price == null) return byPriority(a, b)
      return a.price == null ? 1 : -1
    }
    return (a.price - b.price) * dir || byPriority(a, b)
  }
}

const COMPARE: Record<SortKey, (a: WishItem, b: WishItem) => number> = {
  priority: byPriority,
  cheap: byPrice(1),
  expensive: byPrice(-1),
  added: newer,
  // «В желаниях» → «Куплено» → «Подарили», внутри — по приоритету
  status: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || byPriority(a, b),
}

export function sortItems(items: WishItem[], key: SortKey): WishItem[] {
  return [...items].sort(COMPARE[key])
}

const storageKey = (listId: string) => `me-wish:sort:${listId}`

function readSort(listId: string): SortKey {
  try {
    const v = localStorage.getItem(storageKey(listId))
    return SORT_OPTIONS.some((o) => o.key === v) ? (v as SortKey) : 'priority'
  } catch {
    return 'priority'
  }
}

/** Сортировка списка, запомненная на этом устройстве. */
export function useListSort(listId: string) {
  const [sort, setSortState] = useState<SortKey>(() => readSort(listId))
  const setSort = useCallback(
    (key: SortKey) => {
      setSortState(key)
      try {
        if (key === 'priority') localStorage.removeItem(storageKey(listId))
        else localStorage.setItem(storageKey(listId), key)
      } catch {
        // приватный режим Safari — просто не запоминаем
      }
    },
    [listId],
  )
  return [sort, setSort] as const
}
