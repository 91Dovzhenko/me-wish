import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Hearts from '../../components/Hearts.tsx'
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  EditIcon,
  ExternalIcon,
  MoreIcon,
  TrashIcon,
} from '../../components/Icons.tsx'
import ListIcon from '../../components/ListIcon.tsx'
import { MenuDivider, MenuItem, MenuPanel, useDismiss } from '../../components/Menu.tsx'
import { useToast } from '../../components/Toast.tsx'
import { PhotoSquare } from '../../components/WishCard.tsx'
import {
  isDone,
  useAppData,
  type ListSummary,
  type WishItem,
  type WishStatus,
} from '../../data/AppData.tsx'
import { useIsDesktop } from '../../hooks/useIsDesktop.ts'
import { formatAddedDate, formatRub, wishCount } from '../../lib/format.ts'
import { usePhotoUrls } from '../../lib/photos.ts'
import { PRIORITY_LABELS, priorityLabel } from '../../lib/priority.ts'
import WishForm from './WishForm.tsx'

// Открытая карточка желания (D-067, D-068, D-087):
// телефон — шторка на всю высоту (Mobile-Card, -Long, -NoPhoto, -NoLink, -Done, -Status, -Priority, -Menu, -Move),
// компьютер — окно по центру поверх списка (Desktop-Card, -Priority, -Menu, -Move).
// Свайп вниз не делаем (D-106): закрытие — крестик, нажатие на фон, Esc.

const STATUS_OPTIONS: { key: WishStatus; label: string }[] = [
  { key: 'active', label: 'В желаниях' },
  { key: 'purchased', label: 'Куплено' },
  { key: 'gifted', label: 'Подарили' },
]

function statusLabel(s: WishStatus) {
  return s === 'purchased' ? 'Куплено' : s === 'gifted' ? 'Подарили' : 'В желаниях'
}

type Overlay = 'menu' | 'priority' | 'status' | 'move' | null

type Props = {
  item: WishItem
  list: ListSummary
  /** закрыть карточку (вернуться к списку) */
  onClose: () => void
}

