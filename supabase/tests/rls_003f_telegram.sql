-- Проверка входа через Telegram (ТЗ 003-f) на уровне базы.
-- Запуск: supabase db query --remote --yes -f supabase/tests/rls_003f_telegram.sql
-- Блок завершается исключением со сводкой — транзакция откатывается, в базе ничего не остаётся.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  n integer;
  r record;
  ok integer := 0;
  bad text := '';
begin
  -- A — как создаёт telegram-auth: служебная почта, имя и фото в user_metadata, telegram_id в app_metadata
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'telegram-900000001@me-wish.invalid',
     '{"full_name":"Мария Тестова","avatar_url":"https://t.me/i/userpic/320/x.jpg"}',
     '{"telegram_id":"900000001"}', now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'telegram-900000002@me-wish.invalid',
     '{}', '{}', now(), now());

  -- 1. первый вход: имя, фото, telegram_id, «Мои желания» по умолчанию
  select p.display_name, p.avatar_url, p.telegram_id, l.title into r
  from public.profiles p join public.lists l on l.id = p.default_list_id where p.id = a;
  if r.display_name = 'Мария Тестова' and r.avatar_url like 'https://t.me/%' and r.telegram_id = 900000001
     and r.title = 'Мои желания' then ok := ok + 1;
  else bad := bad || format(' [первый вход: %s]', row_to_json(r)); end if;

  -- 2. имя из служебной почты не берётся
  select display_name into r from public.profiles where id = b;
  if r.display_name = '' then ok := ok + 1; else bad := bad || format(' [имя из почты: %s]', r.display_name); end if;

  -- 3. telegram_id уникален
  begin
    update public.profiles set telegram_id = 900000001 where id = b;
    bad := bad || ' [два профиля с одним telegram_id]';
  exception when unique_violation then ok := ok + 1;
  end;

  -- ══ B от своего имени
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  execute 'set local role authenticated';

  -- 4. свой telegram_id клиент поставить не может (перехват чужого входа)
  begin
    update public.profiles set telegram_id = 900000003 where id = b;
    bad := bad || ' [клиент поставил себе telegram_id]';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- 5. имя, аватар и список по умолчанию менять по-прежнему можно
  update public.profiles set display_name = 'Борис', avatar_url = null where id = b;
  get diagnostics n = row_count;
  if n = 1 then ok := ok + 1; else bad := bad || ' [не меняется имя]'; end if;

  -- 6. чужой профиль (и его telegram_id) не виден
  select count(*) into n from public.profiles where id = a;
  if n = 0 then ok := ok + 1; else bad := bad || ' [B видит профиль A]'; end if;
  execute 'reset role';

  raise exception 'RLS-ТЕСТ 003-f: пройдено %, ошибок: %', ok, coalesce(nullif(bad, ''), 'нет');
end;
$$;
