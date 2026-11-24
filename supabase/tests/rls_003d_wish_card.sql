-- Проверка открытой карточки (ТЗ 003-d) на двух пользователях: приоритет, статус, редактирование,
-- перенос, удаление в корзину и отмена удаления.
-- Запуск: supabase db query --remote --yes -f supabase/tests/rls_003d_wish_card.sql
-- Блок завершается исключением со сводкой — транзакция откатывается, в базе ничего не остаётся.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  a_list uuid;
  a_list2 uuid;
  b_list uuid;
  a_item uuid;
  a_item2 uuid;
  b_item uuid;
  b_item_trashed uuid;
  w1 uuid;
  w2 uuid;
  bw1 uuid;
  bw2 uuid;
  n integer;
  r record;
  ok integer := 0;
  bad text := '';
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls3d-a@example.test',
     '{"full_name":"Анна Тестова"}', now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls3d-b@example.test',
     '{"name":"Борис"}', now(), now());
  select default_list_id into a_list from public.profiles where id = a;
  select default_list_id into b_list from public.profiles where id = b;

  -- ══ B: два желания — одно на месте, одно в корзине
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  execute 'set local role authenticated';
  bw1 := public.add_wish(null, b_list, 'Желание Бориса', 1000);
  bw2 := public.add_wish(null, b_list, 'В корзине у Бориса');
  select id into b_item from public.list_items where wish_id = bw1;
  select id into b_item_trashed from public.list_items where wish_id = bw2;
  perform public.trash_list_item(b_item_trashed);
  execute 'reset role';

  -- ══ A
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  execute 'set local role authenticated';

  insert into public.lists (title) values ('Второй') returning id into a_list2;
  w1 := public.add_wish(null, a_list, 'Кофе', 500);
  select id into a_item from public.list_items where wish_id = w1;

  -- 1. приоритет — обычным update
  update public.list_items set priority = 4 where id = a_item;
  get diagnostics n = row_count;
  if n = 1 then ok := ok + 1; else bad := bad || ' [A не сменил приоритет]'; end if;

  -- 2. статус: «Куплено» ставит completed_at, «В желаниях» сбрасывает; сводка списка считает
  update public.wishes set status = 'purchased' where id = w1;
  select w.completed_at, o.active_count, o.done_count into r
  from public.wishes w, public.list_overview o where w.id = w1 and o.id = a_list;
  if r.completed_at is not null and r.active_count = 0 and r.done_count = 1 then ok := ok + 1;
  else bad := bad || format(' [статус purchased: %s]', row_to_json(r)); end if;
  update public.wishes set status = 'active' where id = w1;
  select completed_at into r from public.wishes where id = w1;
  if r.completed_at is null then ok := ok + 1; else bad := bad || ' [completed_at не сброшен]'; end if;

  -- 3. редактирование одной функцией, включая перенос во второй список
  perform public.update_wish(a_item, a_list2, '  Кофе в зёрнах ', 650, 'https://example.com/c', 'арабика', 5::smallint, null);
  select li.list_id, li.priority, w.title, w.price, w.description into r
  from public.list_items li join public.wishes w on w.id = li.wish_id where li.id = a_item;
  if r.list_id = a_list2 and r.priority = 5 and r.title = 'Кофе в зёрнах' and r.price = 650 and r.description = 'арабика'
  then ok := ok + 1; else bad := bad || format(' [update_wish: %s]', row_to_json(r)); end if;

  -- 4. «Переместить» — обычным update list_id; счётчики обоих списков
  update public.list_items set list_id = a_list where id = a_item;
  select (select item_count from public.list_overview where id = a_list) as c1,
         (select item_count from public.list_overview where id = a_list2) as c2 into r;
  if r.c1 = 1 and r.c2 = 0 then ok := ok + 1; else bad := bad || format(' [перенос: %s]', row_to_json(r)); end if;

  -- 5. в чужой список не перенести — ни update, ни функцией
  begin
    update public.list_items set list_id = b_list where id = a_item;
    bad := bad || ' [A перенёс в список B]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    perform public.update_wish(a_item, b_list, 'Кофе', null, null, null, 3::smallint, null);
    bad := bad || ' [A перенёс в список B функцией]';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- 6. проверки полей в update_wish
  begin
    perform public.update_wish(a_item, a_list, '   ', null, null, null, 3::smallint, null);
    bad := bad || ' [пустое название сохранилось]';
  exception when sqlstate '22023' then ok := ok + 1;
  end;
  begin
    perform public.update_wish(a_item, a_list, 'Кофе', null, null, null, 3::smallint,
      b::text || '/' || gen_random_uuid()::text || '.webp');
    bad := bad || ' [A сослался на фото в папке B]';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- 7. удаление в корзину и отмена
  perform public.trash_list_item(a_item);
  select (select deleted_at from public.list_items where id = a_item) as d,
         (select item_count from public.list_overview where id = a_list) as c into r;
  if r.d is not null and r.c = 0 then ok := ok + 1; else bad := bad || format(' [в корзину: %s]', row_to_json(r)); end if;
  begin
    perform public.trash_list_item(a_item);
    bad := bad || ' [удалено дважды]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  begin
    perform public.update_wish(a_item, a_list, 'Кофе', null, null, null, 3::smallint, null);
    bad := bad || ' [изменено в корзине]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  perform public.restore_list_item(a_item);
  select (select deleted_at from public.list_items where id = a_item) as d,
         (select item_count from public.list_overview where id = a_list) as c into r;
  if r.d is null and r.c = 1 then ok := ok + 1; else bad := bad || format(' [отмена: %s]', row_to_json(r)); end if;

  -- 8. «Отменить» после удаления списка — нельзя вернуть в удалённый список
  w2 := public.add_wish(null, a_list2, 'Чай');
  select id into a_item2 from public.list_items where wish_id = w2;
  perform public.trash_list_item(a_item2);
  perform public.delete_list(a_list2);
  begin
    perform public.restore_list_item(a_item2);
    bad := bad || ' [вернул в удалённый список]';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- 9. чужое желание: не видно, не открыть
  select count(*) into n from public.list_items where id in (b_item, b_item_trashed);
  if n = 0 then ok := ok + 1; else bad := bad || ' [A видит появления B]'; end if;

  -- 10. чужое: приоритет, статус, перенос в свой список — 0 строк
  update public.list_items set priority = 1 where id = b_item;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else bad := bad || ' [A сменил приоритет у B]'; end if;
  update public.wishes set status = 'gifted' where id = bw1;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else bad := bad || ' [A сменил статус у B]'; end if;
  update public.list_items set list_id = a_list where id = b_item;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else bad := bad || ' [A перенёс желание B в свой список]'; end if;

  -- 11. чужое: редактировать, удалить, вернуть из корзины — «не найдено»
  begin
    perform public.update_wish(b_item, a_list, 'взлом', 1, null, null, 3::smallint, null);
    bad := bad || ' [A отредактировал желание B]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  begin
    perform public.update_wish(b_item, b_list, 'взлом', 1, null, null, 3::smallint, null);
    bad := bad || ' [A отредактировал желание B в его списке]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  begin
    perform public.trash_list_item(b_item);
    bad := bad || ' [A удалил желание B]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  begin
    perform public.restore_list_item(b_item_trashed);
    bad := bad || ' [A вернул желание B из корзины]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  -- в корзину напрямую — тоже 0 строк
  update public.list_items set deleted_at = now() where id = b_item;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else bad := bad || ' [A удалил желание B напрямую]'; end if;

  execute 'reset role';

  -- 12. у B всё на месте (смотрим от имени postgres)
  select li.list_id, li.priority, li.deleted_at, w.title, w.status into r
  from public.list_items li join public.wishes w on w.id = li.wish_id where li.id = b_item;
  if r.list_id = b_list and r.priority = 3 and r.deleted_at is null and r.title = 'Желание Бориса' and r.status = 'active'
  then ok := ok + 1; else bad := bad || format(' [желание B изменилось: %s]', row_to_json(r)); end if;
  select deleted_at into r from public.list_items where id = b_item_trashed;
  if r.deleted_at is not null then ok := ok + 1; else bad := bad || ' [корзина B изменилась]'; end if;

  -- ══ B: желание A недоступно
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.list_items where id = a_item;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B видит появление A]'; end if;
  begin
    perform public.trash_list_item(a_item);
    bad := bad || ' [B удалил желание A]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  begin
    perform public.update_wish(a_item, b_list, 'Забрал себе', null, null, null, 3::smallint, null);
    bad := bad || ' [B перенёс желание A к себе]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  execute 'reset role';

  -- ══ аноним
  execute 'set local role anon';
  begin
    perform public.trash_list_item(a_item);
    bad := bad || ' [аноним вызвал trash_list_item]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    perform public.update_wish(a_item, a_list, 'Аноним', null, null, null, 3::smallint, null);
    bad := bad || ' [аноним вызвал update_wish]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';

  raise exception 'RLS-ТЕСТ 003-d: пройдено %, ошибок: %', ok, coalesce(nullif(bad, ''), 'нет');
end;
$$;
