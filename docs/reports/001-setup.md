# 001 — Отчёт Claude Code: каркас проекта, деплой, Supabase, PWA

**Дата:** 2026-11-22  **ТЗ:** `docs/tasks/001-setup.md`  **Коммит:** «Этап 0: каркас приложения, деплой на GitHub Pages, Supabase, PWA»

## Сделано
1. **Git.** Репозиторий уже был (ветка `main`, remote `91Dovzhenko/me-wish`), `git init` не делался.
2. **Каркас.** Vite 8 + React 19 + TypeScript 6 + Tailwind CSS 4 + React Router 8, ESLint 10 (flat config) + Prettier 3. Структура: `src/` (`pages/`, `lib/`), `public/`, `supabase/`.
3. **Маршрутизация.** `BrowserRouter` с `basename` `/me-wish/`. Прямые ссылки — приём с `public/404.html` + восстановление адреса в `index.html`; при установленном service worker — `navigateFallback`. Неизвестные адреса — страница «Страница не найдена» со ссылкой «На главную». Описание — `docs/tech/routing.md`.
4. **Деплой.** `.github/workflows/deploy.yml`: при пуше в `main` — `npm ci`, lint, сборка, публикация через официальные actions GitHub Pages. Также можно запустить вручную (workflow_dispatch).
5. **Supabase.** Supabase CLI 3.2 установлен (Homebrew), `supabase init` → `supabase/config.toml`, `migrations/`, `functions/` (пустые, с `.gitkeep`). Папка связана с облачным проектом `me-wish` (`ldpxoyqpxesypgxjakxf`, eu-central-1) через `supabase link`; вход в CLI выполнил владелец, пароль базы не вводился. Клиент — `src/lib/supabase.ts`, переменные `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (значение — publishable key). Локально — `.env` (в `.gitignore`), шаблон — `.env.example`.
6. **Заглушка.** «me:wish», «Списки желаний — скоро здесь», индикатор «Supabase: подключено» (зелёный) / «Supabase: нет связи» (красный) / «проверяем…» по реальному запросу `GET /auth/v1/health`, внизу — дата и время сборки. Цвета через CSS-переменные, светлая и тёмная тема по системной настройке.
7. **PWA.** Манифест (`me:wish`, `lang: ru`, `standalone`, `start_url`/`scope` = `/me-wish/`), временные иконки 192, 512, maskable 512, apple-touch-icon 180, мета-теги iOS. Service worker через `vite-plugin-pwa`: `autoUpdate` + `skipWaiting` + `clientsClaim` + очистка старых кэшей.
8. **README.md** — запуск, переменные, деплой.
9. **Коммит** подготовлен, не запушен.

## Переменные для GitHub Actions
Settings → Secrets and variables → Actions → вкладка **Variables** → New repository variable:

| Имя | Тип | Значение / откуда взять |
|---|---|---|
| `VITE_SUPABASE_URL` | **variable** | `https://ldpxoyqpxesypgxjakxf.supabase.co` — Supabase → Project Settings → Data API → Project URL (без `/rest/v1/`) |
| `VITE_SUPABASE_ANON_KEY` | **variable** | Publishable key `sb_publishable_…` — Supabase → Project Settings → API Keys |

Почему variable, а не secret: оба значения публичные и всё равно попадают в JS-бандл сайта. Если продукт предпочтёт secrets — в workflow нужно заменить `vars.` на `secrets.`.

Кроме того: Settings → Pages → Build and deployment → Source: **GitHub Actions**.

## Не сделано или сделано иначе, чем в ТЗ
- **TypeScript 6.0 вместо 7.0.** Шаблон Vite ставит TS 7, но `typescript-eslint` пока поддерживает TS < 6.1, а ESLint требуется ТЗ.
- **ESLint вместо oxlint.** Свежий шаблон Vite ставит oxlint; заменён на ESLint + Prettier по ТЗ.
- **Публикация проверена** после Push владельца: на `https://91dovzhenko.github.io/me-wish/` заглушка, «Supabase: подключено», дата сборки свежая, service worker зарегистрирован, ошибок в консоли нет; `/me-wish/l/test` открывает «Страница не найдена» внутри приложения, адрес без `#`. Первый запуск workflow упал, потому что Pages ещё не был включён (ожидаемо), повторный ручной запуск прошёл.
- **Не проверено на реальных устройствах:** установка на iPhone и в Chrome на Mac — проверяет владелец. Локально также проверены ширина 390px и десктоп, светлая и тёмная темы.

## Изменения в базе данных
- Нет. Пустая `supabase/migrations/`, связь с проектом.

## Как проверить
1. Владелец пушит коммит через GitHub Desktop, задаёт две переменные (см. выше) и источник Pages «GitHub Actions». Если переменные заданы после первого пуша — Actions → «Деплой на GitHub Pages» → Run workflow.
2. Открыть `https://91dovzhenko.github.io/me-wish/` — «me:wish», зелёное «Supabase: подключено», внизу сегодняшняя дата сборки.
3. Открыть `https://91dovzhenko.github.io/me-wish/l/test` — страница «Страница не найдена» внутри приложения, адрес без `#`.
4. iPhone, Safari → «Поделиться» → «На экран Домой» → иконка «me:wish», открывается без адресной строки.
5. Chrome на Mac → значок установки в адресной строке.

## Технические решения
- Подробно — `docs/tech/setup.md`, `docs/tech/routing.md`.
- Новые зависимости: `react-router` (маршрутизация), `@supabase/supabase-js` (клиент Supabase), `tailwindcss` + `@tailwindcss/vite` (стили), `vite-plugin-pwa` (манифест и service worker), ESLint-пакеты (`eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, `eslint-config-prettier`) и `prettier` — проверка и форматирование кода.
- Временные иконки сгенерированы скриптом на Swift (без новых зависимостей); заменить, когда будет дизайн.
- Новая версия после деплоя появляется после перезагрузки страницы / повторного открытия PWA (service worker обновляется в фоне и сразу берёт управление).

## Проблемы, риски, вопросы к продукту
- `npm audit`: 4 уязвимости уровня moderate в `glob`/`minimatch` — транзитивные зависимости сборки service worker (workbox-build), в браузер не попадают. Исправление требует понижения `vite-plugin-pwa` — не делал, вернуться при обновлении плагина.
- Прямые ссылки на GitHub Pages первым ответом отдают HTTP 404 (особенность приёма). Для пользователей незаметно; поисковики такие страницы могут не индексировать — для приватных списков это неважно.
- ROADMAP/DECISIONS упоминают «anon key»; в Supabase сейчас основной — publishable key (`sb_publishable_…`), он и используется. Имя переменной оставлено `VITE_SUPABASE_ANON_KEY`, как в ТЗ.
