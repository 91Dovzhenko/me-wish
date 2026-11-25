import { useState } from 'react'
import Panel from '../../components/Panel.tsx'
import { SAVE_ERROR, useToast } from '../../components/Toast.tsx'
import { useAppData, type ListRole, type ListSummary } from '../../data/AppData.tsx'
import { canShare, copyText, inviteUrl, rememberInviteToken } from './inviteLinks.ts'

const ROLES: { role: ListRole; title: string; text: string; path: string; tile: string }[] = [
  {
    role: 'editor',
    title: 'Редактор',
    text: 'Добавляет и меняет желания',
    path: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
    tile: 'bg-accent-2-soft text-accent-2-text',
  },
  {
    role: 'viewer',
    title: 'Зритель',
    text: 'Только смотрит',
    path: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    tile: 'bg-bg text-[#3A3B40]',
  },
]

/** «Пригласить» — Invite.dc.html: 2.25 выбор роли → 2.26 ссылка, «Скопировать», «Поделиться» (D-113). */
export default function InviteWindow({
  list,
  onClose,
}: {
  list: ListSummary
  onClose: () => void
}) {
  const data = useAppData()
  const toast = useToast()
  const [role, setRole] = useState<ListRole>('editor')
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState<string | null>(null)

  const create = async () => {
    setBusy(true)
    try {
      const inv = await data.createInvite(list.id, role)
      rememberInviteToken(inv.id, inv.token, inv.expiresAt)
      setUrl(inviteUrl(inv.token))
    } catch (e) {
      console.warn('Не удалось создать ссылку:', e)
      toast({ text: SAVE_ERROR, kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (url && (await copyText(url))) toast({ text: 'Ссылка скопирована' })
  }

  const share = async () => {
    if (!url) return
    try {
      await navigator.share({
        title: `ME:WISH · ${list.title}`,
        text: `Приглашаю в список «${list.title}» в ME:WISH`,
        url,
      })
    } catch {
      /* закрыли системное меню — ничего не делаем */
    }
  }

  return (
    <Panel title={`Пригласить в «${list.title}»`} onClose={onClose}>
      <span className="text-sm text-text-2">Кем будет приглашённый?</span>
      <div role="radiogroup" aria-label="Роль" className="flex flex-col gap-2">
        {ROLES.map((r) => {
          const on = r.role === role
          return (
            <button
              key={r.role}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!!url}
              onClick={() => setRole(r.role)}
              className={`flex cursor-pointer items-center gap-3 rounded-[18px] bg-surface p-3.5 text-left disabled:cursor-default ${
                on ? 'border-2 border-text' : 'border-[1.5px] border-border'
              } ${url && !on ? 'opacity-50' : ''}`}
            >
              <span
                className={`flex size-11 flex-none items-center justify-center rounded-[14px] ${r.tile}`}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={r.path} />
                </svg>
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-base font-bold">{r.title}</span>
                <span className="text-[13px] text-text-2">{r.text}</span>
              </span>
              <span
                aria-hidden="true"
                className={`box-border size-[22px] flex-none rounded-full bg-surface ${
                  on ? 'border-[6px] border-text' : 'border-[1.5px] border-[#C9C8C2]'
                }`}
              />
            </button>
          )
        })}
      </div>

      {url ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex h-[52px] items-center gap-2.5 rounded-[14px] bg-bg px-3.5 text-[15px]">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#4B3BC4"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="flex-none"
            >
              <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
            </svg>
            <span className="min-w-0 flex-1 truncate">{url.replace(/^https?:\/\//, '')}</span>
          </div>
          <div className={`grid gap-2 ${canShare() ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <button
              type="button"
              onClick={() => void copy()}
              className="h-[52px] cursor-pointer rounded-[16px] bg-accent text-[15px] font-bold whitespace-nowrap"
            >
              Скопировать ссылку
            </button>
            {canShare() ? (
              <button
                type="button"
                onClick={() => void share()}
                className="h-[52px] cursor-pointer rounded-[16px] bg-text text-[15px] font-semibold text-white"
              >
                Поделиться
              </button>
            ) : null}
          </div>
          <span className="text-[13px] leading-[1.4] text-text-2">
            Ссылка действует 7 дней. Её можно отозвать в «Участниках».
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void create()}
          disabled={busy}
          className="h-[54px] flex-none cursor-pointer rounded-[18px] bg-accent text-base font-bold disabled:opacity-70"
        >
          Создать ссылку
        </button>
      )}
    </Panel>
  )
}
