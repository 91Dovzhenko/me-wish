import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import Button from '../components/Button.tsx'
import {
  BackIcon,
  CheckIcon,
  EditIcon,
  MoreIcon,
  PlusIcon,
  SortIcon,
  TrashIcon,
} from '../components/Icons.tsx'
import ListIcon from '../components/ListIcon.tsx'
import {
  MenuDivider,
  MenuItem,
  MenuItemDisabled,
  MenuPanel,
  useDismiss,
} from '../components/Menu.tsx'
import { SkeletonBlock } from '../components/Skeleton.tsx'
import { useAppData, type ListSummary } from '../data/AppData.tsx'
import WishCard from '../components/WishCard.tsx'
import { useListActions } from '../features/lists/ListActions.tsx'
import { useWishActions } from '../features/wishes/WishActions.tsx'
import { useListWishes, type ListWish } from '../features/wishes/useListWishes.ts'
import { countSum } from '../lib/format.ts'
import { usePhotoUrls } from '../lib/photos.ts'
import NotFoundPage from './NotFoundPage.tsx'

// Экран списка: Mobile-List / Mobile-List-Compact / Mobile-List-Empty / Mobile-List-Loading,
// Desktop-List / Desktop-List-Empty / Desktop-List-Loading. Меню «•••» — Mobile-List-Menu(-Last), Desktop-List-Menu.
// Сетка карточек — WishCard / Spec-Cards (только просмотр). Открытие карточки, сортировка, «Исполненные» — 003-d.

export default function ListPage() {
  const { listId } = useParams()
  const data = useAppData()

  if (data.status === 'error') {
    return (
      <main className="flex min-h-dvh flex-col items-start gap-3 px-5 pt-[calc(env(safe-area-inset-top)+16px)] lg:min-h-0 lg:px-8 lg:pt-9">
        <BackButton />
        <p role="alert" className="m-0 text-sm font-medium text-danger">
          Не получилось загрузить список. Проверьте интернет.
        </p>
        <Button variant="dark" onClick={data.reload}>
          Попробовать ещё раз
        </Button>
      </main>
    )
  }

  if (data.status === 'loading') return <ListLoading />

  const list = data.lists.find((l) => l.id === listId)
  // Чужой, удалённый или несуществующий список база не отдаёт
  if (!list) return <NotFoundPage />

  return (
    <ListView
      key={list.id}
      list={list}
      isLast={data.lists.length <= 1}
      wishesVersion={data.wishesVersion}
    />
  )
}

function ListView({
  list,
  isLast,
  wishesVersion,
}: {
  list: ListSummary
  isLast: boolean
  wishesVersion: number
}) {
  const hasItems = list.itemCount > 0
  const { openAdd } = useWishActions()
  const add = () => openAdd({ listId: list.id })
  const wishes = useListWishes(list.id, hasItems, wishesVersion)

  return (
    <>
      <main className="flex flex-col gap-3 px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-[120px] lg:gap-[18px] lg:px-8 lg:pt-9 lg:pb-12">
        {/* Телефон: назад и «•••» */}
        <header className="flex items-center justify-between lg:hidden">
          <BackButton />
          <ListMenu list={list} isLast={isLast} />
        </header>

        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5 px-1 lg:gap-2 lg:px-0">
            <div className="flex min-w-0 items-center gap-2.5 lg:gap-3">
              <span className="lg:hidden">
                <ListIcon icon={list.icon} color={list.color} size={17} box={32} />
              </span>
              <span className="hidden lg:inline-flex">
                <ListIcon icon={list.icon} color={list.color} size={20} box={40} />
              </span>
              <h1 className="m-0 min-w-0 truncate font-display text-2xl font-semibold tracking-[-0.03em] lg:text-[30px]">
                {list.title}
              </h1>
              <div className="hidden flex-none lg:block">
                <ListMenu list={list} isLast={isLast} />
              </div>
            </div>
            {list.description ? (
              <p className="m-0 text-sm text-text-2 lg:text-[15px]">{list.description}</p>
            ) : null}
            {hasItems ? <ListSummaryLine list={list} /> : null}
          </div>
          <div className="hidden flex-none lg:block">
            <Button
              variant="primary"
              onClick={add}
              className="h-12 rounded-[16px] px-5 text-[15px]"
            >
              <PlusIcon size={18} strokeWidth={2.2} />
              Добавить желание
            </Button>
          </div>
        </div>

        {hasItems ? (
          <>
            <ListChips />
            <WishGrid state={wishes.state} onRetry={wishes.retry} />
          </>
        ) : (
          <EmptyState list={list} onAdd={add} />
        )}
      </main>

      <AddFab onClick={add} />
    </>
  )
}