export default function WishSheet({ item, list, onClose }: Props) {
  const data = useAppData()
  const toast = useToast()
  const isDesktop = useIsDesktop()
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [editing, setEditing] = useState<{ focusPrice: boolean } | null>(null)
  const urls = usePhotoUrls([item.imagePath])
  const photoUrl = item.imagePath ? urls[item.imagePath] : null
  const done = isDone(item.status)

  const closeRef = useRef(onClose)
  const stateRef = useRef({ overlay, editing })
  useEffect(() => {
    closeRef.current = onClose
    stateRef.current = { overlay, editing }
  })

  // Прокрутка списка под карточкой выключена. Esc закрывает карточку — если поверх нет меню, выбора или формы
  // (у них свой Esc, они перехватывают его раньше).
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const s = stateRef.current
      if (s.editing) return
      if (s.overlay) setOverlay(null)
      else closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const failed = () =>
    toast({ text: 'Не получилось сохранить — проверьте интернет', kind: 'error' })

  const choosePriority = (n: number) => {
    setOverlay(null)
    if (n !== item.priority) data.setPriority(item.itemId, n).catch(failed)
  }
  const chooseStatus = (s: WishStatus) => {
    setOverlay(null)
    if (s !== item.status) data.setStatus(item.itemId, s).catch(failed)
  }

  const lists = data.status === 'ready' ? data.lists : []
  const moveTo = (target: ListSummary) => {
    if (target.id === item.listId) {
      setOverlay(null)
      return
    }
    onClose()
    toast({ text: `Перемещено в «${target.title}»` })
    data.moveItem(item.itemId, target.id).catch(failed)
  }

  const remove = () => {
    onClose()
    const trashing = data.trashItem(item.itemId)
    trashing.catch(() =>
      toast({ text: 'Не получилось удалить — проверьте интернет', kind: 'error' }),
    )
    toast({
      text: 'Удалено',
      action: {
        label: 'Отменить',
        onClick: () => {
          // «Отменить» могли нажать раньше, чем база удалила, — дожидаемся
          trashing
            .then(() => data.restoreItem(item))
            .catch(() => toast({ text: 'Не получилось вернуть желание', kind: 'error' }))
        },
      },
    })
  }

  const openEdit = (focusPrice = false) => {
    setOverlay(null)
    setEditing({ focusPrice })
  }

  const props: ViewProps = {
    item,
    list,
    photoUrl,
    done,
    overlay,
    setOverlay,
    onClose,
    choosePriority,
    chooseStatus,
    openEdit,
    remove,
  }

  return (
    <>
      {isDesktop ? <DesktopCard {...props} /> : <MobileCard {...props} />}

      {overlay === 'move' ? (
        <MovePicker
          lists={lists}
          currentId={item.listId}
          isDesktop={isDesktop}
          onPick={moveTo}
          onClose={() => setOverlay(null)}
        />
      ) : null}

      {editing && data.status === 'ready' ? (
        <WishForm
          mode="edit"
          userId={data.profile.id}
          lists={data.lists}
          initialListId={item.listId}
          defaultListId={data.profile.defaultListId}
          fromListId={item.listId}
          focusPrice={editing.focusPrice}
          initial={{
            listId: item.listId,
            title: item.title,
            price: item.price,
            sourceUrl: item.sourceUrl,
            description: item.description,
            priority: item.priority,
            imagePath: item.imagePath,
          }}
          onClose={() => setEditing(null)}
          onSubmit={(w) => data.updateWish(item.itemId, w)}
          onDone={(w) => {
            setEditing(null)
            if (w.listId !== item.listId) {
              const target = data.lists.find((l) => l.id === w.listId)
              onClose()
              toast({ text: `Перемещено в «${target?.title ?? 'список'}»` })
            }
          }}
        />
      ) : null}
    </>
  )
}

type ViewProps = {
  item: WishItem
  list: ListSummary
  photoUrl: string | null | undefined
  done: boolean
  overlay: Overlay
  setOverlay: (o: Overlay) => void
  onClose: () => void
  choosePriority: (n: number) => void
  chooseStatus: (s: WishStatus) => void
  openEdit: (focusPrice?: boolean) => void
  remove: () => void
}

// ─── Телефон: шторка ─────────────────────────────────────────

