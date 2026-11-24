import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  /** подпись окна для экранных дикторов */
  label: string
  onClose: () => void
  children: ReactNode
  /** классы содержимого (отступы между строками) */
  className?: string
}

/**
 * Простая шторка снизу (телефон): ручка, затемнение, Esc и нажатие на фон закрывают.
 * Для коротких выборов — «Фото профиля», «Список по умолчанию», подсказка установки (Mobile-Profile).
 */
export default function Sheet({ label, onClose, children, className = 'gap-2' }: Props) {
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

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fade-in absolute inset-0 bg-[rgba(23,24,28,0.35)]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`sheet-up absolute inset-x-0 bottom-0 mx-auto flex max-h-[85dvh] max-w-[560px] flex-col overflow-y-auto rounded-t-[28px] bg-surface px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+30px)] ${className}`}
      >
        <div
          aria-hidden="true"
          className="mb-1.5 h-[5px] w-10 flex-none self-center rounded-full bg-border-strong"
        />
        {children}
      </div>
    </div>,
    document.body,
  )
}
