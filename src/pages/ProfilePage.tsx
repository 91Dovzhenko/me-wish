import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider.tsx'
import {
  AlertIcon,
  BackIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EditIcon,
  TelegramIcon,
} from '../components/Icons.tsx'
import AvatarStack from '../components/AvatarStack.tsx'
import ImageCropper from '../components/ImageCropper.tsx'
import ListIcon from '../components/ListIcon.tsx'
import { useDismiss } from '../components/Menu.tsx'
import ProfileAvatar from '../components/ProfileAvatar.tsx'
import Sheet from '../components/Sheet.tsx'
import { SkeletonBlock } from '../components/Skeleton.tsx'
import { SAVE_ERROR, useToast } from '../components/Toast.tsx'
import { useAppData, type ListSummary } from '../data/AppData.tsx'
import { isStandalone, openInstallHint } from '../features/install/installHint.ts'
import { useAvatarUpload } from '../features/profile/useAvatarUpload.ts'
import { useIsDesktop } from '../hooks/useIsDesktop.ts'

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

const NAME_MAX = 60

/**
 * Профиль — Mobile-Profile / Desktop-Profile (D-091).
 * Телефон: аватар и имя, способ входа, список по умолчанию и корзина, «Выйти».
 * Компьютер: аватар и имя, способ входа, список по умолчанию (корзина и «Выйти» — в меню бокового меню, D-053).
 */
export default function ProfilePage() {
  const data = useAppData()
  const { signOut } = useAuth()
  const isDesktop = useIsDesktop()
  const {
    inputRef: fileRef,
    pick,
    onFile,
    cropping,
    cancelCrop,
    confirmCrop,
    uploading,
    error: avatarError,
    clearError,
  } = useAvatarUpload()
  const [avatarSheet, setAvatarSheet] = useState(false)
  const [listSheet, setListSheet] = useState(false)
  const ready = data.status === 'ready'

  const avatarButton = (
    <AvatarButton
      size={isDesktop ? 84 : 88}
      uploading={uploading}
      disabled={!ready}
      onClick={() => {
        clearError()
        if (isDesktop) pick()
        else setAvatarSheet(true)
      }}
    />
  )

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
      className="hidden"
      onChange={(e) => void onFile(e.target.files?.[0])}
    />
  )

  const cropper = cropping ? (
    <ImageCropper
      src={cropping.url}
      width={cropping.width}
      height={cropping.height}
      shape="circle"
      title="Фото профиля"
      onCancel={cancelCrop}
      onDone={(crop) => void confirmCrop(crop)}
    />
  ) : null

  const errorLine = avatarError ? (
    <div
      role="alert"
      className="flex w-full items-center gap-2 rounded-[12px] bg-danger-soft px-3 py-2.5 text-[13px] font-medium text-danger"
    >
      <AlertIcon size={16} className="flex-none" />
      {avatarError}
    </div>
  ) : null

  const versionLine = (
    // Диагностика для проверки на устройствах (D-107): какая сборка работает и на связи ли синхронизация
    <p className="m-0 text-center text-xs text-text-3 lg:text-left">
      Версия от {BUILD_LABEL} · {LIVE_LABEL[data.liveStatus]}
    </p>
  )

  if (isDesktop) {
    return (
      <main className="flex flex-col gap-[22px] px-8 pt-9 pb-12">
        <h1 className="m-0 font-display text-[30px] font-semibold tracking-[-0.03em]">Профиль</h1>
        <div className="flex max-w-[620px] flex-col gap-3.5">
          <section className="flex flex-col gap-3 rounded-[24px] bg-surface p-5">
            <div className="flex items-center gap-[18px]">
              {avatarButton}
              <NameField desktop />
            </div>
            {errorLine}
          </section>
          <LoginMethods desktop />
          <DefaultListDesktop />
          {versionLine}
        </div>
        {fileInput}
        {cropper}
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-[560px] flex-col gap-4 px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-[30px]">
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
        {avatarButton}
        {errorLine}
        <NameField />
      </section>

      <LoginMethods />

      <section aria-label="Настройки" className="rounded-[24px] bg-surface px-4 py-1.5">
        <button
          type="button"
          disabled={!ready}
          onClick={() => setListSheet(true)}
          className="flex min-h-[62px] w-full cursor-pointer items-center justify-between gap-2.5 border-b border-divider text-left"
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[15px]">Список по умолчанию</span>
            <span className="text-xs text-text-2">Сюда попадают новые желания</span>
          </span>
          <span className="flex min-w-0 flex-none items-center gap-1.5 text-sm font-semibold">
            <span className="max-w-[150px] truncate">{defaultListTitle(data)}</span>
            <ChevronRightIcon size={14} />
          </span>
        </button>
        <Link
          to="/trash"
          className={`flex min-h-14 items-center justify-between ${
            isStandalone() ? '' : 'border-b border-divider'
          }`}
        >
          <span className="text-[15px]">Корзина</span>
          <span className="flex items-center gap-1.5 text-sm text-text-2">
            {ready ? data.trash.length : ''}
            <ChevronRightIcon size={14} className="text-text" />
          </span>
        </Link>
        {/* «Подсказка всегда есть в профиле» (Mobile-InstallHint); в установленном приложении не нужна */}
        {isStandalone() ? null : (
          <button
            type="button"
            onClick={openInstallHint}
            className="flex min-h-14 w-full cursor-pointer items-center justify-between text-left"
          >
            <span className="text-[15px]">Как установить на iPhone</span>
            <ChevronRightIcon size={14} />
          </button>
        )}
      </section>

      <button
        type="button"
        onClick={() => void signOut()}
        className="h-[52px] cursor-pointer rounded-[16px] border-[1.5px] border-border bg-surface text-[15px] font-semibold text-danger hover:bg-danger-soft"
      >
        Выйти
      </button>

      {versionLine}

      {avatarSheet ? (
        <Sheet label="Фото профиля" onClose={() => setAvatarSheet(false)}>
          <button
            type="button"
            onClick={() => {
              setAvatarSheet(false)
              pick()
            }}
            className="flex h-14 cursor-pointer items-center gap-3 rounded-[16px] bg-bg px-3 text-base font-semibold"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <circle cx="9" cy="10" r="1.8" />
              <path d="M21 16l-5-5-8 9" />
            </svg>
            Загрузить фото
          </button>
          <button
            type="button"
            onClick={() => setAvatarSheet(false)}
            className="h-[52px] cursor-pointer rounded-[16px] text-[15px] font-semibold"
          >
            Отмена
          </button>
        </Sheet>
      ) : null}

      {listSheet ? <DefaultListSheet onClose={() => setListSheet(false)} /> : null}

      {fileInput}
      {cropper}
    </main>
  )
}

