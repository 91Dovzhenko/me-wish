import { Link } from 'react-router'

/** «Страница не найдена» — Mobile-NotFound / Desktop-NotFound (на компьютере — рядом с боковым меню). */
export default function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center lg:min-h-[calc(100dvh-24px)] lg:p-10">
      <span
        aria-hidden="true"
        className="font-display text-[72px] leading-none font-semibold tracking-[-0.04em] text-accent-2 lg:text-[96px]"
      >
        404
      </span>
      <h1 className="m-0 text-2xl font-bold">Страница не найдена</h1>
      <p className="m-0 max-w-[300px] text-[15px] leading-[1.45] text-text-2">
        Возможно, ссылка устарела или список удалили.
      </p>
      <Link
        to="/"
        className="mt-2 inline-flex h-[52px] items-center rounded-[16px] bg-accent px-6 text-base font-bold text-text hover:brightness-[0.97]"
      >
        На главную
      </Link>
    </main>
  )
}
