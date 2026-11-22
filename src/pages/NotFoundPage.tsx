import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-2xl font-bold text-accent">me:wish</p>
      <h1 className="text-xl font-semibold">Страница не найдена</h1>
      <p className="text-muted">Такой страницы нет. Возможно, ссылка устарела.</p>
      <Link
        to="/"
        className="rounded-full bg-accent px-5 py-2.5 font-medium text-white hover:opacity-90"
      >
        На главную
      </Link>
    </main>
  )
}
