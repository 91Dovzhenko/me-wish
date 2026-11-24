// Ссылка на товар (D-061): сохраняем без рекламных и служебных меток.
// Размер, вариант и продавец остаются, если они в отдельных параметрах (size у WB, sku_id у AliExpress, oid…).
// Список меток — по docs/tech/parsing-research.md (ссылки из приложений Ozon, WB, Маркета, AliExpress).
// Короткие имена вроде at, sh, cpc убираются только у «своих» маркетплейсов: у обычного магазина
// такой параметр может что-то значить.

/** Метки, которые убираются с любого сайта (имя без учёта регистра). */
const GLOBAL = [
  'gclid',
  'gbraid',
  'wbraid',
  'dclid',
  'fbclid',
  'yclid',
  'ysclid',
  'msclkid',
  'ttclid',
  'twclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  '_openstat',
  'erid',
  'admitad_uid',
  'spm',
]
/** Префиксы меток с любого сайта: utm_source, utm_medium, … */
const GLOBAL_PREFIXES = ['utm_', 'pk_', 'mtm_', '_ga', '_gl']

/** Метки конкретных маркетплейсов: домен (и его поддомены) → имена параметров. */
const BY_HOST: [RegExp, string[]][] = [
  [
    /(^|\.)market\.yandex\.[a-z]+$/,
    [
      'cpc',
      'sponsored',
      'do-waremd5',
      'nid',
      'ultima',
      'ogv',
      'bnplselectedplan',
      'uniqueid',
      'srcrr',
      'rs',
      'lr',
      'clid',
      'cpa',
      'pp',
      'track',
      'text',
      'hid',
      'from',
    ],
  ],
  [
    /(^|\.)ozon\.[a-z]+$/,
    [
      'at',
      'sh',
      'asb',
      'asb2',
      'keywords',
      'avtc',
      'avte',
      'avts',
      'is_apparel_size_selected',
      'miniapp',
      'oos_search',
      'from',
      'from_sku',
      'tab',
    ],
  ],
  [/(^|\.)(wildberries|wb)\.[a-z]+$/, ['targeturl', 'from', 'source']],
  [
    /(^|\.)aliexpress\.[a-z]+$/,
    [
      'scm',
      'pvid',
      'algo_pvid',
      'algo_expid',
      'ru_algo_pv_id',
      'scenario',
      'mixer_rcmd_bucket_id',
      'pdp_trigger_item_id',
      'traffic_source',
      'type_rcmd',
      'gatewayadapt',
      'pdp_npi',
      'pdp_ext_f',
      'pdp_perf',
      'sourcetype',
      'aff_fcid',
      'aff_fsk',
      'aff_platform',
      'aff_trace_key',
      'terminal_id',
      'afsmartredirect',
      'dp',
      'af',
      'cv',
      'cn',
      'mall_affr',
      'tt',
      'sk',
      'businesstype',
      'platform',
      'search_id',
      'browser_id',
      'gps-id',
      'srcsns',
      'spreadtype',
      'biztype',
      'social_params',
      'tracelog',
      'shareid',
      'share_id',
      'invitationcode',
      'templateid',
    ],
  ],
]

function trackingFor(hostname: string): (name: string) => boolean {
  const host = hostname.toLowerCase()
  const names = new Set(GLOBAL)
  for (const [re, list] of BY_HOST) if (re.test(host)) list.forEach((n) => names.add(n))
  return (name) => {
    const n = name.toLowerCase()
    return names.has(n) || GLOBAL_PREFIXES.some((p) => n.startsWith(p))
  }
}

/** Убирает метки из адреса. Путь, нужные параметры и якорь остаются как были. */
export function cleanUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return raw
  }
  const isTracking = trackingFor(url.hostname)
  const keep: [string, string][] = []
  url.searchParams.forEach((value, key) => {
    if (!isTracking(key)) keep.push([key, value])
  })
  url.search = keep.length ? new URLSearchParams(keep).toString() : ''
  return url.toString()
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"«»]+/i
// Адрес без «https://»: market.yandex.ru/cc/abc, ozon.ru/t/xyz, www.wildberries.ru/…
const BARE_DOMAIN = /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-zа-яё]{2,}(?:[/?#]\S*)?$/i

/**
 * Достаёт ссылку из введённого текста: сама ссылка, ссылка без https:// или ссылка внутри
 * текста «Поделиться» («Смотрите, что я нашёл на Ozon: https://ozon.ru/t/…»), и очищает её.
 * Если ссылки нет — null (просто текст ссылкой не сохраняем, D-061).
 */
export function extractUrl(input: string): string | null {
  const text = input.trim()
  if (!text) return null
  const found = text.match(URL_IN_TEXT)
  let candidate: string | null = null
  if (found) {
    // хвостовая пунктуация после ссылки в тексте
    candidate = found[0].replace(/[).,;:!?»”'"]+$/, '')
  } else if (!/\s/.test(text) && BARE_DOMAIN.test(text)) {
    candidate = `https://${text}`
  }
  if (!candidate) return null
  try {
    const u = new URL(candidate)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname.includes('.')) return null
    const clean = cleanUrl(u.toString())
    return clean.length <= 2048 ? clean : null
  } catch {
    return null
  }
}
