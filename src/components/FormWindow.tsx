import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useIsDesktop } from '../hooks/useIsDesktop.ts'
import { CloseIcon } from './Icons.tsx'

type Props = {
  title: string
  /** закрытие крестиком, Esc или нажатием на фон (форма сама решает, спросить ли «Не сохранять?») */
  onClose: () => void
  children: ReactNode
  /** телефон: кнопка внизу шторки; компьютер: строка кнопок внизу окна */
  footer: ReactNode
  /** отступ окна сверху на компьютере */
  desktopTop?: number
  /** ширина окна на компьютере (по умолчанию 700) */
  desktopWidth?: number
  /** классы строки кнопок на компьютере (по умолчанию — в ряд, по краям) */
  desktopFooterClassName?: string
  /**
   * В форме есть введённые данные: свайп вниз не закрывает шторку, а возвращает её на место
   * и вызывает onClose — форма спросит «Не сохранять…?» (D-081, D-104).
   */
  dirty?: boolean
}

/** Отступ активного поля от кнопки внизу шторки (и от верха). */
const FIELD_MARGIN = 16

/**
 * Видимая часть экрана на телефоне: при открытой клавиатуре iOS не уменьшает окно, а только visualViewport.
 * Шторка повторяет её — кнопка внизу оказывается над клавиатурой (Mobile-Add-Keyboard).
 */
function useVisualViewport(enabled: boolean) {
  const [box, setBox] = useState<{ top: number; height: number; keyboard: boolean } | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    if (!enabled || !vv) return
    const update = () => {
      const keyboard = window.innerHeight - vv.height > 120
      setBox({ top: vv.offsetTop, height: vv.height, keyboard })
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [enabled])
  return enabled ? box : null
}

/**
 * Форма поверх экрана.
 * Телефон — шторка снизу почти на всю высоту, с «ручкой» и кнопкой, прижатой к низу (Mobile-NewList).
 *   Над клавиатурой: кнопка поднимается, активное поле прокручивается выше неё.
 *   Свайп вниз за ручку и шапку (или по содержимому, прокрученному до верха) закрывает шторку (D-104).
 * Компьютер — окно по центру шириной до 700 px (Desktop-NewList).
 */
