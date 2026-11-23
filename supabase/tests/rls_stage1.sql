-- Проверка RLS этапа 1 на двух пользователях (ТЗ 003-a).
-- Запуск: supabase db query --remote --yes -f supabase/tests/rls_stage1.sql
-- Весь блок завершается исключением со сводкой — транзакция откатывается, в базе ничего не остаётся.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  a_list uuid;
  b_list uuid;
  a_wish uuid;
  a_wish2 uuid;
  n integer;
  ok integer := 0;
  bad text := '';
  r record;
begin
  -- Два пользователя «как после входа через Google»
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@example.test',
     '{"full_name":"Анна Тестова","avatar_url":"https://example.test/a.png"}', now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@example.test',
     '{"name":"Борис"}', now(), now());

  -- Триггер первого входа
  select p.default_list_id into a_list from public.profiles p where p.id = a and p.display_name = 'Анна Тестова' and p.avatar_url = 'https://example.test/a.png';
  select p.default_list_id into b_list from public.profiles p where p.id = b and p.display_name = 'Борис';
  if a_list is not null and b_list is not null then ok := ok + 1; else bad := bad || ' [профиль/default_list_id]'; end if;
  select count(*) into n from public.lists l join public.list_members m on m.list_id = l.id and m.user_id = a and m.role = 'editor'
    where l.id = a_list and l.title = 'Мои желания' and l.icon = 'heart' and l.color = 'lavender' and l.cover_mode = 'collage';
  if n = 1 then ok := ok + 1; else bad := bad || ' [список «Мои желания»/участие]'; end if;

  -- ── От имени A: желания и сводка
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  execute 'set local role authenticated';

  insert into public.wishes (title, price) values ('Тестовое желание A', 1000) returning id into a_wish;
  insert into public.list_items (list_id, wish_id) values (a_list, a_wish);
  insert into public.wishes (title, price, status) values ('Подарок A', 500, 'gifted') returning id into a_wish2;
  insert into public.list_items (list_id, wish_id, priority) values (a_list, a_wish2, 5);

  select * into r from public.dashboard_summary('Europe/Moscow');
  if r.active_count = 1 and r.active_sum = 1000 and r.done_count = 1 and r.done_sum = 500 then ok := ok + 1;
  else bad := bad || format(' [сводка A: %s]', row_to_json(r)); end if;

  select item_count, total_price into r from public.list_overview where id = a_list;
  if r.item_count = 2 and r.total_price = 1000 then ok := ok + 1; else bad := bad || ' [list_overview A]'; end if;

  select count(*) into n from public.lists;
  if n = 1 then ok := ok + 1; else bad := bad || format(' [A видит списков: %s]', n); end if;

  -- корзина не попадает в сводку
  update public.list_items set deleted_at = now() where wish_id = a_wish;
  select * into r from public.dashboard_summary('Europe/Moscow');
  if r.active_count = 0 and r.active_sum = 0 then ok := ok + 1; else bad := bad || ' [корзина в сводке]'; end if;
  update public.list_items set deleted_at = null where wish_id = a_wish;

  execute 'reset role';

  -- ── От имени B: чужое не видно и не меняется
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.lists where id = a_list;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B видит список A]'; end if;
  select count(*) into n from public.lists;
  if n = 1 then ok := ok + 1; else bad := bad || ' [B видит не только свой список]'; end if;
  select count(*) into n from public.list_overview where id = a_list;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B видит list_overview A]'; end if;
  select count(*) into n from public.wishes;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B видит желания A]'; end if;
  select count(*) into n from public.list_items;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B видит list_items A]'; end if;
  select count(*) into n from public.list_members where list_id = a_list;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B видит участников A]'; end if;
  select count(*) into n from public.profiles where id = a;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B видит профиль A]'; end if;
  select count(*) into n from public.profiles_public() where id = a;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B видит имя A без общего списка]'; end if;
  select * into r from public.dashboard_summary('UTC');
  if r.active_count = 0 and r.done_count = 0 then ok := ok + 1; else bad := bad || ' [сводка B включает A]'; end if;

  update public.lists set title = 'взлом' where id = a_list;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B изменил список A]'; end if;
  delete from public.lists where id = a_list;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B удалил список A]'; end if;
  update public.wishes set title = 'взлом' where id = a_wish;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B изменил желание A]'; end if;
  delete from public.wishes where id = a_wish;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B удалил желание A]'; end if;
  update public.list_items set priority = 1 where list_id = a_list;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B изменил list_items A]'; end if;
  update public.profiles set display_name = 'взлом' where id = a;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B изменил профиль A]'; end if;

  begin
    insert into public.list_items (list_id, wish_id) values (b_list, a_wish);
    bad := bad || ' [B подцепил желание A к своему списку]';
  exception when insufficient_privilege or check_violation then ok := ok + 1;
  end;
  begin
    insert into public.list_members (list_id, user_id, role) values (a_list, b, 'editor');
    bad := bad || ' [B добавил себя в список A]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into public.lists (title, created_by) values ('от имени A', a);
    bad := bad || ' [B создал список от имени A]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    update public.profiles set default_list_id = a_list where id = b;
    bad := bad || ' [B сделал список A своим по умолчанию]';
  exception when insufficient_privilege or check_violation then ok := ok + 1;
  end;

  -- B создаёт свой список: становится редактором, видит его сразу (insert … returning)
  insert into public.lists (title, icon, color) values ('Новый список B', 'gift', 'pink') returning id into b_list;
  select count(*) into n from public.list_members where list_id = b_list and user_id = b and role = 'editor';
  if n = 1 then ok := ok + 1; else bad := bad || ' [создатель не стал редактором]'; end if;

  execute 'reset role';

  -- ── Аноним: таблицы недоступны
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
  begin
    select count(*) into n from public.lists;
    bad := bad || ' [аноним читает lists]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';

  raise exception 'RLS-ТЕСТ: пройдено %, ошибок: %', ok, coalesce(nullif(bad, ''), 'нет');
end;
$$;
