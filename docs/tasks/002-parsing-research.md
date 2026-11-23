# 002 — ТЗ для Claude Code: исследование разбора ссылок

**Этап:** 0  **Связано:** SPEC §4.5, ROADMAP «Этап 0», OPEN_QUESTIONS Q-01, DECISIONS D-002, D-005, D-006, D-032, D-035
**Дизайн:** не нужен (исследование, без интерфейса)

## Контекст
Главная фича me:wish — карточка создаётся из одной ссылки (D-002). Разбор ссылок будет жить в Edge Function `parse-link` (этап 1). Перед тем как проектировать интерфейс добавления, нужно понять, **что реально можно достать** из ссылок Ozon, Wildberries, Яндекс Маркета, обычных магазинов и AliExpress, если запрос идёт с серверов Supabase Edge Functions (они за границей, проект в Frankfurt). Это главный риск проекта.

Это **исследование, а не продуктовая функция**. Результат — документ с выводами и рекомендованной стратегией для каждого источника.

## Что сделать
1. **Временная тестовая Edge Function** (например, `parse-probe`) в проекте Supabase `me-wish`. На вход — URL, на выход — для отладки: цепочка редиректов, итоговый URL, HTTP-статус, важные заголовки, размер ответа, признаки антибота/капчи, найдено ли: JSON-LD `Product`, Open Graph, микроразметка, `<title>`, цена, картинка. Задеплоить и прогнать через неё все тестовые ссылки.
2. **Для сравнения** — те же запросы с Mac владельца (российский IP). Важно понять, где разница из-за страны сервера.
3. **По каждому маркетплейсу (Ozon, WB, Яндекс Маркет, AliExpress)** проверить:
   - что отдаёт обычная страница товара на запрос с сервера;
   - короткие ссылки и ссылки «Поделиться» из мобильных приложений (`ozon.ru/t/…`, ссылки WB и Маркета из приложения) — раскрываются ли редиректы;
   - есть ли публичные способы получить данные по артикулу (открытые JSON, которые использует сам сайт, oEmbed и т. п.) — только то, что доступно без входа в аккаунт;
   - можно ли скачать картинку товара с сервера (нужно для копирования в Storage, D-032).
4. **Обычные магазины** — проверить универсальный разбор (JSON-LD → Open Graph → микроразметка → `<title>`) на тестовых ссылках.
5. **Извлекаемые поля** для каждой ссылки: название, первая картинка, цена, валюта, краткое описание, канонический URL (SPEC §4.5). Отметить, что получилось, что нет.
6. **Вывод для каждого источника:** рекомендованная стратегия, запасной вариант, ожидаемая надёжность (высокая / средняя / низкая), что увидит пользователь, если разбор не удался (частичная карточка: ссылка + то, что удалось достать).
7. **Документ** `docs/tech/parsing-research.md`: сводная таблица по всем тестовым ссылкам, выводы по источникам, рекомендация для `parse-link`, риски (блокировки, смена разметки), ограничения бесплатного тарифа Supabase, если они важны.
8. **В конце удалить** тестовую функцию из облачного проекта (код можно оставить в `docs/tech/` или в отдельной папке как пример, но не в `supabase/functions/`).

## Что НЕ делать
- **Не использовать платные прокси, платные API и внешние сервисы парсинга.** Если без них не обойтись — остановись, опиши варианты с ценой в отчёте и в итоговом сообщении владельцу. Решение принимает продукт.
- Не решать капчи, не обходить защиту от ботов подменой отпечатков браузера, не заходить в аккаунты.
- Не делать продуктовую функцию `parse-link`, таблицы, интерфейс — это этап 1.
- Не трогать Instagram (D-035).

## Изменения в базе данных
- Нет.

## Тестовые ссылки
Прислал владелец (реальные желания). Ссылки длинные, с метками рекламы и параметрами размера — это тоже часть проверки: разбор должен с ними справляться.

**Ozon**
1. https://www.ozon.ru/product/mobilnyy-telefon-zaryadki-porta-pyli-chistyashchiy-komplekt-12-sht-3439834265/?at=1iGs1V7rLaj8FNk1FTRXQulch9lAsg5Z&is_apparel_size_selected=true&sh=s1bt61HB8Q
2. https://www.ozon.ru/product/shchetka-dlya-chistki-gadzhetov-shchetka-dlya-chistki-naushnikov-klaviatury-telefona-2-4548627348/?at=1iGs1RkzESU_dZXMfBvGybkeUPfz0VPJ&is_apparel_size_selected=true&sh=s1bt6_TOzw
3. https://www.ozon.ru/product/nezamerzayushchaya-zhidkost-kontsentrat-1litr-do-85-gr-6251994274/?at=1iGs1ZxVOaDV-cSUGY8dv46xTU_NaqSu&sh=s1bt61HB8Q

**Wildberries**
1. https://www.wildberries.ru/catalog/552288745/detail.aspx?targetUrl=MI
2. https://www.wildberries.ru/catalog/285880104/detail.aspx
3. https://www.wildberries.ru/catalog/210692346/detail.aspx?size=337064852

