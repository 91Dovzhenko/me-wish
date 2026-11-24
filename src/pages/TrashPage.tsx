import { useRef, useState } from 'react'
import { Link } from 'react-router'
import Dialog from '../components/Dialog.tsx'
import { BackIcon, CheckIcon, ChevronDownIcon } from '../components/Icons.tsx'
import ListIcon from '../components/ListIcon.tsx'
import { useDismiss } from '../components/Menu.tsx'
import { SkeletonBlock } from '../components/Skeleton.tsx'
import { SAVE_ERROR, useToast } from '../components/Toast.tsx'
import { PhotoSquare } from '../components/WishCard.tsx'
import { useAppData, type ListSummary, type TrashItem } from '../data/AppData.tsx'
import { plural, trashDaysLeft } from '../lib/format.ts'
import { usePhotoUrls } from '../lib/photos.ts'

const TrashBinIcon = ({ size }: { size: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#8A8B90"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
)

/**
 * Корзина — Mobile-Trash / Desktop-Trash. Удалённые желания (новые первыми), «удалится через N дн.»,
 * «Восстановить» (на место или в выбранный список, если списка уже нет — D-082), «Очистить корзину».
 */
export default function TrashPage() {
  const data = useAppData()
  const toast = useToast()
  const [restoring, setRestoring] = useState<TrashItem | null>(null)
  const [askClear, setAskClear] = useState<string[] | null>(null)

  const ready = data.status === 'ready'
  const trash = ready ? data.trash : []
  const urls = usePhotoUrls(trash.map((t) => t.imagePath))
  const hasItems = ready && trash.length > 0

  const restore = (t: TrashItem, listId?: string) => {
    if (data.status !== 'ready') return
    const target = data.lists.find((l) => l.id === (listId ?? t.listId))
    setRestoring(null)
    data
      .restoreFromTrash(t, listId)
      .then(() => toast({ text: `Восстановлено в «${target?.title ?? t.listTitle}»` }))
      .catch((e) => {
        console.warn('Не удалось восстановить:', e)
        toast({ text: SAVE_ERROR, kind: 'error' })
      })
  }

  const onRestore = (t: TrashItem) => (t.listAlive ? restore(t) : setRestoring(t))

  const clear = (ids: string[]) => {
    setAskClear(null)
    data.emptyTrash(ids).catch((e) => {
      console.warn('Не удалось очистить корзину:', e)
      toast({ text: 'Не получилось удалить — проверьте интернет', kind: 'error' })
    })
  }

  const n = askClear?.length ?? 0

  return (
    <main className="flex flex-col gap-4 px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-[30px] lg:gap-[18px] lg:px-8 lg:pt-9 lg:pb-12">
      <header className="flex items-center justify-between gap-4 lg:flex-wrap lg:items-start">
        <div className="flex items-center gap-2 lg:flex-col lg:items-start">
          <Link
            to="/profile"
            aria-label="Назад"
            className="flex size-11 flex-none items-center justify-center rounded-full bg-surface lg:hidden"
          >
            <BackIcon size={20} />
          </Link>
          <h1 className="m-0 text-xl font-bold lg:font-display lg:text-[30px] lg:font-semibold lg:tracking-[-0.03em]">
            Корзина
          </h1>
          {hasItems ? (
            <p className="m-0 hidden text-sm text-text-2 lg:block">
              Удалённые желания хранятся 30 дней, потом исчезают навсегда.
            </p>
          ) : null}
        </div>
        {hasItems ? (
          <button
            type="button"
            onClick={() => setAskClear(trash.map((t) => t.itemId))}
            className="h-11 flex-none cursor-pointer px-1 text-sm font-semibold text-danger lg:rounded-[14px] lg:border-[1.5px] lg:border-[#F3C9C4] lg:bg-surface lg:px-4 lg:hover:bg-danger-soft"
          >
            Очистить корзину
          </button>
        ) : null}
      </header>
      {hasItems ? (
        <p className="m-0 -mt-1 text-[13px] leading-[1.4] text-text-2 lg:hidden">
          Удалённые желания хранятся 30 дней, потом исчезают навсегда.
        </p>
      ) : null}

      {!ready ? (
        <div className="flex max-w-[760px] flex-col gap-2.5 lg:gap-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-[22px] bg-surface p-2.5">
              <SkeletonBlock className="size-16 flex-none rounded-[14px] lg:size-[72px]" />
              <div className="flex flex-1 flex-col gap-2">
                <SkeletonBlock tone="line" className="h-3.5 w-3/4 rounded-[7px]" />
                <SkeletonBlock tone="line-2" className="h-2.5 w-1/2 rounded-[5px]" />
              </div>
            </div>
          ))}
        </div>
      ) : hasItems ? (
        <ul className="m-0 flex max-w-[760px] list-none flex-col gap-2.5 p-0 lg:gap-2">
          {trash.map((t) => (
            <li
              key={t.itemId}
              className="flex items-center gap-3 rounded-[22px] bg-surface p-2.5 lg:gap-4 lg:rounded-[20px]"
            >
              <div className="w-16 flex-none lg:w-[72px]">
                <PhotoSquare
                  url={t.imagePath ? urls[t.imagePath] : null}
                  alt=""
                  radius={14}
                  iconSize={24}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-[3px] lg:gap-1">
                <span className="truncate text-sm font-semibold lg:text-[15px]">{t.title}</span>
                <span className="text-xs text-text-2 lg:text-[13px]">
                  Из «{t.listTitle}» · удалится через {trashDaysLeft(t.deletedAt)} дн.
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRestore(t)}
                className="h-11 flex-none cursor-pointer rounded-[14px] bg-accent-2-soft px-3 text-[13px] font-semibold text-accent-2-text hover:brightness-[0.97] lg:px-4 lg:text-sm"
              >
                Восстановить
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-20 flex flex-col items-center gap-3 text-center lg:mt-5 lg:max-w-[760px] lg:rounded-[28px] lg:bg-surface lg:px-6 lg:py-14">
          <span className="flex size-[72px] items-center justify-center rounded-[24px] bg-surface lg:bg-bg">
            <TrashBinIcon size={32} />
          </span>
          <span className="text-lg font-bold lg:text-xl">Корзина пуста</span>
          <span className="max-w-[260px] text-sm leading-[1.4] text-text-2 lg:max-w-[320px] lg:text-[15px] lg:leading-[1.45]">
            Удалённые желания появятся здесь и будут храниться 30 дней
          </span>
        </div>
      )}

      {restoring && data.status === 'ready' ? (
        <RestoreDialog
          item={restoring}
          lists={data.lists}
          defaultListId={data.profile.defaultListId}
          onCancel={() => setRestoring(null)}
          onRestore={(listId) => restore(restoring, listId)}
        />
      ) : null}

      {askClear ? (
        <Dialog
          title={`Удалить навсегда ${n} ${plural(n, ['желание', 'желания', 'желаний'])}?`}
          body={n === 1 ? 'Восстановить его будет нельзя.' : 'Восстановить их будет нельзя.'}
          primary="Удалить"
          secondary="Отмена"
          onPrimary={() => clear(askClear)}
          onSecondary={() => setAskClear(null)}
        />
      ) : null}
    </main>
  )
}

