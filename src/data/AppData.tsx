import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider.tsx'
import { asListColor, asListIcon, type ListColor, type ListIconName } from '../lib/listStyle.ts'
import { supabase } from '../lib/supabase.ts'

export type Profile = {
  id: string
  displayName: string
  avatarUrl: string | null
  defaultListId: string | null
}

export type CoverMode = 'collage' | 'icon'

export type ListSummary = {
  id: string
  title: string
  description: string | null
  eventDate: string | null
  icon: ListIconName
  color: ListColor
  coverMode: CoverMode
  /** карточки не в корзине */
  itemCount: number
  /** сумма активных (не исполненных) */
  totalPrice: number
  activeCount: number
  doneCount: number
  doneSum: number
}

/** Поля формы списка (создание и настройки). */
export type ListFields = {
  title: string
  description: string | null
  eventDate: string | null
  icon: ListIconName
  color: ListColor
  coverMode: CoverMode
}

export type Dashboard = {
  activeCount: number
  activeSum: number
  doneYear: number
  doneCount: number
  doneSum: number
}

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; profile: Profile; lists: ListSummary[]; dashboard: Dashboard }

type AppDataValue = State & {
  /** перезагрузка со скелетонами (после ошибки) */
  reload: () => void
  /** тихое обновление после изменений — без скелетонов */
  refresh: () => Promise<void>
  createList: (fields: ListFields) => Promise<string>
  updateList: (id: string, fields: ListFields) => Promise<void>
  /** мягкое удаление; желания уходят в корзину (D-082). Бросает LastListError, если список последний. */
  deleteList: (id: string) => Promise<void>
}

// eslint-disable-next-line react-refresh/only-export-components
export class LastListError extends Error {
  constructor() {
    super('Нельзя удалить единственный список')
  }
}

function toRow(f: ListFields) {
  return {
    title: f.title.trim(),
    description: f.description?.trim() || null,
    event_date: f.eventDate,
    icon: f.icon,
    color: f.color,
    cover_mode: f.coverMode,
  }
}

const AppDataContext = createContext<AppDataValue | null>(null)

async function load(userId: string) {
  const db = supabase!
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const [profileRes, listsRes, dashRes] = await Promise.all([
    db
      .from('profiles')
      .select('id, display_name, avatar_url, default_list_id')
      .eq('id', userId)
      .single(),
    db
      .from('list_overview')
      .select(
        'id, title, description, event_date, icon, color, cover_mode, item_count, total_price, active_count, done_count, done_sum, created_at',
      )
      .order('created_at', { ascending: true }),
    db.rpc('dashboard_summary', { p_tz: tz }).single(),
  ])
  if (profileRes.error) throw profileRes.error
  if (listsRes.error) throw listsRes.error
  if (dashRes.error) throw dashRes.error

  const p = profileRes.data
  const d = dashRes.data as {
    active_count: number
    active_sum: number
    done_year: number
    done_count: number
    done_sum: number
  }
  return {
    profile: {
      id: p.id,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      defaultListId: p.default_list_id,
    } satisfies Profile,
    lists: listsRes.data.map((l): ListSummary => ({
      id: l.id,
      title: l.title,
      description: l.description,
      eventDate: l.event_date,
      icon: asListIcon(l.icon),
      color: asListColor(l.color),
      coverMode: l.cover_mode === 'icon' ? 'icon' : 'collage',
      itemCount: Number(l.item_count ?? 0),
      totalPrice: Number(l.total_price ?? 0),
      activeCount: Number(l.active_count ?? 0),
      doneCount: Number(l.done_count ?? 0),
      doneSum: Number(l.done_sum ?? 0),
    })),
    dashboard: {
      activeCount: Number(d.active_count),
      activeSum: Number(d.active_sum),
      doneYear: Number(d.done_year),
      doneCount: Number(d.done_count),
      doneSum: Number(d.done_sum),
    } satisfies Dashboard,
  }
}

/** Данные вошедшего пользователя для боковой панели, шапки и главной. */
export function AppDataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!userId) return
    let alive = true
    load(userId)
      .then((data) => alive && setState({ status: 'ready', ...data }))
      .catch((e) => {
        console.warn('Не удалось загрузить данные:', e)
        if (alive) setState({ status: 'error' })
      })
    return () => {
      alive = false
    }
  }, [userId, attempt])

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  const refresh = useCallback(async () => {
    if (!userId) return
    const data = await load(userId)
    setState({ status: 'ready', ...data })
  }, [userId])

  const createList = useCallback(
    async (fields: ListFields) => {
      const { data, error } = await supabase!
        .from('lists')
        .insert(toRow(fields))
        .select('id')
        .single()
      if (error) throw error
      await refresh()
      return data.id as string
    },
    [refresh],
  )

  const updateList = useCallback(
    async (id: string, fields: ListFields) => {
      const { error } = await supabase!.from('lists').update(toRow(fields)).eq('id', id)
      if (error) throw error
      await refresh()
    },
    [refresh],
  )

  const deleteList = useCallback(async (id: string) => {
    const { error } = await supabase!.rpc('delete_list', { p_list_id: id })
    if (error) {
      if (error.message.includes('last_list')) throw new LastListError()
      throw error
    }
    // обновление данных — после перехода на главную (его делает вызывающий), иначе экран списка мигнёт «не найдено»
  }, [])

  return (
    <AppDataContext.Provider
      value={{ ...state, reload, refresh, createList, updateList, deleteList }}
    >
      {children}
    </AppDataContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData вне AppDataProvider')
  return ctx
}
