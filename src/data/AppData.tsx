import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../auth/AuthProvider.tsx'
import { asListColor, asListIcon, type ListColor, type ListIconName } from '../lib/listStyle.ts'
import { removePhotos } from '../lib/photos.ts'
import { supabase } from '../lib/supabase.ts'

export type Profile = {
  id: string
  displayName: string
  /** аватар из Google (Telegram — 003-f) */
  avatarUrl: string | null
  /** своё фото в бакете avatars — главнее avatarUrl (D-091) */
  avatarPath: string | null
  defaultListId: string | null
  /** вошёл через Telegram (003-f); ставит только сервер */
  telegramId: string | null
}

/** Изменяемые поля профиля. */
export type ProfilePatch = Partial<Pick<Profile, 'displayName' | 'avatarPath' | 'defaultListId'>>

/** Желание в корзине (trash_items): из какого списка и жив ли он. */
export type TrashItem = {
  itemId: string
  wishId: string
  title: string
  imagePath: string | null
  listId: string
  listTitle: string
  listAlive: boolean
  /** в списке есть другие участники — «Очистить» удалит и у них (D-122) */
  listShared: boolean
  deletedAt: string
  addedAt: string
  /** кто удалил, если не я (004-b) */
  deletedBy: Person | null
}

/** Имя и аватар человека (из profiles_public). */
export type Person = {
  userId: string
  name: string
  avatarUrl: string | null
  avatarPath: string | null
}

/** Раздел главной и бокового меню (D-114, D-123). */
export type ListSection = 'mine' | 'shared' | 'viewer'

export type CoverMode = 'collage' | 'icon'

export type WishStatus = 'active' | 'booked' | 'purchased' | 'gifted'

/** Исполнено: «Куплено» или «Подарили». */
// eslint-disable-next-line react-refresh/only-export-components
export function isDone(status: WishStatus) {
  return status === 'purchased' || status === 'gifted'
}

/** Желание в списке (появление list_items + поля желания). Корзина сюда не попадает. */
export type WishItem = {
  itemId: string
  listId: string
  wishId: string
  title: string
  price: number | null
  imagePath: string | null
  sourceUrl: string | null
  description: string | null
  status: WishStatus
  completedAt: string | null
  priority: number
  addedAt: string
  /** кто добавил (list_items.added_by); имя — из участников, null для неизвестных */
  addedBy: Person | null
}

/** Роль в списке (DOMAIN §4). */
export type ListRole = 'editor' | 'viewer'

/** Участник списка (004-a): имя и аватар — из profiles_public (только тех, с кем есть общий список). */
export type Member = {
  userId: string
  name: string
  avatarUrl: string | null
  avatarPath: string | null
  role: ListRole
  addedAt: string
  isMe: boolean
}

/** Ссылка-приглашение в «Участниках» (токена в базе нет — только хэш). */
export type InviteLink = {
  id: string
  role: ListRole
  createdAt: string
  expiresAt: string
}

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
  /** моя роль в списке */
  myRole: ListRole
  /** участники: сначала я, затем по дате вступления */
  members: Member[]
  /** «Мои списки» (я единственный редактор), «Совместные» (есть ещё редактор), «Со мной поделились» (я зритель) */
  section: ListSection
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

/** Поля формы желания — при добавлении и редактировании (D-088). */
export type WishFields = {
  listId: string
  title: string
  price: number | null
  sourceUrl: string | null
  description: string | null
  priority: number
  imagePath: string | null
}

/** Новое желание из формы. id задаёт клиент: под ним заранее загружено фото. */
export type NewWish = WishFields & { id: string }

/** Состояние связи Realtime — для строки в профиле. */
export type LiveStatus = 'connecting' | 'live' | 'offline'

type ListMeta = Omit<
  ListSummary,
  'itemCount' | 'totalPrice' | 'activeCount' | 'doneCount' | 'doneSum' | 'coverPhotos' | 'section'
>

/** Снимок данных пользователя: всё, что на экране, считается из него (сводки не расходятся с сеткой). */
type Snapshot = { profile: Profile; lists: ListMeta[]; items: WishItem[]; trash: TrashItem[] }

type State = { status: 'loading' } | { status: 'error' } | ({ status: 'ready' } & Snapshot)

