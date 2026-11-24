import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useToast } from '../../components/Toast.tsx'
import { useAppData } from '../../data/AppData.tsx'
import WishForm from './WishForm.tsx'

type WishActionsValue = {
  /**
   * «+», «Добавить желание», «Добавить первое желание».
   * listId — со страницы списка (этот список); без него — список по умолчанию из профиля (D-073).
   */
  openAdd: (opts?: { listId?: string }) => void
  /** можно открыть форму: данные загружены */
  canAdd: boolean
}

const WishActionsContext = createContext<WishActionsValue | null>(null)

export function WishActionsProvider({ children }: { children: ReactNode }) {
  const data = useAppData()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState<{ fromListId: string | null; key: number } | null>(null)

  const ready = data.status === 'ready'
  const openAdd = useCallback(
    (opts?: { listId?: string }) => {
      if (!ready) return
      setForm({ fromListId: opts?.listId ?? null, key: Date.now() })
    },
    [ready],
  )

  const value = useMemo(() => ({ openAdd, canAdd: ready }), [openAdd, ready])

  let formNode: ReactNode = null
  if (form && data.status === 'ready' && data.lists.length > 0) {
    const { lists, profile } = data
    const alive = (id: string | null) => (id && lists.some((l) => l.id === id) ? id : null)
    const fromListId = alive(form.fromListId)
    const initialListId = fromListId ?? alive(profile.defaultListId) ?? lists[0]!.id
    formNode = (
      <WishForm
        key={form.key}
        userId={profile.id}
        lists={lists}
        initialListId={initialListId}
        defaultListId={profile.defaultListId}
        fromListId={fromListId}
        onClose={() => setForm(null)}
        onSubmit={data.addWish}
        onAdded={(wish) => {
          setForm(null)
          const list = lists.find((l) => l.id === wish.listId)
          toast({
            text: `Добавлено в «${list?.title ?? 'список'}»`,
            action: { label: 'Открыть', onClick: () => navigate(`/l/${wish.listId}`) },
          })
        }}
      />
    )
  }

  return (
    <WishActionsContext.Provider value={value}>
      {children}
      {formNode}
    </WishActionsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWishActions() {
  const ctx = useContext(WishActionsContext)
  if (!ctx) throw new Error('useWishActions вне WishActionsProvider')
  return ctx
}
