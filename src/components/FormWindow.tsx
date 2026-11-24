import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useIsDesktop } from '../hooks/useIsDesktop.ts'
import { CloseIcon } from './Icons.tsx'

type Props = {
  title: string
  /** закрытие крестиком, Esc или нажатием на фон (форма сама решает, спросить ли «Не сохранять?») */
  onClose: () => void
  children: ReactNode
  /** телефон: кнопка внизу шторки; компьютер: строка кнопок внизу окна */
  footer: ReactNode
  /** отступ окна сверху на компьютере */
  desktopTop?: number
}

/**
 * Форма поверх экрана.
 * Телефон — шторка снизу почти на всю высоту, с «ручкой» и кнопкой, прижатой к низу (Mobile-NewList).
 * Компьютер — окно по центру шириной до 700 px (Desktop-NewList).
 */
export default function FormWindow({ title, onClose, children, footer, desktopTop = 60 }: Props) {
  const isDesktop = useIsDesktop()
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  // Прокрутка страницы под формой выключена; Esc закрывает
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const header = (
    <div className="flex items-center justify-between gap-3">
      <h2 id="form-window-title" className="m-0 text-xl font-bold whitespace-nowrap lg:text-2xl">
        {title}
      </h2>
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full bg-bg hover:bg-[#ebebe5]"
      >
        <CloseIcon size={16} />
      </button>
    </div>
  )

  if (isDesktop) {
    return createPortal(
      <div className="fixed inset-0 z-40 overflow-y-auto">
        <div
          aria-hidden="true"
          className="fade-in fixed inset-0 bg-[rgba(23,24,28,0.38)]"
          onClick={onClose}
        />
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="form-window-title"
          className="pop-in relative mx-auto mb-6 flex w-[min(700px,calc(100%-48px))] flex-col gap-[18px] rounded-window bg-surface px-[30px] pt-[26px] pb-7 shadow-window"
          style={{ marginTop: desktopTop }}
        >
          {header}
          {children}
          <div className="flex items-center justify-between gap-3 pt-1">{footer}</div>
        </section>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div
        aria-hidden="true"
        className="fade-in absolute inset-0 bg-[rgba(23,24,28,0.35)]"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-window-title"
        className="sheet-up absolute inset-x-0 top-[calc(env(safe-area-inset-top)+48px)] bottom-0 flex flex-col overflow-hidden rounded-t-window bg-surface"
      >
        <div
          aria-hidden="true"
          className="absolute top-2.5 left-1/2 z-10 h-[5px] w-10 -translate-x-1/2 rounded-full bg-border-strong"
        />
        <div
          data-sheet-scroll
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pt-6 pb-8"
        >
          {header}
          {children}
        </div>
        <div className="flex-none bg-surface px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-[0_-1px_0_var(--divider)]">
          {footer}
        </div>
      </section>
    </div>,
    document.body,
  )
}
