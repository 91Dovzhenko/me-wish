import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useToast } from '../../components/Toast.tsx'
import { useAppData } from '../../data/AppData.tsx'
import { supabase } from '../../lib/supabase.ts'
import { takePendingInviteRedirect } from './inviteLinks.ts'

/**
 * Служебное для вошедшего пользователя (004-a), без своего вида:
 * - список пропал не из-за моего действия → «Вас убрали из «…»» или «Список «…» удалён»; если он открыт — на главную;
 * - тост из перехода (`navigate(…, { state: { toast } })`) — «Вы присоединились к «…»» после «Принять»;
 * - отложенное приглашение: вернулись на главную после входа через Google (или iPhone перезапустил
 *   приложение) — снова экран «Принять».
 */
export default function MembershipWatcher() {
  const data = useAppData()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const prev = useRef<Map<string, string> | null>(null)
  const pathRef = useRef(location.pathname)
  useEffect(() => {
    pathRef.current = location.pathname
  })

  // Отложенное приглашение — один раз после входа
  useEffect(() => {
    const token = takePendingInviteRedirect()
    if (token) navigate(`/i/${token}`, { replace: true })
  }, [navigate])

  // Тост, переданный переходом
  const stateToast = (location.state as { toast?: string } | null)?.toast
  useEffect(() => {
    if (!stateToast) return
    toast({ text: stateToast })
    navigate(location.pathname, { replace: true, state: null })
  }, [stateToast, toast, navigate, location.pathname])

  // Пропавшие списки
  const { status } = data
  const lists = data.status === 'ready' ? data.lists : null
  const userId = data.status === 'ready' ? data.profile.id : null
  const { takeExpectedGone } = data
  useEffect(() => {
    if (status !== 'ready' || !lists || !userId) return
    const now = new Map(lists.map((l) => [l.id, l.title]))
    const before = prev.current
    prev.current = now
    if (!before) return
    for (const [id, title] of before) {
      if (now.has(id) || takeExpectedGone(id)) continue
      if (pathRef.current.startsWith(`/l/${id}`)) navigate('/', { replace: true })
      // удалённый список: участие остаётся (для корзины); убрали — участия больше нет
      supabase
        ?.from('list_members')
        .select('role')
        .eq('list_id', id)
        .eq('user_id', userId)
        .maybeSingle()
        .then(({ data: m, error }) => {
          if (error) return
          toast({ text: m ? `Список «${title}» удалён` : `Вас убрали из «${title}»` })
        })
    }
  }, [status, lists, userId, takeExpectedGone, navigate, toast])

  return null
}
