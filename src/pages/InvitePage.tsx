import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider.tsx'
import Logo from '../components/Logo.tsx'
import InviteCard, { type InvitePreview } from '../features/members/InviteCard.tsx'
import { clearPendingInvite, savePendingInvite } from '../features/members/inviteLinks.ts'
import { supabase, supabaseUrl } from '../lib/supabase.ts'
import LoginPage from './LoginPage.tsx'

type Preview = { status: 'loading' } | { status: 'invalid' } | InvitePreview | { status: 'error' }

async function loadPreview(token: string): Promise<InvitePreview | { status: 'invalid' }> {
  const res = await fetch(`${supabaseUrl}/functions/v1/invite-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) throw new Error(`invite-preview: ${res.status}`)
  const body = (await res.json()) as InvitePreview | { status: 'invalid' }
  return body.status === 'ok' ? body : { status: 'invalid' }
}

/**
 * Приглашение по ссылке /i/<токен> (D-113): 1.5 / 1.5D не вошёл → вход с карточкой; 1.6 / 1.6D «Принять»;
 * 1.7 / 1.7D «Приглашение больше не действует»; уже участник — сразу список; после «Принять» — список и тост (1.8).
 * Адрес запоминается (inviteLinks.ts): после входа через Google приложение возвращается сюда само.
 */
export default function InvitePage() {
  const { token = '' } = useParams()
  const { status: auth, session } = useAuth()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<Preview>({ status: 'loading' })
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const valid = /^[0-9a-f]{64}$/.test(token)

  // Запоминаем ссылку только до входа: после входа через Google приложение вернётся на главную
  // и само откроет этот экран (один раз — иначе «Назад» возвращал бы сюда снова и снова)
  useEffect(() => {
    if (valid && (auth === 'signedOut' || auth === 'error')) savePendingInvite(token)
  }, [token, valid, auth])

  useEffect(() => {
    if (!valid) return
    let alive = true
    loadPreview(token)
      .then((p) => alive && setPreview(p))
      .catch((e) => {
        console.warn('Не удалось загрузить приглашение:', e)
        if (alive) setPreview({ status: 'error' })
      })
    return () => {
      alive = false
    }
  }, [token, valid])

  const listId = preview.status === 'ok' ? preview.list_id : null
  const userId = session?.user.id

  // Вошёл и уже участник (или это свой список) — сразу открыть список
  useEffect(() => {
    if (auth !== 'signedIn' || !listId || !userId || !supabase) return
    let alive = true
    supabase
      .from('list_members')
      .select('role')
      .eq('list_id', listId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data) {
          clearPendingInvite()
          navigate(`/l/${listId}`, { replace: true })
        }
      })
    return () => {
      alive = false
    }
  }, [auth, listId, userId, navigate])

  // недействительная ссылка — отложенное приглашение больше не нужно
  useEffect(() => {
    if (!valid || preview.status === 'invalid') clearPendingInvite()
  }, [valid, preview.status])

  const accept = async () => {
    if (preview.status !== 'ok' || !supabase) return
    setBusy(true)
    setFailed(false)
    const { data, error } = await supabase.rpc('accept_invite', { p_token: token })
    setBusy(false)
    if (error) {
      if (error.code === 'P0002') setPreview({ status: 'invalid' })
      else setFailed(true)
      return
    }
    clearPendingInvite()
    navigate(`/l/${data as string}`, {
      replace: true,
      state: { toast: `Вы присоединились к «${preview.title}»` },
    })
  }

  const later = () => {
    clearPendingInvite()
    navigate('/', { replace: true })
  }

  if (!valid || preview.status === 'invalid') {
    return (
      <Screen>
        <InviteCard mode="expired" />
      </Screen>
    )
  }

  if (preview.status === 'loading' || auth === 'initializing') {
    return <Screen busy />
  }

  if (preview.status === 'error') {
    return (
      <Screen>
        <p role="alert" className="m-0 text-center text-[15px] text-text-2">
          Не получилось открыть приглашение — проверьте интернет и обновите страницу.
        </p>
      </Screen>
    )
  }

  if (auth !== 'signedIn') {
    return <LoginPage invite={<InviteCard mode="login" invite={preview} />} />
  }

  return (
    <Screen
      title="Вас пригласили в список"
      lead={
        // имя в творительном падеже («с Виталием») не построить надёжно — без имени
        preview.role === 'editor'
          ? 'Вы сможете добавлять и менять желания вместе'
          : 'Вы сможете смотреть желания в этом списке'
      }
    >
      <InviteCard
        mode="card"
        invite={preview}
        busy={busy}
        onAccept={() => void accept()}
        onLater={later}
      />
      {failed ? (
        <p role="alert" className="m-0 text-sm font-medium text-danger">
          Не получилось принять — проверьте интернет и попробуйте ещё раз
        </p>
      ) : null}
    </Screen>
  )
}

/** Фон, логотип, заголовок — Shared-Accept / Shared-Accept-Desktop. */
function Screen({
  title,
  lead,
  busy,
  children,
}: {
  title?: string
  lead?: string
  busy?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{
        background:
          'radial-gradient(60% 45% at 70% 25%, rgba(185, 168, 255, 0.55), rgba(185, 168, 255, 0) 70%), radial-gradient(35% 40% at 22% 75%, rgba(200, 245, 106, 0.3), rgba(200, 245, 106, 0) 70%), var(--bg)',
      }}
    >
      <div className="relative mx-auto flex min-h-dvh max-w-[500px] flex-col gap-7 px-5 pt-[calc(env(safe-area-inset-top)+56px)] pb-10 lg:items-center lg:justify-center lg:gap-6 lg:pt-10">
        <Logo size="header" />
        {title ? (
          <div className="flex flex-col gap-2.5 lg:items-center lg:text-center">
            <h1 className="m-0 text-[26px] leading-[1.2] font-bold lg:text-[30px]">{title}</h1>
            {lead ? <p className="m-0 text-[15px] text-text-2">{lead}</p> : null}
          </div>
        ) : null}
        {busy ? (
          <div role="status" aria-label="Загрузка" className="flex justify-center py-10">
            <span className="size-8 animate-spin rounded-full border-[3px] border-skeleton-line border-t-text" />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