function defaultListTitle(data: ReturnType<typeof useAppData>) {
  if (data.status !== 'ready') return ''
  const l = data.lists.find((x) => x.id === data.profile.defaultListId)
  return l?.title ?? '—'
}

/** Аватар со значком камеры; пока фото грузится — затемнение и индикатор. */
function AvatarButton({
  size,
  uploading,
  disabled,
  onClick,
}: {
  size: number
  uploading: boolean
  disabled: boolean
  onClick: () => void
}) {
  const badge = size >= 88 ? 32 : 30
  return (
    <button
      type="button"
      aria-label="Сменить фото профиля"
      disabled={disabled || uploading}
      onClick={onClick}
      className="relative flex-none cursor-pointer rounded-full disabled:cursor-default"
      style={{ width: size, height: size }}
    >
      <ProfileAvatar size={size} />
      {uploading ? (
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-[rgba(23,24,28,0.45)]">
          <span className="size-7 animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className="absolute -right-0.5 -bottom-0.5 flex items-center justify-center rounded-full bg-text shadow-[0_0_0_3px_#fff]"
        style={{ width: badge, height: badge }}
      >
        <svg
          width={badge >= 32 ? 15 : 14}
          height={badge >= 32 ? 15 : 14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 8h3l2-3h6l2 3h3v11H4zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
        </svg>
      </span>
    </button>
  )
}

/** Имя: нажатие → поле → «Сохранить» (Mobile-Profile-Name / Desktop-Profile-Name). */
function NameField({ desktop }: { desktop?: boolean }) {
  const data = useAppData()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  if (data.status !== 'ready') {
    return <SkeletonBlock className="my-3.5 h-4 w-32 rounded-lg" />
  }
  const name = data.profile.displayName

  const start = () => {
    setValue(name)
    setError('')
    setEditing(true)
  }

  const save = async () => {
    const v = value.trim()
    if (!v) {
      setError('Напишите имя')
      inputRef.current?.focus()
      return
    }
    if (v === name) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await data.updateProfile({ displayName: v })
      setEditing(false)
    } catch (e) {
      // поле остаётся открытым с введённым именем
      console.warn('Не удалось сохранить имя:', e)
      toast({ text: SAVE_ERROR, kind: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className={desktop ? 'flex min-w-0 flex-col gap-1' : 'flex max-w-full'}>
        <button
          type="button"
          onClick={start}
          className={`inline-flex max-w-full cursor-pointer items-center gap-2 font-bold ${
            desktop ? 'text-[22px]' : 'h-11 rounded-[12px] px-3 text-xl'
          }`}
        >
          <span className="truncate">{name || 'Без имени'}</span>
          <EditIcon size={16} className="flex-none text-text-2" />
        </button>
        {desktop ? (
          <span className="text-[13px] text-text-2">Нажмите на фото, чтобы загрузить новое</span>
        ) : null}
      </div>
    )
  }

  const input = (
    <input
      ref={inputRef}
      id="profile-name"
      type="text"
      value={value}
      maxLength={NAME_MAX}
      autoComplete="name"
      enterKeyHint="done"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? 'profile-name-error' : undefined}
      onChange={(e) => {
        setValue(e.target.value)
        if (error && e.target.value.trim()) setError('')
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') void save()
        if (e.key === 'Escape') setEditing(false)
      }}
      className={`box-border rounded-field border-[1.5px] px-3.5 text-base outline-none ${
        error ? 'border-danger bg-danger-soft' : 'border-text bg-surface'
      } ${desktop ? 'h-12 min-w-0 flex-1' : 'h-[50px] w-full'}`}
    />
  )
  const errorText = error ? (
    <span id="profile-name-error" className="text-[13px] font-medium text-danger">
      {error}
    </span>
  ) : null
  const cancel = (
    <button
      type="button"
      onClick={() => setEditing(false)}
      className={`cursor-pointer rounded-[14px] font-semibold ${
        desktop
          ? 'h-12 bg-surface px-4 text-sm shadow-[inset_0_0_0_1.5px_var(--border)]'
          : 'h-12 bg-bg text-[15px]'
      }`}
    >
      Отмена
    </button>
  )
  const submit = (
    <button
      type="button"
      onClick={() => void save()}
      disabled={saving}
      className={`cursor-pointer rounded-[14px] bg-accent font-bold disabled:opacity-70 ${
        desktop ? 'h-12 px-[18px] text-sm' : 'h-12 text-[15px]'
      }`}
    >
      Сохранить
    </button>
  )

  if (desktop) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label htmlFor="profile-name" className="text-[13px] font-semibold">
          Имя
        </label>
        <div className="flex gap-2">
          {input}
          {cancel}
          {submit}
        </div>
        {errorText}
      </div>
    )
  }
  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor="profile-name" className="text-[13px] font-semibold">
        Имя
      </label>
      {input}
      {errorText}
      <div className="grid grid-cols-2 gap-2">
        {cancel}
        {submit}
      </div>
    </div>
  )
}

/** Способы входа — только показываем (D-091), без «Подключить». */
function LoginMethods({ desktop }: { desktop?: boolean }) {
  const { session } = useAuth()
  const data = useAppData()
  const providers = new Set<string>(
    (session?.user.identities ?? []).map((i) => i.provider).filter(Boolean),
  )
  const appProviders = session?.user.app_metadata?.providers
  if (Array.isArray(appProviders)) appProviders.forEach((p) => providers.add(String(p)))
  // Telegram — по профилю: telegram_id ставит только сервер при входе через Telegram (003-f)
  if (data.status === 'ready' && data.profile.telegramId) providers.add('telegram')

  const rows: { key: string; title: string; icon: ReactNode; tile: string }[] = []
  if (providers.has('google'))
    rows.push({
      key: 'google',
      title: 'Google',
      tile: 'bg-accent-2-soft text-accent-2-text',
      icon: <span className="text-lg font-bold">G</span>,
    })
  if (providers.has('telegram'))
    rows.push({
      key: 'telegram',
      title: 'Telegram',
      tile: 'bg-[#E6F0FF] text-[#1E4FA8]',
      icon: <TelegramIcon size={20} />,
    })
  if (rows.length === 0) return null

  return (
    <section
      aria-label="Способ входа"
      className={`flex flex-col gap-3 bg-surface ${
        desktop ? 'rounded-[20px] px-5 py-4' : 'rounded-[24px] px-4 py-3.5'
      }`}
    >
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-3">
          <span
            className={`flex size-10 flex-none items-center justify-center rounded-[12px] ${r.tile}`}
            aria-hidden="true"
          >
            {r.icon}
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{r.title}</span>
            <span className="text-[13px] text-text-2">Вход выполнен через него</span>
          </span>
        </div>
      ))}
    </section>
  )
}

