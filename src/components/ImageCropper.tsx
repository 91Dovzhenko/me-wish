import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsDesktop } from '../hooks/useIsDesktop.ts'
import type { CropRect } from '../lib/image.ts'
import { CloseIcon, MinusIcon, MoveIcon, PlusIcon } from './Icons.tsx'

const MAX_ZOOM = 3

type Props = {
  /** адрес картинки (object URL) и её размер в пикселях */
  src: string
  width: number
  height: number
  /** прошлая обрезка — при повторном «Обрезать» */
  initial?: CropRect | null
  /** рамка: квадрат (фото желания) или круг (аватар, 003-e) */
  shape?: 'square' | 'circle'
  title?: string
  onCancel: () => void
  onDone: (crop: CropRect) => void
}

/** Положение: масштаб (1 — фото целиком закрывает рамку) и точка исходника в центре рамки. */
type View = { zoom: number; cx: number; cy: number }

function clampView(v: View, w: number, h: number): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom))
  // половина стороны рамки в пикселях исходника
  const half = Math.min(w, h) / zoom / 2
  return {
    zoom,
    cx: Math.min(w - half, Math.max(half, v.cx)),
    cy: Math.min(h - half, Math.max(half, v.cy)),
  }
}

/** экранный масштаб: пикселей экрана на пиксель исходника при рамке f */
function scaleFor(v: View, f: number, w: number, h: number) {
  return (f / Math.min(w, h)) * v.zoom
}

function initialView(w: number, h: number, crop?: CropRect | null): View {
  if (crop && crop.size > 0) {
    return clampView(
      { zoom: Math.min(w, h) / crop.size, cx: crop.x + crop.size / 2, cy: crop.y + crop.size / 2 },
      w,
      h,
    )
  }
  return { zoom: 1, cx: w / 2, cy: h / 2 }
}

/**
 * Обрезка фото — Mobile-Crop / Desktop-Crop (D-066). Рамка всегда квадратная (или круглая для аватара),
 * фото двигается и приближается внутри неё: на телефоне — пальцем и двумя пальцами,
 * на компьютере — перетаскиванием, ползунком, колесом мыши и жестом трекпада.
 */
