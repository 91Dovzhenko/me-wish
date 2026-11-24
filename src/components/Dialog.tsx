import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  title: string
  body?: string
  /** действие — справа */
  primary: string
  /** отмена — слева, серая */
  secondary: string
  /** опасное действие — красное, иначе лаймовое */
  danger?: boolean
  busy?: boolean
  onPrimary: () => void
  onSecondary: () => void
  /** дополнительное поле между текстом и кнопками (выбор списка — Mobile-Trash-Restore) */
  children?: ReactNode
}

/**
 * Диалог подтверждения — Dialog.dc.html / Spec-Feedback.
 * Слева отмена (серая), справа действие. Фон затемняется на 40%. Esc и нажатие на фон — отмена.
 */
export default function Dialog({
  title,
  body,
  primary,
  secondary,
  danger = true,
  busy,
  onPrimary,
  onSecondary,
  children,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const secondaryRef = useRef(onSecondary)
  useEffect(() => {
    secondaryRef.current = onSecondary
  })

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        secondaryRef.current()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      prev?.focus?.()
    }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div
        aria-hidden="true"
        className="fade-in absolute inset-0 bg-[rgba(23,24,28,0.4)]"
        onClick={onSecondary}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={body ? 'dialog-body' : undefined}
        className="pop-in relative flex w-full max-w-[360px] flex-col gap-2.5 rounded-[28px] bg-surface p-6 shadow-[0_30px_80px_rgba(23,24,28,0.3)]"
      >
        <h2 id="dialog-title" className="m-0 text-[19px] leading-[1.3] font-bold">
          {title}
        </h2>
        {body ? (
          <p id="dialog-body" className="m-0 text-[15px] leading-[1.45] text-text-2">
            {body}
          </p>
        ) : null}
        {children}
        <div className="mt-2.5 flex gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onSecondary}
            className="h-[50px] flex-1 cursor-pointer rounded-[16px] bg-bg text-[15px] font-semibold whitespace-nowrap outline-none hover:bg-[#ebebe5] focus-visible:ring-2 focus-visible:ring-text"
          >
            {secondary}
          </button>
          <button
            type="button"
            onClick={onPrimary}
            disabled={busy}
            className={`h-[50px] flex-1 cursor-pointer rounded-[16px] text-[15px] font-bold whitespace-nowrap disabled:cursor-default disabled:opacity-70 ${
              danger ? 'bg-danger text-white hover:bg-[#9f1f15]' : 'bg-accent text-text'
            }`}
          >
            {primary}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
