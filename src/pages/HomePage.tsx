import AvatarStack from '../components/AvatarStack.tsx'
import Button from '../components/Button.tsx'
import Cover from '../components/Cover.tsx'
import { AlertIcon, CheckIcon, PlusIcon } from '../components/Icons.tsx'
import { CoverSkeleton, SkeletonBlock } from '../components/Skeleton.tsx'
import { useAppData, type Dashboard, type ListSection, type ListSummary } from '../data/AppData.tsx'
import { useListActions } from '../features/lists/ListActions.tsx'
import { useWishActions } from '../features/wishes/WishActions.tsx'
import MobileHeader from '../layout/MobileHeader.tsx'
import { formatEventDate, formatRub, listMeta } from '../lib/format.ts'
import { usePhotoUrls } from '../lib/photos.ts'

// Главная: Main / Mobile-FirstRun / Mobile-Home-Loading (телефон),
// Desktop-Home / Desktop-FirstRun / Desktop-Home-Loading (компьютер).

export default function HomePage() {
  const data = useAppData()
  const { openCreate } = useListActions()
  const { openAdd } = useWishActions()
  const ready = data.status === 'ready'
  const lists = ready ? data.lists : []
  const byS: Record<ListSection, ListSummary[]> = {
    mine: lists.filter((l) => l.section === 'mine'),
    shared: lists.filter((l) => l.section === 'shared'),
    viewer: lists.filter((l) => l.section === 'viewer'),
  }
  const firstRun =
    ready &&
    data.dashboard.activeCount + data.dashboard.doneCount === 0 &&
    data.lists.every((l) => l.itemCount === 0)

  return (
    <>
      <main className="flex flex-col gap-4 px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-[120px] lg:gap-[22px] lg:px-8 lg:pt-9 lg:pb-12">
        {/* Телефон: шапка */}
        <div className="lg:hidden">
          <MobileHeader />
        </div>

        {/* Компьютер: заголовок, сводка и «Добавить желание» */}
        <header className="hidden items-start justify-between gap-4 lg:flex">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[32px] font-semibold tracking-[-0.03em]">Главная</h1>
            {ready ? <Summary d={data.dashboard} /> : <SummarySkeleton />}
          </div>
          <Button
            variant="primary"
            onClick={() => openAdd()}
            className="h-12 flex-none rounded-[16px] px-5 text-[15px]"
          >
            <PlusIcon size={18} strokeWidth={2.2} />
            Добавить желание
          </Button>
        </header>

        {/* Телефон: сводка в две строки (D-086) */}
        <div className="px-1 lg:hidden">
          {ready ? <Summary d={data.dashboard} /> : <SummarySkeleton />}
        </div>

        {data.status === 'error' ? (
          <LoadError onRetry={data.reload} />
        ) : (
          <section className="flex flex-col gap-4 lg:mt-2 lg:gap-3.5" aria-labelledby="my-lists">
            <div className="flex items-center justify-between px-1 pt-1 lg:p-0">
              <h2 id="my-lists" className="text-xl font-bold tracking-[-0.01em]">
                Мои списки
              </h2>
              {/* На компьютере «+ Новый список» — в боковом меню (D-076) */}
              <Button variant="link" onClick={openCreate} className="lg:hidden">
                + Новый список
              </Button>
            </div>

            <div className={GRID}>
              {ready ? (
                <>
                  {byS.mine.map((l) => (
                    <ListCover key={l.id} list={l} />
                  ))}
                  {firstRun ? (
                    <StartCard className="col-span-2 hidden lg:flex" onAdd={() => openAdd()} />
                  ) : null}
                </>
              ) : (
                [0, 1, 2, 3].map((i) => <CoverSkeleton key={i} />)
              )}
            </div>

            {firstRun ? (
              <StartCard className="mt-1.5 flex lg:hidden" onAdd={() => openAdd()} />
            ) : null}

            {/* Разделы D-114 / D-123: пустые скрыты */}
            {(['shared', 'viewer'] as const).map((sec) =>
              byS[sec].length > 0 ? (
                <div key={sec} className="flex flex-col gap-4 lg:gap-3.5">
                  <h2 className="mt-2 px-1 text-xl font-bold tracking-[-0.01em] lg:mt-3 lg:p-0">
                    {SECTION_TITLE[sec]}
                  </h2>
                  <div className={GRID}>
                    {byS[sec].map((l) => (
                      <ListCover key={l.id} list={l} small />
                    ))}
                  </div>
                </div>
              ) : null,
            )}
          </section>
        )}
      </main>

      {/* Телефон: плавающая «+» */}
      <button
        type="button"
        aria-label="Добавить желание"
        onClick={() => openAdd()}
        className="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+28px)] z-10 flex size-16 cursor-pointer items-center justify-center rounded-full bg-accent text-text shadow-fab lg:hidden"
      >
        <PlusIcon size={28} />
      </button>
    </>
  )
}