/** «Восстановить в список» (Mobile-Trash-Restore): список удалён — выбор, предвыбран список по умолчанию. */
function RestoreDialog({
  item,
  lists,
  defaultListId,
  onCancel,
  onRestore,
}: {
  item: TrashItem
  lists: ListSummary[]
  defaultListId: string | null
  onCancel: () => void
  onRestore: (listId: string) => void
}) {
  const [listId, setListId] = useState(
    () => (lists.some((l) => l.id === defaultListId) ? defaultListId : lists[0]?.id) ?? '',
  )
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useDismiss(rootRef, open, () => setOpen(false))
  const current = lists.find((l) => l.id === listId)
  const note = (id: string) => (id === defaultListId ? 'По умолчанию' : '')

  return (
    <Dialog
      title="Восстановить в список"
      body={`Списка «${item.listTitle}» больше нет. Куда вернуть «${item.title}»?`}
      primary="Восстановить"
      secondary="Отмена"
      danger={false}
      busy={!current}
      onPrimary={() => current && onRestore(current.id)}
      onSecondary={onCancel}
    >
      <div ref={rootRef} className="relative mt-1.5">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Список: ${current?.title ?? ''}`}
          onClick={() => setOpen((v) => !v)}
          className={`flex h-[52px] w-full cursor-pointer items-center gap-2.5 rounded-field border-[1.5px] bg-surface pr-3 pl-2 text-left ${
            open ? 'border-text' : 'border-border hover:border-border-strong'
          }`}
        >
          {current ? (
            <>
              <ListIcon icon={current.icon} color={current.color} size={15} box={32} />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                {current.title}
              </span>
              {note(current.id) ? (
                <span className="flex-none text-xs text-text-2">{note(current.id)}</span>
              ) : null}
            </>
          ) : (
            <span className="flex-1" />
          )}
          <ChevronDownIcon size={16} className="flex-none" />
        </button>
        {open ? (
          <div
            role="listbox"
            aria-label="Список"
            className="pop-in absolute top-full left-0 z-20 mt-2 flex max-h-[240px] w-full flex-col overflow-y-auto rounded-[18px] bg-surface p-1.5 shadow-[0_16px_40px_rgba(23,24,28,0.18),0_0_0_1px_var(--divider)]"
          >
            {lists.map((l) => {
              const on = l.id === listId
              return (
                <button
                  key={l.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    setListId(l.id)
                    setOpen(false)
                  }}
                  className={`flex h-12 flex-none cursor-pointer items-center gap-2.5 rounded-item px-2 text-left ${
                    on ? 'bg-bg' : 'hover:bg-bg'
                  }`}
                >
                  <ListIcon icon={l.icon} color={l.color} size={15} box={30} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{l.title}</span>
                  {note(l.id) ? (
                    <span className="flex-none text-xs text-text-2">{note(l.id)}</span>
                  ) : null}
                  {on ? (
                    <CheckIcon size={16} className="flex-none" />
                  ) : (
                    <span className="w-4 flex-none" />
                  )}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
