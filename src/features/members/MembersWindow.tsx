import { useCallback, useEffect, useRef, useState } from 'react'
import Avatar from '../../components/Avatar.tsx'
import Dialog from '../../components/Dialog.tsx'
import { MoreIcon, PlusIcon } from '../../components/Icons.tsx'
import { MenuDivider, MenuItem, MenuPanel, useDismiss } from '../../components/Menu.tsx'
import Panel from '../../components/Panel.tsx'
import { SAVE_ERROR, useToast } from '../../components/Toast.tsx'
import {
  useAppData,
  type InviteLink,
  type ListRole,
  type ListSummary,
  type Member,
} from '../../data/AppData.tsx'
import { AVATAR_BUCKET, usePhotoUrls } from '../../lib/photos.ts'
import InviteWindow from './InviteWindow.tsx'
import {
  copyText,
  forgetInviteToken,
  inviteUrl,
  knownInviteToken,
  validUntil,
} from './inviteLinks.ts'

const ROLE_NAME: Record<ListRole, string> = { editor: 'Редактор', viewer: 'Зритель' }
const LINK_NAME: Record<ListRole, string> = { editor: 'Для редактора', viewer: 'Для зрителя' }

/**
 * «Участники» — Members.dc.html (2.21 вы один, 2.22 несколько и ссылки, 2.23 меню участника,
 * 2.24 у зрителя, 2.22D окно на компьютере). Любой редактор приглашает, меняет роль, убирает (D-116).
 */
