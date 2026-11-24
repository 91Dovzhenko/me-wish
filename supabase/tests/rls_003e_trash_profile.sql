-- Проверка корзины, профиля и аватаров (ТЗ 003-e) на двух пользователях.
-- Запуск: supabase db query --remote --yes -f supabase/tests/rls_003e_trash_profile.sql
-- Блок завершается исключением со сводкой — транзакция откатывается, в базе ничего не остаётся.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  a_list uuid;
  a_list2 uuid;
  a_list3 uuid;
  b_list uuid;
  w1 uuid := gen_random_uuid();
  w2 uuid;
  w3 uuid;
  i1 uuid;
  i2 uuid;
  i3 uuid;
  a_avatar text;
  n integer;
  r record;
  paths text[];
  ok integer := 0;
  bad text := '';
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls3e-a@example.test',
     '{"full_name":"Анна Тестова"}', now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls3e-b@example.test',
     '{"name":"Борис"}', now(), now());
  select default_list_id into a_list from public.profiles where id = a;
  select default_list_id into b_list from public.profiles where id = b;
  a_avatar := a::text || '/' || gen_random_uuid()::text || '.webp';

  -- ══ A: w1 удалено вручную (с фото), w2 и w3 — вместе со списком «Второй»
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  execute 'set local role authenticated';

  insert into public.lists (title) values ('Второй') returning id into a_list2;
  insert into public.lists (title) values ('Третий') returning id into a_list3;
  perform public.add_wish(w1, a_list, 'Кофе', 500, null, null, 3::smallint, a::text || '/' || w1::text || '.webp');
  w2 := public.add_wish(null, a_list2, 'Чай');
  w3 := public.add_wish(null, a_list2, 'Сахар');
  select id into i1 from public.list_items where wish_id = w1;
  select id into i2 from public.list_items where wish_id = w2;
  select id into i3 from public.list_items where wish_id = w3;
  perform public.trash_list_item(i1);
  perform public.delete_list(a_list2);

  -- 1. корзина A: три желания, у удалённого списка видно название и что его нет
  select count(*) into n from public.trash_items();
  if n = 3 then ok := ok + 1; else bad := bad || format(' [в корзине A %s, а не 3]', n); end if;
  select list_title, list_alive into r from public.trash_items() where item_id = i2;
  if r.list_title = 'Второй' and r.list_alive = false then ok := ok + 1;
  else bad := bad || format(' [удалённый список в корзине: %s]', row_to_json(r)); end if;
  select list_alive into r from public.trash_items() where item_id = i1;
  if r.list_alive then ok := ok + 1; else bad := bad || ' [живой список помечен удалённым]'; end if;

  -- 2. восстановить в удалённый список нельзя, в живой выбранный — можно
  begin
    perform public.restore_list_item(i2);
    bad := bad || ' [вернул в удалённый список]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  perform public.restore_list_item_to(i2, a_list3);
  select list_id, deleted_at into r from public.list_items where id = i2;
  if r.list_id = a_list3 and r.deleted_at is null then ok := ok + 1;
  else bad := bad || format(' [восстановление в выбранный: %s]', row_to_json(r)); end if;
  begin
    perform public.restore_list_item_to(i2, a_list3);
    bad := bad || ' [восстановил не из корзины]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;

  -- 3. восстановить в чужой список нельзя
  begin
    perform public.restore_list_item_to(i3, b_list);
    bad := bad || ' [A восстановил в список B]';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- 4. профиль: имя обрезается, пустое и длинное — нельзя
  update public.profiles set display_name = '  Анна  ' where id = a;
  select display_name into r from public.profiles where id = a;
  if r.display_name = 'Анна' then ok := ok + 1; else bad := bad || ' [имя не обрезано]'; end if;
  begin
    update public.profiles set display_name = '   ' where id = a;
    bad := bad || ' [пустое имя сохранилось]';
  exception when sqlstate '22023' then ok := ok + 1;
  end;
  begin
    update public.profiles set display_name = repeat('я', 61) where id = a;
    bad := bad || ' [имя длиннее 60 сохранилось]';
  exception when sqlstate '22023' then ok := ok + 1;
  end;

  -- 5. аватар: своя папка — можно, чужая или неверное имя — нельзя
  insert into storage.objects (bucket_id, name) values ('avatars', a_avatar);
  update public.profiles set avatar_path = a_avatar where id = a;
  ok := ok + 1;
  begin
    update public.profiles set avatar_path = b::text || '/' || gen_random_uuid()::text || '.webp' where id = a;
    bad := bad || ' [аватар из папки B]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    update public.profiles set avatar_path = a::text || '/avatar.png' where id = a;
    bad := bad || ' [аватар с неверным именем]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('avatars', b::text || '/' || gen_random_uuid()::text || '.webp');
    bad := bad || ' [A загрузил аватар в папку B]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  select count(*) into n from storage.objects where bucket_id = 'avatars' and name = a_avatar;
  if n = 1 then ok := ok + 1; else bad := bad || ' [A не видит свой аватар]'; end if;

  -- 6. служебные функции недоступны
  begin
    perform public.purge_trash();
    bad := bad || ' [пользователь вызвал purge_trash]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    perform public.storage_orphans();
    bad := bad || ' [пользователь вызвал storage_orphans]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';

  -- ══ B: чужая корзина и чужой аватар
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  execute 'set local role authenticated';

  -- 7. корзину A не видно
  select count(*) into n from public.trash_items();
  if n = 0 then ok := ok + 1; else bad := bad || format(' [B видит %s чужих в корзине]', n); end if;

  -- 8. не восстановить ни на место, ни в свой список
  begin
    perform public.restore_list_item(i1);
    bad := bad || ' [B восстановил желание A]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  begin
    perform public.restore_list_item_to(i3, b_list);
    bad := bad || ' [B забрал желание A из корзины к себе]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;

  -- 9. не очистить чужую корзину
  select array_agg(p) into paths from public.empty_trash(array[i1, i3]) p;
  select count(*) into n from public.list_items where id in (i1, i3);
  if paths is null then ok := ok + 1; else bad := bad || ' [B получил пути фото A]'; end if;
  execute 'reset role';
  select count(*) into n from public.list_items where id in (i1, i3) and deleted_at is not null;
  if n = 2 then ok := ok + 1; else bad := bad || ' [B очистил корзину A]'; end if;
  execute 'set local role authenticated';

  -- 10. чужой аватар не виден, пока нет общего списка
  select count(*) into n from storage.objects where bucket_id = 'avatars' and name = a_avatar;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B видит аватар A без общего списка]'; end if;
  begin
    delete from storage.objects where bucket_id = 'avatars' and name = a_avatar;
    get diagnostics n = row_count;
    if n = 0 then ok := ok + 1; else bad := bad || ' [B удалил аватар A]'; end if;
  exception when others then ok := ok + 1; -- protect_delete тоже не пускает
  end;
  execute 'reset role';

  -- 11. общий список (этап 2) — аватар виден
  insert into public.list_members (list_id, user_id, role) values (a_list, b, 'viewer');
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'avatars' and name = a_avatar;
  if n = 1 then ok := ok + 1; else bad := bad || ' [участник общего списка не видит аватар]'; end if;
  -- зритель видит корзину общего списка, но очистить не может (только редактор)
  select array_agg(p) into paths from public.empty_trash(array[i1]) p;
  execute 'reset role';
  select count(*) into n from public.list_items where id = i1;
  if n = 1 then ok := ok + 1; else bad := bad || ' [зритель очистил корзину]'; end if;

  -- ══ A: «Очистить корзину» — навсегда, вместе с пустым удалённым списком; пути фото возвращаются
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  execute 'set local role authenticated';
  select array_agg(p) into paths from public.empty_trash(array[i1, i3]) p;
  execute 'reset role';
  if paths = array[a::text || '/' || w1::text || '.webp'] then ok := ok + 1;
  else bad := bad || format(' [пути фото: %s]', paths); end if;
  select (select count(*) from public.list_items where id in (i1, i3)) as items,
         (select count(*) from public.wishes where id in (w1, w3)) as wishes,
         (select count(*) from public.lists where id = a_list2) as lists,
         (select count(*) from public.wishes where id = w2) as kept into r;
  if r.items = 0 and r.wishes = 0 and r.lists = 0 and r.kept = 1 then ok := ok + 1;
  else bad := bad || format(' [очистка: %s]', row_to_json(r)); end if;

  -- ══ аноним
  execute 'set local role anon';
  begin
    perform public.trash_items();
    bad := bad || ' [аноним вызвал trash_items]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    perform public.empty_trash(array[i2]);
    bad := bad || ' [аноним вызвал empty_trash]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';

  raise exception 'RLS-ТЕСТ 003-e: пройдено %, ошибок: %', ok, coalesce(nullif(bad, ''), 'нет');
end;
$$;
