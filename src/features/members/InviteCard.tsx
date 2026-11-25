import { Link } from 'react-router'
import Avatar from '../../components/Avatar.tsx'
import Cover from '../../components/Cover.tsx'
import { wishCount } from '../../lib/format.ts'
import { asListColor, asListIcon } from '../../lib/listStyle.ts'

/** Данные карточки приглашения — ответ Edge Function invite-preview. */
export type InvitePreview = {
  status: 'ok'
  list_id: string
  title: string
  icon: string
  color: string
  cover_mode: 'collage' | 'icon'
  item_count: number
  cover_urls: string[]
  role: 'editor' | 'viewer'
  inviter_name: string | null
  inviter_avatar: string | null
  expires_at: string
}

const ROLE = {
  editor: {
    name: 'Редактор',
    text: 'добавляет и меняет желания',
    path: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  },
  viewer: {
    name: 'Зритель',
    text: 'только смотрит',
    path: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  },
} as const

/**
 * Карточка приглашения — InviteCard.dc.html: card (1.6 «Принять» / «Не сейчас»), login (1.5, на экране входа),
 * expired (1.7 «Приглашение больше не действует»).
 */
export default function InviteCard(
  props:
    | {
        mode: 'card' | 'login'
        invite: InvitePreview
        busy?: boolean
        onAccept?: () => void
        onLater?: () => void
      }
    | { mode: 'expired' },
) {
  if (props.mode === 'expired') {
    return (
      <section
        aria-label="Приглашение в список"
        className="flex w-full max-w-[460px] flex-col items-center gap-2.5 rounded-[28px] bg-surface px-[18px] py-7 text-center shadow-[0_20px_50px_rgba(75,59,196,0.12)]"
      >
        <span className="flex size-16 items-center justify-center rounded-[22px] bg-bg">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8A8B90"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1M3 3l18 18" />
          </svg>
        </span>
        <span className="text-[19px] font-bold">Приглашение больше не действует</span>
        <span className="text-sm leading-[1.45] text-text-2">
          Попросите прислать новое — ссылка действует 7 дней и её могли отозвать.
        </span>
        <Link
          to="/"
          replace
          className="mt-1.5 inline-flex h-[50px] items-center rounded-[16px] bg-text px-[22px] text-[15px] font-semibold text-white"
        >
          На главную
        </Link>
      </section>
    )
  }

  const { invite: inv, mode } = props
  const login = mode === 'login'
  const role = ROLE[inv.role]
  const inviter = inv.inviter_name || 'Вас'

  return (
    <section
      aria-label="Приглашение в список"
      className={`flex w-full flex-col gap-3.5 rounded-[28px] bg-surface shadow-[0_20px_50px_rgba(75,59,196,0.12)] ${
        login ? 'max-w-[420px] p-3.5' : 'max-w-[460px] p-[18px]'
      }`}
    >
      <div className="flex items-center gap-3.5">
        <div className={`flex-none ${login ? 'w-[110px]' : 'w-[130px]'}`}>
          <Cover
            title={inv.title}
            meta={wishCount(inv.item_count)}
            icon={asListIcon(inv.icon)}
            color={asListColor(inv.color)}
            coverMode={inv.cover_mode}
            photos={inv.cover_urls}
            heightClass={login ? 'h-[80px]' : 'h-[100px]'}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Avatar name={inv.inviter_name ?? ''} src={inv.inviter_avatar} size={28} />
            <span className="text-[13px] text-text-2">
              {inv.inviter_name ? `${inviter} приглашает вас` : 'Вас приглашают'}
            </span>
          </div>
          <span className="text-xl leading-[1.25] font-bold [overflow-wrap:anywhere]">
            в «{inv.title}»
          </span>
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-[14px] bg-[#F5F2FF] px-3 py-2.5 text-[13px] leading-[1.35] text-accent-2-text">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="mt-px flex-none"
        >
          <path d={role.path} />
        </svg>
        <span className="min-w-0 [overflow-wrap:anywhere]">
          <b className="font-bold">{role.name}</b> · {role.text}
        </span>
      </div>
      {login ? (
        <span className="text-[13px] text-text-2">Войдите, чтобы принять приглашение</span>
      ) : (
        <div className="grid grid-cols-[1fr_1.4fr] gap-2">
          <button
            type="button"
            onClick={props.onLater}
            className="h-[52px] cursor-pointer rounded-[16px] bg-bg text-[15px] font-semibold"
          >
            Не сейчас
          </button>
          <button
            type="button"
            onClick={props.onAccept}
            disabled={props.busy}
            className="h-[52px] cursor-pointer rounded-[16px] bg-accent text-base font-bold disabled:opacity-70"
          >
            Принять
          </button>
        </div>
      )}
    </section>
  )
}
