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

export const CloseIcon = (p: IconProps) => <Line strokeWidth={2} {...p} d="M6 6l12 12M18 6L6 18" />
export const MoreIcon = (p: IconProps) => (
  <Line strokeWidth={3} {...p} d="M5 12h.01M12 12h.01M19 12h.01" />
)
export const EditIcon = (p: IconProps) => <Line {...p} d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4" />
export const CalendarIcon = (p: IconProps) => (
  <Line
    {...p}
    d="M7 5h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM4 10h16M9 3v4M15 3v4"
  />
)
export const SortIcon = (p: IconProps) => (
  <Line strokeWidth={2} {...p} d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" />
)
export const ChevronLeftIcon = (p: IconProps) => <Line strokeWidth={2} {...p} d="M15 5l-7 7 7 7" />
export const ChevronRightIcon = (p: IconProps) => <Line strokeWidth={2} {...p} d="M9 5l7 7-7 7" />

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

export const MinusIcon = (p: IconProps) => <Line strokeWidth={2} {...p} d="M5 12h14" />
export const ChevronDownIcon = (p: IconProps) => <Line strokeWidth={2} {...p} d="M6 9l6 6 6-6" />
export const MoveIcon = (p: IconProps) => (
  <Line
    strokeWidth={2}
    {...p}
    d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"
  />
)
export const CropIcon = (p: IconProps) => (
  <Line {...p} d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14" />
)
export const ImageIcon = (p: IconProps) => (
  <svg
    width={p.size ?? 20}
    height={p.size ?? 20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={p.strokeWidth ?? 1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    className={p.className}
  >
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="M21 16l-5-5-8 9" />
  </svg>
)
export const WarnIcon = (p: IconProps) => (
  <Line
    strokeWidth={2}
    {...p}
    d="M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
  />
)
export const GiftIcon = (p: IconProps) => (
  <Line
    strokeWidth={1.5}
    {...p}
    d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1s3 1 5 1zM12 7c1.5-3 5-3.5 5-1s-3 1-5 1z"
  />
)
