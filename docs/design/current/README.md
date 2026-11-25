# Дизайн ME:WISH — текущая выгрузка холста

Источник: https://claude.ai/artifact/UmB9vPzs6WZYo6rNKBqpbY (версия 1795592297-27dc, выгружено 2026-11-25). Утверждено владельцем: этап 1 (D-097) и совместные списки (дизайн 004, 2026-11-25). Claude Code ссылки claude.ai не открывает — работай по этой папке. **Если холст и эти файлы расходятся, верны эти файлы**, пока продукт не выгрузит новую версию. Прежняя выгрузка `docs/design/stage1/` — история, больше не обновляется.

## Как читать
- Каждый `*.dc.html` — экран или компонент; вёрстка на inline-стилях (размеры, отступы, цвета, скругления, шрифты — оттуда).
- `<dc-import name="X" ...>` — вставка экрана/компонента X с параметрами; состояния — по атрибутам и в скрипте внизу (`renderVals`, `data-props`). `{{…}}`, `<sc-for>`, `<sc-if>` — подстановка данных.
- Фото товаров в выгрузку не входят (скриншоты маркетплейсов на холсте).
- Порядок на холсте (D-118): разделы 0 · На согласовании (пуст), 1 · Вход и первый запуск, 2 · Главная и списки, 3 · Добавление желания и фото, 4 · Карточка желания, 5 · Профиль и корзина, 6 · Общие состояния, 7 · Спецификация. Коды компьютерных версий — с буквой D.
- `Overview.dc.html` — оглавление и «Последние изменения»; `canvas.json` — раскладка холста.
- Основа и компоненты: `Spec-Foundations`, `Spec-Components`, `Spec-Navigation`, `Spec-Feedback`, `Spec-Cards`; компоненты `Sidebar`, `Hearts`, `ListIcon`, `Photo`, `WishCard`, `Cover`, `DatePicker`, `Dialog`, `Toast`, `Avatar`, `AvatarStack`, `Members`, `Invite`, `InviteCard`.
- Компьютерных версий 4.9D, 5.6D, 5.7D с совместными списками нет — делай по телефонным 4.9, 5.6, 5.7 в окне/на странице компьютера.

## Код → файл (131 экранов, по таблице 7.6 холста)

