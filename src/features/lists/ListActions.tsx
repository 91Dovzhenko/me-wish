import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import Dialog from '../../components/Dialog.tsx'
import { useToast } from '../../components/Toast.tsx'
import { LastListError, useAppData, type ListSummary } from '../../data/AppData.tsx'
import { plural } from '../../lib/format.ts'
import ListForm from './ListForm.tsx'

type ListActionsValue = {
  /** «+ Новый список» — с главной и из бокового меню */
  openCreate: () => void
  /** «Редактировать» — настройки списка */
  openEdit: (list: ListSummary) => void
  /** «Удалить» — подтверждение и удаление */
  askDelete: (list: ListSummary) => void
}

const ListActionsContext = createContext<ListActionsValue | null>(null)

const SAVE_ERROR = 'Не получилось сохранить — проверьте интернет'

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

  const listCount = data.status === 'ready' ? data.lists.length : 0
  const { createList, updateList, deleteList, refresh } = data

  const openCreate = useCallback(() => setForm({ mode: 'create' }), [])
  const openEdit = useCallback((list: ListSummary) => setForm({ mode: 'edit', list }), [])
  const askDelete = useCallback((list: ListSummary) => setDeleting(list), [])

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await deleteList(deleting.id)
      setDeleting(null)
      setForm(null)
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
    () => ({ openCreate, openEdit, askDelete }),
    [openCreate, openEdit, askDelete],
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
          isLast={listCount <= 1}
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

      {deleting ? (
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

// eslint-disable-next-line react-refresh/only-export-components
export function useListActions() {
  const ctx = useContext(ListActionsContext)
  if (!ctx) throw new Error('useListActions вне ListActionsProvider')
  return ctx
}
