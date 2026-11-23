import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'dark' | 'light' | 'link'

const VARIANTS: Record<Variant, string> = {
  // лаймовая главная
  primary:
    'h-14 rounded-btn bg-accent px-5 text-[17px] font-bold text-text hover:brightness-[0.97] disabled:bg-accent-disabled disabled:text-accent-disabled-text',
  // тёмная
  dark: 'h-[52px] rounded-[16px] bg-text px-5 text-base font-semibold text-white hover:bg-[#2a2b31] disabled:opacity-60',
  // светлая с рамкой
  light:
    'h-[52px] rounded-[16px] border-[1.5px] border-border-strong bg-surface px-5 text-base font-semibold text-text hover:bg-[#fafaf7] disabled:opacity-60',
  // текстовая ссылка
  link: 'py-3 text-sm font-semibold text-accent-2-text hover:underline',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  children: ReactNode
  /** «Пока не работает»: видна как на макете, но ничего не делает (оживёт в следующих ТЗ). */
  inactive?: boolean
}

export default function Button({
  variant = 'primary',
  className = '',
  inactive,
  type = 'button',
  onClick,
  children,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`inline-flex cursor-pointer items-center justify-center gap-2.5 whitespace-nowrap transition-colors disabled:cursor-default ${VARIANTS[variant]} ${inactive ? 'cursor-default' : ''} ${className}`}
      aria-disabled={inactive || undefined}
      title={inactive ? 'Скоро' : rest.title}
      onClick={inactive ? undefined : onClick}
      {...rest}
    >
      {children}
    </button>
  )
}