/** Выбор списка по умолчанию; сохраняется сразу. */
function useSetDefaultList() {
  const data = useAppData()
  const toast = useToast()
  return (l: ListSummary) => {
    if (data.status !== 'ready' || l.id === data.profile.defaultListId) return
    data.updateProfile({ defaultListId: l.id }).catch((e) => {
      console.warn('Не удалось сменить список по умолчанию:', e)
      toast({ text: SAVE_ERROR, kind: 'error' })
    })
  }
}

/** Mobile-Profile-DefaultList: шторка со списками, текущий отмечен. */
function DefaultListSheet({ onClose }: { onClose: () => void }) {
  const data = useAppData()
  const setDefault = useSetDefaultList()
  if (data.status !== 'ready') return null
  return (
    <Sheet label="Список по умолчанию" onClose={onClose} className="gap-1.5">
      <h2 className="mx-1 mt-2 mb-0.5 text-lg font-bold">Список по умолчанию</h2>
      <p className="mx-1 mt-0 mb-1.5 text-[13px] text-text-2">
        Сюда попадают желания, добавленные с главной и через бота
      </p>
      <div role="radiogroup" aria-label="Список по умолчанию" className="flex flex-col gap-1.5">
        {/* 5.6: только списки, где я редактор (мои и совместные, D-117) */}
        {data.lists
          .filter((l) => l.myRole === 'editor')
          .map((l) => {
            const on = l.id === data.profile.defaultListId
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setDefault(l)
                  onClose()
                }}
                className={`flex h-14 flex-none cursor-pointer items-center gap-3 rounded-[16px] pr-3 pl-2.5 text-left ${
                  on ? 'bg-bg' : 'hover:bg-bg'
                }`}
              >
                <ListIcon icon={l.icon} color={l.color} size={16} box={34} />
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{l.title}</span>
                {l.members.length > 1 ? <AvatarStack people={l.members} size={20} /> : null}
                {on ? <CheckIcon size={18} strokeWidth={2.4} className="flex-none" /> : null}
              </button>
            )
          })}
      </div>
    </Sheet>
  )
}

