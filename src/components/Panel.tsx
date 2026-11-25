import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useIsDesktop } from '../hooks/useIsDesktop.ts'
import { CloseIcon } from './Icons.tsx'

type Props = {
  title: string
  onClose: () => void
  children: ReactNode
  /** ширина окна на компьютере */
  width?: number
}

/**
 * Окно поверх экрана: телефон — шторка снизу с ручкой, компьютер — окно по центру (Members / Invite, 2.21–2.26).
 * Заголовок с крестиком; Esc и нажатие на фон закрывают.
 */
export default function Panel({ title, onClose, children, width = 520 }: Props) {
  const isDesktop = useIsDesktop()
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

  const head = (
    <div className="flex items-center justify-between gap-3">
      <h2 className="m-0 min-w-0 truncate text-xl font-bold">{title}</h2>
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full bg-bg"
      >
        <CloseIcon size={16} />
      </button>
    </div>
  )

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fade-in absolute inset-0 ${
          isDesktop ? 'bg-[rgba(23,24,28,0.38)]' : 'bg-[rgba(23,24,28,0.35)]'
        }`}
      />
      {isDesktop ? (
        <section
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="pop-in absolute top-[100px] left-1/2 flex max-h-[calc(100dvh-140px)] max-w-[calc(100%-48px)] -translate-x-1/2 flex-col gap-3.5 overflow-y-auto rounded-[28px] bg-surface p-6 shadow-[0_30px_80px_rgba(23,24,28,0.25)]"
          style={{ width }}
        >
          {head}
          {children}
        </section>
      ) : (
        <section
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="sheet-up absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] max-w-[560px] flex-col gap-3.5 overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+30px)]"
        >
          <div
            aria-hidden="true"
            className="h-[5px] w-10 flex-none self-center rounded-full bg-border-strong"
          />
          {head}
          {children}
        </section>
      )}
    </div>,
    document.body,
  )
}
