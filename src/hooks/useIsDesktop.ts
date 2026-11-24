import { useSyncExternalStore } from 'react'

// Точка перехода телефон/компьютер — 1024 px (как `lg:` в Tailwind)
const QUERY = '(min-width: 64rem)'

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

/** true на компьютере (от 1024 px). Для мест, где телефон и компьютер различаются устройством, а не только стилями. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
