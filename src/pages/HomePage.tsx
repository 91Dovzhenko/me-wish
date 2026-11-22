import { useEffect, useState } from 'react'
import { checkSupabaseConnection } from '../lib/supabase.ts'

type Status = 'checking' | 'ok' | 'error'

const buildTime = new Date(__BUILD_TIME__).toLocaleString('ru-RU', {
  dateStyle: 'long',
  timeStyle: 'short',
})

export default function HomePage() {
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    const controller = new AbortController()
    checkSupabaseConnection(controller.signal).then((ok) => {
      if (!controller.signal.aborted) setStatus(ok ? 'ok' : 'error')
    })
    return () => controller.abort()
  }, [])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-between px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div />
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-accent sm:text-6xl">me:wish</h1>
        <p className="text-lg text-muted">Списки желаний — скоро здесь</p>
        <StatusBadge status={status} />
      </div>
      <p className="text-xs text-muted">Сборка: {buildTime}</p>
    </main>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const text = {
    checking: 'Supabase: проверяем…',
    ok: 'Supabase: подключено',
    error: 'Supabase: нет связи',
  }[status]
  const color = { checking: 'text-muted', ok: 'text-ok', error: 'text-error' }[status]
  const dot = { checking: 'bg-muted', ok: 'bg-ok', error: 'bg-error' }[status]

  return (
    <p
      role="status"
      className={`mt-2 inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-medium ${color}`}
    >
      <span className={`size-2.5 rounded-full ${dot}`} aria-hidden />
      {text}
    </p>
  )
}
