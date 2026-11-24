import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.ts'

export type WishStatus = 'active' | 'booked' | 'purchased' | 'gifted'

/** Карточка в сетке списка: желание и его появление в этом списке. */
export type ListWish = {
  itemId: string
  wishId: string
  title: string
  price: number | null
  imagePath: string | null
  status: WishStatus
  priority: number
  addedAt: string
}

type Row = {
  id: string
  priority: number
  added_at: string
  wish: {
    id: string
    title: string
    price: number | null
    image_path: string | null
    status: WishStatus
  } | null
}

export type ListWishesState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: ListWish[] }

/**
 * Карточки списка (не в корзине). Порядок — по приоритету, сверху «Мечта»; при равном — новые первыми (D-057).
 * version — перечитать после добавления.
 */
export function useListWishes(listId: string, enabled: boolean, version: number) {
  const [state, setState] = useState<ListWishesState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled || !supabase) return
    let alive = true
    supabase
      .from('list_items')
      .select('id, priority, added_at, wish:wishes!inner(id, title, price, image_path, status)')
      .eq('list_id', listId)
      .is('deleted_at', null)
      .order('priority', { ascending: false })
      .order('added_at', { ascending: false })
      .order('id', { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return
        if (error) {
          console.warn('Не удалось загрузить желания:', error)
          setState((prev) => (prev.status === 'ready' ? prev : { status: 'error' }))
          return
        }
        const items = ((data ?? []) as unknown as Row[])
          .filter((r) => r.wish)
          .map((r): ListWish => ({
            itemId: r.id,
            wishId: r.wish!.id,
            title: r.wish!.title,
            price: r.wish!.price,
            imagePath: r.wish!.image_path,
            status: r.wish!.status,
            priority: r.priority,
            addedAt: r.added_at,
          }))
        setState({ status: 'ready', items })
      })
    return () => {
      alive = false
    }
  }, [listId, enabled, version, attempt])

  return { state, retry: () => setAttempt((n) => n + 1) }
}