type Ready = {
  status: 'ready'
  profile: Profile
  lists: ListSummary[]
  dashboard: Dashboard
  /** все желания всех списков пользователя (не в корзине) */
  items: WishItem[]
  /** корзина: новые удалённые первыми */
  trash: TrashItem[]
  /** сколько у меня живых списков, где я редактор (последний такой нельзя удалить или покинуть, D-082) */
  editorListCount: number
}

type AppDataValue = ({ status: 'loading' } | { status: 'error' } | Ready) & {
  /** перезагрузка со скелетонами (после ошибки) */
  reload: () => void
  /** тихое обновление после изменений — без скелетонов */
  refresh: () => Promise<void>
  /** тихо перечитать всё (несколько вызовов подряд — одно обновление) */
  sync: () => void
  liveStatus: LiveStatus
  createList: (fields: ListFields) => Promise<string>
  updateList: (id: string, fields: ListFields) => Promise<void>
  /** мягкое удаление; желания уходят в корзину (D-082). Бросает LastListError, если список последний. */
  deleteList: (id: string) => Promise<void>
  /** желание + появление в списке одной транзакцией (add_wish) */
  addWish: (wish: NewWish) => Promise<void>
  /** поля желания, приоритет и список — одной транзакцией (update_wish) */
  updateWish: (itemId: string, fields: WishFields) => Promise<void>
  setPriority: (itemId: string, priority: number) => Promise<void>
  setStatus: (itemId: string, status: WishStatus) => Promise<void>
  moveItem: (itemId: string, listId: string) => Promise<void>
  /** в корзину (D-080) */
  trashItem: (itemId: string) => Promise<void>
  /** «Отменить» после удаления */
  restoreItem: (item: WishItem) => Promise<void>
  /** «Восстановить» из корзины: на место или (если списка нет) в выбранный список */
  restoreFromTrash: (item: TrashItem, listId?: string) => Promise<void>
  /** «Очистить корзину»: навсегда, вместе с фото */
  emptyTrash: (itemIds: string[]) => Promise<void>
  updateProfile: (patch: ProfilePatch) => Promise<void>
  /** растёт при каждом применённом обновлении данных — повод перечитать то, чего нет в снимке (ссылки) */
  dataVersion: number
  // ─── Участники и приглашения (004-a) ───
  createInvite: (
    listId: string,
    role: ListRole,
  ) => Promise<{ id: string; token: string; expiresAt: string }>
  fetchInvites: (listId: string) => Promise<InviteLink[]>
  revokeInvite: (inviteId: string) => Promise<void>
  /** принять по токену → id списка */
  acceptInvite: (token: string) => Promise<string>
  setMemberRole: (listId: string, userId: string, role: ListRole) => Promise<void>
  removeMember: (listId: string, userId: string) => Promise<void>
  /** выйти; если я последний редактор — список удаляется у всех ('deleted'). Бросает LastListError. */
  leaveList: (listId: string) => Promise<'left' | 'deleted'>
  /** этот список пропадёт из-за моего действия — без тоста «Вас убрали» */
  expectGone: (listId: string) => void
  /** был ли список помечен expectGone (и снять пометку) */
  takeExpectedGone: (listId: string) => boolean
}

// eslint-disable-next-line react-refresh/only-export-components
export class LastListError extends Error {
  constructor(message = 'Нельзя удалить единственный список') {
    super(message)
  }
}

