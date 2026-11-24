import { Suspense } from 'react'
import Cover from '../components/Cover.tsx'

// Только для разработки (/dev/covers): коллаж обложки при 1–4 фото на подставных картинках.
// Картинки — простые SVG-заглушки, без фото товаров.

function fakePhoto(hue: number, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 82%)"/><stop offset="1" stop-color="hsl(${hue + 40} 60% 62%)"/></linearGradient></defs>
<rect width="400" height="400" fill="url(#g)"/><circle cx="200" cy="180" r="80" fill="rgba(255,255,255,.55)"/>
<text x="200" y="330" font-family="sans-serif" font-size="44" font-weight="700" text-anchor="middle" fill="rgba(23,24,28,.6)">${label}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const P = [
  fakePhoto(20, '1'),
  fakePhoto(140, '2'),
  fakePhoto(220, '3'),
  fakePhoto(280, '4'),
  fakePhoto(60, '5'),
]

const CASES = [
  {
    title: 'Мои желания',
    meta: '7 желаний · 24 760 ₽',
    photos: P.slice(0, 4),
    note: '4 фото — 2×2',
  },
  {
    title: 'День рождения',
    meta: '8 желаний · 61 200 ₽',
    date: '14 марта',
    photos: P.slice(0, 3),
    note: '3 фото, с датой',
  },
  { title: 'Для поездок', meta: '2 желания · 7 480 ₽', photos: P.slice(0, 2), note: '2 фото' },
  { title: 'Книги', meta: '1 желание · 990 ₽', photos: P.slice(0, 1), note: '1 фото' },
  { title: 'Пять фото', meta: 'берутся 4 последних', photos: P, note: '5 фото → 4' },
  {
    title: 'Режим «Иконка»',
    meta: 'есть фото, но иконка',
    photos: P,
    coverMode: 'icon' as const,
    icon: 'gift' as const,
    color: 'mint' as const,
    note: 'cover_mode = icon',
  },
  {
    title: 'Новый год',
    meta: 'Пока пусто',
    photos: [],
    icon: 'tree' as const,
    color: 'mint' as const,
    date: '31 декабря',
    note: 'без фото',
  },
]

export default function DevCoversPage() {
  return (
    <Suspense>
      <main className="flex flex-col gap-4 px-5 py-8 lg:px-8">
        <h1 className="m-0 text-xl font-bold">Обложки: коллаж 1–4 фото (подставные данные)</h1>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] lg:gap-4">
          {CASES.map((c) => (
            <div key={c.title} className="flex flex-col gap-1.5">
              <Cover
                title={c.title}
                meta={c.meta}
                date={c.date}
                photos={c.photos}
                coverMode={c.coverMode}
                icon={c.icon ?? 'heart'}
                color={c.color ?? 'lavender'}
              />
              <span className="px-1 text-xs text-text-2">{c.note}</span>
            </div>
          ))}
        </div>
      </main>
    </Suspense>
  )
}
