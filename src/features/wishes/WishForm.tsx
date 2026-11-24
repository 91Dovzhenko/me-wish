import { useEffect, useRef, useState } from 'react'
import Dialog from '../../components/Dialog.tsx'
import FormWindow from '../../components/FormWindow.tsx'
import { Heart } from '../../components/Hearts.tsx'
import { CheckIcon, ChevronDownIcon } from '../../components/Icons.tsx'
import ImageCropper from '../../components/ImageCropper.tsx'
import ListIcon from '../../components/ListIcon.tsx'
import { useDismiss } from '../../components/Menu.tsx'
import TextField from '../../components/TextField.tsx'
import type { ListSummary, NewWish } from '../../data/AppData.tsx'
import { useIsDesktop } from '../../hooks/useIsDesktop.ts'
import { firstImageFile } from '../../lib/image.ts'
import { rememberLocalPhoto } from '../../lib/photos.ts'
import { priorityLabel } from '../../lib/priority.ts'
import { extractUrl } from '../../lib/url.ts'
import PhotoField from './PhotoField.tsx'
import { usePhoto } from './usePhoto.ts'

const MAX_PRICE_DIGITS = 9

/** «32990» → «32 990» (неразрывные пробелы). */
function groupDigits(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

type Props = {
  userId: string
  lists: ListSummary[]
  initialListId: string
  /** список по умолчанию из профиля — подпись «По умолчанию» */
  defaultListId: string | null
  /** открыта со страницы списка — подпись «Этот список» */
  fromListId: string | null
  onSubmit: (wish: NewWish) => Promise<void>
  /** добавлено — форму закрыть, показать тост */
  onAdded: (wish: NewWish) => void
  onClose: () => void
}

/**
 * Форма «Новое желание» — Mobile-Add (+ -Empty, -Home, -FromList, -NameError, -Keyboard, -Discard,
 * фото: -Uploading, -PhotoError, -PhotoTooBig, -PhotoSmall) и Desktop-Add (+ -Drag).
 * Блока «Подробнее» нет: приоритет и список видны всегда, список уже выбран (D-073, D-088).
 */
export default function WishForm({
  userId,
  lists,
  initialListId,
  defaultListId,
  fromListId,
  onSubmit,
  onAdded,
  onClose,
}: Props) {
  const isDesktop = useIsDesktop()
  const [wishId] = useState(() => crypto.randomUUID())
  const [title, setTitle] = useState('')
  const [priceDigits, setPriceDigits] = useState('')
  const [url, setUrl] = useState('')
  const [urlFocused, setUrlFocused] = useState(false)
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState(3)
  const [listId, setListId] = useState(initialListId)
  const [nameError, setNameError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [askDiscard, setAskDiscard] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)
  const p = usePhoto(userId, wishId)

  const dirty =
    !!p.photo ||
    !!title.trim() ||
    !!priceDigits ||
    !!url.trim() ||
    !!description.trim() ||
    priority !== 3
  const uploading = p.photo?.upload === 'uploading'
  const blocked = saving || !p.ready
  const urlIsText = url.trim() !== '' && extractUrl(url) === null

  const requestClose = () => {
    if (saving || p.cropping) return
    if (dirty) setAskDiscard(true)
    else onClose()
  }

  const submit = async () => {
    if (blocked) return
    if (!title.trim()) {
      setNameError(true)
      titleRef.current?.focus()
      titleRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }
    setSaving(true)
    setSaveError(false)
    const photo = p.photo
    const wish: NewWish = {
      id: wishId,
      listId,
      title: title.trim(),
      price: priceDigits ? Number(priceDigits) : null,
      sourceUrl: extractUrl(url),
      description: description.trim() || null,
      priority,
      imagePath: photo?.path ?? null,
    }
    try {
      await onSubmit(wish)
    } catch (e) {
      console.warn('Не удалось добавить желание:', e)
      setSaving(false)
      setSaveError(true)
      return
    }
    if (photo) {
      // файл теперь принадлежит желанию: не удалять при закрытии формы; карточка сразу покажет его из памяти
      p.keep()
      rememberLocalPhoto(photo.path, photo.blob)
    }
    onAdded(wish)
  }

  // Компьютер: курсор сразу в названии
  useEffect(() => {
    if (isDesktop) titleRef.current?.focus()
  }, [isDesktop])

  // Вставка картинки из буфера (⌘V), пока форма открыта. Текст вставляется в поля как обычно.
  // Перетаскивание файла на окно — подсветка блока фото (Desktop-Add-Drag).
  const pickRef = useRef(p.pickFile)
  const croppingRef = useRef(!!p.cropping)
  useEffect(() => {
    pickRef.current = p.pickFile
    croppingRef.current = !!p.cropping
  })
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) =>
      !!e.dataTransfer && [...e.dataTransfer.types].includes('Files')
    const onPaste = (e: ClipboardEvent) => {
      if (croppingRef.current) return
      const file = firstImageFile(e.clipboardData?.files) ?? firstImageFile(e.clipboardData?.items)
      if (!file || !file.type.startsWith('image/')) return
      e.preventDefault()
      void pickRef.current(file)
    }
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e) || croppingRef.current) return
      e.preventDefault()
      depth++
      setDragOver(true)
    }
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = croppingRef.current ? 'none' : 'copy'
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragOver(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragOver(false)
      if (croppingRef.current) return
      const file = firstImageFile(e.dataTransfer?.files)
      if (file) void pickRef.current(file)
    }
    document.addEventListener('paste', onPaste)
    document.addEventListener('dragenter', onEnter)
    document.addEventListener('dragover', onOver)
    document.addEventListener('dragleave', onLeave)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('dragenter', onEnter)
      document.removeEventListener('dragover', onOver)
      document.removeEventListener('dragleave', onLeave)
      document.removeEventListener('drop', onDrop)
    }
  }, [])

  /** Цена: только цифры, разбивка пробелами при вводе, курсор остаётся после той же цифры. */
  const onPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target
    const raw = el.value
    const caret = el.selectionStart ?? raw.length
    let digitsBefore = raw.slice(0, caret).replace(/\D/g, '').length
    let digits = raw.replace(/\D/g, '')
    // стёрли пробел-разделитель — стираем цифру перед ним
    if (
      digits === priceDigits &&
      raw.length < groupDigits(priceDigits).length &&
      digitsBefore > 0
    ) {
      digits = digits.slice(0, digitsBefore - 1) + digits.slice(digitsBefore)
      digitsBefore--
    }
    digits = digits.replace(/^0+(?=\d)/, '').slice(0, MAX_PRICE_DIGITS)
    digitsBefore = Math.min(digitsBefore, digits.length)
    setPriceDigits(digits)
    const formatted = groupDigits(digits)
    let pos = 0
    for (let seen = 0; pos < formatted.length && seen < digitsBefore; pos++) {
      if (/\d/.test(formatted[pos]!)) seen++
    }
    requestAnimationFrame(() => priceRef.current?.setSelectionRange(pos, pos))
  }

  const cta = (
    <button
      type="submit"
      form="wish-form"
      disabled={blocked}
      aria-disabled={blocked || !title.trim() || undefined}
      className={`h-14 w-full rounded-btn text-[17px] font-bold whitespace-nowrap lg:h-[52px] lg:w-auto lg:rounded-[16px] lg:px-9 lg:text-base ${
        blocked || (!title.trim() && !nameError)
          ? 'bg-accent-disabled text-accent-disabled-text'
          : 'bg-accent text-text hover:brightness-[0.97]'
      } ${blocked ? 'cursor-default' : 'cursor-pointer'}`}
    >
      {saving ? 'Добавляем…' : uploading ? 'Загружаем фото…' : 'Добавить'}
    </button>
  )

  const photoField = (
    <PhotoField
      photo={p.photo}
      problem={p.problem}
      opening={p.opening}
      dragOver={dragOver}
      isDesktop={isDesktop}
      onFile={(f) => void p.pickFile(f)}
      onRecrop={p.recrop}
      onRemove={p.remove}
      onRetry={p.retry}
    />
  )

  const fields = (
    <>
      <TextField
        ref={titleRef}
        label="Название"
        requiredMark
        large
        value={title}
        maxLength={200}
        autoComplete="off"
        enterKeyHint="next"
        placeholder="Что вы хотите?"
        error={nameError ? 'Напишите, что вы хотите' : undefined}
        onChange={(e) => {
          setTitle(e.target.value)
          if (nameError && e.target.value.trim()) setNameError(false)
        }}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="wish-price" className="text-[13px] font-semibold">
          Цена
        </label>
        <div className="relative">
          <input
            ref={priceRef}
            id="wish-price"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="next"
            placeholder="0"
            value={groupDigits(priceDigits)}
            onChange={onPriceChange}
            className="h-[50px] w-full rounded-field border-[1.5px] border-border bg-surface pr-10 pl-3.5 text-base text-text outline-none placeholder:text-text-3 focus:border-text"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-base font-semibold text-text-2"
          >
            ₽
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="wish-url" className="text-[13px] font-semibold">
          Ссылка на товар
        </label>
        <input
          id="wish-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          placeholder="Чтобы подарили именно этот товар"
          value={url}
          aria-describedby={urlIsText && !urlFocused ? 'wish-url-hint' : undefined}
          onFocus={() => setUrlFocused(true)}
          onBlur={() => {
            setUrlFocused(false)
            // вставили текст «Поделиться» или ссылку с метками — показываем то, что сохранится
            const clean = extractUrl(url)
            if (clean && clean !== url.trim()) setUrl(clean)
          }}
          onChange={(e) => setUrl(e.target.value)}
          className="h-[50px] w-full rounded-field border-[1.5px] border-border bg-surface px-3.5 text-base text-text outline-none placeholder:text-text-3 focus:border-text lg:text-[15px]"
        />
        {urlIsText && !urlFocused ? (
          <span id="wish-url-hint" className="text-[13px] text-text-2">
            Это не ссылка — её не сохраним. Подробности можно написать в описании
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="wish-desc" className="text-[13px] font-semibold">
          Описание
        </label>
        <textarea
          id="wish-desc"
          rows={2}
          maxLength={2000}
          placeholder="Размер, цвет, модель, пожелания"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            const el = e.target
            el.style.height = 'auto'
            el.style.height = `${Math.min(el.scrollHeight + 3, 220)}px`
          }}
          className="resize-none rounded-field border-[1.5px] border-border bg-surface px-3.5 py-3 text-base leading-[1.4] text-text outline-none placeholder:text-text-3 focus:border-text lg:text-[15px]"
        />
      </div>
    </>
  )

  const priorityField = (
    <PriorityInput value={priority} onChange={setPriority} compact={isDesktop} />
  )
  const listField = (
    <ListPicker
      lists={lists}
      value={listId}
      onChange={setListId}
      defaultListId={defaultListId}
      fromListId={fromListId}
      compact={isDesktop}
    />
  )

  const saveErrorLine = saveError ? (
    <p role="alert" className="m-0 text-[13px] font-medium text-danger">
      Не получилось добавить — проверьте интернет и попробуйте ещё раз
    </p>
  ) : null

  return (
    <>
      <FormWindow
        title="Новое желание"
        onClose={requestClose}
        keyboardAware
        desktopTop={80}
        desktopWidth={780}
        desktopFooterClassName="flex flex-wrap items-end justify-between gap-4 border-t border-divider pt-[18px]"
        footer={
          isDesktop ? (
            <>
              <div className="flex flex-wrap gap-3.5">
                {priorityField}
                {listField}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {saveErrorLine}
                {cta}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              {saveErrorLine}
              {cta}
            </div>
          )
        }
      >
        <form
          id="wish-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          // телефон: поле с фокусом не прячется под клавиатурой
          onFocus={(e) => {
            if (isDesktop) return
            const el = e.target as HTMLElement
            window.setTimeout(
              () => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
              300,
            )
          }}
          className={isDesktop ? 'flex flex-wrap items-start gap-7' : 'flex flex-col gap-3.5'}
        >
          {photoField}
          {isDesktop ? (
            <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5">{fields}</div>
          ) : (
            <>
              {fields}
              {priorityField}
              {listField}
            </>
          )}
        </form>
      </FormWindow>

      {p.cropping ? (
        <ImageCropper
          src={p.cropping.original.url}
          width={p.cropping.original.width}
          height={p.cropping.original.height}
          initial={p.cropping.initial}
          onCancel={p.cancelCrop}
          onDone={(crop) => void p.confirmCrop(crop)}
        />
      ) : null}

      {askDiscard ? (
        <Dialog
          title="Не сохранять желание?"
          body="Введённые данные пропадут."
          primary="Не сохранять"
          secondary="Продолжить"
          onPrimary={onClose}
          onSecondary={() => setAskDiscard(false)}
        />
      ) : null}
    </>
  )
}

