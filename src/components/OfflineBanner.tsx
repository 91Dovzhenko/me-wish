import { useOnline } from '../hooks/useOnline.ts'

/**
 * «Нет интернета — изменения не сохранятся» (Mobile-Offline, Spec-Feedback).
 * Телефон — плашка поверх верха экрана; компьютер — над контентом. Появляется и исчезает сама.
 */
export default function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div
      role="status"
      className="fade-in fixed inset-x-3 top-[calc(env(safe-area-inset-top)+8px)] z-[55] flex items-center gap-2.5 rounded-[14px] bg-text px-3.5 py-2.5 text-[13px] font-medium text-white lg:sticky lg:inset-x-auto lg:top-3 lg:mx-8 lg:mt-3 lg:max-w-[760px]"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FFB4A9"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="flex-none"
      >
        <path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.7M19 13a10 10 0 0 0-2.5-1.7M12 20h.01" />
      </svg>
      Нет интернета — изменения не сохранятся
    </div>
  )
}
