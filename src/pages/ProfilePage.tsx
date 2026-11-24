import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider.tsx'
import Avatar from '../components/Avatar.tsx'
import { BackIcon } from '../components/Icons.tsx'
import { SkeletonBlock } from '../components/Skeleton.tsx'
import { useAppData } from '../data/AppData.tsx'

const BUILD_LABEL = new Date(__BUILD_TIME__).toLocaleString('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

const LIVE_LABEL = {
  live: 'синхронизация на связи',
  connecting: 'синхронизация подключается',
  offline: 'синхронизация не на связи',
} as const

/**
 * Профиль (Mobile-Profile.dc.html) — на этом ТЗ только имя, аватар и «Выйти».
 * Смена имени и фото, список по умолчанию, способы входа, корзина — в 003-e.
 */
export default function ProfilePage() {
  const data = useAppData()
  const { signOut } = useAuth()

  return (
    <main className="mx-auto flex max-w-[560px] flex-col gap-4 px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-[30px] lg:pt-9">
      <div className="flex items-center gap-2">
        <Link
          to="/"
          aria-label="Назад"
          className="flex size-11 items-center justify-center rounded-full bg-surface"
        >
          <BackIcon size={20} />
        </Link>
        <h1 className="m-0 text-xl font-bold">Профиль</h1>
      </div>

      <section className="flex flex-col items-center gap-3 rounded-[28px] bg-surface p-5">
        {data.status === 'ready' ? (
          <>
            <Avatar name={data.profile.displayName} src={data.profile.avatarUrl} size={88} />
            <span className="flex h-11 items-center px-3 text-xl font-bold">
              {data.profile.displayName}
            </span>
          </>
        ) : (
          <>
            <SkeletonBlock className="size-[88px] rounded-full" />
            <SkeletonBlock className="my-3.5 h-4 w-32 rounded-lg" />
          </>
        )}
      </section>

      <button
        type="button"
        onClick={() => void signOut()}
        className="h-[52px] cursor-pointer rounded-[16px] border-[1.5px] border-border bg-surface text-[15px] font-semibold text-danger hover:bg-danger-soft"
      >
        Выйти
      </button>

      {/* Для проверки на устройствах: какая сборка работает и на связи ли синхронизация */}
      <p className="m-0 text-center text-xs text-text-3">
        Версия от {BUILD_LABEL} · {LIVE_LABEL[data.liveStatus]}
      </p>
    </main>
  )
}