function BackButton() {
  return (
    <Link
      to="/"
      aria-label="Назад"
      className="flex size-11 items-center justify-center rounded-full bg-surface lg:hidden"
    >
      <BackIcon size={20} />
    </Link>
  )
}

/** Плавающая «+» телефона — добавить в этот список. */
function AddFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Добавить желание в этот список"
      onClick={onClick}
      className="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+28px)] z-10 flex size-16 cursor-pointer items-center justify-center rounded-full bg-accent text-text shadow-fab lg:hidden"
    >
      <PlusIcon size={28} />
    </button>
  )
}

/** «Активные N · сумма | Исполнено N · сумма» — по этому списку. */
function ListSummaryLine({ list }: { list: ListSummary }) {
  return (
    <p aria-label="Сводка списка" className="m-0 mt-0.5 text-[13px] text-text-2 lg:mt-0 lg:text-sm">
      <span className="whitespace-nowrap">
        Активные{' '}
        <b className="font-semibold text-text">{countSum(list.activeCount, list.totalPrice)}</b>
      </span>
      <span aria-hidden="true" className="mx-2 text-[#c9c8c2] lg:mx-2.5">
        |
      </span>
      <span className="whitespace-nowrap">
        Исполнено{' '}
        <b className="font-semibold text-text">{countSum(list.doneCount, list.doneSum)}</b>
      </span>
    </p>
  )
}

/** Чипы «По приоритету» и «Исполненные» — видны, работа появится в 003-d. */
function ListChips() {
  return (
    <div className="flex items-center justify-between gap-2 lg:justify-start lg:gap-2.5">
      <button
        type="button"
        aria-disabled="true"
        title="Скоро"
        className="inline-flex h-10 cursor-default items-center gap-1.5 rounded-full bg-surface px-3.5 text-sm font-semibold whitespace-nowrap"
      >
        <SortIcon size={15} />
        По приоритету
      </button>
      <button
        type="button"
        role="switch"
        aria-checked="true"
        aria-disabled="true"
        title="Скоро"
        className="inline-flex h-10 cursor-default items-center gap-2 rounded-full bg-surface pr-3.5 pl-2 text-sm font-semibold whitespace-nowrap"
      >
        <span
          aria-hidden="true"
          className="inline-flex size-[22px] items-center justify-center rounded-full bg-accent"
        >
          <CheckIcon size={12} strokeWidth={3} />
        </span>
        Исполненные
      </button>
    </div>
  )
}

/** «Здесь пока пусто» — Mobile-List-Empty / Desktop-List-Empty. */
function EmptyState({ list, onAdd }: { list: ListSummary; onAdd: () => void }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 px-5 text-center lg:mt-5 lg:rounded-[28px] lg:bg-surface lg:px-6 lg:py-14">
      <span className="flex size-[76px] items-center justify-center rounded-[26px] bg-surface lg:hidden">
        <ListIcon icon={list.icon} color={list.color} size={26} box={52} />
      </span>
      <span className="hidden lg:inline-flex">
        <ListIcon icon={list.icon} color={list.color} size={28} box={60} />
      </span>
      <span className="text-[19px] font-bold lg:text-[22px]">Здесь пока пусто</span>
      <span className="text-sm leading-[1.45] text-text-2 lg:text-[15px]">
        Добавьте первое желание — хватит названия.
        <br />
        Фото и ссылку можно добавить потом.
      </span>
      <Button
        variant="dark"
        onClick={onAdd}
        className="mt-1.5 h-[50px] px-5 text-[15px] lg:mt-2 lg:px-[22px]"
      >
        Добавить первое желание
      </Button>
    </div>
  )
}

const GRID =
  'grid grid-cols-2 gap-2.5 lg:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] lg:gap-3.5'

/**
 * Сетка карточек: телефон — 2 колонки, компьютер — 4–5 (Mobile-List / Desktop-List).
 * Порядок — по приоритету, при равном — новые первыми (D-057). Все карточки ряда одной высоты (D-096).
 */
function WishGrid({
  state,
  onRetry,
}: {
  state: ReturnType<typeof useListWishes>['state']
  onRetry: () => void
}) {
  const items = state.status === 'ready' ? state.items : []
  const urls = usePhotoUrls(items.map((w) => w.imagePath))

  if (state.status === 'loading') return <GridSkeleton />
  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-start gap-3 px-1 lg:px-0">
        <p role="alert" className="m-0 text-sm font-medium text-danger">
          Не получилось загрузить желания. Проверьте интернет.
        </p>
        <Button variant="dark" onClick={onRetry}>
          Попробовать ещё раз
        </Button>
      </div>
    )
  }
  return (
    <ul aria-label="Желания" className={`m-0 list-none p-0 ${GRID}`}>
      {items.map((w: ListWish) => (
        <li key={w.itemId} className="min-w-0">
          <WishCard
            title={w.title}
            price={w.price}
            photoUrl={w.imagePath ? urls[w.imagePath] : null}
            priority={w.priority}
            status={w.status}
          />
        </li>
      ))}
    </ul>
  )
}

