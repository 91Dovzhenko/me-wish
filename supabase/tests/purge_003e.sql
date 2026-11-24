-- Проверка автоочистки корзины (ТЗ 003-e) на тестовых данных со сдвинутой датой удаления.
-- Запуск: supabase db query --remote --yes -f supabase/tests/purge_003e.sql
-- Блок завершается исключением со сводкой — транзакция откатывается (в том числе всё, что удалил purge_trash).
do $$
declare
  u uuid := gen_random_uuid();
  l_main uuid;
  l_old uuid;
  l_mixed uuid;
  w_old uuid;
  w_new uuid;
  w_alive uuid;
  w_list_old uuid;
  w_mixed_old uuid;
  w_mixed_new uuid;
  res jsonb;
  r record;
  ok integer := 0;
  bad text := '';
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'purge3e@example.test',
          '{"full_name":"Тест Очистки"}', now(), now());
  select default_list_id into l_main from public.profiles where id = u;

  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  execute 'set local role authenticated';
  insert into public.lists (title) values ('Старый удалённый') returning id into l_old;
  insert into public.lists (title) values ('Удалённый недавно') returning id into l_mixed;
  w_old := public.add_wish(null, l_main, 'В корзине 31 день');
  w_new := public.add_wish(null, l_main, 'В корзине 29 дней');
  w_alive := public.add_wish(null, l_main, 'Не в корзине');
  w_list_old := public.add_wish(null, l_old, 'Из списка, удалённого 40 дней назад');
  w_mixed_old := public.add_wish(null, l_mixed, 'Удалено вручную 35 дней назад');
  w_mixed_new := public.add_wish(null, l_mixed, 'Удалено со списком 5 дней назад');
  perform public.delete_list(l_old);
  perform public.delete_list(l_mixed);
  execute 'reset role';

  -- сдвигаем даты удаления в прошлое
  update public.list_items set deleted_at = now() - interval '31 days' where wish_id = w_old;
  update public.list_items set deleted_at = now() - interval '29 days' where wish_id = w_new;
  update public.list_items set deleted_at = now() - interval '40 days' where wish_id = w_list_old;
  update public.lists set deleted_at = now() - interval '40 days' where id = l_old;
  update public.list_items set deleted_at = now() - interval '35 days' where wish_id = w_mixed_old;
  update public.list_items set deleted_at = now() - interval '5 days' where wish_id = w_mixed_new;
  update public.lists set deleted_at = now() - interval '5 days' where id = l_mixed;

  res := public.purge_trash();

  -- 1. старше 30 дней — удалены вместе с желаниями
  select (select count(*) from public.wishes where id in (w_old, w_list_old, w_mixed_old)) as wishes,
         (select count(*) from public.list_items where wish_id in (w_old, w_list_old, w_mixed_old)) as items into r;
  if r.wishes = 0 and r.items = 0 then ok := ok + 1; else bad := bad || format(' [старые остались: %s]', row_to_json(r)); end if;

  -- 2. моложе 30 дней и не в корзине — на месте
  select count(*) as n into r from public.wishes where id in (w_new, w_alive, w_mixed_new);
  if r.n = 3 then ok := ok + 1; else bad := bad || format(' [удалено лишнее: осталось %s из 3]', r.n); end if;

  -- 3. удалённый список без появлений — удалён; с недавними появлениями — остался
  select (select count(*) from public.lists where id = l_old) as old_list,
         (select count(*) from public.lists where id = l_mixed) as mixed_list,
         (select count(*) from public.lists where id = l_main) as main_list into r;
  if r.old_list = 0 and r.mixed_list = 1 and r.main_list = 1 then ok := ok + 1;
  else bad := bad || format(' [списки: %s]', row_to_json(r)); end if;

  -- 4. сводка функции
  if (res ->> 'items')::int >= 3 and (res ->> 'wishes')::int >= 3 and (res ->> 'lists')::int >= 1 then ok := ok + 1;
  else bad := bad || format(' [сводка: %s]', res); end if;

  -- 5. расписание настроено
  select count(*) as n into r from cron.job
  where jobname in ('me-wish-purge-trash', 'me-wish-storage-cleanup') and active;
  if r.n = 2 then ok := ok + 1; else bad := bad || format(' [заданий в pg_cron: %s]', r.n); end if;

  raise exception 'ТЕСТ АВТООЧИСТКИ 003-e: пройдено %, ошибок: % · %', ok, coalesce(nullif(bad, ''), 'нет'), res;
end;
$$;