| Код | Экран | Файл |
|---|---|---|
| 1.1 | Вход (телефон) | `Mobile-Login.dc.html` |
| 1.2 | Вход — «Входим…» (телефон) | `Mobile-Login-Loading.dc.html` |
| 1.3 | Вход — ошибка (телефон) | `Mobile-Login-Error.dc.html` |
| 1.4 | Первый вход (телефон) | `Mobile-FirstRun.dc.html` |
| 1.5 | Приглашение — не вошёл (телефон) | `Shared-Accept-Login.dc.html` |
| 1.6 | Приглашение — принять (телефон) | `Shared-Accept.dc.html` |
| 1.7 | Приглашение не действует (телефон) | `Shared-Accept-Expired.dc.html` |
| 1.8 | Тост «Вы присоединились» (телефон) | `Shared-Joined.dc.html` |
| 1.1D | Вход (компьютер) | `Desktop-Login.dc.html` |
| 1.4D | Первый вход (компьютер) | `Desktop-FirstRun.dc.html` |
| 1.5D | Приглашение — не вошёл (компьютер) | `Shared-Accept-Login-Desktop.dc.html` |
| 1.6D | Приглашение — принять (компьютер) | `Shared-Accept-Desktop.dc.html` |
| 1.7D | Приглашение не действует (компьютер) | `Shared-Accept-Expired-Desktop.dc.html` |
| 2.1 | Главная с разделами (телефон) | `Main.dc.html` |
| 2.2 | Главная — загрузка (телефон) | `Mobile-Home-Loading.dc.html` |
| 2.3 | Список (телефон) | `Mobile-List.dc.html` |
| 2.4 | Список — пустой (телефон) | `Mobile-List-Empty.dc.html` |
| 2.5 | Список — загрузка (телефон) | `Mobile-List-Loading.dc.html` |
| 2.6 | Список — без описания (телефон) | `Mobile-List-Compact.dc.html` |
| 2.7 | Список — группа «Исполнено» (телефон) | `Mobile-List-DoneGroup.dc.html` |
| 2.8 | Список — исполнено всё (телефон) | `Mobile-List-AllDone.dc.html` |
| 2.9 | Список — сортировка (телефон) | `Mobile-List-Sort.dc.html` |
| 2.10 | Список — меню «•••» (телефон) | `Mobile-List-Menu.dc.html` |
| 2.11 | Меню единственного списка (телефон) | `Mobile-List-Menu-Last.dc.html` |
| 2.12 | Удаление списка — подтверждение (телефон) | `Mobile-List-DeleteConfirm.dc.html` |
| 2.13 | Новый список (телефон) | `Mobile-NewList.dc.html` |
| 2.14 | Новый список — календарь (телефон) | `Mobile-NewList-Date.dc.html` |
| 2.15 | Настройки списка (телефон) | `Mobile-ListSettings.dc.html` |
| 2.17 | Совместный список — редактор (телефон) | `Shared-List-Mobile.dc.html` |
| 2.18 | Совместный список — меню «•••» (телефон) | `Shared-List-Menu.dc.html` |
| 2.19 | Список глазами зрителя (телефон) | `Shared-Viewer-List.dc.html` |
| 2.20 | Зритель — меню «•••» (телефон) | `Shared-Viewer-Menu.dc.html` |
| 2.21 | Участники — вы один (телефон) | `Shared-Members-One.dc.html` |
| 2.22 | Участники — несколько и ссылка (телефон) | `Shared-Members.dc.html` |
| 2.23 | Участники — меню участника (телефон) | `Shared-Members-Menu.dc.html` |
| 2.24 | Участники у зрителя (телефон) | `Shared-Members-Viewer.dc.html` |
| 2.25 | Пригласить — роль (телефон) | `Shared-Invite-Role.dc.html` |
| 2.26 | Пригласить — ссылка, тост (телефон) | `Shared-Invite-Link.dc.html` |
| 2.27 | «Удалить у всех?» (телефон) | `Shared-Dialog-DeleteAll.dc.html` |
| 2.28 | «Выйти из списка?» (телефон) | `Shared-Dialog-Leave.dc.html` |
| 2.29 | «Вы последний редактор» (телефон) | `Shared-Dialog-LeaveLast.dc.html` |
| 2.30 | «Убрать Олесю?» (телефон) | `Shared-Dialog-Remove.dc.html` |
| 2.1D | Главная с разделами (компьютер) | `Desktop-Home.dc.html` |
| 2.2D | Главная — загрузка (компьютер) | `Desktop-Home-Loading.dc.html` |
| 2.3D | Список (компьютер) | `Desktop-List.dc.html` |
| 2.4D | Список — пустой (компьютер) | `Desktop-List-Empty.dc.html` |
| 2.5D | Список — загрузка (компьютер) | `Desktop-List-Loading.dc.html` |
| 2.9D | Список — сортировка (компьютер) | `Desktop-List-Sort.dc.html` |
| 2.10D | Список — меню «•••» (компьютер) | `Desktop-List-Menu.dc.html` |
| 2.13D | Новый список (компьютер) | `Desktop-NewList.dc.html` |
| 2.14D | Новый список — календарь (компьютер) | `Desktop-NewList-Date.dc.html` |
| 2.15D | Настройки списка (компьютер) | `Desktop-ListSettings.dc.html` |
| 2.16D | Много списков (компьютер) | `Desktop-Home-ManyLists.dc.html` |
| 2.17D | Совместный список (компьютер) | `Shared-List-Desktop.dc.html` |
| 2.22D | Участники — окно (компьютер) | `Shared-Members-Desktop.dc.html` |
| 3.1 | Новое желание — пусто (телефон) | `Mobile-Add-Empty.dc.html` |
| 3.2 | Новое желание — заполнено (телефон) | `Mobile-Add.dc.html` |
| 3.3 | Форма — открыта с главной (телефон) | `Mobile-Add-Home.dc.html` |
| 3.4 | Форма — открыта из списка (телефон) | `Mobile-Add-FromList.dc.html` |
| 3.5 | Обрезка фото (телефон) | `Mobile-Crop.dc.html` |
| 3.6 | Фото загружается (телефон) | `Mobile-Add-Uploading.dc.html` |
| 3.7 | Ошибка: не картинка (телефон) | `Mobile-Add-PhotoError.dc.html` |
| 3.8 | Ошибка: больше 20 МБ (телефон) | `Mobile-Add-PhotoTooBig.dc.html` |
| 3.9 | Предупреждение: маленькое фото (телефон) | `Mobile-Add-PhotoSmall.dc.html` |
| 3.10 | Пустое название (телефон) | `Mobile-Add-NameError.dc.html` |
| 3.11 | Форма с клавиатурой (телефон) | `Mobile-Add-Keyboard.dc.html` |
| 3.12 | «Не сохранять желание?» (телефон) | `Mobile-Add-Discard.dc.html` |
| 3.14 | Форма: выбор списка (телефон) | `Shared-Add-ListPicker.dc.html` |
| 3.2D | Новое желание (компьютер) | `Desktop-Add.dc.html` |
| 3.5D | Обрезка фото (компьютер) | `Desktop-Crop.dc.html` |
| 3.13D | Перетаскивание фото (компьютер) | `Desktop-Add-Drag.dc.html` |
| 4.1 | Карточка — шторка (телефон) | `Mobile-Card.dc.html` |
| 4.2 | Выбор приоритета (телефон) | `Mobile-Card-Priority.dc.html` |
| 4.3 | Статус раскрыт (телефон) | `Mobile-Card-Status.dc.html` |
| 4.4 | Исполненная (телефон) | `Mobile-Card-Done.dc.html` |
| 4.5 | Длинные название и описание (телефон) | `Mobile-Card-Long.dc.html` |
| 4.6 | Без фото и цены (телефон) | `Mobile-Card-NoPhoto.dc.html` |
| 4.7 | Без ссылки и описания (телефон) | `Mobile-Card-NoLink.dc.html` |
| 4.8 | Меню «•••» (телефон) | `Mobile-Card-Menu.dc.html` |
| 4.9 | Переместить (телефон) | `Mobile-Card-Move.dc.html` |
| 4.10 | Редактирование (телефон) | `Mobile-Card-Edit.dc.html` |
| 4.11 | «Не сохранять изменения?» (телефон) | `Mobile-Card-Edit-Discard.dc.html` |
| 4.12 | Карточка: «Добавила Олеся» (телефон) | `Shared-Card-Author.dc.html` |
| 4.13 | Карточка у зрителя (телефон) | `Shared-Card-Viewer.dc.html` |
| 4.1D | Карточка — окно (компьютер) | `Desktop-Card.dc.html` |
| 4.2D | Выбор приоритета (компьютер) | `Desktop-Card-Priority.dc.html` |
| 4.8D | Меню «•••» (компьютер) | `Desktop-Card-Menu.dc.html` |
| 4.9D | Переместить (компьютер) | `Desktop-Card-Move.dc.html` |
| 5.1 | Профиль (телефон) | `Mobile-Profile.dc.html` |
| 5.2 | Профиль — имя (телефон) | `Mobile-Profile-Name.dc.html` |
| 5.3 | Профиль — фото (телефон) | `Mobile-Profile-Avatar.dc.html` |
| 5.4 | Фото профиля — обрезка (телефон) | `Mobile-Avatar-Crop.dc.html` |
| 5.5 | Ошибка загрузки фото (телефон) | `Mobile-Profile-AvatarError.dc.html` |
| 5.6 | Список по умолчанию (телефон) | `Mobile-Profile-DefaultList.dc.html` |
| 5.7 | Корзина (телефон) | `Mobile-Trash.dc.html` |
| 5.8 | Корзина — пусто (телефон) | `Mobile-Trash-Empty.dc.html` |
| 5.9 | Восстановить в список (телефон) | `Mobile-Trash-Restore.dc.html` |
| 5.10 | Очистить корзину (телефон) | `Mobile-Trash-Clear.dc.html` |
| 5.1D | Профиль (компьютер) | `Desktop-Profile.dc.html` |
| 5.2D | Профиль — имя (компьютер) | `Desktop-Profile-Name.dc.html` |
| 5.4D | Фото профиля — обрезка (компьютер) | `Desktop-Avatar-Crop.dc.html` |
| 5.6D | Список по умолчанию (компьютер) | `Desktop-Profile-DefaultList.dc.html` |
| 5.7D | Корзина (компьютер) | `Desktop-Trash.dc.html` |
| 5.8D | Корзина — пусто (компьютер) | `Desktop-Trash-Empty.dc.html` |
| 5.11D | Меню профиля (компьютер) | `Desktop-ProfileMenu.dc.html` |
| 6.1 | Нет интернета (телефон) | `Mobile-Offline.dc.html` |
| 6.2 | Страница не найдена (телефон) | `Mobile-NotFound.dc.html` |
| 6.3 | Подсказка «На экран «Домой»» (телефон) | `Mobile-InstallHint.dc.html` |
| 6.4 | Тост «Добавлено» (телефон) | `Mobile-List-Added.dc.html` |
| 6.5 | Тост «Удалено · Отменить» (телефон) | `Mobile-List-Deleted.dc.html` |
| 6.2D | Страница не найдена (компьютер) | `Desktop-NotFound.dc.html` |
| 7.1 | Цвета, шрифты, отступы, скругления, тени | `Spec-Foundations.dc.html` |
| 7.2 | Элементы | `Spec-Components.dc.html` |
| 7.3 | Карточки и обложки | `Spec-Cards.dc.html` |
| 7.4 | Меню, приоритет, календарь | `Spec-Navigation.dc.html` |
| 7.5 | Диалог, тосты, плашка, скелетоны | `Spec-Feedback.dc.html` |
| 7.6 | Таблица «Код → файл» | `Spec-CodeTable.dc.html` |
| 7.7 | Компонент: карточка | `WishCard.dc.html` |
| 7.8 | Компонент: обложка | `Cover.dc.html` |
| 7.9 | Компонент: фото | `Photo.dc.html` |
| 7.10 | Компонент: сердечки | `Hearts.dc.html` |
| 7.11 | Компонент: иконка списка | `ListIcon.dc.html` |
| 7.12 | Компонент: календарь | `DatePicker.dc.html` |
| 7.13 | Компонент: тост | `Toast.dc.html` |
| 7.14 | Компонент: диалог | `Dialog.dc.html` |
| 7.15 | Компонент: боковое меню | `Sidebar.dc.html` |
| 7.16 | Компонент: аватар | `Avatar.dc.html` |
| 7.17 | Компонент: аватары участников | `AvatarStack.dc.html` |
| 7.18 | Компонент: участники | `Members.dc.html` |
| 7.19 | Компонент: пригласить | `Invite.dc.html` |
| 7.20 | Компонент: карточка приглашения | `InviteCard.dc.html` |
