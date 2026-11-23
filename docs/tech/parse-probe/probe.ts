// Временная проба для исследования разбора ссылок (ТЗ 002).
// Один и тот же код запускается в Edge Function и локально через Deno.

export type UA = 'browser' | 'bot';
export type Mode = 'page' | 'raw' | 'image';

export interface ProbeOpts {
  ua?: UA;
  mode?: Mode;
  headers?: Record<string, string>;
  maxRedirects?: number;
  rawChars?: number;
  find?: string[];
}

const UAS: Record<UA, string> = {
  // Обычная строка браузера (только заголовок, без подмены отпечатков).
  browser:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  // Честный бот.
  bot: 'me-wish-bot/0.1 (+https://91dovzhenko.github.io/me-wish/)',
};

const INTERESTING_HEADERS = [
  'server',
  'content-type',
  'content-length',
  'location',
  'cache-control',
  'x-frame-options',
  'cf-ray',
  'x-qrator-status',
  'x-request-id',
  'via',
];

const ANTIBOT_MARKERS: [string, RegExp][] = [
  ['captcha', /captcha/i],
  ['smartcaptcha', /smartcaptcha|showcaptcha/i],
  ['qrator', /qrator/i],
  ['servicepipe', /servicepipe/i],
  ['ddos-guard', /ddos-guard/i],
  ['cloudflare-challenge', /cf-chl|challenge-platform|just a moment/i],
  ['antibot', /antibot|anti-bot|__abt|abt-challenge/i],
  ['access-restricted', /доступ ограничен|access denied|доступ запрещ/i],
  ['are-you-robot', /вы не робот|are you a robot|robot check/i],
  ['enable-js', /enable javascript|включите javascript|включите js/i],
  ['punish(aliexpress)', /punish|x5sec|baxia/i],
];

const STATE_MARKERS: [string, RegExp][] = [
  ['__NEXT_DATA__', /__NEXT_DATA__/],
  ['__NUXT__', /__NUXT__/],
  ['__INITIAL_STATE__', /__INITIAL_STATE__/],
  ['__APOLLO_STATE__', /__APOLLO_STATE__/],
  ['__PRELOADED_STATE__', /__PRELOADED_STATE__/],
  ['ozon-widgetStates', /widgetStates/],
];