export default function FormWindow({
  title,
  onClose,
  children,
  footer,
  desktopTop = 60,
  desktopWidth = 700,
  desktopFooterClassName = 'flex items-center justify-between gap-3 pt-1',
  dirty = false,
}: Props) {
  const isDesktop = useIsDesktop()
  const viewport = useVisualViewport(!isDesktop)
  const closeRef = useRef(onClose)
  const dirtyRef = useRef(dirty)
  useEffect(() => {
    closeRef.current = onClose
    dirtyRef.current = dirty
  })
  const sectionRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  // ─── Активное поле — целиком над кнопкой внизу (и над клавиатурой) ───
  const revealFocused = useCallback(() => {
    const scroller = scrollRef.current
    const el = document.activeElement
    if (!scroller || !(el instanceof HTMLElement) || !scroller.contains(el)) return
    if (!el.matches('input, textarea, select, [contenteditable="true"]')) return
    const box = scroller.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (r.bottom > box.bottom - FIELD_MARGIN) {
      scroller.scrollTop += r.bottom - (box.bottom - FIELD_MARGIN)
    } else if (r.top < box.top + FIELD_MARGIN) {
      scroller.scrollTop -= box.top + FIELD_MARGIN - r.top
    }
  }, [])

  // клавиатура выезжает с анимацией и iOS сам двигает экран — поправляем после каждого изменения
  useLayoutEffect(() => {
    if (!isDesktop) revealFocused()
  }, [isDesktop, viewport, revealFocused])

  useEffect(() => {
    const scroller = scrollRef.current
    if (isDesktop || !scroller) return
    const timers: number[] = []
    const onFocus = () => {
      timers.forEach((t) => window.clearTimeout(t))
      timers.length = 0
      // iOS сначала сам прокручивает поле к клавиатуре (не зная о кнопке), потом выезжает клавиатура
      for (const ms of [50, 300, 600]) timers.push(window.setTimeout(revealFocused, ms))
    }
    // описание растёт при вводе — нижний край не должен уходить под кнопку
    const onInput = () => requestAnimationFrame(revealFocused)
    scroller.addEventListener('focusin', onFocus)
    scroller.addEventListener('input', onInput)
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      scroller.removeEventListener('focusin', onFocus)
      scroller.removeEventListener('input', onInput)
    }
  }, [isDesktop, revealFocused])

  // ─── Свайп вниз закрывает шторку (D-104) ───
  useEffect(() => {
    const sec = sectionRef.current
    if (isDesktop || !sec) return
    let start: { y: number; ok: boolean } | null = null
    let dragging = false
    let dy = 0
    let lastY = 0
    let lastT = 0
    let speed = 0 // px/мс, вниз — положительная

    // тянуть можно за ручку и шапку всегда; за содержимое — только если оно (и всё под пальцем) прокручено до верха
    const canDragFrom = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false
      if (target.closest('[data-sheet-grab]')) return true
      if (target.closest('input[type="range"]')) return false
      for (let el: Element | null = target; el && el !== sec; el = el.parentElement) {
        if (el.scrollTop > 0) return false
      }
      return true
    }
    const setOffset = (px: number, animate: boolean) => {
      const t = animate ? 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'
      sec.style.transition = t
      sec.style.transform = px ? `translateY(${px}px)` : ''
      const bd = backdropRef.current
      if (bd) {
        bd.style.transition = animate ? 'opacity 220ms ease-out' : 'none'
        bd.style.opacity = px ? String(Math.max(0, 1 - px / sec.offsetHeight)) : ''
      }
    }
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        start = null
        return
      }
      const t = e.touches[0]!
      start = { y: t.clientY, ok: canDragFrom(e.target) }
      dragging = false
      dy = 0
      speed = 0
      lastY = t.clientY
      lastT = e.timeStamp
    }
    const onMove = (e: TouchEvent) => {
      if (!start?.ok) return
      const t = e.touches[0]
      if (!t) return
      const d = t.clientY - start.y
      if (!dragging) {
        if (d < -6) {
          start = null // тянут вверх — обычная прокрутка
          return
        }
        if (d < 8) return
        dragging = true
        // клавиатура мешает — убираем
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      }
      e.preventDefault()
      dy = Math.max(0, d)
      const dt = e.timeStamp - lastT
      if (dt > 0) speed = (t.clientY - lastY) / dt
      lastY = t.clientY
      lastT = e.timeStamp
      setOffset(dy, false)
    }
    const onEnd = () => {
      if (!dragging) {
        start = null
        return
      }
      dragging = false
      start = null
      const far = dy > Math.min(160, sec.offsetHeight * 0.25)
      const fast = speed > 0.5 && dy > 40
      if ((far || fast) && !dirtyRef.current) {
        setOffset(sec.offsetHeight, true)
        window.setTimeout(() => closeRef.current(), 200)
      } else {
        setOffset(0, true)
        // с введёнными данными — на место и вопрос «Не сохранять…?»
        if (far || fast) closeRef.current()
      }
    }
    sec.addEventListener('touchstart', onStart, { passive: true })
    sec.addEventListener('touchmove', onMove, { passive: false })
    sec.addEventListener('touchend', onEnd)
    sec.addEventListener('touchcancel', onEnd)
    return () => {
      sec.removeEventListener('touchstart', onStart)
      sec.removeEventListener('touchmove', onMove)
      sec.removeEventListener('touchend', onEnd)
      sec.removeEventListener('touchcancel', onEnd)
    }
  }, [isDesktop])

  // Прокрутка страницы под формой выключена; Esc закрывает
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const header = (
    <div data-sheet-grab className="flex items-center justify-between gap-3">
      <h2 id="form-window-title" className="m-0 text-xl font-bold whitespace-nowrap lg:text-2xl">
        {title}
      </h2>
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full bg-bg hover:bg-[#ebebe5]"
      >
        <CloseIcon size={16} />
      </button>
    </div>
  )

  if (isDesktop) {
    return createPortal(
      <div className="fixed inset-0 z-40 overflow-y-auto">
        <div
          aria-hidden="true"
          className="fade-in fixed inset-0 bg-[rgba(23,24,28,0.38)]"
          onClick={onClose}
        />
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="form-window-title"
          className="pop-in relative mx-auto mb-6 flex flex-col gap-[18px] rounded-window bg-surface px-[30px] pt-[26px] pb-7 shadow-window"
          style={{ marginTop: desktopTop, width: `min(${desktopWidth}px, calc(100% - 48px))` }}
        >
          {header}
          {children}
          <div className={desktopFooterClassName}>{footer}</div>
        </section>
      </div>,
      document.body,
    )
  }

  const rootStyle: CSSProperties | undefined = viewport
    ? { top: viewport.top, height: viewport.height, bottom: 'auto' }
    : undefined
  const keyboard = viewport?.keyboard ?? false

  return createPortal(
    <div className="fixed inset-0 z-40" style={rootStyle}>
      <div
        ref={backdropRef}
        aria-hidden="true"
        className="fade-in absolute inset-0 bg-[rgba(23,24,28,0.35)]"
        onClick={onClose}
      />
      <section
        ref={sectionRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-window-title"
        className="sheet-up absolute inset-x-0 top-[calc(env(safe-area-inset-top)+48px)] bottom-0 flex flex-col overflow-hidden rounded-t-window bg-surface"
      >
        {/* ручка и зона захвата для свайпа вниз */}
        <div data-sheet-grab aria-hidden="true" className="absolute inset-x-0 top-0 z-10 h-6">
          <div className="absolute top-2.5 left-1/2 h-[5px] w-10 -translate-x-1/2 rounded-full bg-border-strong" />
        </div>
        <div
          ref={scrollRef}
          data-sheet-scroll
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pt-6 pb-8"
        >
          {header}
          {children}
        </div>
        <div
          className={`flex-none bg-surface px-5 pt-3 shadow-[0_-1px_0_var(--divider)] ${
            keyboard ? 'pb-3' : 'pb-[calc(env(safe-area-inset-bottom)+20px)]'
          }`}
        >
          {footer}
        </div>
      </section>
    </div>,
    document.body,
  )
}
