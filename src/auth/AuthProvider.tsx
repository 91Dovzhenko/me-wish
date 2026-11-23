import type { Session } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase.ts'

export type AuthStatus =
  | 'initializing' // читаем сохранённую сессию
  | 'exchanging' // вернулись из Google, получаем сессию («Входим…»)
  | 'signedOut'
  | 'signedIn'
  | 'error' // вход не удался

type AuthValue = {
  status: AuthStatus
  session: Session | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

// ── Разбор адреса после возврата из Google. Выполняется один раз при загрузке модуля,
// до того как React Router прочитает адрес, — служебные параметры сразу убираются из строки.
type Callback =
  { kind: 'none' } | { kind: 'code'; code: string } | { kind: 'error'; message: string }

function readCallback(): Callback {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const error =
    url.searchParams.get('error_description') ??
    url.searchParams.get('error') ??
    hash.get('error_description') ??
    hash.get('error')
  const code = url.searchParams.get('code')
  if (!error && !code) return { kind: 'none' }

  for (const key of ['code', 'error', 'error_code', 'error_description', 'state']) {
    url.searchParams.delete(key)
  }
  const cleanHash = hash.has('error') ? '' : url.hash
  window.history.replaceState(window.history.state, '', url.pathname + url.search + cleanHash)

  if (error) return { kind: 'error', message: error }
  return { kind: 'code', code: code! }
}

const callback = readCallback()

// Обмен кода — один раз даже при двойном запуске эффектов в StrictMode
let exchangePromise: Promise<Session | null> | null = null
function exchangeOnce(code: string): Promise<Session | null> {
  if (!exchangePromise) {
    exchangePromise = supabase!.auth.exchangeCodeForSession(code).then(({ data, error }) => {
      if (error) throw error
      return data.session
    })
  }
  return exchangePromise
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (!supabase) return 'signedOut'
    if (callback.kind === 'error') return 'error'
    if (callback.kind === 'code') return 'exchanging'
    return 'initializing'
  })

  useEffect(() => {
    if (!supabase) return
    let alive = true

    if (callback.kind === 'code') {
      exchangeOnce(callback.code)
        .then((s) => {
          if (!alive) return
          setSession(s)
          setStatus(s ? 'signedIn' : 'error')
        })
        .catch((e) => {
          console.warn('Вход через Google не завершён:', e)
          if (alive) setStatus('error')
        })
    } else if (callback.kind === 'none') {
      supabase.auth.getSession().then(({ data }) => {
        if (!alive) return
        setSession(data.session)
        setStatus(data.session ? 'signedIn' : 'signedOut')
      })
    } else {
      console.warn('Вход через Google отклонён:', callback.message)
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!alive) return
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setStatus('signedOut')
      } else if (
        s &&
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')
      ) {
        setSession(s)
        setStatus('signedIn')
      }
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      setStatus('error')
      return
    }
    // Возврат в приложение с учётом базового пути GitHub Pages: …/me-wish/
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, queryParams: { prompt: 'select_account' } },
    })
    if (error) {
      console.warn('Не удалось начать вход через Google:', error)
      setStatus('error')
    }
    // при успехе браузер уходит на страницу Google
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setSession(null)
    setStatus('signedOut')
  }, [])

  const value = useMemo(
    () => ({ status, session, signInWithGoogle, signOut }),
    [status, session, signInWithGoogle, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth вне AuthProvider')
  return ctx
}
