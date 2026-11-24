-- Проверка добавления желаний и фото (ТЗ 003-c) на двух пользователях, включая Storage.
-- Запуск: supabase db query --remote --yes -f supabase/tests/rls_003c_wishes.sql
-- Блок завершается исключением со сводкой — транзакция откатывается, в базе ничего не остаётся.
-- Файлы в Storage здесь — только строки storage.objects (так же их создаёт и проверяет Storage API
-- от имени пользователя); удаление разрешаем так же, как Storage API (storage.allow_delete_query).
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  a_list uuid;
  a_list2 uuid;
  b_list uuid;
  w1 uuid := gen_random_uuid();
  w_bad uuid := gen_random_uuid();
  b_wish uuid;
  p1 text;
  photos text[];
  n integer;
  v uuid;
  ok integer := 0;
  bad text := '';
  r record;
  i integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls3c-a@example.test',
     '{"full_name":"Анна Тестова"}', now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls3c-b@example.test',
     '{"name":"Борис"}', now(), now());
  select default_list_id into a_list from public.profiles where id = a;
  select default_list_id into b_list from public.profiles where id = b;
  p1 := a::text || '/' || w1::text || '.webp';
  perform set_config('storage.allow_delete_query', 'true', true);

  -- ══ A
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  execute 'set local role authenticated';

  insert into public.lists (title) values ('Второй') returning id into a_list2;

  -- 1. фото загружается в свою папку
  insert into storage.objects (bucket_id, name, owner_id) values ('wish-photos', p1, a::text);
  ok := ok + 1;

  -- 2. желание с фото, ценой, ссылкой и приоритетом — одной функцией
  v := public.add_wish(w1, a_list, '  Штатив  ', 11990, 'https://market.yandex.ru/card/x/1', 'с видеоголовой', 5::smallint, p1);
  select li.priority, w.title, w.price, w.image_path into r
  from public.list_items li join public.wishes w on w.id = li.wish_id where li.wish_id = w1;
  if v = w1 and r.priority = 5 and r.title = 'Штатив' and r.price = 11990 and r.image_path = p1 then ok := ok + 1;
  else bad := bad || format(' [add_wish: %s]', row_to_json(r)); end if;

  -- 3. только название — приоритет 3 по умолчанию
  v := public.add_wish(null, a_list2, 'Массаж');
  select priority into n from public.list_items where wish_id = v;
  if n = 3 then ok := ok + 1; else bad := bad || ' [приоритет по умолчанию]'; end if;

  -- 4. пустое название — ошибка
  begin
    perform public.add_wish(null, a_list, '   ');
    bad := bad || ' [добавлено без названия]';
  exception when sqlstate '22023' then ok := ok + 1;
  end;

  -- 5. в чужой список нельзя, и желание не остаётся (атомарность) — проверяется ниже от имени postgres
  begin
    perform public.add_wish(w_bad, b_list, 'В чужой список');
    bad := bad || ' [A добавил в список B]';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- 6. ссылка на фото из чужой папки — нельзя
  begin
    perform public.add_wish(null, a_list, 'Чужое фото', null, null, null, 3::smallint,
      b::text || '/' || gen_random_uuid()::text || '.webp');
    bad := bad || ' [A сослался на фото в папке B]';
  exception when sqlstate '22023' or insufficient_privilege then ok := ok + 1;
  end;

  -- 7. фото в папку B и файл с неправильным именем не загрузить
  begin
    insert into storage.objects (bucket_id, name, owner_id)
    values ('wish-photos', b::text || '/' || gen_random_uuid()::text || '.webp', a::text);
    bad := bad || ' [A загрузил в папку B]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('wish-photos', a::text || '/x.png', a::text);
    bad := bad || ' [A загрузил файл с неправильным именем]';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- 8. сменить image_path напрямую на чужую папку нельзя
  begin
    update public.wishes set image_path = b::text || '/' || gen_random_uuid()::text || '.webp' where id = w1;
    bad := bad || ' [A сменил image_path на папку B]';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- 9. коллаж: не больше 4 фото; корзина не попадает (порядок «новые первыми» внутри одной
  --    транзакции не проверить: added_at у всех одинаковый — now())
  for i in 1..5 loop
    v := gen_random_uuid();
    insert into storage.objects (bucket_id, name, owner_id) values ('wish-photos', a::text || '/' || v::text || '.jpg', a::text);
    perform public.add_wish(v, a_list2, 'Фото ' || i, null, null, null, 3::smallint, a::text || '/' || v::text || '.jpg');
  end loop;
  select cover_photos into photos from public.list_overview where id = a_list2;
  if cardinality(photos) = 4 then ok := ok + 1;
  else bad := bad || format(' [коллаж: %s]', photos); end if;
  p1 := photos[1];
  update public.list_items set deleted_at = now()
  where wish_id = (select id from public.wishes where image_path = p1);
  select cover_photos into photos from public.list_overview where id = a_list2;
  if cardinality(photos) = 4 and not (p1 = any (photos)) then ok := ok + 1;
  else bad := bad || ' [корзина в коллаже]'; end if;
  p1 := a::text || '/' || w1::text || '.webp';

  -- 10. счётчики и сумма считаются по данным; пустая цена не считается
  select item_count, total_price into r from public.list_overview where id = a_list;
  if r.item_count = 1 and r.total_price = 11990 then ok := ok + 1;
  else bad := bad || format(' [сводка: %s]', row_to_json(r)); end if;

  -- 11. своё фото без ссылки из желания можно перезаписать и удалить; на которое ссылается желание — тоже (редактор)
  v := gen_random_uuid();
  insert into storage.objects (bucket_id, name, owner_id) values ('wish-photos', a::text || '/' || v::text || '.webp', a::text);
  update storage.objects set metadata = '{"size": 1}' where bucket_id = 'wish-photos' and name = a::text || '/' || v::text || '.webp';
  get diagnostics n = row_count;
  if n = 1 then ok := ok + 1; else bad := bad || ' [A не перезаписал своё фото]'; end if;
  delete from storage.objects where bucket_id = 'wish-photos' and name = a::text || '/' || v::text || '.webp';
  get diagnostics n = row_count;
  if n = 1 then ok := ok + 1; else bad := bad || ' [A не удалил своё фото]'; end if;

  execute 'reset role';

  -- атомарность: желание, не попавшее в список, не осталось
  select count(*) into n from public.wishes where id = w_bad;
  if n = 0 then ok := ok + 1; else bad := bad || ' [осталось желание без списка]'; end if;

  -- ══ B
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  execute 'set local role authenticated';

  -- 12. не видит ни желаний, ни появлений, ни фото A
  select count(*) into n from public.wishes;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B видит желания A]'; end if;
  select count(*) into n from public.list_items where list_id in (a_list, a_list2);
  if n = 0 then ok := ok + 1; else bad := bad || ' [B видит появления A]'; end if;
  select count(*) into n from storage.objects where bucket_id = 'wish-photos';
  if n = 0 then ok := ok + 1; else bad := bad || ' [B видит фото A]'; end if;

  -- 13. не может перезаписать и удалить фото A
  update storage.objects set metadata = '{}' where bucket_id = 'wish-photos' and name = p1;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B перезаписал фото A]'; end if;
  delete from storage.objects where bucket_id = 'wish-photos' and name = p1;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B удалил фото A]'; end if;

  -- 14. не может положить файл по пути A (подмена)
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('wish-photos', p1, b::text);
    bad := bad || ' [B записал файл по пути A]';
  exception when insufficient_privilege or unique_violation then ok := ok + 1;
  end;

  -- 15. не может добавить желание в список A
  begin
    perform public.add_wish(null, a_list, 'Подкинуть');
    bad := bad || ' [B добавил желание в список A]';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- 16. не может сослаться на фото A ни при создании, ни правкой своего желания — и прочитать его так
  begin
    perform public.add_wish(null, b_list, 'Чужое фото', null, null, null, 3::smallint, p1);
    bad := bad || ' [B создал желание с фото A]';
  exception when sqlstate '22023' or insufficient_privilege then ok := ok + 1;
  end;
  b_wish := public.add_wish(null, b_list, 'Своё');
  begin
    update public.wishes set image_path = p1 where id = b_wish;
    bad := bad || ' [B подставил фото A в своё желание]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  select count(*) into n from storage.objects where bucket_id = 'wish-photos' and name = p1;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B читает фото A]'; end if;

  -- 17. не может поменять желание A
  update public.wishes set title = 'взлом', price = 1 where id = w1;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B изменил желание A]'; end if;

  execute 'reset role';

  -- ══ аноним: ни таблиц, ни фото
  execute 'set local role anon';
  select count(*) into n from storage.objects where bucket_id = 'wish-photos';
  if n = 0 then ok := ok + 1; else bad := bad || ' [аноним видит фото]'; end if;
  begin
    perform public.add_wish(null, a_list, 'Аноним');
    bad := bad || ' [аноним вызвал add_wish]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';

  raise exception 'RLS-ТЕСТ 003-c: пройдено %, ошибок: %', ok, coalesce(nullif(bad, ''), 'нет');
end;
$$;