function MobileCard(p: ViewProps) {
  const { item, overlay, setOverlay } = p
  const hasLink = !!item.sourceUrl
  return createPortal(
    <div className="fixed inset-0 z-40">
      <div
        aria-hidden="true"
        className="fade-in absolute inset-0 bg-[rgba(23,24,28,0.35)]"
        onClick={p.onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Карточка желания"
        className="sheet-up absolute inset-x-0 top-[calc(env(safe-area-inset-top)+48px)] bottom-0 flex flex-col overflow-hidden rounded-t-window bg-surface"
      >
        <div
          aria-hidden="true"
          className="absolute top-2.5 left-1/2 z-10 h-[5px] w-10 -translate-x-1/2 rounded-full bg-border-strong"
        />
        <div
          className={`flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain px-5 pt-6 ${
            hasLink ? 'pb-8' : 'pb-[calc(env(safe-area-inset-bottom)+30px)]'
          }`}
        >
          <div className="relative w-[300px] max-w-[calc(100%-32px)] flex-none self-center">
            <PhotoSquare url={p.photoUrl} alt={item.title} radius={24} iconSize={64} />
            {item.imagePath ? null : <AddPhotoButton onClick={() => p.openEdit()} />}
            {p.done ? <DoneLabel status={item.status} /> : null}
            <button
              type="button"
              aria-label="Закрыть"
              onClick={p.onClose}
              className="absolute -top-2 -left-4 flex size-11 cursor-pointer items-center justify-center rounded-full bg-surface shadow-photo"
            >
              <CloseIcon size={16} />
            </button>
            <CardMenu
              open={overlay === 'menu'}
              setOpen={(v) => setOverlay(v ? 'menu' : null)}
              onEdit={() => p.openEdit()}
              onMove={() => setOverlay('move')}
              onDelete={p.remove}
              buttonClassName="absolute -top-2 -right-4 shadow-photo"
              idleBg="bg-surface"
              panelClassName="absolute top-[58px] -right-4 z-30 w-[220px]"
              dim
            />
          </div>

          <h1 className="m-0 mt-0.5 text-[21px] leading-[1.28] font-bold tracking-[-0.01em] [overflow-wrap:anywhere]">
            {item.title}
          </h1>

          <PriceRow {...p} large={false} />

          {item.description ? <Description text={item.description} /> : null}

          <StatusField {...p} inline />

          <InfoLine item={item} list={p.list} />
        </div>

        {hasLink ? (
          <div className="flex-none bg-surface px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-[0_-1px_0_var(--divider)]">
            <ShopButton url={item.sourceUrl!} />
          </div>
        ) : null}
      </section>
    </div>,
    document.body,
  )
}

// ─── Компьютер: окно поверх списка ───────────────────────────

function DesktopCard(p: ViewProps) {
  const { item, overlay, setOverlay } = p
  return createPortal(
    <div className="fixed inset-0 z-40 overflow-y-auto">
      <div
        aria-hidden="true"
        className="fade-in fixed inset-0 bg-[rgba(23,24,28,0.38)]"
        onClick={p.onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Карточка желания"
        className="pop-in relative mx-auto mt-16 mb-6 flex w-[min(940px,calc(100%-48px))] flex-wrap gap-8 rounded-window bg-surface p-6 shadow-window"
      >
        <div className="relative max-w-[420px] flex-[1_1_340px] self-start">
          <PhotoSquare url={p.photoUrl} alt={item.title} radius={24} iconSize={72} />
          {item.imagePath ? null : <AddPhotoButton onClick={() => p.openEdit()} />}
          {p.done ? <DoneLabel status={item.status} /> : null}
        </div>

        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-3.5 py-1 pr-1">
          <div className="relative -mb-1.5 flex justify-end gap-2">
            <CardMenu
              open={overlay === 'menu'}
              setOpen={(v) => setOverlay(v ? 'menu' : null)}
              onEdit={() => p.openEdit()}
              onMove={() => setOverlay('move')}
              onDelete={p.remove}
              idleBg="bg-bg hover:bg-[#ebebe5]"
              panelClassName="absolute top-[50px] right-0 z-30 w-[210px]"
            />
            <button
              type="button"
              aria-label="Закрыть"
              onClick={p.onClose}
              className="flex size-11 cursor-pointer items-center justify-center rounded-full bg-bg hover:bg-[#ebebe5]"
            >
              <CloseIcon size={16} />
            </button>
          </div>

          <h1 className="m-0 text-2xl leading-[1.28] font-bold tracking-[-0.01em] [overflow-wrap:anywhere]">
            {item.title}
          </h1>

          <PriceRow {...p} large />

          {item.description ? <Description text={item.description} /> : null}

          <StatusField {...p} inline={false} />

          <InfoLine item={item} list={p.list} />

          {item.sourceUrl ? (
            <div className="mt-1">
              <ShopButton url={item.sourceUrl} />
            </div>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  )
}

// ─── Части карточки ──────────────────────────────────────────

function AddPhotoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-5 left-1/2 h-11 -translate-x-1/2 cursor-pointer rounded-[14px] bg-surface px-4 text-sm font-semibold whitespace-nowrap shadow-photo"
    >
      + Добавить фото
    </button>
  )
}

function DoneLabel({ status }: { status: WishStatus }) {
  return (
    <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-[5px] rounded-full bg-text py-[5px] pr-2.5 pl-2 text-xs font-bold text-white">
      <CheckIcon size={12} strokeWidth={3} className="text-accent" />
      {statusLabel(status)}
    </span>
  )
}

/** Цена слева, приоритет справа — одна строка (D-087). Нажатие на приоритет — выбор из 5 уровней. */
function PriceRow({
  item,
  overlay,
  setOverlay,
  choosePriority,
  openEdit,
  large,
}: ViewProps & { large: boolean }) {
  const open = overlay === 'priority'
  const rootRef = useRef<HTMLDivElement>(null)
  useDismiss(rootRef, open, () => setOverlay(null))
  return (
    <div className={`flex items-center justify-between gap-3 ${large ? '' : '-mt-1.5'}`}>
      {item.price != null ? (
        <span
          className={`font-display font-semibold tracking-[-0.03em] whitespace-nowrap ${
            large ? 'text-[28px]' : 'text-2xl'
          }`}
        >
          {formatRub(item.price)}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => openEdit(true)}
          className="h-10 cursor-pointer rounded-[12px] border-[1.5px] border-dashed border-[#c9c7ff] bg-[#f7f5ff] px-3 text-sm font-semibold whitespace-nowrap text-accent-2-text"
        >
          + Указать цену
        </button>
      )}
      <div ref={rootRef} className={`relative ${large ? '' : '-mr-2.5'}`}>
        <button
          type="button"
          aria-label={`Приоритет: ${priorityLabel(item.priority)}. Изменить`}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOverlay(open ? null : 'priority')}
          className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-[12px] px-2.5 whitespace-nowrap ${
            open ? 'bg-accent-2-soft' : 'hover:bg-[#f7f5ff]'
          }`}
        >
          <Hearts level={item.priority} size={14} gap={0} />
          <span className="text-sm font-semibold text-accent-2-text">
            {priorityLabel(item.priority)}
          </span>
          <ChevronDownIcon size={14} className="text-accent-2-text" />
        </button>
        {open ? (
          <div
            role="listbox"
            aria-label="Приоритет"
            className="pop-in absolute top-[50px] right-0 z-30 flex w-[250px] flex-col rounded-[18px] bg-surface p-1.5 shadow-[0_16px_40px_rgba(23,24,28,0.2),0_0_0_1px_var(--divider)]"
          >
            {[5, 4, 3, 2, 1].map((n) => {
              const on = n === item.priority
              return (
                <button
                  key={n}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => choosePriority(n)}
                  className={`flex h-[46px] cursor-pointer items-center gap-2.5 rounded-[12px] px-2.5 text-left lg:h-11 ${
                    on ? 'bg-bg' : 'hover:bg-bg'
                  }`}
                >
                  <Hearts level={n} size={13} gap={0} />
                  <span
                    className={`flex-1 text-sm whitespace-nowrap ${on ? 'font-semibold' : 'font-normal'}`}
                  >
                    {PRIORITY_LABELS[n - 1]}
                  </span>
                  {on ? <CheckIcon size={16} strokeWidth={2.4} /> : null}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Описание: 4 строки и «Ещё» → целиком, «Свернуть» (D-068). */
function Description({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || expanded) return
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text, expanded])
  return (
    <div className="flex flex-col gap-1">
      <p
        ref={ref}
        className={`m-0 text-[15px] leading-[1.45] whitespace-pre-line [overflow-wrap:anywhere] ${
          expanded ? '' : 'line-clamp-4'
        }`}
      >
        {text}
      </p>
      {overflows || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="cursor-pointer self-start py-1 text-sm font-semibold text-accent-2-text"
        >
          {expanded ? 'Свернуть' : 'Ещё'}
        </button>
      ) : null}
    </div>
  )
}

/**
 * Статус — выпадающий список «В желаниях» / «Куплено» / «Подарили» (D-069, D-070).
 * Телефон: поле на всю ширину, варианты раскрываются под ним (Mobile-Card-Status). Компьютер: «Статус [кнопка]».
 */
function StatusField({
  item,
  overlay,
  setOverlay,
  chooseStatus,
  inline,
}: ViewProps & { inline: boolean }) {
  const open = overlay === 'status'
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useDismiss(rootRef, open, () => setOverlay(null))
  useEffect(() => {
    if (open) panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [open])

  const options = (
    <div
      ref={panelRef}
      role="listbox"
      aria-label="Статус"
      className={`flex flex-col rounded-[16px] bg-surface p-1.5 shadow-[0_14px_34px_rgba(23,24,28,0.16),0_0_0_1px_var(--divider)] ${
        inline ? '' : 'pop-in absolute top-[50px] left-0 z-30 w-[220px]'
      }`}
    >
      {STATUS_OPTIONS.map((o) => {
        const on = o.key === item.status || (o.key === 'active' && item.status === 'booked')
        return (
          <button
            key={o.key}
            type="button"
            role="option"
            aria-selected={on}
            onClick={() => chooseStatus(o.key)}
            className={`flex h-[46px] cursor-pointer items-center justify-between rounded-[12px] px-3 text-left text-[15px] lg:h-11 ${
              on ? 'bg-bg font-semibold' : 'font-normal hover:bg-bg'
            }`}
          >
            {o.label}
            {on ? <CheckIcon size={16} strokeWidth={2.4} /> : null}
          </button>
        )
      })}
    </div>
  )

  if (inline) {
    return (
      <div ref={rootRef} className="flex flex-col gap-1.5">
        <span id="wish-status-label" className="text-xs text-text-2">
          Статус
        </span>
        <button
          type="button"
          aria-label={`Статус: ${statusLabel(item.status)}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOverlay(open ? null : 'status')}
          className={`flex h-[50px] cursor-pointer items-center justify-between rounded-field border-[1.5px] px-3.5 text-[15px] font-semibold ${
            open ? 'border-text' : 'border-border'
          }`}
        >
          <span id="wish-status-value">{statusLabel(item.status)}</span>
          {open ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
        </button>
        {open ? options : null}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3">
      <span id="wish-status-label" className="text-[13px] text-text-2">
        Статус
      </span>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          aria-label={`Статус: ${statusLabel(item.status)}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOverlay(open ? null : 'status')}
          className={`inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-field border-[1.5px] bg-surface pr-3 pl-3.5 text-[15px] font-semibold ${
            open ? 'border-text' : 'border-border hover:border-border-strong'
          }`}
        >
          <span id="wish-status-value">{statusLabel(item.status)}</span>
          {open ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
        </button>
        {open ? options : null}
      </div>
    </div>
  )
}

function InfoLine({ item, list }: { item: WishItem; list: ListSummary }) {
  return (
    <p className="m-0 text-[13px] text-text-2">
      В списке «{list.title}» · добавлено {formatAddedDate(item.addedAt)}
    </p>
  )
}

/** «Перейти в магазин» — главная кнопка; ссылка открывается в новой вкладке / во внешнем браузере. */
function ShopButton({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-14 items-center justify-center gap-2.5 rounded-btn bg-accent text-[17px] font-bold text-text no-underline hover:brightness-[0.97]"
    >
      Перейти в магазин
      <ExternalIcon size={18} />
    </a>
  )
}

/** Меню «•••»: «Редактировать», «Переместить», «Удалить» (D-071). */
function CardMenu({
  open,
  setOpen,
  onEdit,
  onMove,
  onDelete,
  buttonClassName = '',
  idleBg,
  panelClassName,
  dim = false,
}: {
  open: boolean
  setOpen: (v: boolean) => void
  onEdit: () => void
  onMove: () => void
  onDelete: () => void
  buttonClassName?: string
  idleBg: string
  panelClassName: string
  /** телефон: лёгкое затемнение под меню (Mobile-Card-Menu) */
  dim?: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  useDismiss(rootRef, open, () => setOpen(false))
  return (
    <div ref={rootRef} className={buttonClassName ? 'contents' : 'relative'}>
      <button
        type="button"
        aria-label="Ещё действия"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`z-[31] flex size-11 cursor-pointer items-center justify-center rounded-full ${
          open ? 'bg-accent-2-soft' : idleBg
        } ${buttonClassName}`}
      >
        <MoreIcon size={20} />
      </button>
      {open ? (
        <>
          {dim ? (
            // затемнение внутри rootRef — закрываем меню нажатием на него самого
            <div
              aria-hidden="true"
              onClick={() => setOpen(false)}
              className="fade-in fixed inset-0 z-20 cursor-pointer bg-[rgba(23,24,28,0.12)]"
            />
          ) : null}
          <MenuPanel label="Действия с карточкой" className={panelClassName}>
            <MenuItem icon={<EditIcon size={18} className="flex-none" />} onClick={onEdit}>
              Редактировать
            </MenuItem>
            <MenuItem icon={<ArrowRightIcon size={18} className="flex-none" />} onClick={onMove}>
              Переместить
            </MenuItem>
            <MenuDivider />
            <MenuItem
              danger
              icon={<TrashIcon size={18} className="flex-none" />}
              onClick={onDelete}
            >
              Удалить
            </MenuItem>
          </MenuPanel>
        </>
      ) : null}
    </div>
  )
}

/** «Переместить в список» — телефон: шторка снизу (Mobile-Card-Move), компьютер: окно (Desktop-Card-Move). */
function MovePicker({
  lists,
  currentId,
  isDesktop,
  onPick,
  onClose,
}: {
  lists: ListSummary[]
  currentId: string
  isDesktop: boolean
  onPick: (l: ListSummary) => void
  onClose: () => void
}) {
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [])

  const rows: ReactNode = lists.map((l) => {
    const cur = l.id === currentId
    return (
      <button
        key={l.id}
        type="button"
        aria-current={cur || undefined}
        onClick={() => onPick(l)}
        className={`flex flex-none cursor-pointer items-center gap-3 px-2.5 text-left ${
          isDesktop ? 'h-[52px] rounded-[14px]' : 'h-14 rounded-[16px]'
        } ${cur ? 'bg-bg' : 'hover:bg-bg'}`}
      >
        <ListIcon icon={l.icon} color={l.color} size={16} box={isDesktop ? 32 : 34} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{l.title}</span>
        <span className="flex-none text-[13px] text-text-2">{wishCount(l.itemCount)}</span>
        {cur ? (
          <CheckIcon size={18} strokeWidth={2.4} className="flex-none" />
        ) : (
          <span className="w-[18px] flex-none" />
        )}
      </button>
    )
  })

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fade-in absolute inset-0 ${
          isDesktop ? 'bg-[rgba(23,24,28,0.25)]' : 'bg-[rgba(23,24,28,0.35)]'
        }`}
      />
      {isDesktop ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="move-title"
          className="pop-in absolute top-[200px] left-1/2 flex max-h-[calc(100dvh-240px)] w-[400px] max-w-[calc(100%-48px)] -translate-x-1/2 flex-col gap-1.5 overflow-y-auto rounded-[26px] bg-surface p-[18px] shadow-[0_30px_80px_rgba(23,24,28,0.3)]"
        >
          <h2 id="move-title" className="mx-1.5 mt-1 mb-2 text-lg font-bold">
            Переместить в список
          </h2>
          {rows}
        </div>
      ) : (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="move-title"
          className="sheet-up absolute inset-x-0 bottom-0 flex max-h-[80dvh] flex-col gap-2.5 overflow-y-auto rounded-t-[28px] bg-surface px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+30px)]"
        >
          <div
            aria-hidden="true"
            className="h-[5px] w-10 flex-none self-center rounded-full bg-border-strong"
          />
          <h2 id="move-title" className="mx-1 mt-1 mb-0.5 text-lg font-bold">
            Переместить в список
          </h2>
          {rows}
        </div>
      )}
    </div>,
    document.body,
  )
}
