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

export type ListSummary = {
  id: string
  title: string
  eventDate: string | null
  icon: ListIconName
  color: ListColor
  itemCount: number
  totalPrice: number
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

type AppDataValue = State & { reload: () => void }

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
      .select('id, title, event_date, icon, color, item_count, total_price, created_at')
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
      eventDate: l.event_date,
      icon: asListIcon(l.icon),
      color: asListColor(l.color),
      itemCount: Number(l.item_count ?? 0),
      totalPrice: Number(l.total_price ?? 0),
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

  return <AppDataContext.Provider value={{ ...state, reload }}>{children}</AppDataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData вне AppDataProvider')
  return ctx
}
