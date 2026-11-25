// Ссылки-приглашения (ТЗ 004-a). Токен в базе не хранится (только sha256), поэтому:
// - адрес ссылки собирается в браузере из токена, который create_invite вернул один раз;
// - чтобы в «Участниках» можно было скопировать ссылку ещё раз, токен запоминается на этом устройстве
//   (localStorage, по id приглашения, до срока ссылки). На других устройствах — только «Отозвать».
// - «отложенное приглашение»: адрес /i/<токен> запоминается, чтобы после входа через Google
//   (возврат на главную) или после перезапуска приложения на iPhone вернуться к «Принять».

const TOKENS_KEY = 'me-wish:invite-tokens'
const PENDING_KEY = 'me-wish:pending-invite'
const PENDING_TTL_MS = 24 * 60 * 60 * 1000

export function inviteUrl(token: string) {
  return `${window.location.origin}${import.meta.env.BASE_URL}i/${token}`
}

type Stored = Record<string, { token: string; expiresAt: string }>

function readTokens(): Stored {
  try {
    const all = JSON.parse(localStorage.getItem(TOKENS_KEY) ?? '{}') as Stored
    const now = Date.now()
    for (const [id, v] of Object.entries(all)) if (Date.parse(v.expiresAt) < now) delete all[id]
    return all
  } catch {
    return {}
  }
}

export function rememberInviteToken(id: string, token: string, expiresAt: string) {
  try {
    const all = readTokens()
    all[id] = { token, expiresAt }
    localStorage.setItem(TOKENS_KEY, JSON.stringify(all))
  } catch {
    /* приватный режим — просто нельзя будет скопировать позже */
  }
}

export function knownInviteToken(id: string): string | null {
  return readTokens()[id]?.token ?? null
}

export function forgetInviteToken(id: string) {
  try {
    const all = readTokens()
    delete all[id]
    localStorage.setItem(TOKENS_KEY, JSON.stringify(all))
  } catch {
    /* не страшно */
  }
}

type Pending = { token: string; savedAt: number; redirected: boolean }

export function savePendingInvite(token: string) {
  try {
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ token, savedAt: Date.now(), redirected: false } satisfies Pending),
    )
  } catch {
    /* без сохранения — после входа через Google придётся открыть ссылку ещё раз */
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    /* не страшно */
  }
}

/** Отложенное приглашение, к которому ещё не возвращали после входа (один раз — без зацикливания). */
export function takePendingInviteRedirect(): string | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as Pending | null
    if (!p || !/^[0-9a-f]{64}$/.test(p.token) || Date.now() - p.savedAt > PENDING_TTL_MS) {
      localStorage.removeItem(PENDING_KEY)
      return null
    }
    if (p.redirected) return null
    localStorage.setItem(PENDING_KEY, JSON.stringify({ ...p, redirected: true }))
    return p.token
  } catch {
    return null
  }
}

/** Скопировать в буфер; true — получилось. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // запасной путь (старый Safari, нет разрешения)
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export const canShare = () => typeof navigator.share === 'function'

const MONTHS_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

/** «действует до 1 декабря» */
export function validUntil(iso: string) {
  const d = new Date(iso)
  return `действует до ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`
}
