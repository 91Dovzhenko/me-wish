# me:wish

Списки желаний, где карточка создаётся из одной ссылки — в приложении или через Telegram-бота.

Сайт: https://91dovzhenko.github.io/me-wish/

## Запуск локально

Нужен Node.js 24+.

```bash
npm install
cp .env.example .env   # заполнить значения Supabase
npm run dev            # http://localhost:5173/me-wish/
```

Команды: `npm run build` (сборка в `dist/`), `npm run lint`, `npm run format`, `npm run preview`.

## Переменные окружения

| Имя                      | Откуда взять                                                                   |
| ------------------------ | ------------------------------------------------------------------------------ |
| `VITE_SUPABASE_URL`      | Supabase → Project Settings → Data API → Project URL                           |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → Publishable key (или Legacy anon key) |

Локально они лежат в `.env` (файл не коммитится), для деплоя — в GitHub: Settings → Secrets and variables → Actions → вкладка **Variables**.
Секретные ключи (service role, токен бота) во фронтенд не попадают никогда.

## Деплой

При пуше в `main` GitHub Actions (`.github/workflows/deploy.yml`) запускает lint и сборку, а затем публикует `dist/` на GitHub Pages.
В Settings → Pages источник — «GitHub Actions».

## Устройство

- `src/` — фронтенд (React + TypeScript + Vite, Tailwind CSS, React Router)
- `supabase/` — `migrations/`, `functions/`, `config.toml` (Supabase CLI)
- `public/` — статика, иконки PWA, `404.html` для прямых ссылок
- `docs/` — документация; технические заметки — `docs/tech/`

## Как устроена работа

- **Проект в Claude** — продуктовая работа: интервью, требования, дизайн, ТЗ, разбор отчётов. Инструкция: `docs/PROJECT_INSTRUCTIONS.md`.
- **Claude Code** — разработка по ТЗ из `docs/tasks/`, отчёты в `docs/reports/`. Инструкция: `CLAUDE.md`.
- Цикл работы — `docs/WORKFLOW.md`.

## Документы

`docs/PRODUCT.md` · `docs/SPEC.md` · `docs/DOMAIN.md` · `docs/DECISIONS.md` · `docs/ROADMAP.md` · `docs/BACKLOG.md` · `docs/OPEN_QUESTIONS.md` · `docs/DESIGN.md` · `docs/JOURNAL.md`
