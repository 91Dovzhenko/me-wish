import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router'
import Dialog from '../../components/Dialog.tsx'
import { SAVE_ERROR, useToast } from '../../components/Toast.tsx'
import { LastListError, useAppData, type ListSummary } from '../../data/AppData.tsx'
import { plural } from '../../lib/format.ts'
import MembersWindow from '../members/MembersWindow.tsx'
import ListForm from './ListForm.tsx'

type ListActionsValue = {
  /** «+ Новый список» — с главной и из бокового меню */
  openCreate: () => void
  /** «Редактировать» — настройки списка */
  openEdit: (list: ListSummary) => void
  /** «Удалить» — подтверждение и удаление (в совместном — «у всех», 2.27) */
  askDelete: (list: ListSummary) => void
  /** «Участники» (004-a) */
  openMembers: (list: ListSummary) => void
  /** «Выйти из списка» — 2.28, последний редактор — 2.29 */
  askLeave: (list: ListSummary) => void
}

const ListActionsContext = createContext<ListActionsValue | null>(null)

/** Форма списка и удаление — общие для главной, бокового меню и экрана списка. */
export function ListActionsProvider({ children }: { children: ReactNode }) {
  const data = useAppData()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState<{ mode: 'create' } | { mode: 'edit'; list: ListSummary } | null>(
    null,
  )
  const [deleting, setDeleting] = useState<ListSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [membersOf, setMembersOf] = useState<string | null>(null)
  const [leaving, setLeaving] = useState<ListSummary | null>(null)

  // последний список, где я редактор, удалить или покинуть нельзя (D-082)
  const editorListCount = data.status === 'ready' ? data.editorListCount : 0
  const { createList, updateList, deleteList, leaveList, refresh } = data
  const membersList =
    membersOf && data.status === 'ready'
      ? (data.lists.find((l) => l.id === membersOf) ?? null)
      : null

  // настройки списка открыты, а меня там сделали зрителем — закрыть с тостом (004-b)
  const editRole =
    form?.mode === 'edit' && data.status === 'ready'
      ? data.lists.find((l) => l.id === form.list.id)?.myRole
      : undefined
  useEffect(() => {
    if (editRole !== 'viewer') return
    toast({ text: 'Вас сделали зрителем' })
    const t = window.setTimeout(() => setForm(null), 0)
    return () => window.clearTimeout(t)
  }, [editRole, toast])

  const openCreate = useCallback(() => setForm({ mode: 'create' }), [])
  const openEdit = useCallback((list: ListSummary) => setForm({ mode: 'edit', list }), [])
  const askDelete = useCallback((list: ListSummary) => setDeleting(list), [])
  const openMembers = useCallback((list: ListSummary) => setMembersOf(list.id), [])
  const askLeave = useCallback((list: ListSummary) => setLeaving(list), [])

  const confirmLeave = async () => {
    if (!leaving) return
    const title = leaving.title
    setBusy(true)
    try {
      const res = await leaveList(leaving.id)
      setLeaving(null)
      setMembersOf(null)
      navigate('/', { replace: true })
      toast({ text: res === 'deleted' ? `Список «${title}» удалён` : `Вы вышли из «${title}»` })
      refresh().catch((e) => console.warn('Не удалось обновить данные:', e))
    } catch (e) {
      setLeaving(null)
      if (e instanceof LastListError) toast({ text: e.message, kind: 'error' })
      else toast({ text: SAVE_ERROR, kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await deleteList(deleting.id)
      setDeleting(null)
      setForm(null)
      setMembersOf(null)
      navigate('/', { replace: true })
      toast({ text: 'Список удалён' })
      refresh().catch((e) => console.warn('Не удалось обновить данные:', e))
    } catch (e) {
      setDeleting(null)
      if (e instanceof LastListError) toast({ text: e.message, kind: 'error' })
      else toast({ text: 'Не получилось удалить — проверьте интернет', kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const value = useMemo(
    () => ({ openCreate, openEdit, askDelete, openMembers, askLeave }),
    [openCreate, openEdit, askDelete, openMembers, askLeave],
  )

  return (
    <ListActionsContext.Provider value={value}>
      {children}

      {form?.mode === 'create' ? (
        <ListForm
          onClose={() => setForm(null)}
          onSubmit={async (fields) => {
            try {
              const id = await createList(fields)
              setForm(null)
              navigate(`/l/${id}`)
            } catch (e) {
              toast({ text: SAVE_ERROR, kind: 'error' })
              throw e
            }
          }}
        />
      ) : null}

      {form?.mode === 'edit' ? (
        <ListForm
          key={form.list.id}
          list={form.list}
          isLast={form.list.myRole === 'editor' && editorListCount <= 1}
          onClose={() => setForm(null)}
          onDelete={() => setDeleting(form.list)}
          onSubmit={async (fields) => {
            try {
              await updateList(form.list.id, fields)
              setForm(null)
            } catch (e) {
              toast({ text: SAVE_ERROR, kind: 'error' })
              throw e
            }
          }}
        />
      ) : null}

      {membersList ? (
        <MembersWindow
          list={membersList}
          onClose={() => setMembersOf(null)}
          onLeave={() => setLeaving(membersList)}
        />
      ) : null}

      {leaving ? (
        <LeaveDialog
          list={leaving}
          busy={busy}
          onConfirm={() => void confirmLeave()}
          onCancel={() => !busy && setLeaving(null)}
        />
      ) : null}

      {deleting && deleting.members.length > 1 ? (
        <Dialog
          title={`Удалить «${deleting.title}» у всех участников?`}
          body={`Желания попадут в корзину у всех редакторов. ${othersLoseAccess(deleting)}`}
          primary="Удалить у всех"
          secondary="Отмена"
          busy={busy}
          onPrimary={() => void confirmDelete()}
          onSecondary={() => !busy && setDeleting(null)}
        />
      ) : deleting ? (
        <Dialog
          title={
            deleting.itemCount > 0
              ? `Удалить список и ${deleting.itemCount} ${plural(deleting.itemCount, ['желание', 'желания', 'желаний'])}?`
              : 'Удалить список?'
          }
          body={
            deleting.itemCount > 0
              ? 'Желания попадут в корзину, их можно восстановить 30 дней.'
              : undefined
          }
          primary="Удалить"
          secondary="Отмена"
          busy={busy}
          onPrimary={() => void confirmDelete()}
          onSecondary={() => !busy && setDeleting(null)}
        />
      ) : null}
    </ListActionsContext.Provider>
  )
}

function othersLoseAccess(list: ListSummary) {
  const others = list.members.filter((m) => !m.isMe)
  return others.length === 1
    ? `${others[0]!.name} тоже потеряет доступ к списку.`
    : 'Остальные участники тоже потеряют доступ к списку.'
}

/** «Выйти из списка?» (2.28) или, если я последний редактор, «Вы последний редактор» (2.29). */
function LeaveDialog({
  list,
  busy,
  onConfirm,
  onCancel,
}: {
  list: ListSummary
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const lastEditor =
    list.myRole === 'editor' && !list.members.some((m) => !m.isMe && m.role === 'editor')
  return lastEditor ? (
    <Dialog
      title="Вы последний редактор"
      body={`Если выйти, список «${list.title}» удалится, а его желания попадут в корзину.`}
      primary="Выйти и удалить"
      secondary="Остаться"
      busy={busy}
      onPrimary={onConfirm}
      onSecondary={onCancel}
    />
  ) : (
    <Dialog
      title={`Выйти из списка «${list.title}»?`}
      body="Вы больше не увидите его желания. Вернуться можно по новому приглашению."
      primary="Выйти"
      secondary="Остаться"
      busy={busy}
      onPrimary={onConfirm}
      onSecondary={onCancel}
    />
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useListActions() {
  const ctx = useContext(ListActionsContext)
  if (!ctx) throw new Error('useListActions вне ListActionsProvider')
  return ctx
}
