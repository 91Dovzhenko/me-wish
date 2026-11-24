-- Проверка запросов на вход через бота (ТЗ 003-f2): клиентам таблица недоступна, уборка работает.
-- Запуск: supabase db query --remote --yes -f supabase/tests/rls_003f2_bot_login.sql
-- Блок завершается исключением со сводкой — транзакция откатывается.
do $$
declare
  u uuid := gen_random_uuid();
  n integer;
  ok integer := 0;
  bad text := '';
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls3f2@example.test', '{}', now(), now());
  insert into public.telegram_login_requests (code, secret_hash, created_at)
  values ('OldCode12345', repeat('a', 64), now() - interval '2 days'),
         ('NewCode12345', repeat('b', 64), now());

  -- 1–4. вошедший пользователь: ни прочитать, ни создать, ни подтвердить, ни удалить
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    select count(*) into n from public.telegram_login_requests;
    bad := bad || ' [пользователь читает запросы]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into public.telegram_login_requests (code, secret_hash) values ('Hack12345678', repeat('c', 64));
    bad := bad || ' [пользователь создал запрос]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    update public.telegram_login_requests set status = 'confirmed', telegram_id = 1 where code = 'NewCode12345';
    bad := bad || ' [пользователь подтвердил запрос]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    perform public.purge_login_requests();
    bad := bad || ' [пользователь вызвал уборку]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';

  -- 5. аноним — тоже нет
  execute 'set local role anon';
  begin
    select count(*) into n from public.telegram_login_requests;
    bad := bad || ' [аноним читает запросы]';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  execute 'reset role';

  -- 6. уборка: старше суток — удалён, свежий — на месте
  perform public.purge_login_requests();
  select count(*) into n from public.telegram_login_requests where code in ('OldCode12345', 'NewCode12345');
  if n = 1 and exists (select 1 from public.telegram_login_requests where code = 'NewCode12345') then ok := ok + 1;
  else bad := bad || ' [уборка]'; end if;

  -- 7. уборка есть в расписании
  if exists (select 1 from cron.job where jobname = 'me-wish-purge-login-requests' and active) then ok := ok + 1;
  else bad := bad || ' [нет задания уборки]'; end if;

  raise exception 'RLS-ТЕСТ 003-f2: пройдено %, ошибок: %', ok, coalesce(nullif(bad, ''), 'нет');
end;
$$;
