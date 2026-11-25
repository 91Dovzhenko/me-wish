-- Участники и приглашения (ТЗ 004-a): владелец O, редактор E, зритель V, посторонний S (+ E2 для крайних случаев).
-- Запуск: supabase db query --remote --yes -f supabase/tests/rls_004a_members.sql
-- Блок завершается исключением со сводкой — транзакция откатывается, в базе ничего не остаётся.

create function pg_temp.as_user(p uuid) returns void language plpgsql as $f$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p::text, true);
  execute 'set local role authenticated';
end;
$f$;

create function pg_temp.as_admin() returns void language plpgsql as $f$
begin
  execute 'reset role';
end;
$f$;

do $$
declare
  o uuid := gen_random_uuid();
  e uuid := gen_random_uuid();
  v uuid := gen_random_uuid();
  s uuid := gen_random_uuid();
  e2 uuid := gen_random_uuid();
  l uuid;
  o_own uuid;
  e_own uuid;
  v_own uuid;
  s_own uuid;
  e2_own uuid;
  w uuid;
  it uuid;
  te text;
  tv text;
  tv_id uuid;
  tx text;
  tx_id uuid;
  n integer;
  r record;
  res text;
  ok integer := 0;
  bad text := '';
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  select x.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', x.email,
         json_build_object('full_name', x.name)::jsonb, now(), now()
  from (values (o, 'rls4a-o@example.test', 'Виталий'), (e, 'rls4a-e@example.test', 'Олеся'),
               (v, 'rls4a-v@example.test', 'Аня'), (s, 'rls4a-s@example.test', 'Посторонний'),
               (e2, 'rls4a-e2@example.test', 'Второй')) as x(id, email, name);
  select default_list_id into o_own from public.profiles where id = o;
  select default_list_id into e_own from public.profiles where id = e;
  select default_list_id into v_own from public.profiles where id = v;
  select default_list_id into s_own from public.profiles where id = s;
  select default_list_id into e2_own from public.profiles where id = e2;

  -- ══ O: список «Для дома», желание, две ссылки
  perform pg_temp.as_user(o);
  insert into public.lists (title) values ('Для дома') returning id into l;
  w := public.add_wish(null, l, 'Пылесос', 20000);
  select id into it from public.list_items where wish_id = w;
  select token into te from public.create_invite(l, 'editor');
  select invite_id, token into tv_id, tv from public.create_invite(l, 'viewer');

  -- 1. в базе только хэш токена
  perform pg_temp.as_admin();
  select count(*) into n from public.invites
  where list_id = l and token_hash in (public.invite_token_hash(te), public.invite_token_hash(tv))
    and token_hash <> te and token_hash <> tv and length(te) = 64;
  if n = 2 then ok := ok + 1; else bad := bad || ' [токены не хэшированы]'; end if;

  -- ══ S до принятия: ничего не видит и не может
  perform pg_temp.as_user(s);
  -- 2. ни списка, ни желаний, ни участников, ни ссылок
  select (select count(*) from public.lists where id = l) + (select count(*) from public.list_items where list_id = l)
       + (select count(*) from public.list_members where list_id = l) + (select count(*) from public.invites where list_id = l)
  into n;
  if n = 0 then ok := ok + 1; else bad := bad || format(' [посторонний видит %s строк]', n); end if;
  -- 3. не создаёт ссылку
  begin
    perform public.create_invite(l, 'editor');
    bad := bad || ' [посторонний создал ссылку]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  -- 4. карточку приглашения напрямую не получить — только через Edge Function
  begin
    perform public.invite_preview(te);
    bad := bad || ' [пользователь вызвал invite_preview]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  -- 5. напрямую в участники себя не добавить
  begin
    insert into public.list_members (list_id, user_id, role) values (l, s, 'editor');
    bad := bad || ' [посторонний добавил себя в участники]';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- ══ E и V принимают
  perform pg_temp.as_user(e);
  if public.accept_invite(te) = l then ok := ok + 1; else bad := bad || ' [accept не вернул список]'; end if;
  perform pg_temp.as_user(v);
  perform public.accept_invite(tv);
  perform pg_temp.as_admin();
  -- 6. роли
  select (select role from public.list_members where list_id = l and user_id = e) as er,
         (select role from public.list_members where list_id = l and user_id = v) as vr into r;
  if r.er = 'editor' and r.vr = 'viewer' then ok := ok + 1; else bad := bad || format(' [роли: %s]', row_to_json(r)); end if;

  -- 7. повторное принятие роль не понижает (редактор по ссылке зрителя остаётся редактором)
  perform pg_temp.as_user(e);
  perform public.accept_invite(tv);
  perform pg_temp.as_admin();
  if (select role from public.list_members where list_id = l and user_id = e) = 'editor' then ok := ok + 1;
  else bad := bad || ' [роль понизилась при повторном принятии]'; end if;

  -- ══ V — зритель: видит, но ничего не меняет
  perform pg_temp.as_user(v);
  -- 8. видит список, желание и состав
  select (select count(*) from public.lists where id = l) as lc, (select count(*) from public.list_items where list_id = l) as ic,
         (select count(*) from public.list_members where list_id = l) as mc into r;
  if r.lc = 1 and r.ic = 1 and r.mc = 3 then ok := ok + 1; else bad := bad || format(' [зритель видит: %s]', row_to_json(r)); end if;
  -- 9. список не меняет
  update public.lists set title = 'Взлом' where id = l;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else bad := bad || ' [зритель переименовал список]'; end if;
  -- 10. желание не добавляет
  begin
    perform public.add_wish(null, l, 'Чужое', 1);
    bad := bad || ' [зритель добавил желание]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  -- 11. приоритет, статус — 0 строк; в корзину — не найдено
  update public.list_items set priority = 1 where id = it;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else bad := bad || ' [зритель сменил приоритет]'; end if;
  update public.wishes set status = 'gifted' where id = w;
  get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else bad := bad || ' [зритель сменил статус]'; end if;
  begin
    perform public.trash_list_item(it);
    bad := bad || ' [зритель удалил желание]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  begin
    perform public.update_wish(it, l, 'Взлом', 1, null, null, 3::smallint, null);
    bad := bad || ' [зритель отредактировал желание]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  -- 12. участников не меняет, ссылок не создаёт и не видит, список не удаляет
  begin
    perform public.create_invite(l, 'viewer');
    bad := bad || ' [зритель создал ссылку]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  begin
    perform public.set_member_role(l, e, 'viewer');
    bad := bad || ' [зритель сменил роль]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  begin
    perform public.remove_member(l, e);
    bad := bad || ' [зритель убрал участника]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  begin
    update public.list_members set role = 'editor' where list_id = l and user_id = v;
    get diagnostics n = row_count;
    if n = 0 then ok := ok + 1; else bad := bad || ' [зритель сделал себя редактором]'; end if;
  exception when insufficient_privilege then ok := ok + 1;
  end;
  select count(*) into n from public.invites where list_id = l;
  if n = 0 then ok := ok + 1; else bad := bad || ' [зритель видит ссылки]'; end if;
  begin
    perform public.delete_list(l);
    bad := bad || ' [зритель удалил список]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  -- 13. зритель не может сделать совместный список своим «по умолчанию»
  begin
    update public.profiles set default_list_id = l where id = v;
    bad := bad || ' [зритель поставил чужой список по умолчанию]';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- ══ E — редактор: видит ссылки, отзывает, меняет роли, не себя
  perform pg_temp.as_user(e);
  select count(*) into n from public.invites where list_id = l;
  if n = 2 then ok := ok + 1; else bad := bad || format(' [редактор видит %s ссылок]', n); end if;
  perform public.revoke_invite(tv_id);
  perform pg_temp.as_user(s);
  -- 14. по отозванной ссылке нельзя вступить
  begin
    perform public.accept_invite(tv);
    bad := bad || ' [вступил по отозванной ссылке]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  -- 15. по устаревшей — тоже
  perform pg_temp.as_user(e);
  select invite_id, token into tx_id, tx from public.create_invite(l, 'viewer');
  perform pg_temp.as_admin();
  update public.invites set expires_at = now() - interval '1 minute' where id = tx_id;
  perform pg_temp.as_user(s);
  begin
    perform public.accept_invite(tx);
    bad := bad || ' [вступил по устаревшей ссылке]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  -- 16. и по выдуманной
  begin
    perform public.accept_invite(repeat('a', 64));
    bad := bad || ' [вступил по выдуманному токену]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;
  -- 17. многоразовая: по принятой ссылке может вступить ещё кто-то
  perform public.accept_invite(te);
  perform pg_temp.as_admin();
  if exists (select 1 from public.list_members where list_id = l and user_id = s and role = 'editor') then ok := ok + 1;
  else bad := bad || ' [многоразовая ссылка не сработала второй раз]'; end if;

  perform pg_temp.as_user(e);
  -- 18. редактор меняет роль другому, но не себе
  perform public.set_member_role(l, v, 'editor');
  perform public.set_member_role(l, v, 'viewer');
  begin
    perform public.set_member_role(l, e, 'viewer');
    bad := bad || ' [редактор понизил себя]';
  exception when sqlstate '22023' then ok := ok + 1;
  end;
  begin
    perform public.remove_member(l, e);
    bad := bad || ' [редактор убрал себя]';
  exception when sqlstate '22023' then ok := ok + 1;
  end;

  -- 19. убранный теряет доступ сразу
  perform public.remove_member(l, s);
  perform pg_temp.as_user(s);
  select (select count(*) from public.lists where id = l) + (select count(*) from public.list_items where list_id = l) into n;
  if n = 0 then ok := ok + 1; else bad := bad || ' [убранный видит список]'; end if;

  -- 20. «Выйти»: E делает список своим по умолчанию, выходит — по умолчанию снова свой
  perform pg_temp.as_user(e);
  update public.profiles set default_list_id = l where id = e;
  res := public.leave_list(l);
  perform pg_temp.as_admin();
  select (select count(*) from public.list_members where list_id = l and user_id = e) as m,
         (select default_list_id from public.profiles where id = e) as d into r;
  if res = 'left' and r.m = 0 and r.d = e_own then ok := ok + 1; else bad := bad || format(' [выход: %s %s]', res, row_to_json(r)); end if;

  -- 21. свой единственный список оставить или удалить нельзя
  perform pg_temp.as_user(s);
  begin
    perform public.leave_list(s_own);
    bad := bad || ' [вышел из единственного списка]';
  exception when sqlstate 'P0001' then ok := ok + 1;
  end;
  begin
    perform public.delete_list(s_own);
    bad := bad || ' [удалил единственный список]';
  exception when sqlstate 'P0001' then ok := ok + 1;
  end;

  -- 22. убрали того, у кого это был единственный список-редактор, — у него появляется свой «Мои желания»
  perform pg_temp.as_user(o);
  select token into tx from public.create_invite(l, 'editor');
  perform pg_temp.as_user(e2);
  perform public.accept_invite(tx);
  update public.profiles set default_list_id = l where id = e2;
  perform public.delete_list(e2_own);
  perform pg_temp.as_user(o);
  perform public.remove_member(l, e2);
  perform pg_temp.as_admin();
  select count(*) as cnt, (select default_list_id from public.profiles where id = e2) as d,
         (select title from public.lists where id = (select default_list_id from public.profiles where id = e2)) as t into r
  from public.lists ll join public.list_members m on m.list_id = ll.id and m.user_id = e2 and m.role = 'editor'
  where ll.deleted_at is null;
  if r.cnt = 1 and r.t = 'Мои желания' and r.d <> l then ok := ok + 1; else bad := bad || format(' [свой список после удаления из совместного: %s]', row_to_json(r)); end if;

  -- 23. «Выйти» последним редактором — список удаляется у всех, зритель теряет доступ, ссылки гаснут
  perform pg_temp.as_user(v);
  update public.profiles set default_list_id = v_own where id = v;
  perform pg_temp.as_user(o);
  res := public.leave_list(l);
  perform pg_temp.as_admin();
  select (select deleted_at from public.lists where id = l) as del,
         (select count(*) from public.list_items where list_id = l and deleted_at is null) as alive_items,
         (select count(*) from public.invites where list_id = l and revoked_at is null) as live_links into r;
  if res = 'deleted' and r.del is not null and r.alive_items = 0 and r.live_links = 0 then ok := ok + 1;
  else bad := bad || format(' [последний редактор: %s %s]', res, row_to_json(r)); end if;
  perform pg_temp.as_user(v);
  select count(*) into n from public.lists where id = l;
  if n = 0 then ok := ok + 1; else bad := bad || ' [зритель видит удалённый список]'; end if;
  -- 24. по ссылке удалённого списка не вступить
  perform pg_temp.as_user(s);
  begin
    perform public.accept_invite(te);
    bad := bad || ' [вступил в удалённый список]';
  exception when sqlstate 'P0002' then ok := ok + 1;
  end;

  -- 25. «Удалить у всех» редактором: новый совместный список O + E, удаляет E
  perform pg_temp.as_user(o);
  insert into public.lists (title) values ('Отпуск') returning id into l;
  select token into tx from public.create_invite(l, 'editor');
  perform pg_temp.as_user(e);
  perform public.accept_invite(tx);
  perform public.delete_list(l);
  perform pg_temp.as_user(o);
  select count(*) into n from public.lists where id = l;
  if n = 0 then ok := ok + 1; else bad := bad || ' [список не удалился у всех]'; end if;

  perform pg_temp.as_admin();
  raise exception 'RLS-ТЕСТ 004-a: пройдено %, ошибок: %', ok, coalesce(nullif(bad, ''), 'нет');
end;
$$;
