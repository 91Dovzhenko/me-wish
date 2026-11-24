import type { Session } from '@supabase/supabase-js'
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
import { supabase } from '../lib/supabase.ts'
import {
  createTelegramLogin,
  finishTelegram,
  loadActiveLogin,
  openTelegram,
  pollTelegram,
  saveActiveLogin,
  type TelegramLogin,
} from './telegram.ts'

export type AuthStatus =
  | 'initializing' // читаем сохранённую сессию
  | 'telegramWaiting' // открыли бота, ждём «Start» («Подтвердите вход в Telegram…»)
  | 'exchanging' // вернулись из Google или бот подтвердил вход, получаем сессию («Входим…»)
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
  /** создать запрос на вход заранее, чтобы нажатие сразу открыло Telegram (iOS требует открытия по нажатию) */
  prepareTelegram: () => void
  signInWithTelegram: () => void
  /** «Открыть Telegram ещё раз» */
  reopenTelegram: () => void
  /** «Отмена» ожидания */
  cancelTelegram: () => void
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

// Обмен кода Google — один раз даже при двойном запуске эффектов в StrictMode
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

const LAST_METHOD_KEY = 'me-wish:login-method'
function initialMethod(): LoginMethod {
  if (callback.kind !== 'none') return 'google'
  try {
    return localStorage.getItem(LAST_METHOD_KEY) === 'telegram' ? 'telegram' : 'google'
  } catch {
    return 'google'
  }
}

/** Запрос годится для нового нажатия, если до конца срока больше 2 минут. */
const fresh = (l: TelegramLogin | null): l is TelegramLogin =>
  !!l && l.expiresAt - Date.now() > 2 * 60_000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [lastMethod, setLastMethod] = useState<LoginMethod>(initialMethod)
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (!supabase) return 'signedOut'
    if (callback.kind === 'error') return 'error'
    if (callback.kind === 'code') return 'exchanging'
    return 'initializing'
  })

  // Telegram: запрос, который ждёт «Start» (переживает перезагрузку), и заготовка для следующего нажатия
  const active = useRef<TelegramLogin | null>(null)
  const prepared = useRef<TelegramLogin | null>(null)
  const preparing = useRef<Promise<TelegramLogin> | null>(null)

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
        if (data.session) {
          saveActiveLogin(null)
          setStatus('signedIn')
          return
        }
        // iOS мог выгрузить приложение, пока пользователь был в Telegram — продолжаем ждать
        const waiting = loadActiveLogin()
        if (waiting) {
          active.current = waiting
          setStatus('telegramWaiting')
        } else setStatus('signedOut')
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

  const remember = (m: LoginMethod) => {
    setLastMethod(m)
    try {
      localStorage.setItem(LAST_METHOD_KEY, m)
    } catch {
      /* приватный режим — не страшно */
    }
  }

  // ─── Вход через Telegram-бота (003-f2) ───

  const prepareTelegram = useCallback(() => {
    if (!supabase || fresh(prepared.current) || preparing.current) return
    preparing.current = createTelegramLogin()
    preparing.current
      .then((l) => {
        prepared.current = l
      })
      .catch((e) => console.warn('Не удалось подготовить вход через Telegram:', e))
      .finally(() => {
        preparing.current = null
      })
  }, [])

  const startWaiting = useCallback((l: TelegramLogin) => {
    active.current = l
    saveActiveLogin(l)
    setStatus('telegramWaiting')
  }, [])

  const signInWithTelegram = useCallback(() => {
    remember('telegram')
    const ready = prepared.current
    if (fresh(ready)) {
      // запрос готов — открываем Telegram прямо в обработчике нажатия
      prepared.current = null
      openTelegram(ready.code)
      startWaiting(ready)
      return
    }
    // запроса ещё нет (медленная сеть) — создаём; Telegram откроет кнопка «Открыть Telegram ещё раз»
    // на экране ожидания, если браузер не разрешит открыть его без нажатия
    setStatus('exchanging')
    ;(preparing.current ?? createTelegramLogin())
      .then((l) => {
        prepared.current = null
        startWaiting(l)
        openTelegram(l.code)
      })
      .catch((e) => {
        console.warn('Не удалось начать вход через Telegram:', e)
        setStatus('error')
      })
  }, [startWaiting])

  const reopenTelegram = useCallback(() => {
    if (active.current) openTelegram(active.current.code)
  }, [])

  const cancelTelegram = useCallback(() => {
    active.current = null
    saveActiveLogin(null)
    setStatus('signedOut')
  }, [])

  // Ожидание подтверждения: опрос раз в 1,5 с, сразу при возвращении в приложение; через 10 минут — ошибка
  useEffect(() => {
    if (status !== 'telegramWaiting') return
    let alive = true
    let busy = false

    const fail = () => {
      active.current = null
      saveActiveLogin(null)
      setStatus('error')
    }

    const tick = async () => {
      const l = active.current
      if (!alive || busy || !l) return
      if (l.expiresAt <= Date.now()) return fail()
      busy = true
      try {
        const r = await pollTelegram(l)
        if (!alive) return
        if (r.status === 'expired') fail()
        else if (r.status === 'ok') {
          active.current = null
          saveActiveLogin(null)
          setStatus('exchanging')
          const s = await finishTelegram(r.tokenHash)
          if (!alive) return
          setSession(s)
          setStatus(s ? 'signedIn' : 'error')
        }
      } catch (e) {
        // сеть пропала на секунду — попробуем на следующем шаге; ошибку покажем по истечении срока
        console.warn('Ожидание входа через Telegram:', e)
      } finally {
        busy = false
      }
    }

    const onBack = () => {
      if (document.visibilityState === 'visible') void tick()
    }
    void tick()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void tick()
    }, 1500)
    document.addEventListener('visibilitychange', onBack)
    window.addEventListener('focus', onBack)
    window.addEventListener('pageshow', onBack)
    return () => {
      alive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onBack)
      window.removeEventListener('focus', onBack)
      window.removeEventListener('pageshow', onBack)
    }
  }, [status])

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
    () => ({
      status,
      session,
      lastMethod,
      signInWithGoogle,
      prepareTelegram,
      signInWithTelegram,
      reopenTelegram,
      cancelTelegram,
      signOut,
    }),
    [
      status,
      session,
      lastMethod,
      signInWithGoogle,
      prepareTelegram,
      signInWithTelegram,
      reopenTelegram,
      cancelTelegram,
      signOut,
    ],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth вне AuthProvider')
  return ctx
}
