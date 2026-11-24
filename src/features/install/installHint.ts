// Подсказка «Добавьте ME:WISH на экран «Домой»» (Mobile-InstallHint).
// Сама — один раз после первого входа, только Safari на iPhone/iPad вне установленного приложения.
// Из профиля — всегда.
import { useSyncExternalStore } from 'react'

const SEEN_KEY = 'me-wish:install-hint-seen'

let open = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function openInstallHint() {
  open = true
  emit()
}

export function closeInstallHint() {
  open = false
  emit()
}

export function useInstallHintOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => open,
    () => false,
  )
}

/** Открыто как установленное приложение (с экрана «Домой» или из Dock). */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

/** Safari на iPhone или iPad (iPad с iPadOS 13+ представляется Mac с сенсорным экраном). */
export function isIosSafari(): boolean {
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  // Chrome, Firefox, Edge, Opera, Яндекс, Google-приложение на iOS
  const other = /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|GSA\//.test(ua)
  return ios && !other
}

/** Показать один раз: вызывается, когда данные пользователя загрузились. */
export function maybeShowInstallHintOnce() {
  try {
    if (localStorage.getItem(SEEN_KEY)) return
    if (!isIosSafari() || isStandalone()) return
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    return
  }
  openInstallHint()
}
