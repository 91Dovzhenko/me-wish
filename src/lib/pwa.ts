// Service worker и обновление приложения.
// Раньше новая версия ставилась в фоне, но открытая страница продолжала работать на старом коде
// до ручной перезагрузки — так на Mac старая сборка показывала свежие счётчики без сетки и коллажа.
// Теперь: проверяем обновление при запуске, при возвращении в приложение и раз в 30 минут;
// когда новая версия готова — перезагружаем страницу, но не посреди заполнения формы.
import { registerSW } from 'virtual:pwa-register'

const CHECK_EVERY_MS = 30 * 60 * 1000

/** Открыта форма, обрезка или диалог — перезагрузка стёрла бы введённое. */
function busy() {
  return !!document.querySelector('[role="dialog"], [role="alertdialog"]')
}

export function startPwa() {
  if (!('serviceWorker' in navigator)) return
  let pending = false

  const reloadWhenSafe = () => {
    pending = true
    if (!busy()) window.location.reload()
  }

  registerSW({
    immediate: true,
    onNeedReload: reloadWhenSafe,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {})
      }
      window.setInterval(check, CHECK_EVERY_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
        // свернули приложение с ожидающей версией — при возвращении откроется уже новая
        else if (pending) window.location.reload()
      })
    },
  })

  // новая версия ждёт, пока закроют форму: проверяем после каждого нажатия
  document.addEventListener(
    'click',
    () => {
      if (pending) window.setTimeout(() => pending && !busy() && window.location.reload(), 500)
    },
    true,
  )
}