/** Приоритет: 5 сердечек и слово уровня, по умолчанию 3 «Хочу» (D-057). */
function PriorityInput({
  value,
  onChange,
  compact,
}: {
  value: number
  onChange: (v: number) => void
  compact: boolean
}) {
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(Math.min(5, value + 1))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(Math.max(1, value - 1))
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span id="wish-priority-label" className="text-[13px] font-semibold">
        Приоритет
      </span>
      <div
        role="radiogroup"
        aria-labelledby="wish-priority-label"
        onKeyDown={onKey}
        className={`flex items-center rounded-field border-[1.5px] border-border ${
          compact ? 'h-[46px] gap-2 pr-3 pl-1.5' : 'h-[50px] justify-between pr-1.5 pl-1'
        }`}
      >
        <div className="flex items-center">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={i === value}
              aria-label={priorityLabel(i)}
              tabIndex={i === value ? 0 : -1}
              onClick={() => onChange(i)}
              className={`flex cursor-pointer items-center justify-center rounded-[10px] transition-transform active:scale-90 ${
                compact ? 'h-10 w-[30px]' : 'h-11 w-10'
              }`}
            >
              <Heart on={i <= value} size={compact ? 19 : 22} />
            </button>
          ))}
        </div>
        <span
          aria-hidden="true"
          className={`text-sm font-bold whitespace-nowrap text-accent-2-text ${compact ? 'ml-1' : 'pr-2'}`}
        >
          {priorityLabel(value)}
        </span>
      </div>
    </div>
  )
}

