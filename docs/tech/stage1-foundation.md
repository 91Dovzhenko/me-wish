# Основа этапа 1 (ТЗ 003-a): дизайн-система, вход, база

## Дизайн-система
- **Токены** — CSS-переменные в `src/index.css` (`--bg`, `--surface`, `--text`, `--text-2`, `--border`, `--divider`, `--accent`, `--accent-2`, `--accent-2-soft`, `--accent-2-text`, `--heart`, `--danger` и служебные: скелетоны, «исполнено», заглушка фото). Через `@theme inline` они доступны в Tailwind: `bg-bg`, `bg-surface`, `text-text-2`, `bg-accent`, `text-accent-2-text`, `bg-done-bg` и т. д.
- **8 цветов списков** — `--list-<цвет>-bg | -fg | -cover` (фон иконки, цвет иконки, фон пустой обложки). В коде — `src/lib/listStyle.ts` (`listColorVars`).
- **Скругления**: `rounded-item` 12, `rounded-field` 14, `rounded-btn` 18, `rounded-card` 22, `rounded-window` 32. Нестандартные значения с макетов (17, 26, 28) — произвольными классами.
- **Тени**: `shadow-photo`, `shadow-label`, `shadow-menu`, `shadow-window`, `shadow-fab`.
- **Только светлая тема** (D-055): `color-scheme: light`, `prefers-color-scheme` больше не используется. Для тёмной темы потом достаточно переопределить переменные.
- **Точка перехода телефон/компьютер — 1024 px** (`lg:` в Tailwind = 64rem). Отступлений нет.

## Шрифты
- **Локально, через пакеты `@fontsource-variable/onest` и `@fontsource-variable/unbounded`** (вариативные, все начертания в одном файле). Подключены в `src/index.css`, семейства `Onest Variable` (`font-sans`, по умолчанию) и `Unbounded Variable` (`font-display`: логотип, заголовки экранов, «404»).
- Почему не Google Fonts: нет запроса к сторонним серверам, шрифты работают офлайн в PWA. Браузер скачивает только нужные наборы символов (`unicode-range`); service worker заранее кэширует кириллицу и латиницу (`globPatterns` в `vite.config.ts`).

## Иконки
- **Иконки списков** (30 шт.) и цвета перенесены как SVG-пути из `docs/design/stage1/ListIcon.dc.html` в `src/lib/listStyle.ts`. Тот же список значений проверяется в базе (check в `lists.icon`, `lists.color`).
- **Иконки интерфейса** (плюс, галочка, домик, выход…) — тоже пути из выгрузки, `src/components/Icons.tsx`. Библиотека иконок не подключалась.
- Иллюстрации на экране входа — свои SVG (`src/components/DecorWishCard.tsx`), без фото с маркетплейсов.

## Вход через Google
- `supabase.auth.signInWithOAuth({ provider: 'google' })`, поток **PKCE**, `redirectTo = origin + BASE_URL` → `…/me-wish/` (локально `http://localhost:5173/me-wish/`). Оба адреса должны быть в Supabase → Authentication → URL Configuration → Redirect URLs (`…/me-wish/**`).
- `detectSessionInUrl: false`: код из адреса (`?code=…`) обменивает `src/auth/AuthProvider.tsx` сам, один раз (защита от двойного запуска в StrictMode). Служебные параметры (`code`, `error`, …) сразу убираются из адресной строки.
- Состояния: `initializing` → `signedIn` / `signedOut`; после возврата из Google — `exchanging` («Входим…»), при неудаче или `?error=` — `error` («Не получилось войти»).
- Защита адресов — `RequireAuth` в `src/App.tsx`: без входа всё, кроме `/login`, ведёт на `/login`; вошедшего `/login` отправляет на главную.
- `prompt: 'select_account'` — Google всегда показывает выбор аккаунта (удобно, когда на устройстве несколько аккаунтов).

## База (миграция `supabase/migrations/20261123210000_stage1_schema.sql`)
- Таблицы `profiles`, `lists`, `list_members`, `wishes`, `list_items`; статусы, роли, приоритет, иконки, цвета — `check`-ограничения (а не enum: проще расширять).
- **Права** проверяют функции `is_list_member`, `is_list_editor`, `can_view_wish`, `can_edit_wish`, `can_link_wish`, `shares_list_with` (security definer, `search_path = ''`) — чтобы политики не зацикливались на RLS друг друга.
- `can_link_wish`: в свой список можно положить только своё желание или то, которое уже можешь редактировать. Иначе можно было бы «подцепить» чужое желание по id и прочитать его.
- Политики чтения `lists` и `wishes` дополнительно пропускают автора (`created_by = auth.uid()`): иначе `insert … returning` не вернёт строку — участие/появление в списке создаётся позже в той же операции. **На этапе 2** (удаление участников) это стоит пересмотреть: например, добавлять желание одной функцией `add_wish(...)`.
- `list_members` клиенту только для чтения: участие создаётся триггером `lists_add_creator`. Приглашения и роли — этап 2.
- Чужие профили — только через функцию `profiles_public()` (имя и аватар тех, с кем есть общий список). Прямой `select` из `profiles` отдаёт только свою строку.
- Неизменяемые поля (`id`, `created_by`, `created_at`, `list_items.wish_id`, `added_by`) защищены триггером `keep_immutable_columns`.
- `wishes.completed_at` ставит триггер при переходе в `purchased`/`gifted` и сбрасывает при возврате в `active`/`booked`.
- `anon` не имеет доступа к таблицам вообще.
- **Первый вход** — триггер `on_auth_user_created` на `auth.users`: профиль (имя из `full_name`/`name`, иначе начало email; аватар из `avatar_url`/`picture`), список «Мои желания» (heart, lavender), участие редактором, `default_list_id`.
- **Представление `list_overview`** (security_invoker) — списки с числом карточек (не в корзине) и суммой (не в корзине и не исполненные, DOMAIN §6) — для обложек и бокового меню.
- **Функция `dashboard_summary(p_tz)`** — сводка главной. Год считается в часовом поясе браузера (`Intl…timeZone`). Желание считается один раз, корзина не считается ни в «Активных», ни в «Исполнено».

## Как применяются миграции
У CLI нет пароля базы, Docker на Mac нет. Миграция применена командой
`supabase db query --remote --yes -f supabase/migrations/<файл>.sql` (через Management API, нужен вход в CLI),
затем записана в историю: `insert into supabase_migrations.schema_migrations(version, name) values (…)`.
`supabase db push --remote` ждёт пароль базы — с паролем (`-p`) им тоже можно пользоваться.

## Проверка RLS
`supabase/tests/rls_stage1.sql`: создаёт двух пользователей в `auth.users`, по очереди становится ими
(`set local role authenticated` + `request.jwt.claims`) и проверяет 27 условий: триггер первого входа, сводку, корзину,
что второй не видит и не меняет списки, желания, появления, участников и профиль первого, не может подцепить чужое желание,
добавить себя в чужой список, создать список от чужого имени; аноним не читает таблицы. В конце блок бросает исключение
со сводкой — транзакция откатывается, данных не остаётся. Запуск:
`supabase db query --remote --yes -f supabase/tests/rls_stage1.sql` → ожидаемо `ERROR: RLS-ТЕСТ: пройдено 27, ошибок: нет`.

## Проверка экранов без входа через Google
Для визуальной проверки вошедшего состояния в браузере подставлялась поддельная сессия в `localStorage`
и подменялся `fetch` ответами-образцами (только в консоли браузера, в коде этого нет).
