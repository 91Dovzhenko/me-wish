-- Проверка RLS и удаления списков (ТЗ 003-b) на двух пользователях.
-- Запуск: supabase db query --remote --yes -f supabase/tests/rls_003b_lists.sql
-- Блок завершается исключением со сводкой — транзакция откатывается, в базе ничего не остаётся.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  a_list uuid;   -- «Мои желания» A (по умолчанию)
  a_list2 uuid;  -- второй список A
  b_list uuid;
  a_wish uuid;
  a_wish2 uuid;
  n integer;
  v uuid;
  ok integer := 0;
  bad text := '';
  r record;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls3b-a@example.test',
     '{"full_name":"Анна Тестова"}', now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls3b-b@example.test',
     '{"name":"Борис"}', now(), now());
  select default_list_id into a_list from public.profiles where id = a;
  select default_list_id into b_list from public.profiles where id = b;

  -- ── A: второй список, желания в «Моих желаниях»
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  execute 'set local role authenticated';

  insert into public.lists (title, description, event_date, icon, color, cover_mode)
  values ('День рождения', 'Идеи к 35-летию', '2027-03-14', 'cake', 'pink', 'icon')
  returning id into a_list2;
  if a_list2 is not null then ok := ok + 1; else bad := bad || ' [A не создал список]'; end if;

  insert into public.wishes (title, price) values ('Желание 1', 1000) returning id into a_wish;
  insert into public.list_items (list_id, wish_id) values (a_list, a_wish);
  insert into public.wishes (title, price, status) values ('Желание 2', 500, 'gifted') returning id into a_wish2;
  insert into public.list_items (list_id, wish_id) values (a_list, a_wish2);

  select active_count, total_price, done_count, done_sum into r from public.list_overview where id = a_list;
  if r.active_count = 1 and r.total_price = 1000 and r.done_count = 1 and r.done_sum = 500 then ok := ok + 1;
  else bad := bad || format(' [сводка списка: %s]', row_to_json(r)); end if;

  -- редактирование настроек
  update public.lists set title = 'ДР', description = null, event_date = null, cover_mode = 'collage' where id = a_list2;
  get diagnostics n = row_count;
  if n = 1 then ok := ok + 1; else bad := bad || ' [A не изменил свой список]'; end if;

  -- напрямую поставить deleted_at или удалить строку нельзя
  begin
    update public.lists set deleted_at = now() where id = a_list2;
    bad := bad || ' [A поставил deleted_at напрямую]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    delete from public.lists where id = a_list2;
    bad := bad || ' [A удалил строку списка]';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  execute 'reset role';

  -- ── B: чужой список не открыть, не изменить, не удалить
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.lists where id in (a_list, a_list2);
  if n = 0 then ok := ok + 1; else bad := bad || ' [B видит списки A]'; end if;
  select count(*) into n from public.list_overview where id in (a_list, a_list2);
  if n = 0 then ok := ok + 1; else bad := bad || ' [B видит list_overview A]'; end if;
  update public.lists set title = 'взлом' where id = a_list2;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B изменил список A]'; end if;
  begin
    perform public.delete_list(a_list2);
    bad := bad || ' [B удалил список A через delete_list]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  -- B не может удалить свой единственный список
  begin
    perform public.delete_list(b_list);
    bad := bad || ' [B удалил единственный список]';
  exception when sqlstate 'P0001' then ok := ok + 1;
  end;

  execute 'reset role';

  -- ── A: удаляет список по умолчанию с желаниями
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  execute 'set local role authenticated';

  perform public.delete_list(a_list);

  select count(*) into n from public.lists where id = a_list;
  if n = 0 then ok := ok + 1; else bad := bad || ' [удалённый список виден в lists]'; end if;
  select count(*) into n from public.list_overview where id = a_list;
  if n = 0 then ok := ok + 1; else bad := bad || ' [удалённый список виден в list_overview]'; end if;
  select default_list_id into v from public.profiles where id = a;
  if v = a_list2 then ok := ok + 1; else bad := bad || ' [default_list_id не перенесён]'; end if;
  -- желания остались, с отметкой удаления, и доступны для корзины
  select count(*) into n from public.list_items where list_id = a_list and deleted_at is not null;
  if n = 2 then ok := ok + 1; else bad := bad || format(' [желаний удалённого списка в корзине: %s]', n); end if;
  select count(*) into n from public.wishes where id in (a_wish, a_wish2);
  if n = 2 then ok := ok + 1; else bad := bad || ' [желания удалённого списка не читаются]'; end if;
  select * into r from public.dashboard_summary('UTC');
  if r.active_count = 0 and r.done_count = 0 then ok := ok + 1; else bad := bad || ' [корзина удалённого списка в сводке]'; end if;

  -- в удалённый список ничего не добавить, его не изменить, его не сделать списком по умолчанию
  begin
    insert into public.wishes (title) values ('Желание 3') returning id into v;
    insert into public.list_items (list_id, wish_id) values (a_list, v);
    bad := bad || ' [добавление в удалённый список]';
  exception when insufficient_privilege or check_violation then ok := ok + 1;
  end;
  update public.lists set title = 'воскрес' where id = a_list;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else bad := bad || ' [изменён удалённый список]'; end if;
  begin
    update public.profiles set default_list_id = a_list where id = a;
    bad := bad || ' [удалённый список стал списком по умолчанию]';
  exception when insufficient_privilege or check_violation then ok := ok + 1;
  end;
  begin
    perform public.delete_list(a_list);
    bad := bad || ' [повторное удаление]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;

  -- корзина 003-e: желание удалённого списка можно вернуть в другой список
  update public.list_items set list_id = a_list2, deleted_at = null where list_id = a_list and wish_id = a_wish;
  get diagnostics n = row_count;
  if n = 1 then ok := ok + 1; else bad := bad || ' [не вернулось в другой список]'; end if;
  select item_count into n from public.list_overview where id = a_list2;
  if n = 1 then ok := ok + 1; else bad := bad || ' [возвращённое не видно в списке]'; end if;

  -- последний список удалить нельзя
  begin
    perform public.delete_list(a_list2);
    bad := bad || ' [удалён последний список]';
  exception when sqlstate 'P0001' then ok := ok + 1;
  end;

  execute 'reset role';

  -- ── B после всего: по-прежнему не видит ни списков, ни желаний A
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.list_items where list_id in (a_list, a_list2);
  if n = 0 then ok := ok + 1; else bad := bad || ' [B видит корзину A]'; end if;
  select count(*) into n from public.wishes;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B видит желания A]'; end if;
  execute 'reset role';

  raise exception 'RLS-ТЕСТ 003-b: пройдено %, ошибок: %', ok, coalesce(nullif(bad, ''), 'нет');
end;
$$;