class Jar {
  private c = new Map<string, Map<string, string>>();
  set(host: string, headers: Headers) {
    // getSetCookie есть в Deno
    const list = (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    for (const sc of list) {
      const [pair] = sc.split(';');
      const i = pair.indexOf('=');
      if (i < 1) continue;
      const domMatch = sc.match(/domain=\.?([^;]+)/i);
      const dom = (domMatch?.[1] ?? host).toLowerCase();
      if (!this.c.has(dom)) this.c.set(dom, new Map());
      this.c.get(dom)!.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    return list.map((s) => s.split('=')[0]);
  }
  header(host: string) {
    const out: string[] = [];
    for (const [dom, m] of this.c) {
      if (host === dom || host.endsWith('.' + dom)) for (const [k, v] of m) out.push(`${k}=${v}`);
    }
    return out.join('; ');
  }
}

function pickHeaders(h: Headers) {
  const o: Record<string, string> = {};
  for (const k of INTERESTING_HEADERS) {
    const v = h.get(k);
    if (v) o[k] = v.slice(0, 300);
  }
  return o;
}

async function fetchChain(url: string, opts: ProbeOpts) {
  const ua = UAS[opts.ua ?? 'browser'];
  const jar = new Jar();
  const chain: Record<string, unknown>[] = [];
  let cur = url;
  const t0 = Date.now();
  for (let i = 0; i <= (opts.maxRedirects ?? 10); i++) {
    const host = new URL(cur).hostname;
    const headers: Record<string, string> = {
      'user-agent': ua,
      accept:
        opts.mode === 'image'
          ? 'image/avif,image/webp,image/*,*/*;q=0.8'
          : 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
      'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8',
      ...(opts.headers ?? {}),
    };
    const ck = jar.header(host);
    if (ck) headers.cookie = ck;
    let res: Response;
    try {
      res = await fetch(cur, { redirect: 'manual', headers, signal: AbortSignal.timeout(20000) });
    } catch (e) {
      chain.push({ url: cur, error: String(e) });
      return { chain, res: null as Response | null, finalUrl: cur, ms: Date.now() - t0 };
    }
    const cookies = jar.set(host, res.headers);
    const loc = res.headers.get('location');
    chain.push({ url: cur, status: res.status, headers: pickHeaders(res.headers), setCookies: cookies });
    if (res.status >= 300 && res.status < 400 && loc) {
      await res.body?.cancel();
      cur = new URL(loc, cur).toString();
      continue;
    }
    return { chain, res, finalUrl: cur, ms: Date.now() - t0 };
  }
  return { chain, res: null as Response | null, finalUrl: cur, ms: Date.now() - t0, tooManyRedirects: true };
}

// ---------- разбор HTML ----------

function decodeEntities(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

function attrs(tag: string) {
  const o: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    o[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? '');
  }
  return o;
}

function short(v: unknown, n = 160) {
  if (v == null) return v;
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function findProducts(node: unknown, out: Record<string, unknown>[] = []) {
  if (Array.isArray(node)) node.forEach((n) => findProducts(n, out));
  else if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    const t = o['@type'];
    const types = Array.isArray(t) ? t : [t];
    if (types.some((x) => typeof x === 'string' && /Product|ProductGroup/.test(x))) out.push(o);
    for (const k of Object.keys(o)) if (k !== '@type') findProducts(o[k], out);
  }
  return out;
}

function firstImage(img: unknown): string | undefined {
  if (!img) return;
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) return firstImage(img[0]);
  if (typeof img === 'object') {
    const o = img as Record<string, unknown>;
    return (o.url ?? o.contentUrl) as string | undefined;
  }
}

function offerOf(p: Record<string, unknown>) {
  let off = p.offers as unknown;
  if (Array.isArray(off)) off = off[0];
  if (!off || typeof off !== 'object') {
    const hv = p.hasVariant as unknown;
    if (Array.isArray(hv) && hv[0]) return offerOf(hv[0] as Record<string, unknown>);
    return {};
  }
  const o = off as Record<string, unknown>;
  return {
    price: o.price ?? o.lowPrice ?? (o.priceSpecification as Record<string, unknown> | undefined)?.price,
    currency: o.priceCurrency ?? (o.priceSpecification as Record<string, unknown> | undefined)?.priceCurrency,
  };
}

export function analyzeHtml(html: string, baseUrl: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const metas: Record<string, string> = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property ?? a.name ?? a.itemprop ?? '').toLowerCase();
    if (key && a.content != null && !(key in metas)) metas[key] = a.content;
  }
  let canonical: string | undefined;
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if ((a.rel ?? '').toLowerCase() === 'canonical' && a.href) {
      canonical = new URL(a.href, baseUrl).toString();
      break;
    }
  }

  // JSON-LD
  const ldBlocks = [...html.matchAll(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)];
  const ldTypes: string[] = [];
  let ldErrors = 0;
  const products: Record<string, unknown>[] = [];
  for (const b of ldBlocks) {
    try {
      const j = JSON.parse(b[1].trim());
      const walk = (n: unknown) => {
        if (Array.isArray(n)) n.forEach(walk);
        else if (n && typeof n === 'object') {
          const t = (n as Record<string, unknown>)['@type'];
          if (t) ldTypes.push(String(t));
          const g = (n as Record<string, unknown>)['@graph'];
          if (g) walk(g);
        }
      };
      walk(j);
      findProducts(j, products);
    } catch {
      ldErrors++;
    }
  }
  const p = products[0];
  const ld = p
    ? {
        name: p.name,
        image: firstImage(p.image),
        description: short(p.description),
        url: p.url,
        ...offerOf(p),
      }
    : null;

  // Микроразметка
  const hasMicrodataProduct = /itemtype\s*=\s*["']https?:\/\/schema\.org\/Product/i.test(html);
  const mdPrice =
    html.match(/itemprop\s*=\s*["']price["'][^>]*content\s*=\s*["']([^"']+)/i)?.[1] ??
    html.match(/content\s*=\s*["']([^"']+)["'][^>]*itemprop\s*=\s*["']price["']/i)?.[1];
  const mdCurrency =
    html.match(/itemprop\s*=\s*["']priceCurrency["'][^>]*content\s*=\s*["']([^"']+)/i)?.[1] ??
    html.match(/content\s*=\s*["']([^"']+)["'][^>]*itemprop\s*=\s*["']priceCurrency["']/i)?.[1];

  const og = {
    title: metas['og:title'],
    image: metas['og:image'] ?? metas['og:image:url'],
    description: short(metas['og:description']),
    url: metas['og:url'],
    type: metas['og:type'],
    price: metas['product:price:amount'] ?? metas['og:price:amount'],
    currency: metas['product:price:currency'] ?? metas['og:price:currency'],
  };

  // Итог по полям (порядок: JSON-LD → OG → микроразметка → title)
  const pickSrc = (...c: [string, unknown][]) => {
    for (const [src, v] of c) if (v != null && v !== '') return { value: short(v, 200), src };
    return null;
  };
  const fields = {
    name: pickSrc(['ld', ld?.name], ['og', og.title], ['md', metas['name']], ['title', title && decodeEntities(title.trim())]),
    image: pickSrc(['ld', ld?.image], ['og', og.image], ['md', metas['image']]),
    price: pickSrc(['ld', ld?.price], ['og', og.price], ['md', mdPrice]),
    currency: pickSrc(['ld', ld?.currency], ['og', og.currency], ['md', mdCurrency]),
    description: pickSrc(['ld', ld?.description], ['og', og.description], ['meta', short(metas['description'])]),
    canonical: pickSrc(['link', canonical], ['og', og.url], ['ld', ld?.url]),
  };

  return {
    title: title ? short(decodeEntities(title.trim()), 200) : null,
    jsonLd: { blocks: ldBlocks.length, types: [...new Set(ldTypes)].slice(0, 15), errors: ldErrors, product: ld },
    openGraph: og,
    microdata: { product: hasMicrodataProduct, price: mdPrice, currency: mdCurrency },
    stateMarkers: STATE_MARKERS.filter(([, r]) => r.test(html)).map(([n]) => n),
    fields,
  };
}

export async function probe(url: string, opts: ProbeOpts = {}) {
  const mode = opts.mode ?? 'page';
  const { chain, res, finalUrl, ms, tooManyRedirects } = await fetchChain(url, opts);
  const base = { input: url, mode, ua: opts.ua ?? 'browser', chain, finalUrl, ms, tooManyRedirects };
  if (!res) return { ...base, ok: false };
  const status = res.status;
  const ct = res.headers.get('content-type') ?? '';

  if (mode === 'image') {
    const buf = new Uint8Array(await res.arrayBuffer());
    const magic = [...buf.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const kind = magic.startsWith('ffd8')
      ? 'jpeg'
      : magic.startsWith('89504e47')
        ? 'png'
        : magic.includes('57454250')
          ? 'webp'
          : magic.includes('66747970')
            ? 'avif/heic'
            : magic.startsWith('47494638')
              ? 'gif'
              : 'unknown';
    return { ...base, ok: status === 200 && kind !== 'unknown', status, contentType: ct, bytes: buf.length, kind };
  }

  const text = await res.text();
  const bytes = new TextEncoder().encode(text).length;
  const antibot = ANTIBOT_MARKERS.filter(([, r]) => r.test(text)).map(([n]) => n);
  if (mode === 'raw') {
    return { ...base, ok: status === 200, status, contentType: ct, bytes, antibot, body: text.slice(0, opts.rawChars ?? 1500) };
  }
  const analysis = ct.includes('html') || /<html/i.test(text.slice(0, 2000)) ? analyzeHtml(text, finalUrl) : null;
  // Отладка: фрагменты вокруг совпадений (например, где на странице лежит цена).
  const snippets: Record<string, string[]> = {};
  for (const f of opts.find ?? []) {
    const re = new RegExp(f, 'gi');
    snippets[f] = [...text.matchAll(re)].slice(0, 4).map((m) => text.slice(Math.max(0, m.index! - 120), m.index! + 180));
  }
  return {
    snippets: opts.find ? snippets : undefined,
    ...base,
    ok: status === 200,
    status,
    contentType: ct,
    bytes,
    antibot,
    analysis,
    bodyStart: analysis?.fields.name ? undefined : text.replace(/\s+/g, ' ').slice(0, 400),
  };
}