**Яндекс Маркет** (первая и третья — с рекламными параметрами `cpc`, очень длинные)
1. https://market.yandex.ru/card/champion-wrap-toe-slippers-mens-black-40/5096120617?do-waremd5=WJC8KoW0lzI6V7o4oF7Dlg&sponsored=1&cpc=V5SD0mCJ00HO3WT95O3Iq6p_xb1yYF7eJs77f92IyRkBmVXL6e_aNT9TjJRTl4xgkvFp6exG1sUHaljWrZr0XZlwRsgZTVlD5ETNThKxKi3CFIT9pFzbJQYajGOckY_O2jHjvOEid1ymJlZ2fW4fhDqyJkrVuQ_rydNxNOVRt-7f8eDC-Za4stWYmwZBbF4sGb9jY2T8E6QFStPMs2j-bWue2ssgqO8cE_G9DAyQfQhRJTJVerzVCKc39R217wTM8vm_dEBtHbQ-I26xGYeVAQVP1WNGUp8-68qz0ivKP8GG7gfx856WVU8mQzjY7r0ZHVv_V3aO521wISr9Pt83sev40AbjDHufv4p31I471t7FvAfz6nICMRgh3CMkW5G-KJb2brhpZVQth_ZVZDnIoFsNRiBvbAR8PoqXcV5BLxQtMAk8ompcSOAEIxbQYdrw0jM1ZVYqSdaxWaBVZyEvWjXpR5oeySHC8rt2xAnS7MPL6VGMIrc_iB5jOn68TQPkuhRMl_5Dkag%2C&nid=66042169&ultima=1&ogV=400
2. https://market.yandex.ru/card/ochki-coin-whitelab--one-size--seryy-/5654393185?do-waremd5=nw358qvn76FrmhRm8XJdlg&nid=51890381&ultima=1&ogV=400
3. https://market.yandex.ru/card/svetofiltr-kf-concept-nano-x-series-black-mist-18-82-mm-green-coating-smyagchayushchiy-prosvetlyayushchiy-vodottalkivayushchiy/6268308711?do-waremd5=1zUdBMlcnlcpJKeA14L2QQ&sponsored=1&cpc=BkSB7jb9QVoD7hhqnGDybxEhpuVA7mMvFHyuzAFlMtJc4e7Zk94O3LPg4zY4eaNOo41XRb-_XhbVMQvUSYUX6igu3bWf-R610w5A2LL843oXDQINI1gFgXWkaURTbaZK5jBpGTvLh_9vaDhPF5QoGdyVy5pkRLJd3ObPSBj-EQVu_X9N9CqYQTcIutQXQGzqFBx1X00UUW5RFTwmINxxMh5wVFOuKYeXz7scYPnhzLhb5LdYbX_-bN9SxY22cc3U2hp4tsIY7Hn0vbn_IJ1Ixr44oxK4jz0zU-kh4JRCnEpjz1Z9RcrRyErVesiuWKm378Ag7v4IbLK-CbXKRClSzdd-Sa4zBpn0b5FN4qM-KeZVjXcVKDa23FnIIN_HaQjWC6hUjwQ_j2775snV5yg5zroC59CSlPLeVuD_GCDKdlHCr3reXfXySBv9La4BptrqvKtD8bvTQP2duojHZMoBjIA5F_fwBgDM55jxyCZC7Xc8o9Jfx0fNAA9UHtC1tTX0rhnGjA9NEDjmGeH06K0QUrfDhua5dKm81nCDPEdTGIuBjCNQz6-w25odYadt1wUFcXd82UIlBdmBy1SDNzQ5hpwt2g5K1HxKiIq-Y2Lf8gdBnv0x0LpxTA%2C%2C&nid=26996470&ogV=400&bnplSelectedPlan=6

**Обычные магазины**
1. https://www.lamoda.ru/p/mp002xu0edqo/clothes-anta-shorty-sportivnye/
2. https://www.lamoda.ru/p/rtlade369701/shoes-adidasoriginals-krossovki/
3. https://oshadhi.store/catalog/sinergii-efirnykh-masel/stress-free-sinergiya-efirnykh-masel/?oid=7333

Lamoda — крупный магазин, возможно со своей защитой; если она ведёт себя как маркетплейс, отметь это отдельно.

**AliExpress** (обе — домен `aliexpress.ru`)
1. https://aliexpress.ru/item/1_173797683.html?sku_id=5000000766521984&spm=a2g2w.productlist.search_results.10.28b42d91hm60hf
2. https://aliexpress.ru/item/1005010115076010.html?spm=a2g2w.detail.rcmdprod.4.50af1968sZStf8&mixer_rcmd_bucket_id=testRankingBaseSasClick&pdp_trigger_item_id=1_173797683&ru_algo_pv_id=160286-61b690-8e5ac1-3acedf-1795428000&scenario=aerSimilarItemPdpRcmd&sku_id=12000051192563964&traffic_source=recommendation&type_rcmd=core

Дополнительно оцени, стоит ли перед разбором чистить ссылку от рекламных и служебных параметров (`cpc`, `spm`, `at`, `sh` и т. п.) и какую ссылку сохранять в карточке — исходную или очищенную (исходная сохраняется всегда, SPEC §4.5).

Коротких ссылок из мобильных приложений среди них нет — дополнительно проверь хотя бы по одной для Ozon, WB и Маркета (возьми любой товар и сделай короткую ссылку через «Поделиться» на сайте, если это возможно, или опиши, что проверить не удалось).

## Критерии приёмки
- [ ] Все 14 тестовых ссылок прогнаны с сервера Supabase и с Mac, результаты в таблице.
- [ ] Для каждого из 5 источников есть стратегия, запасной вариант и оценка надёжности.
- [ ] Ясно, нужен ли платный сервис (да / нет; если да — варианты с ценой, без подключения).
- [ ] Проверено скачивание картинок с сервера.
- [ ] Тестовая функция удалена из облака.
- [ ] `docs/tech/parsing-research.md` написан простым языком в начале (вывод для владельца в 5–7 строках), технические детали — ниже.

## Как проверить (для владельца)
1. Открыть `docs/tech/parsing-research.md` — в начале короткий вывод: что с каждым маркетплейсом работает, что нет, нужны ли деньги.
2. Принести отчёт в проект Claude: «Разбери отчёт 002».

## Отчёт
Напиши `docs/reports/002-parsing-research.md` по шаблону `docs/templates/report.md`.