function GridSkeleton() {
  return (
    <div className={GRID} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`flex flex-col gap-2 rounded-[20px] bg-surface px-1.5 pt-1.5 pb-3 ${
            i === 4 ? 'hidden lg:flex' : ''
          }`}
        >
          <SkeletonBlock className="aspect-square rounded-[15px]" />
          <SkeletonBlock className="mx-1.5 h-3.5 w-[45%] rounded-[7px]" />
          <SkeletonBlock tone="soft" className="mx-1.5 h-2.5 w-[85%] rounded-[5px]" />
          <SkeletonBlock tone="soft" className="mx-1.5 h-2.5 w-[60%] rounded-[5px]" />
        </div>
      ))}
    </div>
  )
}

/** Меню «•••»: телефон — под кнопкой справа, компьютер — рядом с названием. */
function ListMenu({ list, isLast }: { list: ListSummary; isLast: boolean }) {
  const { openEdit, askDelete } = useListActions()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useDismiss(rootRef, open, () => setOpen(false))

  const trash = <TrashIcon size={18} className="flex-none" />

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Меню списка"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex size-11 cursor-pointer items-center justify-center rounded-full transition-colors ${
          open ? 'bg-accent-2-soft' : 'bg-surface hover:bg-[#fafaf7]'
        }`}
      >
        <MoreIcon size={20} />
      </button>
      {open ? (
        <>
          {/* Телефон: лёгкое затемнение под меню. Оно лежит внутри rootRef и закрывает весь экран
              вместе с кнопкой «•••», поэтому useDismiss считает нажатие на него «внутренним» —
              закрываем меню нажатием на само затемнение. */}
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fade-in fixed inset-0 z-20 cursor-pointer bg-[rgba(23,24,28,0.12)] lg:hidden"
          />
          <MenuPanel
            label="Меню списка"
            className="absolute top-[52px] right-0 z-30 w-[220px] lg:top-[52px] lg:right-auto lg:left-0 lg:w-[210px]"
          >
            <MenuItem
              icon={<EditIcon size={18} className="flex-none" />}
              onClick={() => {
                setOpen(false)
                openEdit(list)
              }}
            >
              Редактировать
            </MenuItem>
            <MenuDivider />
            {isLast ? (
              <MenuItemDisabled icon={trash} hint="Нельзя удалить единственный список">
                Удалить
              </MenuItemDisabled>
            ) : (
              <MenuItem
                danger
                icon={trash}
                onClick={() => {
                  setOpen(false)
                  askDelete(list)
                }}
              >
                Удалить
              </MenuItem>
            )}
          </MenuPanel>
        </>
      ) : null}
    </div>
  )
}

/** Загрузка — Mobile-List-Loading / Desktop-List-Loading. */
function ListLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Загрузка списка"
      className="flex flex-col gap-3 px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-[120px] lg:gap-[18px] lg:px-8 lg:pt-9 lg:pb-12"
    >
      <header className="flex items-center justify-between lg:hidden">
        <BackButton />
        <SkeletonBlock tone="soft" className="size-11 rounded-full" />
      </header>
      <div className="flex flex-col gap-2 px-1 lg:px-0" aria-hidden="true">
        <div className="flex items-center gap-2.5 lg:gap-3">
          <SkeletonBlock className="size-8 rounded-[10px] lg:size-10 lg:rounded-[13px]" />
          <SkeletonBlock
            tone="line"
            className="h-6 w-[180px] rounded-[9px] lg:h-[30px] lg:w-[240px]"
          />
        </div>
        <SkeletonBlock tone="line" className="h-3.5 w-[260px] max-w-full rounded-[7px]" />
        <SkeletonBlock tone="line-2" className="h-3.5 w-[320px] max-w-full rounded-[7px]" />
      </div>
      <div className="hidden gap-2.5 lg:flex" aria-hidden="true">
        <SkeletonBlock tone="line" className="h-10 w-[150px] rounded-full" />
        <SkeletonBlock tone="line" className="h-10 w-[150px] rounded-full" />
      </div>
      <GridSkeleton />
    </main>
  )
}
