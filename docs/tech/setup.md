# Каркас проекта (ТЗ 001)

- **Версии:** Vite 8, React 19, React Router 8 (пакет `react-router`), Tailwind CSS 4 (через `@tailwindcss/vite`, без `tailwind.config`), vite-plugin-pwa 2, supabase-js 2, Supabase CLI 3.
- **TypeScript 6.0, а не 7:** шаблон Vite ставит TS 7, но `typescript-eslint` пока поддерживает TS < 6.1. Когда поддержка 7 появится, можно обновить.
- **ESLint вместо oxlint:** шаблон Vite теперь ставит oxlint, а ТЗ требует ESLint + Prettier. Конфиг: `eslint.config.js` (flat). Prettier: `.prettierrc.json`, `npm run format`.
- **Цвета:** с ТЗ 003-a — дизайн-система этапа 1, только светлая тема, см. `docs/tech/stage1-foundation.md`.
- **Дата сборки:** константа `__BUILD_TIME__` (`define` в `vite.config.ts`), объявлена в `src/vite-env.d.ts`.
- **Проверка связи с Supabase** (заглушка 001) убрана в 003-a вместе с заглушкой.
- **PWA:** `registerType: 'autoUpdate'` + `skipWaiting` + `clientsClaim`: новый service worker сразу берёт управление, старый кэш чистится. Новая версия видна после перезагрузки страницы (у установленного PWA — после повторного открытия).
- **Иконки:** с 003-e — знак ME:WISH, PNG в `public/icons/` рисует `scripts/make-icons.swift` (см. `docs/tech/trash-profile.md`).
- **Деплой:** `.github/workflows/deploy.yml`, официальные actions для Pages (`upload-pages-artifact` + `deploy-pages`). В Settings → Pages источник должен быть «GitHub Actions».
- **Переменные сборки** — GitHub Actions *variables* (не secrets): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Оба значения публичные и всё равно попадают в JS-бандл, поэтому secret не нужен.
