import { useEffect, useRef, useState } from 'react'
import DatePicker from '../../components/DatePicker.tsx'
import Dialog from '../../components/Dialog.tsx'
import FormWindow from '../../components/FormWindow.tsx'
import { CalendarIcon } from '../../components/Icons.tsx'
import ListIcon from '../../components/ListIcon.tsx'
import { useDismiss } from '../../components/Menu.tsx'
import TextField from '../../components/TextField.tsx'
import type { CoverMode, ListFields, ListSummary } from '../../data/AppData.tsx'
import { useIsDesktop } from '../../hooks/useIsDesktop.ts'
import { formatFullDate } from '../../lib/format.ts'
import {
  LIST_COLOR_NAMES,
  LIST_COLORS,
  LIST_ICON_NAMES,
  LIST_ICON_PATHS,
  listColorVars,
  type ListIconName,
} from '../../lib/listStyle.ts'

const ICONS = Object.keys(LIST_ICON_PATHS) as ListIconName[]

const EMPTY: ListFields = {
  title: '',
  description: null,
  eventDate: null,
  icon: 'heart',
  color: 'lavender',
  coverMode: 'collage',
}

function normalize(f: ListFields) {
  return JSON.stringify({
    ...f,
    title: f.title.trim(),
    description: f.description?.trim() || null,
  })
}

type Props = {
  /** нет — создание, есть — «Настройки списка» */
  list?: ListSummary
  /** единственный список — «Удалить список» недоступен */
  isLast?: boolean
  onSubmit: (fields: ListFields) => Promise<void>
  onDelete?: () => void
  onClose: () => void
}

/**
 * Форма списка — Mobile-NewList / Desktop-NewList (создание) и Mobile-ListSettings / Desktop-ListSettings (настройки).
 * Выбор обложки — только в настройках, как на макете (решение владельца, 003-b).
 */
