import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider.tsx'
import DecorWishCard from '../components/DecorWishCard.tsx'
import { AlertIcon, TelegramIcon } from '../components/Icons.tsx'
import Logo from '../components/Logo.tsx'

// Экран входа: Mobile-Login (+ -Loading, -Error) и Desktop-Login (D-094).
// Вход через Telegram — в ТЗ 003-f, сейчас кнопка неактивна с подписью «скоро».

const TITLE = 'Все желания — в одном месте'
const LEAD = 'Скриншот, название, цена — и желание сохранено. Делитесь списками с близкими.'

export default function LoginPage() {
  const { status, signInWithGoogle } = useAuth()
  const [starting, setStarting] = useState(false)

  // Вернулись со страницы Google кнопкой «Назад» (страница из кэша) — снова показать кнопки
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && setStarting(false)
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  if (status === 'signedIn') return <Navigate to="/" replace />

  const loading = status === 'exchanging' || status === 'initializing' || starting
  const error = status === 'error' && !starting

  const start = async () => {
    setStarting(true)
    await signInWithGoogle()
    // если браузер не ушёл на Google — значит, ошибка (status станет 'error')
    setStarting(false)
  }

  const actions = <LoginActions loading={loading} error={error} onGoogle={start} />

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg">
      {/* Телефон */}
      <div className="relative flex min-h-dvh flex-col lg:hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-[120px] -right-20 -left-20 h-[560px]"
          style={{
            background:
              'radial-gradient(60% 55% at 70% 40%, rgba(185, 168, 255, 0.75), rgba(185, 168, 255, 0) 70%), radial-gradient(45% 40% at 20% 60%, rgba(200, 245, 106, 0.55), rgba(200, 245, 106, 0) 70%)',
          }}
        />
        {/* Декоративные карточки: привязаны к низу области, на коротких экранах уходят вверх */}
        <div aria-hidden="true" className="relative min-h-[300px] flex-1">
          <div className="absolute bottom-16 left-[34px] w-[150px] -rotate-[7deg]">
            <DecorWishCard
              title="Штатив для камеры с видеоголовой"
              price="11 990 ₽"
              level={5}
              art="tripod"
            />
          </div>
          <div className="absolute right-[30px] bottom-1 w-[150px] rotate-6">
            <DecorWishCard
              title="Очки солнцезащитные, чёрные"
              price="1 290 ₽"
              level={3}
              art="glasses"
            />
          </div>
        </div>
        <div className="relative flex flex-col gap-3.5 px-6 pt-6 pb-[calc(env(safe-area-inset-bottom)+40px)]">
          <Logo size="login" />
          <h1 className="m-0 text-[28px] leading-[1.2] font-bold tracking-[-0.02em]">{TITLE}</h1>
          <p className="m-0 mb-2 text-[15px] leading-[1.45] text-text-2">{LEAD}</p>
          {actions}
        </div>
      </div>

      {/* Компьютер */}
      <div className="relative hidden min-h-dvh items-center justify-center px-5 py-10 lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(45% 50% at 72% 30%, rgba(185, 168, 255, 0.55), rgba(185, 168, 255, 0) 70%), radial-gradient(35% 40% at 22% 75%, rgba(200, 245, 106, 0.35), rgba(200, 245, 106, 0) 70%)',
          }}
        />
        <div className="relative flex w-[min(1120px,100%)] flex-wrap items-center justify-center gap-16">
          <div aria-hidden="true" className="relative h-[460px] max-w-[520px] flex-[1_1_420px]">
            <div className="absolute top-10 left-10 w-[230px] -rotate-[7deg] overflow-hidden rounded-[20px] shadow-[0_24px_50px_rgba(75,59,196,0.15)]">
              <DecorWishCard
                title="Штатив для камеры с видеоголовой, до 170 см"
                price="11 990 ₽"
                level={5}
                art="tripod"
                large
              />
            </div>
            <div className="absolute top-[100px] right-[30px] w-[230px] rotate-6 overflow-hidden rounded-[20px] shadow-[0_24px_50px_rgba(75,59,196,0.15)]">
              <DecorWishCard
                title="Очки солнцезащитные, чёрные"
                price="1 290 ₽"
                level={3}
                art="glasses"
                large
              />
            </div>
          </div>
          <div className="flex max-w-[420px] flex-[1_1_380px] flex-col gap-4">
            <Logo size="login-desktop" />
            <h1 className="m-0 mt-3 text-[40px] leading-[1.12] font-bold tracking-[-0.03em]">
              {TITLE}
            </h1>
            <p className="m-0 mb-2.5 text-[17px] leading-[1.45] text-text-2">{LEAD}</p>
            {actions}
          </div>
        </div>
      </div>
    </div>
  )
}

function LoginActions({
  loading,
  error,
  onGoogle,
}: {
  loading: boolean
  error: boolean
  onGoogle: () => void
}) {
  if (loading) {
    return (
      <div
        role="status"
        className="flex h-[126px] flex-col items-center justify-center gap-3 rounded-[20px] bg-surface"
      >
        <span
          aria-hidden="true"
          className="size-8 animate-spin rounded-full border-[3px] border-skeleton-line border-t-text"
        />
        <span className="text-base font-semibold">Входим…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-[16px] bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger"
        >
          <AlertIcon size={18} className="flex-none" />
          Не получилось войти. Попробуйте ещё раз.
        </div>
        <button
          type="button"
          onClick={onGoogle}
          className="h-14 cursor-pointer rounded-btn bg-text text-base font-semibold text-white hover:bg-[#2a2b31]"
        >
          Попробовать ещё раз
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      <button
        type="button"
        disabled
        aria-label="Войти через Telegram — скоро"
        className="flex h-14 cursor-default items-center justify-center gap-2.5 rounded-btn bg-text text-base font-semibold text-white/55"
      >
        <TelegramIcon size={20} />
        Войти через Telegram
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white/80">
          скоро
        </span>
      </button>
      <button
        type="button"
        onClick={onGoogle}
        className="flex h-14 cursor-pointer items-center justify-center gap-2.5 rounded-btn border-[1.5px] border-border-strong bg-surface text-base font-semibold text-text transition-colors hover:bg-[#fafaf7]"
      >
        <span aria-hidden="true" className="text-lg font-bold text-accent-2-text">
          G
        </span>
        Войти через Google
      </button>
    </div>
  )
}
