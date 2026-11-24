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
import {
  exchangeTelegram,
  readTelegramCallback,
  startTelegramLogin,
  type TelegramAuthData,
} from './telegram.ts'

export type AuthStatus =
  | 'initializing' // читаем сохранённую сессию
  | 'exchanging' // вернулись из Google или Telegram, получаем сессию («Входим…»)
  | 'signedOut'
  | 'signedIn'
  | 'error' // вход не удался

export type LoginMethod = 'google' | 'telegram'

type AuthValue = {
  status: AuthStatus
  session: Session | null
  /** чем входили в последний раз — для «Попробовать ещё раз» */
  lastMethod: LoginMethod
  signInWithGoogle: () => Promise<void>
  signInWithTelegram: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

// ── Разбор адреса после возврата из Google или Telegram. Выполняется один раз при загрузке модуля,
// до того как React Router прочитает адрес, — служебные параметры сразу убираются из строки.
type Callback =
  | { kind: 'none' }
  | { kind: 'code'; code: string }
  | { kind: 'telegram'; data: TelegramAuthData }
  | { kind: 'error'; message: string; method: LoginMethod }

function readCallback(): Callback {
  const tg = readTelegramCallback()
  if (tg === 'refused')
    return { kind: 'error', message: 'telegram: отказ или пустой ответ', method: 'telegram' }
  if (tg) return { kind: 'telegram', data: tg }

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

  if (error) return { kind: 'error', message: error, method: 'google' }
  return { kind: 'code', code: code! }
}

const callback = readCallback()

// Обмен кода (Google) или данных Telegram — один раз даже при двойном запуске эффектов в StrictMode
let exchangePromise: Promise<Session | null> | null = null
function exchangeOnce(cb: Callback): Promise<Session | null> {
  if (!exchangePromise) {
    exchangePromise =
      cb.kind === 'telegram'
        ? exchangeTelegram(cb.data)
        : supabase!.auth
            .exchangeCodeForSession(cb.kind === 'code' ? cb.code : '')
            .then(({ data, error }) => {
              if (error) throw error
              return data.session
            })
  }
  return exchangePromise
}

const LAST_METHOD_KEY = 'me-wish:login-method'
function initialMethod(): LoginMethod {
  if (callback.kind === 'telegram') return 'telegram'
  if (callback.kind === 'error') return callback.method
  try {
    return localStorage.getItem(LAST_METHOD_KEY) === 'telegram' ? 'telegram' : 'google'
  } catch {
    return 'google'
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [lastMethod, setLastMethod] = useState<LoginMethod>(initialMethod)
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (!supabase) return 'signedOut'
    if (callback.kind === 'error') return 'error'
    if (callback.kind === 'code' || callback.kind === 'telegram') return 'exchanging'
    return 'initializing'
  })

  useEffect(() => {
    if (!supabase) return
    let alive = true

    if (callback.kind === 'code' || callback.kind === 'telegram') {
      const who = callback.kind === 'code' ? 'Google' : 'Telegram'
      exchangeOnce(callback)
        .then((s) => {
          if (!alive) return
          setSession(s)
          setStatus(s ? 'signedIn' : 'error')
        })
        .catch((e) => {
          console.warn(`Вход через ${who} не завершён:`, e)
          if (alive) setStatus('error')
        })
    } else if (callback.kind === 'none') {
      supabase.auth.getSession().then(({ data }) => {
        if (!alive) return
        setSession(data.session)
        setStatus(data.session ? 'signedIn' : 'signedOut')
      })
    } else {
      console.warn('Вход отклонён:', callback.message)
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

  const remember = (m: LoginMethod) => {
    setLastMethod(m)
    try {
      localStorage.setItem(LAST_METHOD_KEY, m)
    } catch {
      /* приватный режим — не страшно */
    }
  }

  const signInWithTelegram = useCallback(() => {
    remember('telegram')
    // браузер уходит на oauth.telegram.org и возвращается с #tgAuthResult=…
    if (!startTelegramLogin()) setStatus('error')
  }, [])

  const signInWithGoogle = useCallback(async () => {
    remember('google')
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
    () => ({ status, session, lastMethod, signInWithGoogle, signInWithTelegram, signOut }),
    [status, session, lastMethod, signInWithGoogle, signInWithTelegram, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth вне AuthProvider')
  return ctx
}
