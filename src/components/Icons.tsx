// Иконки интерфейса — пути из выгрузки дизайна (docs/design/stage1). Все 24×24, линия.
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }

function Line({ size = 20, strokeWidth = 1.8, d, ...rest }: IconProps & { d: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={d} />
    </svg>
  )
}

export const HEART_PATH = 'M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z'

export const PlusIcon = (p: IconProps) => <Line strokeWidth={2} {...p} d="M12 5v14M5 12h14" />
export const CheckIcon = (p: IconProps) => <Line strokeWidth={2.6} {...p} d="M5 12l5 5 9-10" />
export const BackIcon = (p: IconProps) => <Line {...p} d="M15 5l-7 7 7 7" />
export const ChevronUpIcon = (p: IconProps) => <Line strokeWidth={2} {...p} d="M6 15l6-6 6 6" />
export const HomeIcon = (p: IconProps) => (
  <Line strokeWidth={1.7} {...p} d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
)
export const UserIcon = (p: IconProps) => (
  <Line strokeWidth={1.7} {...p} d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />
)
export const TrashIcon = (p: IconProps) => (
  <Line strokeWidth={1.7} {...p} d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
)
export const LogoutIcon = (p: IconProps) => (
  <Line strokeWidth={1.7} {...p} d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
)
export const AlertIcon = (p: IconProps) => (
  <Line strokeWidth={2} {...p} d="M12 8v5M12 16.5h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
)

export function TelegramIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d="M21.5 4.2L2.9 11.4c-1 .4-1 1.6.1 1.9l4.6 1.4 1.8 5.5c.3.8 1.2 1 1.8.4l2.6-2.4 4.8 3.5c.7.5 1.6.1 1.8-.7l3.2-15.2c.2-1-.8-1.8-1.9-1.4zM9.6 14.2l8.2-6.4-6.6 7.4-.3 3-1.3-4z" />
    </svg>
  )
}
