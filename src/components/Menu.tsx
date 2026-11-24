import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

/** Закрывать всплывающее по нажатию снаружи и по Esc (Esc не доходит до окна под ним). */
// eslint-disable-next-line react-refresh/only-export-components
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) closeRef.current()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, ref])
}

/**
 * Всплывающее меню «•••» — Spec-Components: белая подложка, скругление 20 (компьютер 18),
 * пункты 46 px (компьютер 44), разделитель, опасный пункт красным.
 */
export function MenuPanel({
  label,
  className = '',
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div
      role="menu"
      aria-label={label}
      className={`pop-in flex flex-col rounded-[20px] bg-surface p-1.5 shadow-[0_16px_40px_rgba(23,24,28,0.18),0_0_0_1px_var(--divider)] lg:rounded-[18px] ${className}`}
    >
      {children}
    </div>
  )
}

export function MenuItem({
  icon,
  danger,
  onClick,
  children,
}: {
  icon?: ReactNode
  danger?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex h-[46px] cursor-pointer items-center gap-3 rounded-[14px] px-3 text-left text-[15px] lg:h-11 lg:gap-2.5 lg:rounded-item lg:text-sm ${
        danger ? 'text-danger hover:bg-danger-soft' : 'hover:bg-bg'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

/** Недоступный пункт с пояснением (Mobile-List-Menu-Last). */
export function MenuItemDisabled({
  icon,
  hint,
  children,
}: {
  icon?: ReactNode
  hint: string
  children: ReactNode
}) {
  return (
    <div
      role="menuitem"
      aria-disabled="true"
      className="flex cursor-default flex-col gap-0.5 rounded-[14px] px-3 py-2 text-[#a9aaaf] lg:rounded-item"
    >
      <span className="flex items-center gap-3 text-[15px] lg:gap-2.5 lg:text-sm">
        {icon}
        {children}
      </span>
      <span className="pl-[30px] text-xs text-[#6b6d73] lg:pl-[27px]">{hint}</span>
    </div>
  )
}

export function MenuDivider() {
  return <div aria-hidden="true" className="mx-2 my-1 h-px bg-divider" />
}