export default function ListForm({ list, isLast, onSubmit, onDelete, onClose }: Props) {
  const isEdit = !!list
  const isDesktop = useIsDesktop()
  const [initial] = useState<ListFields>(() =>
    list
      ? {
          title: list.title,
          description: list.description,
          eventDate: list.eventDate,
          icon: list.icon,
          color: list.color,
          coverMode: list.coverMode,
        }
      : EMPTY,
  )
  const [f, setF] = useState<ListFields>(initial)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [askDiscard, setAskDiscard] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof ListFields>(key: K, value: ListFields[K]) =>
    setF((prev) => ({ ...prev, [key]: value }))

  const dirty = normalize(f) !== normalize(initial)

  const requestClose = () => {
    if (saving) return
    if (dirty) setAskDiscard(true)
    else onClose()
  }

  const submit = async () => {
    if (!f.title.trim()) {
      setError('Напишите название списка')
      titleRef.current?.focus()
      return
    }
    setSaving(true)
    try {
      await onSubmit(f)
    } catch {
      setSaving(false)
    }
  }

  // На компьютере курсор сразу в названии при создании
  useEffect(() => {
    if (isDesktop && !isEdit) titleRef.current?.focus()
  }, [isDesktop, isEdit])

  const cta = (
    <button
      type="submit"
      form="list-form"
      disabled={saving}
      className="h-14 w-full cursor-pointer rounded-btn bg-accent text-[17px] font-bold whitespace-nowrap text-text hover:brightness-[0.97] disabled:cursor-default disabled:opacity-70 lg:h-[52px] lg:w-auto lg:rounded-[16px] lg:px-8 lg:text-base"
    >
      {saving ? 'Сохраняем…' : isEdit ? 'Сохранить' : 'Создать список'}
    </button>
  )

  const deleteButton = isEdit ? (
    <DeleteListButton isLast={!!isLast} onClick={() => onDelete?.()} />
  ) : null

  return (
    <>
      <FormWindow
        title={isEdit ? 'Настройки списка' : 'Новый список'}
        onClose={requestClose}
        desktopTop={isEdit ? 40 : 60}
        footer={
          isDesktop ? (
            <>
              {deleteButton}
              <span aria-hidden="true" className="flex-1" />
              {cta}
            </>
          ) : (
            cta
          )
        }
      >
        <form
          id="list-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="flex flex-col gap-4 lg:gap-[18px]"
        >
          <TextField
            ref={titleRef}
            label="Название"
            requiredMark
            large
            value={f.title}
            maxLength={60}
            autoComplete="off"
            enterKeyHint="done"
            error={error}
            onChange={(e) => {
              set('title', e.target.value)
              if (error && e.target.value.trim()) setError('')
            }}
            before={<ListIcon icon={f.icon} color={f.color} size={24} box={50} />}
          />

          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1.6fr_1fr] lg:gap-3">
            <TextField
              label="Описание"
              value={f.description ?? ''}
              maxLength={200}
              autoComplete="off"
              placeholder={isDesktop ? 'О чём этот список' : 'Например, идеи к 35-летию'}
              onChange={(e) => set('description', e.target.value)}
            />
            <DateField value={f.eventDate} onChange={(v) => set('eventDate', v)} />
          </div>

          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 p-0 text-[13px] font-semibold">Иконка</legend>
            <div
              role="radiogroup"
              aria-label="Иконка списка"
              className="grid grid-cols-6 gap-1.5 lg:grid-cols-10"
            >
              {ICONS.map((k) => {
                const on = k === f.icon
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={LIST_ICON_NAMES[k]}
                    onClick={() => set('icon', k)}
                    className="group flex h-12 cursor-pointer items-center justify-center rounded-field lg:h-[50px]"
                  >
                    <span className="rounded-[14px] transition-transform group-hover:scale-105">
                      <ListIcon
                        icon={k}
                        color={on ? f.color : 'gray'}
                        selected={on}
                        size={isDesktop ? 19 : 20}
                        box={44}
                      />
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 p-0 text-[13px] font-semibold">Цвет</legend>
            <div
              role="radiogroup"
              aria-label="Цвет списка"
              className="flex justify-between lg:justify-start lg:gap-2.5"
            >
              {LIST_COLORS.map((c) => {
                const on = c === f.color
                const v = listColorVars(c)
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={LIST_COLOR_NAMES[c]}
                    onClick={() => set('color', c)}
                    className="flex size-10 cursor-pointer items-center justify-center rounded-full lg:size-[38px]"
                    style={{
                      background: v.bg,
                      boxShadow: on ? '0 0 0 2px #FFFFFF, 0 0 0 4px var(--text)' : undefined,
                    }}
                  >
                    <span
                      className="size-3.5 rounded-full lg:size-[13px]"
                      style={{ background: v.fg }}
                    />
                  </button>
                )
              })}
            </div>
          </fieldset>

          {isEdit ? (
            <CoverPicker
              value={f.coverMode}
              icon={f.icon}
              color={f.color}
              onChange={(v) => set('coverMode', v)}
              isDesktop={isDesktop}
            />
          ) : null}

          {/* На телефоне «Удалить список» — внизу формы, над кнопкой «Сохранить» */}
          {!isDesktop ? deleteButton : null}
        </form>
      </FormWindow>

      {askDiscard ? (
        <Dialog
          title={isEdit ? 'Не сохранять изменения?' : 'Не сохранять список?'}
          body={isEdit ? 'Изменения пропадут.' : 'Введённые данные пропадут.'}
          primary="Не сохранять"
          secondary="Продолжить"
          onPrimary={onClose}
          onSecondary={() => setAskDiscard(false)}
        />
      ) : null}
    </>
  )
}

function DeleteListButton({ isLast, onClick }: { isLast: boolean; onClick: () => void }) {
  if (isLast) {
    return (
      <div className="flex flex-col items-center gap-1 lg:items-start">
        <button
          type="button"
          disabled
          aria-describedby="delete-list-hint"
          className="h-[50px] w-full cursor-default rounded-[16px] border-[1.5px] border-border bg-surface text-[15px] font-semibold text-[#a9aaaf] lg:h-12 lg:w-auto lg:rounded-[14px] lg:px-[18px]"
        >
          Удалить список
        </button>
        <span id="delete-list-hint" className="text-xs text-[#6b6d73]">
          Нельзя удалить единственный список
        </span>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-[50px] w-full flex-none cursor-pointer rounded-[16px] border-[1.5px] border-[#f3c9c4] bg-surface text-[15px] font-semibold whitespace-nowrap text-danger hover:bg-danger-soft lg:h-12 lg:w-auto lg:rounded-[14px] lg:px-[18px]"
    >
      Удалить список
    </button>
  )
}

function DateField({
  value,
  onChange,
}: {
  value: string | null
  onChange: (v: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  useDismiss(rootRef, open, () => setOpen(false))

  // На телефоне календарь может оказаться ниже края шторки — прокручиваем к нему
  useEffect(() => {
    if (open) pickerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [open])

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <span id="list-date-label" className="text-[13px] font-semibold">
        Дата события
      </span>
      <button
        type="button"
        aria-labelledby="list-date-label list-date-value"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-[50px] cursor-pointer items-center justify-between rounded-field border-[1.5px] px-3.5 text-left text-[15px] whitespace-nowrap ${
          open ? 'border-text' : 'border-border hover:border-border-strong'
        }`}
      >
        <span id="list-date-value" className={value ? '' : 'text-text-2'}>
          {value ? formatFullDate(value) : 'Не выбрана'}
        </span>
        <CalendarIcon size={18} className="text-text-2" />
      </button>
      {open ? (
        <div ref={pickerRef} className="absolute top-20 left-0 z-10 pb-4 lg:right-0 lg:left-auto">
          <DatePicker
            value={value}
            onChange={(v) => {
              onChange(v)
              setOpen(false)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

function CoverPicker({
  value,
  icon,
  color,
  onChange,
  isDesktop,
}: {
  value: CoverMode
  icon: ListIconName
  color: ListSummary['color']
  onChange: (v: CoverMode) => void
  isDesktop: boolean
}) {
  const option = (mode: CoverMode, preview: React.ReactNode, label: string) => {
    const on = value === mode
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => onChange(mode)}
        className={`flex cursor-pointer flex-col gap-1.5 rounded-[16px] bg-surface px-[5px] pt-[5px] pb-2 text-left ${
          on ? 'border-2 border-text' : 'border-[1.5px] border-border hover:border-border-strong'
        }`}
      >
        {preview}
        <span className="px-1 text-[13px] font-semibold">{label}</span>
      </button>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <span id="cover-label" className="text-[13px] font-semibold">
        Обложка
      </span>
      <div
        role="radiogroup"
        aria-labelledby="cover-label"
        className="grid grid-cols-2 gap-2 lg:grid-cols-[repeat(2,150px)]"
      >
        {option(
          'collage',
          // Фото желаний появятся в 003-c; пока — схема коллажа 2×2
          <span
            aria-hidden="true"
            className="grid h-[72px] grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-[11px] lg:h-20"
          >
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="bg-surface-2" />
            ))}
          </span>,
          isDesktop ? 'Коллаж' : 'Коллаж · 4 последних желания',
        )}
        {option(
          'icon',
          <span
            aria-hidden="true"
            className="flex h-[72px] items-center justify-center rounded-[11px] lg:h-20"
            style={{ background: listColorVars(color).cover }}
          >
            <ListIcon icon={icon} color={color} size={20} box={40} />
          </span>,
          'Иконка',
        )}
      </div>
    </div>
  )
}
