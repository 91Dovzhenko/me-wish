import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
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
  /** пути в Storage фото 4 последних добавленных желаний с фото (новые первыми) — для коллажа */
  coverPhotos: string[]
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

/** Новое желание из формы (D-088). */
export type NewWish = {
  /** id задаёт клиент: под ним заранее загружено фото */
  id: string
  listId: string
  title: string
  price: number | null
  sourceUrl: string | null
  description: string | null
  priority: number
  imagePath: string | null
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
  /** желание + появление в списке одной транзакцией (add_wish) */
  addWish: (wish: NewWish) => Promise<void>
  /** растёт после каждого добавления — экран списка перечитывает карточки */
  wishesVersion: number
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
        'id, title, description, event_date, icon, color, cover_mode, item_count, total_price, active_count, done_count, done_sum, cover_photos, created_at',
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
      coverPhotos: Array.isArray(l.cover_photos) ? (l.cover_photos as string[]) : [],
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
  const [wishesVersion, setWishesVersion] = useState(0)

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

  // Ответы приходят не по порядку (несколько обновлений подряд) — применяем только последний
  const loadSeq = useRef(0)
  const refresh = useCallback(async () => {
    if (!userId) return
    const my = ++loadSeq.current
    const data = await load(userId)
    if (my === loadSeq.current) setState({ status: 'ready', ...data })
  }, [userId])

  // ─── Синхронизация между устройствами (D-105) ───
  // Всё, что видно на экране (сводка, обложки, счётчики, меню, сетка открытого списка), обновляется
  // одним «sync»: перечитываются общие данные и растёт wishesVersion — экран списка перечитывает карточки.
  const syncTimer = useRef<number | undefined>(undefined)
  const sync = useCallback(() => {
    window.clearTimeout(syncTimer.current)
    // пачку событий (желание + появление в списке) собираем в одно обновление
    syncTimer.current = window.setTimeout(() => {
      setWishesVersion((n) => n + 1)
      refresh().catch((e) => console.warn('Не удалось обновить данные:', e))
    }, 300)
  }, [refresh])

  // 1) Supabase Realtime: изменения таблиц, которые пользователь может видеть (RLS проверяет сервер)
  useEffect(() => {
    const db = supabase
    if (!userId || !db) return
    let wasSubscribed = false
    const channel = db
      .channel(`app-sync-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, sync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_items' }, sync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wishes' }, sync)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'list_members', filter: `user_id=eq.${userId}` },
        sync,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        sync,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // переподключились после обрыва — догоняем пропущенное
          if (wasSubscribed) sync()
          wasSubscribed = true
        }
      })
    return () => {
      window.clearTimeout(syncTimer.current)
      void db.removeChannel(channel)
    }
  }, [userId, sync])

  // 2) Возвращение в приложение (из фона на iPhone, переключение вкладки на Mac) и появление сети
  useEffect(() => {
    if (!userId) return
    let last = 0
    const onBack = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - last < 2000) return
      last = now
      sync()
    }
    document.addEventListener('visibilitychange', onBack)
    window.addEventListener('focus', onBack)
    window.addEventListener('online', onBack)
    window.addEventListener('pageshow', onBack)
    return () => {
      document.removeEventListener('visibilitychange', onBack)
      window.removeEventListener('focus', onBack)
      window.removeEventListener('online', onBack)
      window.removeEventListener('pageshow', onBack)
    }
  }, [userId, sync])

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

  const addWish = useCallback(
    async (wish: NewWish) => {
      const { error } = await supabase!.rpc('add_wish', {
        p_wish_id: wish.id,
        p_list_id: wish.listId,
        p_title: wish.title.trim(),
        p_price: wish.price,
        p_source_url: wish.sourceUrl,
        p_description: wish.description?.trim() || null,
        p_priority: wish.priority,
        p_image_path: wish.imagePath,
      })
      if (error) throw error
      setWishesVersion((n) => n + 1)
      // сводки, счётчики и коллажи — тихо; ошибка обновления не отменяет добавление
      refresh().catch((e) => console.warn('Не удалось обновить данные:', e))
    },
    [refresh],
  )

  return (
    <AppDataContext.Provider
      value={{
        ...state,
        reload,
        refresh,
        createList,
        updateList,
        deleteList,
        addWish,
        wishesVersion,
      }}
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