export default function ImageCropper({
  src,
  width: w,
  height: h,
  initial,
  shape = 'square',
  title = 'Обрежьте фото',
  onCancel,
  onDone,
}: Props) {
  const isDesktop = useIsDesktop()
  const [view, setView] = useState<View>(() => initialView(w, h, initial))
  const viewRef = useRef(view)
  const stageRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState(0)
  const frameRef = useRef(0)
  const pointers = useRef(new Map<number, { x: number; y: number; type: string }>())
  const pinch = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null)
  const gestureScale = useRef(1)

  const apply = useCallback(
    (next: View) => {
      const v = clampView(next, w, h)
      viewRef.current = v
      setView(v)
    },
    [w, h],
  )

  // Размер рамки — от размера области (телефон 74% ширины, как на макете; компьютер до 400 px)
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      const f = isDesktop
        ? Math.min(r.width - 80, r.height - 80, 400)
        : Math.min(r.width * 0.74, r.height - 40, 480)
      frameRef.current = Math.max(120, Math.floor(f))
      setFrame(frameRef.current)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isDesktop])

  const scaleOf = (v: View) => scaleFor(v, frameRef.current, w, h)

  /** Приблизить в factor раз так, чтобы точка (px, py) относительно центра рамки осталась на месте. */
  const zoomAt = useCallback(
    (factor: number, px = 0, py = 0) => {
      const v = viewRef.current
      const s = scaleOf(v)
      const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom * factor))
      const s2 = scaleOf({ ...v, zoom })
      const sx = v.cx + px / s
      const sy = v.cy + py / s
      apply({ zoom, cx: sx - px / s2, cy: sy - py / s2 })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apply, w, h],
  )

  /** координаты события относительно центра рамки */
  const fromCenter = (clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect()
    return { x: clientX - (r.left + r.width / 2), y: clientY - (r.top + r.height / 2) }
  }

  // Колесо мыши и щипок трекпада (в Chrome/Firefox — wheel с ctrlKey), жест трекпада в Safari
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
      const k = e.ctrlKey ? 0.01 : 0.0025
      const p = fromCenter(e.clientX, e.clientY)
      zoomAt(Math.exp(-e.deltaY * unit * k), p.x, p.y)
    }
    type GestureEvt = Event & { scale: number; clientX: number; clientY: number }
    const hasTouch = () => [...pointers.current.values()].some((p) => p.type === 'touch')
    const onGestureStart = (e: Event) => {
      e.preventDefault()
      gestureScale.current = 1
    }
    const onGestureChange = (e: Event) => {
      e.preventDefault()
      // на iPhone щипок уже обработан касаниями — жесты Safari только для трекпада Mac
      if (hasTouch()) return
      const g = e as GestureEvt
      const p = fromCenter(g.clientX, g.clientY)
      zoomAt(g.scale / gestureScale.current, p.x, p.y)
      gestureScale.current = g.scale
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('gesturestart', onGestureStart)
    el.addEventListener('gesturechange', onGestureChange)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('gesturestart', onGestureStart)
      el.removeEventListener('gesturechange', onGestureChange)
    }
  }, [zoomAt])

  const pinchState = () => {
    const [a, b] = [...pointers.current.values()]
    if (!a || !b) return null
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // указатель уже отпущен — захват не нужен
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType })
    pinch.current = pointers.current.size >= 2 ? pinchState() : null
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const dx = e.clientX - prev.x
    const dy = e.clientY - prev.y
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType })

    if (pointers.current.size >= 2) {
      const now = pinchState()
      const before = pinch.current
      if (now && before && before.dist > 0) {
        const v = viewRef.current
        const s = scaleOf(v)
        // сдвиг середины между пальцами — перенос, отношение расстояний — масштаб
        const moved = {
          ...v,
          cx: v.cx - (now.mid.x - before.mid.x) / s,
          cy: v.cy - (now.mid.y - before.mid.y) / s,
        }
        viewRef.current = clampView(moved, w, h)
        const p = fromCenter(now.mid.x, now.mid.y)
        zoomAt(now.dist / before.dist, p.x, p.y)
      }
      pinch.current = now
      return
    }
    const v = viewRef.current
    const s = scaleOf(v)
    apply({ ...v, cx: v.cx - dx / s, cy: v.cy - dy / s })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    pinch.current = pointers.current.size >= 2 ? pinchState() : null
  }

  const done = useCallback(() => {
    const v = viewRef.current
    const size = Math.min(w, h) / v.zoom
    onDone({ x: v.cx - size / 2, y: v.cy - size / 2, size })
  }, [w, h, onDone])

  // Esc — отмена (до формы под обрезкой не доходит), Enter на компьютере — «Готово»; прокрутка выключена
  const cancelRef = useRef(onCancel)
  const doneRef = useRef(done)
  useEffect(() => {
    cancelRef.current = onCancel
    doneRef.current = done
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        cancelRef.current()
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        e.stopPropagation()
        doneRef.current()
      }
    }
    document.addEventListener('keydown', onKey, true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
    }
  }, [])

  const s = scaleFor(view, frame, w, h)
  const imgW = w * s
  const imgH = h * s
  const tx = frame / 2 - view.cx * s
  const ty = frame / 2 - view.cy * s
  const round = shape === 'circle' ? '9999px' : isDesktop ? '6px' : '4px'

  const stage = (
    <div
      ref={stageRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="img"
      aria-label="Область обрезки: фото внутри квадратной рамки"
      className={`relative cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing ${
        isDesktop ? 'h-[480px] rounded-[22px] bg-text' : 'min-h-0 flex-1'
      }`}
    >
      {frame > 0 ? (
        <div
          className="absolute top-1/2 left-1/2"
          style={{ width: frame, height: frame, marginLeft: -frame / 2, marginTop: -frame / 2 }}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left"
            style={{ width: imgW, height: imgH, transform: `translate3d(${tx}px, ${ty}px, 0)` }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 box-border border-2 border-white"
            style={{
              borderRadius: round,
              boxShadow: `0 0 0 9999px rgba(23, 24, 28, ${isDesktop ? 0.6 : 0.62})`,
            }}
          >
            {shape === 'square' ? <Grid /> : null}
          </div>
        </div>
      ) : null}
      {isDesktop ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[rgba(23,24,28,0.7)] px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-white"
        >
          <MoveIcon size={14} />
          Перетащите фото, чтобы выбрать кадр
        </span>
      ) : null}
    </div>
  )

  if (isDesktop) {
    const percent = Math.round(view.zoom * 100)
    return createPortal(
      <div className="fixed inset-0 z-[70] overflow-y-auto">
        <div
          aria-hidden="true"
          className="fade-in fixed inset-0 bg-[rgba(23,24,28,0.38)]"
          onClick={onCancel}
        />
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="crop-title"
          className="pop-in relative mx-auto mt-[70px] mb-6 flex w-[min(640px,calc(100%-48px))] flex-col gap-[18px] rounded-window bg-surface px-7 pt-6 pb-7 shadow-window"
        >
          <div className="flex items-center justify-between">
            <h2 id="crop-title" className="m-0 text-[22px] font-bold">
              {title}
            </h2>
            <button
              type="button"
              aria-label="Закрыть"
              onClick={onCancel}
              className="flex size-11 cursor-pointer items-center justify-center rounded-full bg-bg hover:bg-[#ebebe5]"
            >
              <CloseIcon size={16} />
            </button>
          </div>
          {stage}
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              aria-label="Уменьшить"
              onClick={() => zoomAt(1 / 1.2)}
              className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full bg-bg hover:bg-[#ebebe5]"
            >
              <MinusIcon size={16} strokeWidth={2.2} />
            </button>
            <input
              type="range"
              aria-label="Масштаб"
              aria-valuetext={`${percent}%`}
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={view.zoom}
              onChange={(e) => zoomAt(Number(e.target.value) / viewRef.current.zoom)}
              className="crop-slider h-11 flex-1 cursor-pointer"
              style={{ ['--fill' as string]: `${((view.zoom - 1) / (MAX_ZOOM - 1)) * 100}%` }}
            />
            <button
              type="button"
              aria-label="Увеличить"
              onClick={() => zoomAt(1.2)}
              className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full bg-bg hover:bg-[#ebebe5]"
            >
              <PlusIcon size={16} strokeWidth={2.2} />
            </button>
          </div>
          <p className="m-0 -mt-1.5 text-center text-[13px] text-text-2">
            Масштаб — ползунком, колесом мыши или жестом трекпада.{' '}
            {shape === 'circle' ? 'Рамка круглая.' : 'Рамка всегда квадратная.'}
          </p>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="h-12 cursor-pointer rounded-[16px] bg-bg px-5 text-[15px] font-semibold hover:bg-[#ebebe5]"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={done}
              className="h-12 cursor-pointer rounded-[16px] bg-accent px-7 text-[15px] font-bold hover:brightness-[0.97]"
            >
              Готово
            </button>
          </div>
        </section>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-title"
      className="fade-in fixed inset-0 z-[70] flex flex-col bg-text text-white"
    >
      <div className="relative z-10 flex flex-none items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-11 cursor-pointer items-center px-2 text-base font-medium text-white"
        >
          Отмена
        </button>
        <span id="crop-title" className="text-base font-bold">
          {title}
        </span>
        <button
          type="button"
          onClick={done}
          className="flex h-11 cursor-pointer items-center rounded-[14px] bg-accent px-4 text-base font-bold text-text"
        >
          Готово
        </button>
      </div>
      {stage}
      <div className="relative z-10 flex flex-none flex-col items-center gap-3.5 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <span
          aria-hidden="true"
          className="flex size-[52px] items-center justify-center rounded-full bg-[#2c2d33]"
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#E6E5DF"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4a1.5 1.5 0 0 1 3 0v7M14 10.5V5.5a1.5 1.5 0 0 1 3 0V12M17 9.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L4 16.5a1.6 1.6 0 0 1 2.4-2.1L8 16" />
          </svg>
        </span>
        <p className="m-0 text-center text-[13px] text-[#b5b6bb]">
          Двигайте фото пальцем, приближайте двумя пальцами.
          <br />
          {shape === 'circle'
            ? 'Рамка круглая — так фото будет видно везде.'
            : 'Рамка всегда квадратная.'}
        </p>
      </div>
    </div>,
    document.body,
  )
}

function Grid() {
  const line = 'absolute border-white/45'
  return (
    <>
      <div className={`${line} top-0 bottom-0 left-1/3 border-l`} />
      <div className={`${line} top-0 bottom-0 left-2/3 border-l`} />
      <div className={`${line} top-1/3 right-0 left-0 border-t`} />
      <div className={`${line} top-2/3 right-0 left-0 border-t`} />
    </>
  )
}
