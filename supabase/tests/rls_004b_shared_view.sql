-- Совместные списки (ТЗ 004-b): корзина у редакторов, deleted_by, имена участников.
-- Владелец O, редактор E, зритель V, посторонний S.
-- Запуск: supabase db query --remote --yes -f supabase/tests/rls_004b_shared_view.sql
-- Блок завершается исключением со сводкой — транзакция откатывается.

create function pg_temp.as_user(p uuid) returns void language plpgsql as $f$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p::text, true);
  execute 'set local role authenticated';
end;
$f$;

do $$
declare
  o uuid := gen_random_uuid();
  e uuid := gen_random_uuid();
  v uuid := gen_random_uuid();
  s uuid := gen_random_uuid();
  l uuid;
  l2 uuid;
  w1 uuid;
  w2 uuid;
  w3 uuid;
  i1 uuid;
  i2 uuid;
  i3 uuid;
  te text;
  tv text;
  n integer;
  r record;
  paths text[];
  ok integer := 0;
  bad text := '';
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  select x.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', x.email,
         json_build_object('full_name', x.name)::jsonb, now(), now()
  from (values (o, 'rls4b-o@example.test', 'Виталий'), (e, 'rls4b-e@example.test', 'Олеся'),
               (v, 'rls4b-v@example.test', 'Аня'), (s, 'rls4b-s@example.test', 'Посторонний')) as x(id, email, name);

  -- O: «Для дома», три желания; E — редактор, V — зритель
  perform pg_temp.as_user(o);
  insert into public.lists (title) values ('Для дома') returning id into l;
  w1 := public.add_wish(null, l, 'Пылесос', 20000);
  w2 := public.add_wish(null, l, 'Шторы', 4000);
  w3 := public.add_wish(null, l, 'Лампа', 3000);
  select id into i1 from public.list_items where wish_id = w1;
  select id into i2 from public.list_items where wish_id = w2;
  select id into i3 from public.list_items where wish_id = w3;
  select token into te from public.create_invite(l, 'editor');
  select token into tv from public.create_invite(l, 'viewer');
  perform pg_temp.as_user(e);
  perform public.accept_invite(te);
  perform pg_temp.as_user(v);
  perform public.accept_invite(tv);

  -- ══ E удаляет желание — deleted_by = E
  perform pg_temp.as_user(e);
  perform public.trash_list_item(i1);
  execute 'reset role';
  if (select deleted_by from public.list_items where id = i1) = e then ok := ok + 1;
  else bad := bad || ' [deleted_by не поставился]'; end if;

  -- 1. O (редактор) видит удалённое E — с именем удалившего
  perform pg_temp.as_user(o);
  select deleted_by, deleted_by_name, list_shared into r from public.trash_items() where item_id = i1;
  if r.deleted_by = e and r.deleted_by_name = 'Олеся' and r.list_shared then ok := ok + 1;
  else bad := bad || format(' [корзина редактора: %s]', row_to_json(r)); end if;

  -- 2. у самой E удалившего не показываем (это она)
  perform pg_temp.as_user(e);
  select deleted_by, deleted_by_name into r from public.trash_items() where item_id = i1;
  if r.deleted_by is null and r.deleted_by_name is null then ok := ok + 1;
  else bad := bad || format(' [своё удаление с именем: %s]', row_to_json(r)); end if;

  -- 3. зритель корзину чужого списка не видит, не восстанавливает, не очищает
  perform pg_temp.as_user(v);
  select count(*) into n from public.trash_items() where list_id = l;
  if n = 0 then ok := ok + 1; else bad := bad || ' [зритель видит корзину]'; end if;
  begin
    perform public.restore_list_item(i1);
    bad := bad || ' [зритель восстановил]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  select array_agg(p) into paths from public.empty_trash(array[i1]) p;
  execute 'reset role';
  if exists (select 1 from public.list_items where id = i1) then ok := ok + 1;
  else bad := bad || ' [зритель очистил корзину]'; end if;

  -- 4. посторонний ничего не видит
  perform pg_temp.as_user(s);
  select count(*) into n from public.trash_items() where list_id = l;
  if n = 0 then ok := ok + 1; else bad := bad || ' [посторонний видит корзину]'; end if;

  -- 5. deleted_by нельзя подделать с клиента
  perform pg_temp.as_user(o);
  update public.list_items set deleted_by = v where id = i1;
  execute 'reset role';
  if (select deleted_by from public.list_items where id = i1) = e then ok := ok + 1;
  else bad := bad || ' [deleted_by подменён без смены deleted_at]'; end if;
  perform pg_temp.as_user(o);
  update public.list_items set deleted_at = now(), deleted_by = v where id = i2;
  execute 'reset role';
  if (select deleted_by from public.list_items where id = i2) = o then ok := ok + 1;
  else bad := bad || ' [deleted_by подменён при удалении]'; end if;

  -- 6. O восстанавливает удалённое E — deleted_by очищается
  perform pg_temp.as_user(o);
  perform public.restore_list_item(i1);
  execute 'reset role';
  select deleted_at, deleted_by into r from public.list_items where id = i1;
  if r.deleted_at is null and r.deleted_by is null then ok := ok + 1;
  else bad := bad || format(' [восстановление: %s]', row_to_json(r)); end if;

  -- 7. «Очистить корзину» у E удаляет навсегда и удалённое O из совместного списка (D-122)
  perform pg_temp.as_user(e);
  select count(*) into n from public.trash_items() where item_id = i2;
  if n = 1 then ok := ok + 1; else bad := bad || ' [E не видит удалённое O]'; end if;
  perform public.empty_trash(array[i2]);
  execute 'reset role';
  select (select count(*) from public.list_items where id = i2) + (select count(*) from public.wishes where id = w2) into n;
  if n = 0 then ok := ok + 1; else bad := bad || ' [не удалилось навсегда]'; end if;

  -- 8. удаление списка у всех — deleted_by у желаний = удаливший
  perform pg_temp.as_user(o);
  insert into public.lists (title) values ('Ещё один') returning id into l2; -- чтобы было что оставить
  perform pg_temp.as_user(e);
  perform public.delete_list(l);
  execute 'reset role';
  select count(*) into n from public.list_items where list_id = l and deleted_at is not null and deleted_by = e;
  if n = 2 then ok := ok + 1; else bad := bad || format(' [удаление списка: %s с deleted_by]', n); end if;

  -- 9. имена и аватары участников: посторонний не видит, зритель и редактор — видят
  perform pg_temp.as_user(s);
  select count(*) into n from public.profiles_public() where id in (o, e, v);
  if n = 0 then ok := ok + 1; else bad := bad || format(' [посторонний видит %s профилей]', n); end if;
  perform pg_temp.as_user(v);
  select count(*) into n from public.profiles_public() where id in (o, e);
  if n = 2 then ok := ok + 1; else bad := bad || ' [участник не видит имена]'; end if;
  -- 10. и состав чужого списка посторонний не читает
  perform pg_temp.as_user(s);
  select count(*) into n from public.list_members where list_id = l;
  if n = 0 then ok := ok + 1; else bad := bad || ' [посторонний видит состав]'; end if;

  execute 'reset role';
  raise exception 'RLS-ТЕСТ 004-b: пройдено %, ошибок: %', ok, coalesce(nullif(bad, ''), 'нет');
end;
$$;