export default function MembersWindow({
  list,
  onClose,
  onLeave,
}: {
  list: ListSummary
  onClose: () => void
  /** «Выйти из списка» у зрителя (2.24) */
  onLeave: () => void
}) {
  const data = useAppData()
  const toast = useToast()
  const [inviting, setInviting] = useState(false)
  const [removing, setRemoving] = useState<Member | null>(null)
  const [links, setLinks] = useState<InviteLink[]>([])
  const isEditor = list.myRole === 'editor'
  const one = list.members.length <= 1

  const avatarUrls = usePhotoUrls(
    list.members.map((m) => m.avatarPath),
    AVATAR_BUCKET,
  )

  // Ссылки — только редакторам; перечитываются при каждом обновлении данных (Realtime по invites)
  const { fetchInvites, dataVersion } = data
  const loadLinks = useCallback(() => {
    if (!isEditor) return
    fetchInvites(list.id)
      .then(setLinks)
      .catch((e) => console.warn('Не удалось загрузить ссылки:', e))
  }, [fetchInvites, isEditor, list.id])
  useEffect(loadLinks, [loadLinks, dataVersion])

  const failed = () => toast({ text: SAVE_ERROR, kind: 'error' })

  const setRole = (m: Member, role: ListRole) => {
    data.setMemberRole(list.id, m.userId, role).catch(failed)
  }

  const confirmRemove = () => {
    const m = removing
    setRemoving(null)
    if (!m) return
    data
      .removeMember(list.id, m.userId)
      .then(() => toast({ text: `${m.name} больше не в списке` }))
      .catch(failed)
  }

  const copy = async (l: InviteLink) => {
    const token = knownInviteToken(l.id)
    if (!token) return
    if (await copyText(inviteUrl(token))) toast({ text: 'Ссылка скопирована' })
  }

  const revoke = (l: InviteLink) => {
    setLinks((ls) => ls.filter((x) => x.id !== l.id))
    data
      .revokeInvite(l.id)
      .then(() => {
        forgetInviteToken(l.id)
        toast({ text: 'Ссылка отозвана' })
      })
      .catch(() => {
        loadLinks()
        failed()
      })
  }

  if (inviting) {
    return (
      <InviteWindow
        list={list}
        onClose={() => {
          setInviting(false)
          loadLinks()
        }}
      />
    )
  }

  return (
    <>
      <Panel title={`Участники · ${list.title}`} onClose={onClose}>
        {one ? (
          <div className="flex flex-col items-center gap-2.5 rounded-[22px] bg-[#F7F5FF] px-2.5 pt-[18px] pb-1.5 text-center">
            <div className="flex items-center gap-1.5">
              <Avatar
                name={list.members[0]?.name ?? ''}
                src={memberSrc(list.members[0], avatarUrls)}
                size={48}
              />
              <span
                aria-hidden="true"
                className="flex size-12 items-center justify-center rounded-full border-2 border-dashed border-accent-2 text-[#6E56F0]"
              >
                <PlusIcon size={20} />
              </span>
            </div>
            <span className="text-[17px] font-bold">Пригласите близких — ведите список вместе</span>
            <span className="text-sm leading-[1.4] text-text-2">
              Вы пока единственный участник. Отправьте ссылку — она действует 7 дней.
            </span>
          </div>
        ) : null}

        <ul className="m-0 flex list-none flex-col p-0">
          {list.members.map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              src={memberSrc(m, avatarUrls)}
              canManage={isEditor && !m.isMe}
              onRole={(role) => setRole(m, role)}
              onRemove={() => setRemoving(m)}
            />
          ))}
        </ul>

        {isEditor && links.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-text-2">Ссылки-приглашения</span>
            {links.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-2.5 rounded-[16px] bg-bg py-2.5 pr-2.5 pl-3"
              >
                <LinkIcon />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold">{LINK_NAME[l.role]}</span>
                  <span className="truncate text-xs text-text-2">{validUntil(l.expiresAt)}</span>
                </span>
                {knownInviteToken(l.id) ? (
                  <button
                    type="button"
                    onClick={() => void copy(l)}
                    className="h-10 flex-none cursor-pointer rounded-[12px] bg-surface px-3 text-[13px] font-semibold"
                  >
                    Скопировать
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => revoke(l)}
                  className="h-10 flex-none cursor-pointer rounded-[12px] px-2.5 text-[13px] font-semibold text-danger"
                >
                  Отозвать
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {isEditor ? (
          <button
            type="button"
            onClick={() => setInviting(true)}
            className="flex h-[54px] flex-none cursor-pointer items-center justify-center gap-2 rounded-[18px] bg-accent text-base font-bold"
          >
            <PlusIcon size={18} strokeWidth={2.2} />
            Пригласить
          </button>
        ) : (
          <button
            type="button"
            onClick={onLeave}
            className="h-[50px] flex-none cursor-pointer rounded-[16px] text-[15px] font-semibold text-danger shadow-[inset_0_0_0_1.5px_#F3C9C4] hover:bg-danger-soft"
          >
            Выйти из списка
          </button>
        )}
      </Panel>

      {removing ? (
        <Dialog
          // имя в винительном падеже («Олесю») надёжно не построить — имя в тексте ниже
          title="Убрать участника из списка?"
          body={`${removing.name} больше не увидит «${list.title}». Добавленные желания останутся в списке.`}
          primary="Убрать"
          secondary="Отмена"
          onPrimary={confirmRemove}
          onSecondary={() => setRemoving(null)}
        />
      ) : null}
    </>
  )
}

function memberSrc(m: Member | undefined, urls: Record<string, string>) {
  if (!m) return null
  return m.avatarPath ? (urls[m.avatarPath] ?? null) : m.avatarUrl
}

function MemberRow({
  member: m,
  src,
  canManage,
  onRole,
  onRemove,
}: {
  member: Member
  src: string | null
  canManage: boolean
  onRole: (role: ListRole) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLLIElement>(null)
  useDismiss(rootRef, open, () => setOpen(false))

  return (
    <li
      ref={rootRef}
      className="relative flex min-h-[60px] items-center gap-3 border-b border-divider"
    >
      <Avatar name={m.name} src={src} size={40} tone={m.isMe ? undefined : m.userId} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">
          {m.name}
          {m.isMe ? <span className="font-normal text-text-2"> · вы</span> : null}
        </span>
        <span className="text-[13px] text-text-2">{ROLE_NAME[m.role]}</span>
      </span>
      {canManage ? (
        <button
          type="button"
          aria-label={`Действия с участником ${m.name}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`flex size-11 flex-none cursor-pointer items-center justify-center rounded-full ${
            open ? 'bg-accent-2-soft' : 'bg-bg'
          }`}
        >
          <MoreIcon size={20} />
        </button>
      ) : null}
      {open ? (
        <MenuPanel
          label="Действия с участником"
          className="absolute top-[54px] right-0 z-10 w-[230px]"
        >
          <MenuItem
            onClick={() => {
              setOpen(false)
              onRole(m.role === 'editor' ? 'viewer' : 'editor')
            }}
          >
            {m.role === 'editor' ? 'Сделать зрителем' : 'Сделать редактором'}
          </MenuItem>
          <MenuDivider />
          <MenuItem
            danger
            onClick={() => {
              setOpen(false)
              onRemove()
            }}
          >
            Убрать из списка
          </MenuItem>
        </MenuPanel>
      ) : null}
    </li>
  )
}

function LinkIcon() {
  return (
    <svg
      width="20"
      height="20"
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
  )
}
