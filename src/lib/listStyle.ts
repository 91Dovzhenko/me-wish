// Иконки и цвета списков — перенесены из docs/design/stage1/ListIcon.dc.html (D-075).
// Тот же набор значений проверяется в базе (check в таблице lists).

export const LIST_ICON_PATHS = {
  heart: 'M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1s3 1 5 1zM12 7c1.5-3 5-3.5 5-1s-3 1-5 1z',
  cake: 'M4 20h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2zM4 15c2 1.3 4 1.3 5.3 0s2.7-1.3 4 0 4 1.3 6.7 0M12 11V7M12 4.5v.01',
  home: 'M4 11l8-7 8 7v9H4zM10 20v-5h4v5',
  plane: 'M2.5 13l19-8-6 15-3.5-6zM12 14l9.5-9',
  suitcase: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  shirt: 'M8 3l4 2 4-2 5 4-3 3-2-1v12H8V9l-2 1-3-3z',
  sneaker: 'M3 17h18v-2c0-1.5-1-2.5-3-3l-4-1-2-4H9L8 10H3zM3 17v2h18v-2M11 11l1.5 1.5M9 12l1.5 1.5',
  tech: 'M4 15v-3a8 8 0 0 1 16 0v3M4 15a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2zM20 15a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2z',
  phone: 'M7 3h10v18H7zM11 18h2',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  book: 'M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10',
  dumbbell: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
  ball: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7l4 3-1.5 4.5h-5L8 10zM12 3v4M16 10l4.5-1.5M14.5 14.5l2.5 4M9.5 14.5L7 18.5M8 10L3.5 8.5',
  child: 'M12 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM7 21v-5a5 5 0 0 1 10 0v5',
  ring: 'M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM9 9l-1.5-3h9L15 9M10 6l2-3 2 3',
  tree: 'M12 3l5 6h-3l4 5h-3l4 5H5l4-5H6l4-5H7zM12 19v2',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.8l-5.25 2.8 1-5.8L3.5 9.7l5.9-.9z',
  sparkles:
    'M10 4l1.6 4.4L16 10l-4.4 1.6L10 16l-1.6-4.4L4 10l4.4-1.6zM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z',
  music: 'M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  game: 'M7 8h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.5 1.7L14.5 13h-5l-1 1.7A3 3 0 0 1 3 13v-1a4 4 0 0 1 4-4zM8 10v3M6.5 11.5h3M15.5 11h.01M17.5 12.5h.01',
  paw: 'M8 7.5a1.6 1.6 0 1 0 0-.01zM16 7.5a1.6 1.6 0 1 0 0-.01zM5 12a1.5 1.5 0 1 0 0-.01zM19 12a1.5 1.5 0 1 0 0-.01zM12 13c-3 0-5 3-5 5a2 2 0 0 0 2 2c1.2 0 2-.6 3-.6s1.8.6 3 .6a2 2 0 0 0 2-2c0-2-2-5-5-5z',
  coffee:
    'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2.5M11 3.5v2.5',
  pot: 'M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2 10h20M9 7h6M12 4v3',
  flower:
    'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 10V6a2.5 2.5 0 1 1 0 0M12 21v-7M12 14c-3 0-5 1.5-5 4M12 17c2 0 4-1 5-3M9.5 9.5a2.5 2.5 0 1 1 0-3.5M14.5 9.5a2.5 2.5 0 1 0 0-3.5',
  palette:
    'M12 3a9 9 0 0 0 0 18c1.1 0 1.7-.9 1.4-1.9-.4-1.2.4-2.1 1.6-2.1H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10zM7.5 12h.01M9.5 8h.01M14.5 8h.01M16.5 12h.01',
  car: 'M4 16v-4l2-5h12l2 5v4zM4 16v2h3v-2M17 16v2h3v-2M4 12h16M7.5 14h.01M16.5 14h.01',
  bike: 'M6 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM18 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM6 14.5L10 8h5l3 6.5M10 8l2.5 6.5H6M13 5h3',
  tent: 'M3 20L12 4l9 16zM12 4v16M9 20l3-6 3 6',
  gem: 'M6 4h12l3 5-9 11L3 9zM3 9h18M9 4l3 16M15 4l-3 16',
} as const

export type ListIconName = keyof typeof LIST_ICON_PATHS

export const LIST_COLORS = [
  'lavender',
  'lime',
  'pink',
  'blue',
  'peach',
  'mint',
  'sand',
  'gray',
] as const

export type ListColor = (typeof LIST_COLORS)[number]

export function asListIcon(value: string | null | undefined): ListIconName {
  return value && value in LIST_ICON_PATHS ? (value as ListIconName) : 'heart'
}

export function asListColor(value: string | null | undefined): ListColor {
  return (LIST_COLORS as readonly string[]).includes(value ?? '')
    ? (value as ListColor)
    : 'lavender'
}

/** CSS-переменные цвета списка (заданы в index.css). */
export function listColorVars(color: ListColor) {
  return {
    bg: `var(--list-${color}-bg)`,
    fg: `var(--list-${color}-fg)`,
    cover: `var(--list-${color}-cover)`,
  }
}
