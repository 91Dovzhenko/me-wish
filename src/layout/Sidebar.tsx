import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthProvider.tsx'
import {
  ChevronUpIcon,
  HomeIcon,
  LogoutIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
} from '../components/Icons.tsx'
import ListIcon from '../components/ListIcon.tsx'
import Logo from '../components/Logo.tsx'
import ProfileAvatar from '../components/ProfileAvatar.tsx'
import { SkeletonBlock } from '../components/Skeleton.tsx'
import { useAppData } from '../data/AppData.tsx'
import { useListActions } from '../features/lists/ListActions.tsx'
import { firstName } from '../lib/format.ts'

/** Боковое меню компьютера — Sidebar.dc.html, вариант Б (D-093): белая скруглённая подложка. */
export default function Sidebar() {
  const { openCreate } = useListActions()

  return (
    <nav
      aria-label="Навигация"
      className="sticky top-3 flex h-[calc(100dvh-24px)] w-[260px] flex-none flex-col gap-5 rounded-[28px] bg-surface px-3.5 pt-[26px] pb-[18px]"
    >
      <div className="px-2">
        <Logo size="sidebar" />
      </div>

      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `flex h-11 items-center gap-2.5 rounded-item px-3 text-[15px] font-semibold transition-colors ${
            isActive ? 'bg-accent' : 'hover:bg-bg'
          }`
        }
      >
        <HomeIcon size={18} />
        Главная
      </NavLink>

      <div className="flex min-h-0 flex-col gap-0.5">
        <span className="px-3 pb-1.5 text-xs font-bold tracking-[0.04em] text-text-2 uppercase">
          Мои списки
        </span>
        <SidebarLists />
        <button
          type="button"
          onClick={openCreate}
          className="flex h-11 flex-none cursor-pointer items-center gap-2.5 rounded-item px-2.5 text-left text-[15px] font-semibold text-accent-2-text transition-colors hover:bg-bg"
        >
          <span className="flex size-7 items-center justify-center rounded-[9px] border-[1.5px] border-dashed border-accent-2">
            <PlusIcon size={14} strokeWidth={2.2} />
          </span>
          Новый список
        </button>
      </div>

      <ProfileButton />
    </nav>
  )
}

/** Списки: прокручиваются, если их много; внизу лёгкое затухание, пока есть что прокручивать (Desktop-Home-ManyLists). */
function SidebarLists() {
  const data = useAppData()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [fade, setFade] = useState(false)

  const update = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setFade(el.scrollHeight - el.clientHeight - el.scrollTop > 2)
  }, [])

  const listCount = data.status === 'ready' ? data.lists.length : -1

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [update, listCount])

  return (
    <div className="relative flex min-h-0 flex-col">
      <div
        ref={scrollRef}
        onScroll={update}
        className="flex min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-contain"
      >
        {data.status === 'ready'
          ? data.lists.map((l) => (
              <NavLink
                key={l.id}
                to={`/l/${l.id}`}
                title={l.title}
                className={({ isActive }) =>
                  `flex h-11 flex-none items-center gap-2.5 rounded-item px-2.5 text-[15px] transition-colors ${
                    isActive ? 'bg-accent font-semibold' : 'font-medium hover:bg-bg'
                  }`
                }
              >
                <ListIcon icon={l.icon} color={l.color} size={15} box={28} />
                <span className="min-w-0 flex-1 truncate">{l.title}</span>
                <span className="text-[13px] text-text-2">{l.itemCount}</span>
              </NavLink>
            ))
          : [0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex h-11 flex-none items-center gap-2.5 px-2.5"
                aria-hidden="true"
              >
                <SkeletonBlock className="size-7 rounded-[9px]" />
                <SkeletonBlock className="h-3.5 flex-1 rounded-[7px]" />
              </div>
            ))}
      </div>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-white/0 to-white transition-opacity ${
          fade ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}

function ProfileButton() {
  const data = useAppData()
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const name = data.status === 'ready' ? data.profile.displayName : ''
  const { pathname } = useLocation()
  const onProfile = pathname === '/profile'
  const onTrash = pathname === '/trash'

  return (
    <div ref={rootRef} className="relative mt-auto">
      {open ? (
        <div
          role="menu"
          aria-label="Профиль"
          className="absolute right-0 bottom-[62px] left-0 flex flex-col rounded-[18px] bg-surface p-1.5 shadow-[0_20px_50px_rgba(23,24,28,0.2),0_0_0_1px_var(--divider)]"
        >
          <Link
            to="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`flex h-11 items-center gap-2.5 rounded-item px-3 text-sm hover:bg-bg ${
              onProfile ? 'bg-bg' : ''
            }`}
          >
            <UserIcon size={17} />
            Профиль
          </Link>
          <Link
            to="/trash"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`flex h-11 items-center justify-between rounded-item px-3 hover:bg-bg ${
              onTrash ? 'bg-bg' : ''
            }`}
          >
            <span className="flex items-center gap-2.5 text-sm">
              <TrashIcon size={17} />
              Корзина
            </span>
            <span className="text-[13px] text-text-2">
              {data.status === 'ready' && data.trash.length > 0 ? data.trash.length : ''}
            </span>
          </Link>
          <div aria-hidden="true" className="mx-2 my-1 h-px bg-divider" />
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            className="flex h-11 cursor-pointer items-center gap-2.5 rounded-item px-3 text-left text-sm text-danger hover:bg-danger-soft"
          >
            <LogoutIcon size={17} />
            Выйти
          </button>
        </div>
      ) : null}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-[52px] w-full cursor-pointer items-center gap-2.5 rounded-[14px] px-2.5 text-left transition-colors hover:bg-bg ${
          open || onProfile ? 'bg-bg' : ''
        }`}
      >
        <ProfileAvatar size={32} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {name ? firstName(name) : ''}
        </span>
        <ChevronUpIcon
          size={16}
          className={`text-text-2 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
    </div>
  )
}