type MemberRow = { list_id: string; user_id: string; role: ListRole; added_at: string }
type PublicProfile = {
  id: string
  display_name: string
  avatar_url: string | null
  avatar_path: string | null
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

type TrashRow = {
  list_shared: boolean
  deleted_by: string | null
  deleted_by_name: string | null
  deleted_by_avatar_url: string | null
  deleted_by_avatar_path: string | null
  item_id: string
  wish_id: string
  title: string
  image_path: string | null
  list_id: string
  list_title: string
  list_alive: boolean
  deleted_at: string
  added_at: string
}

type ItemRow = {
  id: string
  list_id: string
  added_by: string | null
  priority: number
  added_at: string
  wish: {
    id: string
    title: string
    price: number | null
    image_path: string | null
    source_url: string | null
    description: string | null
    status: WishStatus
    completed_at: string | null
  } | null
}

const AppDataContext = createContext<AppDataValue | null>(null)

/** Профиль, списки, все желания и корзина — запросы одновременно, результат применяется целиком. */
async function load(userId: string): Promise<Snapshot> {
  const db = supabase!
  const [profileRes, listsRes, itemsRes, trashRes, membersRes, peopleRes] = await Promise.all([
    db
      .from('profiles')
      .select('id, display_name, avatar_url, avatar_path, default_list_id, telegram_id')
      .eq('id', userId)
      .single(),
    // удалённые списки RLS не отдаёт
    db
      .from('lists')
      .select('id, title, description, event_date, icon, color, cover_mode, created_at')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
    db
      .from('list_items')
      .select(
        'id, list_id, priority, added_at, added_by, wish:wishes!inner(id, title, price, image_path, source_url, description, status, completed_at)',
      )
      .is('deleted_at', null)
      .order('added_at', { ascending: false })
      .order('id', { ascending: true }),
    // корзина — с названиями удалённых списков, которые lists не отдаёт
    db.rpc('trash_items'),
    // участники всех моих списков (RLS: состав видят участники) и их имена/аватары
    db.from('list_members').select('list_id, user_id, role, added_at'),
    db.rpc('profiles_public'),
  ])
  if (profileRes.error) throw profileRes.error
  if (listsRes.error) throw listsRes.error
  if (itemsRes.error) throw itemsRes.error
  if (trashRes.error) throw trashRes.error
  if (membersRes.error) throw membersRes.error
  if (peopleRes.error) throw peopleRes.error

  const people = new Map(((peopleRes.data ?? []) as PublicProfile[]).map((x) => [x.id, x]))
  const membersByList = new Map<string, Member[]>()
  for (const m of (membersRes.data ?? []) as MemberRow[]) {
    const pp = people.get(m.user_id)
    const arr = membersByList.get(m.list_id) ?? []
    arr.push({
      userId: m.user_id,
      name: pp?.display_name || 'Участник',
      avatarUrl: pp?.avatar_url ?? null,
      avatarPath: pp?.avatar_path ?? null,
      role: m.role === 'viewer' ? 'viewer' : 'editor',
      addedAt: m.added_at,
      isMe: m.user_id === userId,
    })
    membersByList.set(m.list_id, arr)
  }
  for (const arr of membersByList.values()) {
    arr.sort((a, b) =>
      a.isMe !== b.isMe
        ? a.isMe
          ? -1
          : 1
        : a.addedAt < b.addedAt
          ? -1
          : a.addedAt > b.addedAt
            ? 1
            : 0,
    )
  }

  const p = profileRes.data
  const lists = listsRes.data.map((l): ListMeta => ({
    id: l.id,
    title: l.title,
    description: l.description,
    eventDate: l.event_date,
    icon: asListIcon(l.icon),
    color: asListColor(l.color),
    coverMode: l.cover_mode === 'icon' ? 'icon' : 'collage',
    members: membersByList.get(l.id) ?? [],
    myRole: membersByList.get(l.id)?.find((m) => m.isMe)?.role ?? 'editor',
  }))
  const alive = new Set(lists.map((l) => l.id))
  const items = ((itemsRes.data ?? []) as unknown as ItemRow[])
    .filter((r) => r.wish && alive.has(r.list_id))
    .map((r): WishItem => ({
      itemId: r.id,
      listId: r.list_id,
      wishId: r.wish!.id,
      title: r.wish!.title,
      price: r.wish!.price,
      imagePath: r.wish!.image_path,
      sourceUrl: r.wish!.source_url,
      description: r.wish!.description,
      status: r.wish!.status,
      completedAt: r.wish!.completed_at,
      priority: r.priority,
      addedAt: r.added_at,
      addedBy: r.added_by ? toPerson(r.added_by, people.get(r.added_by)) : null,
    }))
  return {
    profile: {
      id: p.id,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      avatarPath: p.avatar_path,
      defaultListId: p.default_list_id,
      telegramId: p.telegram_id == null ? null : String(p.telegram_id),
    },
    lists,
    items,
    trash: ((trashRes.data ?? []) as TrashRow[]).map((t): TrashItem => ({
      itemId: t.item_id,
      wishId: t.wish_id,
      title: t.title,
      imagePath: t.image_path,
      listId: t.list_id,
      listTitle: t.list_title,
      listAlive: t.list_alive,
      listShared: t.list_shared,
      deletedAt: t.deleted_at,
      addedAt: t.added_at,
      deletedBy: t.deleted_by
        ? {
            userId: t.deleted_by,
            name: t.deleted_by_name || 'Участник',
            avatarUrl: t.deleted_by_avatar_url,
            avatarPath: t.deleted_by_avatar_path,
          }
        : null,
    })),
  }
}

function toPerson(userId: string, pp: PublicProfile | undefined): Person {
  return {
    userId,
    name: pp?.display_name || 'Участник',
    avatarUrl: pp?.avatar_url ?? null,
    avatarPath: pp?.avatar_path ?? null,
  }
}

/** Раздел списка по составу: зритель → «Со мной поделились»; есть ещё редактор → «Совместные». */
function sectionOf(l: { myRole: ListRole; members: Member[] }): ListSection {
  if (l.myRole === 'viewer') return 'viewer'
  return l.members.some((m) => !m.isMe && m.role === 'editor') ? 'shared' : 'mine'
}

/** Новые первыми; при равной дате — по id (как в базе). */
function byAddedDesc(a: WishItem, b: WishItem) {
  if (a.addedAt !== b.addedAt) return a.addedAt < b.addedAt ? 1 : -1
  return a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0
}

/**
 * Сводки считаются из того же снимка, что и сетка (раньше — отдельными запросами, и они расходились).
 * Правила те же, что были в list_overview и dashboard_summary (DOMAIN §6):
 * список — карточки не в корзине; «Активные» — не исполненные; главная — желание считается один раз,
 * «Исполнено» — за текущий год по местному времени.
 */
function derive(s: Snapshot): Omit<Ready, 'status' | 'profile'> {
  const byList = new Map<string, WishItem[]>()
  for (const it of s.items) {
    const arr = byList.get(it.listId)
    if (arr) arr.push(it)
    else byList.set(it.listId, [it])
  }
  const lists = s.lists.map((l): ListSummary => {
    const items = byList.get(l.id) ?? []
    let activeCount = 0
    let totalPrice = 0
    let doneCount = 0
    let doneSum = 0
    for (const it of items) {
      if (isDone(it.status)) {
        doneCount++
        doneSum += it.price ?? 0
      } else {
        activeCount++
        totalPrice += it.price ?? 0
      }
    }
    const coverPhotos = items
      .filter((it) => it.imagePath)
      .sort(byAddedDesc)
      .slice(0, 4)
      .map((it) => it.imagePath!)
    return {
      ...l,
      itemCount: items.length,
      activeCount,
      totalPrice,
      doneCount,
      doneSum,
      coverPhotos,
      section: sectionOf(l),
    }
  })

  const year = new Date().getFullYear()
  const seen = new Set<string>()
  const dashboard: Dashboard = {
    activeCount: 0,
    activeSum: 0,
    doneYear: year,
    doneCount: 0,
    doneSum: 0,
  }
  // сводка — по спискам, где я редактор (мои и совместные), без «Со мной поделились» (D-117)
  const editorLists = new Set(s.lists.filter((l) => l.myRole === 'editor').map((l) => l.id))
  for (const it of s.items) {
    if (!editorLists.has(it.listId)) continue
    if (seen.has(it.wishId)) continue
    seen.add(it.wishId)
    if (!isDone(it.status)) {
      dashboard.activeCount++
      dashboard.activeSum += it.price ?? 0
    } else if (it.completedAt && new Date(it.completedAt).getFullYear() === year) {
      dashboard.doneCount++
      dashboard.doneSum += it.price ?? 0
    }
  }
  const editorListCount = s.lists.filter((l) => l.myRole === 'editor').length
  return { lists, dashboard, items: s.items, trash: s.trash, editorListCount }
}

/** Изменить одно желание в снимке. */
function patchItem(itemId: string, patch: (it: WishItem) => WishItem) {
  return (s: Snapshot): Snapshot => ({
    ...s,
    items: s.items.map((it) => (it.itemId === itemId ? patch(it) : it)),
  })
}

/** Ошибка RPC/запроса → исключение; «0 строк изменено» (нет прав или уже удалено) — тоже ошибка. */
function check({ error, data }: { error: unknown; data?: unknown[] | null }, expectRows = false) {
  if (error) throw error
  if (expectRows && (!data || data.length === 0))
    throw new Error('Нет доступа или строка не найдена')
}

/** Данные вошедшего пользователя для боковой панели, шапки, главной и экрана списка. */
export function AppDataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('connecting')
  const [dataVersion, setDataVersion] = useState(0)
  // списки, которые пропадут из-за моего действия (выход, удаление) — без тоста «Вас убрали»
  const expected = useRef(new Set<string>())

  // Ответы приходят не по порядку, а изменения применяются сразу (не дожидаясь сервера).
  // Номер запроса растёт при каждой загрузке и в начале/конце каждого изменения: применяется только
  // ответ, после запроса которого ничего не менялось, — старый ответ не затрёт свежее изменение.
  const seq = useRef(0)
  const mutating = useRef(0)
  const lastSyncAt = useRef(0)

  useEffect(() => {
    if (!userId) return
    let alive = true
    const my = ++seq.current
    load(userId)
      .then((data) => {
        if (!alive || my !== seq.current) return
        lastSyncAt.current = Date.now()
        setState({ status: 'ready', ...data })
        setDataVersion((n) => n + 1)
        setDataVersion((n) => n + 1)
      })
      .catch((e) => {
        console.warn('Не удалось загрузить данные:', e)
        if (alive) setState((s) => (s.status === 'ready' ? s : { status: 'error' }))
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
    const my = ++seq.current
    const data = await load(userId)
    if (my !== seq.current || mutating.current > 0) return
    lastSyncAt.current = Date.now()
    setState({ status: 'ready', ...data })
  }, [userId])

  // ─── Синхронизация между устройствами (D-105) ───
  const syncTimer = useRef<number | undefined>(undefined)
  const sync = useCallback(() => {
    window.clearTimeout(syncTimer.current)
    // пачку событий (желание + появление в списке) собираем в одно обновление
    syncTimer.current = window.setTimeout(() => {
      refresh().catch((e) => console.warn('Не удалось обновить данные:', e))
    }, 300)
  }, [refresh])

  // 1) Supabase Realtime: изменения строк, которые пользователь может видеть (RLS проверяет сервер).
  //    Канал пересоздаётся сам при ошибке, тайм-ауте или закрытии сервером (например, когда истёк токен
  //    у «уснувшего» iPhone), а при возвращении в приложение — если он не на связи.
  const reconnectRef = useRef<() => void>(() => {})
  useEffect(() => {
    const db = supabase
    if (!userId || !db) return
    let disposed = false
    let channel: ReturnType<typeof db.channel> | null = null
    let retryTimer: number | undefined
    let failures = 0
    let everSubscribed = false
    let n = 0

    const connect = () => {
      window.clearTimeout(retryTimer)
      if (channel) void db.removeChannel(channel)
      setLiveStatus('connecting')
      const ch = db
        .channel(`app-sync-${userId}-${++n}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, sync)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'list_items' }, sync)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wishes' }, sync)
        // весь состав: кто-то принял приглашение, сменили роль, убрали (Realtime сам проверяет RLS)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'list_members' }, sync)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invites' }, sync)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
          sync,
        )
      channel = ch
      ch.subscribe((status, err) => {
        if (disposed || channel !== ch) return
        if (status === 'SUBSCRIBED') {
          failures = 0
          setLiveStatus('live')
          // (пере)подключились — догоняем то, что могли пропустить
          if (everSubscribed) sync()
          everSubscribed = true
        } else {
          // CHANNEL_ERROR / TIMED_OUT / CLOSED — пересоздаём канал с паузой 1, 2, 4… до 30 с
          if (err) console.warn('Realtime:', status, err)
          setLiveStatus('offline')
          window.clearTimeout(retryTimer)
          retryTimer = window.setTimeout(connect, Math.min(30_000, 1000 * 2 ** failures++))
        }
      })
    }

    reconnectRef.current = () => {
      if (disposed) return
      const healthy = channel?.state === 'joined' && db.realtime.isConnected()
      if (!healthy) {
        failures = 0
        connect()
      }
    }

    connect()
    return () => {
      disposed = true
      window.clearTimeout(retryTimer)
      window.clearTimeout(syncTimer.current)
      if (channel) void db.removeChannel(channel)
      reconnectRef.current = () => {}
    }
  }, [userId, sync])

  const liveRef = useRef(liveStatus)
  useEffect(() => {
    liveRef.current = liveStatus
  }, [liveStatus])

  // 2) Возвращение в приложение (из фона на iPhone, переключение вкладки на Mac) и появление сети:
  //    перечитать всё и проверить канал. 3) Страховка: пока приложение на экране, раз в 30 с проверяем
  //    канал; если он не на связи или данные не обновлялись 2 минуты — перечитываем.
  useEffect(() => {
    if (!userId) return
    let last = 0
    const onBack = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - last < 2000) return
      last = now
      reconnectRef.current()
      sync()
    }
    const tick = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      reconnectRef.current()
      const stale = Date.now() - lastSyncAt.current > 120_000
      if (stale || liveRef.current !== 'live') sync()
    }, 30_000)
    document.addEventListener('visibilitychange', onBack)
    window.addEventListener('focus', onBack)
    window.addEventListener('online', onBack)
    window.addEventListener('pageshow', onBack)
    return () => {
      window.clearInterval(tick)
      document.removeEventListener('visibilitychange', onBack)
      window.removeEventListener('focus', onBack)
      window.removeEventListener('online', onBack)
      window.removeEventListener('pageshow', onBack)
    }
  }, [userId, sync])

  /**
   * Изменение: сразу на экране (все сводки пересчитываются из того же снимка), затем запрос к базе,
   * затем тихая сверка с базой. При ошибке сверка вернёт как было, а ошибка уходит вызывающему (тост).
   */
  const mutate = useCallback(
    async (apply: (s: Snapshot) => Snapshot, run: () => Promise<void>) => {
      mutating.current++
      seq.current++
      setState((s) => (s.status === 'ready' ? { status: 'ready', ...apply(s) } : s))
      try {
        await run()
      } finally {
        mutating.current--
        seq.current++
        refresh().catch((e) => console.warn('Не удалось обновить данные:', e))
      }
    },
    [refresh],
  )

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
    expected.current.add(id)
    const { error } = await supabase!.rpc('delete_list', { p_list_id: id })
    if (error) {
      expected.current.delete(id)
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
      // карточка, сводки, счётчики и коллажи — одним обновлением; его ошибка не отменяет добавление
      await refresh().catch((e) => console.warn('Не удалось обновить данные:', e))
    },
    [refresh],
  )

  const updateWish = useCallback(
    (itemId: string, f: WishFields) =>
      mutate(
        patchItem(itemId, (it) => ({
          ...it,
          listId: f.listId,
          title: f.title.trim(),
          price: f.price,
          sourceUrl: f.sourceUrl,
          description: f.description?.trim() || null,
          priority: f.priority,
          imagePath: f.imagePath,
        })),
        async () => {
          const { error } = await supabase!.rpc('update_wish', {
            p_item_id: itemId,
            p_list_id: f.listId,
            p_title: f.title.trim(),
            p_price: f.price,
            p_source_url: f.sourceUrl,
            p_description: f.description?.trim() || null,
            p_priority: f.priority,
            p_image_path: f.imagePath,
          })
          if (error) throw error
        },
      ),
    [mutate],
  )

  const setPriority = useCallback(
    (itemId: string, priority: number) =>
      mutate(
        patchItem(itemId, (it) => ({ ...it, priority })),
        async () =>
          check(
            await supabase!.from('list_items').update({ priority }).eq('id', itemId).select('id'),
            true,
          ),
      ),
    [mutate],
  )

  const setStatus = useCallback(
    (itemId: string, status: WishStatus) => {
      const wishId =
        state.status === 'ready' ? state.items.find((it) => it.itemId === itemId)?.wishId : null
      if (!wishId) return Promise.reject(new Error('Желание не найдено'))
      return mutate(
        // completed_at ставит и сбрасывает база; здесь — только чтобы сводка главной сразу была верной
        (s) => ({
          ...s,
          items: s.items.map((it) =>
            it.wishId !== wishId
              ? it
              : {
                  ...it,
                  status,
                  completedAt: !isDone(status)
                    ? null
                    : isDone(it.status)
                      ? it.completedAt
                      : new Date().toISOString(),
                },
          ),
        }),
        async () =>
          check(
            await supabase!.from('wishes').update({ status }).eq('id', wishId).select('id'),
            true,
          ),
      )
    },
    [mutate, state],
  )

  const moveItem = useCallback(
    (itemId: string, listId: string) =>
      mutate(
        patchItem(itemId, (it) => ({ ...it, listId })),
        async () =>
          check(
            await supabase!
              .from('list_items')
              .update({ list_id: listId })
              .eq('id', itemId)
              .select('id'),
            true,
          ),
      ),
    [mutate],
  )

  const trashItem = useCallback(
    (itemId: string) =>
      mutate(
        (s) => {
          const it = s.items.find((x) => x.itemId === itemId)
          const list = it ? s.lists.find((l) => l.id === it.listId) : undefined
          const trashed: TrashItem[] =
            it && list
              ? [
                  {
                    itemId,
                    wishId: it.wishId,
                    title: it.title,
                    imagePath: it.imagePath,
                    listId: it.listId,
                    listTitle: list.title,
                    listAlive: true,
                    listShared: list.members.length > 1,
                    deletedAt: new Date().toISOString(),
                    addedAt: it.addedAt,
                    deletedBy: null,
                  },
                ]
              : []
          return {
            ...s,
            items: s.items.filter((x) => x.itemId !== itemId),
            trash: [...trashed, ...s.trash.filter((t) => t.itemId !== itemId)],
          }
        },
        async () => {
          const { error } = await supabase!.rpc('trash_list_item', { p_item_id: itemId })
          if (error) throw error
        },
      ),
    [mutate],
  )

  const restoreItem = useCallback(
    (item: WishItem) =>
      mutate(
        (s) => ({
          ...s,
          items: s.items.some((it) => it.itemId === item.itemId) ? s.items : [...s.items, item],
          trash: s.trash.filter((t) => t.itemId !== item.itemId),
        }),
        async () => {
          const { error } = await supabase!.rpc('restore_list_item', { p_item_id: item.itemId })
          if (error) throw error
        },
      ),
    [mutate],
  )

  const restoreFromTrash = useCallback(
    (t: TrashItem, listId?: string) =>
      mutate(
        // на экране сразу убираем из корзины; в сетку желание вернёт сверка с базой
        (s) => ({ ...s, trash: s.trash.filter((x) => x.itemId !== t.itemId) }),
        async () => {
          const { error } =
            listId && listId !== t.listId
              ? await supabase!.rpc('restore_list_item_to', {
                  p_item_id: t.itemId,
                  p_list_id: listId,
                })
              : await supabase!.rpc('restore_list_item', { p_item_id: t.itemId })
          if (error) throw error
        },
      ),
    [mutate],
  )

  const emptyTrash = useCallback(
    (itemIds: string[]) =>
      mutate(
        (s) => ({ ...s, trash: s.trash.filter((t) => !itemIds.includes(t.itemId)) }),
        async () => {
          const { data, error } = await supabase!.rpc('empty_trash', { p_item_ids: itemIds })
          if (error) throw error
          // файлы удалённых навсегда желаний; что не удалится — подберёт ночная уборка (storage-cleanup)
          removePhotos(((data ?? []) as string[]).filter(Boolean))
        },
      ),
    [mutate],
  )

  const updateProfile = useCallback(
    (patch: ProfilePatch) =>
      mutate(
        (s) => ({
          ...s,
          profile: {
            ...s.profile,
            ...patch,
            ...(patch.displayName !== undefined ? { displayName: patch.displayName.trim() } : {}),
          },
        }),
        async () => {
          const row: Record<string, string | null> = {}
          if (patch.displayName !== undefined) row.display_name = patch.displayName.trim()
          if (patch.avatarPath !== undefined) row.avatar_path = patch.avatarPath
          if (patch.defaultListId !== undefined) row.default_list_id = patch.defaultListId
          check(await supabase!.from('profiles').update(row).eq('id', userId!).select('id'), true)
        },
      ),
    [mutate, userId],
  )

  // ─── Участники и приглашения (004-a) ───

  const createInvite = useCallback(async (listId: string, role: ListRole) => {
    const { data, error } = await supabase!.rpc('create_invite', {
      p_list_id: listId,
      p_role: role,
    })
    if (error) throw error
    const row = (data as { invite_id: string; token: string; expires_at: string }[])[0]
    if (!row) throw new Error('create_invite: пустой ответ')
    return { id: row.invite_id, token: row.token, expiresAt: row.expires_at }
  }, [])

  const fetchInvites = useCallback(async (listId: string): Promise<InviteLink[]> => {
    const { data, error } = await supabase!
      .from('invites')
      .select('id, role, created_at, expires_at')
      .eq('list_id', listId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((r) => ({
      id: r.id,
      role: r.role === 'viewer' ? 'viewer' : 'editor',
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    }))
  }, [])

  const revokeInvite = useCallback(async (inviteId: string) => {
    const { error } = await supabase!.rpc('revoke_invite', { p_invite_id: inviteId })
    if (error) throw error
  }, [])

  const acceptInvite = useCallback(
    async (token: string) => {
      const { data, error } = await supabase!.rpc('accept_invite', { p_token: token })
      if (error) throw error
      await refresh().catch((e) => console.warn('Не удалось обновить данные:', e))
      return data as string
    },
    [refresh],
  )

  const patchMembers =
    (listId: string, f: (m: Member[]) => Member[]) =>
    (s: Snapshot): Snapshot => ({
      ...s,
      lists: s.lists.map((l) => (l.id === listId ? { ...l, members: f(l.members) } : l)),
    })

  const setMemberRole = useCallback(
    (listId: string, userId: string, role: ListRole) =>
      mutate(
        patchMembers(listId, (ms) => ms.map((m) => (m.userId === userId ? { ...m, role } : m))),
        async () => {
          const { error } = await supabase!.rpc('set_member_role', {
            p_list_id: listId,
            p_user_id: userId,
            p_role: role,
          })
          if (error) throw error
        },
      ),
    [mutate],
  )

  const removeMember = useCallback(
    (listId: string, userId: string) =>
      mutate(
        patchMembers(listId, (ms) => ms.filter((m) => m.userId !== userId)),
        async () => {
          const { error } = await supabase!.rpc('remove_member', {
            p_list_id: listId,
            p_user_id: userId,
          })
          if (error) throw error
        },
      ),
    [mutate],
  )

  const leaveList = useCallback(async (listId: string) => {
    expected.current.add(listId)
    const { data, error } = await supabase!.rpc('leave_list', { p_list_id: listId })
    if (error) {
      expected.current.delete(listId)
      if (error.message.includes('last_list'))
        throw new LastListError('Нельзя выйти из единственного списка')
      throw error
    }
    // обновление данных — после перехода на главную (его делает вызывающий)
    return data === 'deleted' ? 'deleted' : 'left'
  }, [])

  const expectGone = useCallback((listId: string) => {
    expected.current.add(listId)
  }, [])
  const takeExpectedGone = useCallback((listId: string) => expected.current.delete(listId), [])

  const derived = useMemo(() => (state.status === 'ready' ? derive(state) : null), [state])

  const base =
    state.status === 'ready' && derived
      ? ({ status: 'ready', profile: state.profile, ...derived } satisfies Ready)
      : state.status === 'ready'
        ? ({ status: 'loading' } as const)
        : state

  return (
    <AppDataContext.Provider
      value={{
        ...base,
        reload,
        refresh,
        sync,
        liveStatus,
        createList,
        updateList,
        deleteList,
        addWish,
        updateWish,
        setPriority,
        setStatus,
        moveItem,
        trashItem,
        restoreItem,
        restoreFromTrash,
        emptyTrash,
        updateProfile,
        dataVersion,
        createInvite,
        fetchInvites,
        revokeInvite,
        acceptInvite,
        setMemberRole,
        removeMember,
        leaveList,
        expectGone,
        takeExpectedGone,
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
