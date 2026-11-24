import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon } from './Icons.tsx'

// Тосты — Toast.dc.html / Spec-Feedback: тёмная плашка внизу экрана (на телефоне — слева от «+»).
// Обычный исчезает через 4 секунды, с действием — через 6 (D-096).

type ToastInput = {
  text: string
  kind?: 'ok' | 'error'
  action?: { label: string; onClick: () => void }
}

type ToastItem = ToastInput & { id: number }

const ToastContext = createContext<((t: ToastInput) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null)
  const nextId = useRef(1)

  const show = useCallback((t: ToastInput) => {
    setToast({ ...t, id: nextId.current++ })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), toast.action ? 6000 : 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed right-24 bottom-[calc(env(safe-area-inset-bottom)+34px)] left-4 z-[60] flex lg:right-auto lg:bottom-6 lg:left-1/2 lg:-translate-x-1/2"
        >
          {toast ? (
            <div
              key={toast.id}
              role="status"
              className="toast-in pointer-events-auto inline-flex max-w-[360px] min-h-12 items-center gap-3 rounded-[16px] bg-text py-2 pr-2 pl-4 text-white shadow-[0_12px_30px_rgba(23,24,28,0.25)]"
            >
              {toast.kind === 'error' ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FF8A80"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="flex-none"
                >
                  <path d="M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                </svg>
              ) : (
                <CheckIcon size={18} className="flex-none text-accent" />
              )}
              <span className="flex-1 py-1.5 text-sm leading-[1.35] font-medium">{toast.text}</span>
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.action!.onClick()
                    setToast(null)
                  }}
                  className="h-9 flex-none cursor-pointer rounded-[10px] bg-[#2c2d33] px-3 text-sm font-bold whitespace-nowrap text-accent"
                >
                  {toast.action.label}
                </button>
              ) : (
                <span className="w-2" aria-hidden="true" />
              )}
            </div>
          ) : null}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast вне ToastProvider')
  return ctx
}
