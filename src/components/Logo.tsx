import { HEART_PATH } from './Icons.tsx'

type LogoSize = 'sidebar' | 'header' | 'login' | 'login-desktop'

// Размеры знака и надписи — по макетам: боковое меню, шапка телефона, вход телефон/компьютер.
const SIZES: Record<LogoSize, { box: number; radius: number; icon: number; text: number }> = {
  sidebar: { box: 36, radius: 11, icon: 18, text: 18 },
  header: { box: 38, radius: 12, icon: 20, text: 20 },
  login: { box: 44, radius: 14, icon: 22, text: 26 },
  'login-desktop': { box: 40, radius: 13, icon: 20, text: 22 },
}

/** Логотип ME:WISH: чёрный знак с лаймовым сердцем + надпись (D-076). */
export default function Logo({ size = 'header' }: { size?: LogoSize }) {
  const s = SIZES[size]
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="ME:WISH">
      <span
        className="flex flex-none items-center justify-center bg-text"
        style={{ width: s.box, height: s.box, borderRadius: s.radius }}
        aria-hidden="true"
      >
        <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="var(--accent)">
          <path d={HEART_PATH} />
        </svg>
      </span>
      <span
        className="font-display font-bold whitespace-nowrap"
        style={{ fontSize: s.text, letterSpacing: size === 'login' ? '-0.03em' : '-0.01em' }}
        aria-hidden="true"
      >
        ME:WISH
      </span>
    </span>
  )
}