const GRID = 'grid grid-cols-2 gap-3 lg:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] lg:gap-4'

const SECTION_TITLE: Record<ListSection, string> = {
  mine: 'Мои списки',
  shared: 'Совместные',
  viewer: 'Со мной поделились',
}

function ListCover({ list, small }: { list: ListSummary; small?: boolean }) {
  const urls = usePhotoUrls(list.coverMode === 'collage' ? list.coverPhotos : [])
  return (
    <Cover
      heightClass={small ? 'h-[120px] lg:h-[160px]' : undefined}
      members={
        list.members.length > 1 ? <AvatarStack people={list.members} size={22} /> : undefined
      }
      // пока ссылка не получена — пустая плитка коллажа (без «прыжка» с иконки на фото)
      photos={list.coverPhotos.map((p) => urls[p] ?? '')}
      title={list.title}
      meta={listMeta(list.itemCount, list.totalPrice)}
      date={list.eventDate ? formatEventDate(list.eventDate) : undefined}
      icon={list.icon}
      color={list.color}
      coverMode={list.coverMode}
      to={`/l/${list.id}`}
    />
  )
}

/** Сводка: телефон — две строки, компьютер — одна (D-050, D-074, D-086). */
function Summary({ d }: { d: Dashboard }) {
  return (
    <p
      aria-label="Сводка"
      className="m-0 flex flex-col items-start gap-1.5 text-[13px] text-text-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-3.5 lg:gap-y-2 lg:text-sm"
    >
      <span className="whitespace-nowrap">
        Активные{' '}
        <b className="font-semibold text-text">
          {d.activeCount} · {formatRub(d.activeSum)}
        </b>
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-done-bg py-[3px] pr-2.5 pl-1.5 whitespace-nowrap text-done-text">
        <CheckIcon size={14} className="text-done-icon" />
        Исполнено в {d.doneYear}:{' '}
        <b className="font-semibold text-text">
          {d.doneCount} · {formatRub(d.doneSum)}
        </b>
      </span>
    </p>
  )
}

function SummarySkeleton() {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:gap-3 lg:pt-1" aria-hidden="true">
      <SkeletonBlock
        tone="line"
        className="h-3.5 w-[180px] rounded-[7px] lg:h-[18px] lg:w-[190px] lg:rounded-[9px]"
      />
      <SkeletonBlock
        tone="line-2"
        className="h-[22px] w-[230px] rounded-[11px] lg:-mt-1 lg:h-[26px] lg:w-[240px] lg:rounded-[13px]"
      />
    </div>
  )
}

/** Блок «С чего начать» (Mobile-FirstRun / Desktop-FirstRun). */
function StartCard({ className = '', onAdd }: { className?: string; onAdd: () => void }) {
  return (
    <div
      className={`flex-col items-start gap-2.5 rounded-[28px] bg-surface px-5 py-[22px] lg:justify-center lg:rounded-[26px] lg:px-7 lg:py-[26px] ${className}`}
    >
      <span className="rounded-full bg-accent-2-soft px-2.5 py-1 text-xs font-bold text-accent-2-text">
        С чего начать
      </span>
      <p className="m-0 text-[19px] leading-[1.3] font-bold lg:text-[22px]">
        Добавьте первое желание — хватит названия
      </p>
      <p className="m-0 text-sm leading-[1.45] text-text-2 lg:hidden">
        Сделайте скриншот товара в приложении магазина, обрежьте его прямо здесь и вставьте ссылку —
        чтобы подарили именно то, что нужно.
      </p>
      <p className="m-0 hidden max-w-[460px] text-[15px] leading-[1.45] text-text-2 lg:block">
        Сделайте скриншот товара, перетащите его в окно или вставьте ⌘V, добавьте ссылку — чтобы
        подарили именно то, что нужно.
      </p>
      <Button
        variant="dark"
        onClick={onAdd}
        className="mt-1.5 h-auto rounded-[16px] px-[18px] py-[13px] text-[15px] lg:h-12 lg:px-5 lg:py-0"
      >
        Добавить первое желание
      </Button>
    </div>
  )
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <div
        role="alert"
        className="flex items-center gap-2.5 rounded-[16px] bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger"
      >
        <AlertIcon size={18} className="flex-none" />
        Не получилось загрузить списки. Проверьте интернет.
      </div>
      <Button variant="dark" onClick={onRetry}>
        Попробовать ещё раз
      </Button>
    </div>
  )
}