/** Desktop-Profile-DefaultList: выпадающий список справа в строке. */
function DefaultListDesktop() {
  const data = useAppData()
  const setDefault = useSetDefaultList()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useDismiss(rootRef, open, () => setOpen(false))

  const current =
    data.status === 'ready' ? data.lists.find((l) => l.id === data.profile.defaultListId) : null

  return (
    <section className="relative flex items-center justify-between gap-4 rounded-[20px] bg-surface px-5 py-4">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">Список по умолчанию</span>
        <span className="text-[13px] text-text-2">
          Сюда попадают желания, добавленные с главной и через бота
        </span>
      </span>
      <div ref={rootRef} className="flex-none">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={data.status !== 'ready'}
          onClick={() => setOpen((v) => !v)}
          className={`flex h-[46px] max-w-[260px] cursor-pointer items-center gap-2 rounded-[14px] bg-surface pr-3 pl-2 text-[15px] font-semibold ${
            open
              ? 'shadow-[inset_0_0_0_1.5px_var(--text)]'
              : 'shadow-[inset_0_0_0_1.5px_var(--border)] hover:shadow-[inset_0_0_0_1.5px_var(--border-strong)]'
          }`}
        >
          {current ? (
            <>
              <ListIcon icon={current.icon} color={current.color} size={15} box={30} />
              <span className="min-w-0 truncate">{current.title}</span>
            </>
          ) : (
            <SkeletonBlock className="h-3.5 w-24 rounded-[7px]" />
          )}
          <ChevronDownIcon size={14} className="flex-none" />
        </button>
        {open && data.status === 'ready' ? (
          <div
            role="listbox"
            aria-label="Список по умолчанию"
            className="pop-in absolute top-[74px] right-5 z-10 flex max-h-[320px] w-[260px] flex-col overflow-y-auto rounded-[18px] bg-surface p-1.5 shadow-[0_16px_40px_rgba(23,24,28,0.18),0_0_0_1px_var(--divider)]"
          >
            {data.lists
              .filter((l) => l.myRole === 'editor')
              .map((l) => {
                const on = l.id === data.profile.defaultListId
                return (
                  <button
                    key={l.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => {
                      setDefault(l)
                      setOpen(false)
                    }}
                    className={`flex h-12 flex-none cursor-pointer items-center gap-2.5 rounded-item pr-2.5 pl-2 text-left ${
                      on ? 'bg-bg' : 'hover:bg-bg'
                    }`}
                  >
                    <ListIcon icon={l.icon} color={l.color} size={15} box={30} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{l.title}</span>
                    {l.members.length > 1 ? <AvatarStack people={l.members} size={18} /> : null}
                    {on ? <CheckIcon size={16} strokeWidth={2.4} className="flex-none" /> : null}
                  </button>
                )
              })}
          </div>
        ) : null}
      </div>
    </section>
  )
}