/** Выбор списка: только неудалённые списки пользователя; уже выбран (D-073). */
function ListPicker({
  lists,
  value,
  onChange,
  defaultListId,
  fromListId,
  compact,
}: {
  lists: ListSummary[]
  value: string
  onChange: (id: string) => void
  defaultListId: string | null
  fromListId: string | null
  compact: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useDismiss(rootRef, open, () => setOpen(false))
  const current = lists.find((l) => l.id === value) ?? lists[0]
  const note = (id: string) =>
    id === fromListId ? 'Этот список' : id === defaultListId ? 'По умолчанию' : ''

  if (!current) return null
  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <span id="wish-list-label" className="text-[13px] font-semibold">
        Список
      </span>
      <button
        type="button"
        aria-labelledby="wish-list-label wish-list-value"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex cursor-pointer items-center gap-2.5 rounded-field border-[1.5px] bg-surface text-left ${
          open ? 'border-text' : 'border-border hover:border-border-strong'
        } ${compact ? 'h-[46px] max-w-[300px] pr-3 pl-1.5' : 'h-[50px] pr-3 pl-2'}`}
      >
        <ListIcon
          icon={current.icon}
          color={current.color}
          size={compact ? 15 : 16}
          box={compact ? 30 : 34}
        />
        <span
          id="wish-list-value"
          className={`min-w-0 truncate text-[15px] font-semibold ${compact ? '' : 'flex-1'}`}
        >
          {current.title}
        </span>
        {!compact && note(current.id) ? (
          <span className="flex-none text-xs text-text-2">{note(current.id)}</span>
        ) : null}
        <ChevronDownIcon size={compact ? 14 : 16} className="flex-none" />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-labelledby="wish-list-label"
          className="pop-in absolute bottom-full left-0 z-20 mb-2 flex max-h-[300px] w-full min-w-[260px] flex-col overflow-y-auto rounded-[20px] bg-surface p-1.5 shadow-[0_16px_40px_rgba(23,24,28,0.18),0_0_0_1px_var(--divider)] lg:rounded-[18px]"
        >
          {lists.map((l) => {
            const on = l.id === current.id
            return (
              <button
                key={l.id}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => {
                  onChange(l.id)
                  setOpen(false)
                }}
                className={`flex h-[50px] flex-none cursor-pointer items-center gap-2.5 rounded-[14px] px-2 text-left lg:h-[46px] lg:rounded-item ${
                  on ? 'bg-bg' : 'hover:bg-bg'
                }`}
              >
                <ListIcon icon={l.icon} color={l.color} size={15} box={30} />
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold lg:text-sm">
                  {l.title}
                </span>
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
  )
}
