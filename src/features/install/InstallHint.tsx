import { useEffect } from 'react'
import { CloseIcon } from '../../components/Icons.tsx'
import Sheet from '../../components/Sheet.tsx'
import { useAppData } from '../../data/AppData.tsx'
import { closeInstallHint, maybeShowInstallHintOnce, useInstallHintOpen } from './installHint.ts'

/** Шторка «Добавьте ME:WISH на экран «Домой»» — Main.dc.html, состояние install. */
export default function InstallHint() {
  const open = useInstallHintOpen()
  const ready = useAppData().status === 'ready'

  // один раз после первого входа — когда главная уже на экране
  useEffect(() => {
    if (!ready) return
    const t = window.setTimeout(maybeShowInstallHintOnce, 800)
    return () => window.clearTimeout(t)
  }, [ready])

  if (!open) return null
  return (
    <Sheet label="Установить на экран «Домой»" onClose={closeInstallHint} className="gap-3.5 px-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-xl font-bold">Добавьте ME:WISH на экран «Домой»</h2>
        <button
          type="button"
          aria-label="Закрыть"
          onClick={closeInstallHint}
          className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full bg-bg"
        >
          <CloseIcon size={16} />
        </button>
      </div>
      <p className="m-0 -mt-1 text-sm leading-[1.45] text-text-2">
        Откроется как обычное приложение — без адресной строки. Подсказка всегда есть в профиле.
      </p>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        <Step n={1} text="Нажмите «Поделиться» в Safari">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1E6FF2"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" />
          </svg>
        </Step>
        <Step n={2} text="Выберите «На экран «Домой»»">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="4" width="16" height="16" rx="4" />
            <path d="M12 8v8M8 12h8" />
          </svg>
        </Step>
        <Step n={3} text="Нажмите «Добавить» справа вверху" wide>
          <span className="text-sm font-semibold text-[#1E6FF2]">Добавить</span>
        </Step>
      </ol>
      <button
        type="button"
        onClick={closeInstallHint}
        className="h-[54px] cursor-pointer rounded-[18px] bg-accent text-base font-bold"
      >
        Понятно
      </button>
    </Sheet>
  )
}

function Step({
  n,
  text,
  wide,
  children,
}: {
  n: number
  text: string
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <li className="flex items-center gap-3 rounded-[16px] bg-bg p-3">
      <span className="flex size-7 flex-none items-center justify-center rounded-full bg-text text-[13px] font-bold text-white">
        {n}
      </span>
      <span className="flex-1 text-[15px]">{text}</span>
      <span
        aria-hidden="true"
        className={`flex h-9 flex-none items-center justify-center rounded-[10px] bg-surface ${
          wide ? 'px-2.5' : 'w-9'
        }`}
      >
        {children}
      </span>
    </li>
  )
}
