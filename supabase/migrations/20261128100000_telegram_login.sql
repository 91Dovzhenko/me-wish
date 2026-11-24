-- ТЗ 003-f · Вход через Telegram.
-- 1) profiles.telegram_id — уникальный, ставит только сервер (триггер первого входа из app_metadata).
-- 2) Клиент может менять в профиле только имя, аватар и список по умолчанию (column grants) —
--    иначе можно было бы вписать себе чужой telegram_id и перехватить его будущий вход.
-- 3) Триггер первого входа: имя и фото Telegram приходят в user_metadata. telegram_id из raw_app_meta_data
--    берётся, если он есть при вставке; на деле Supabase добавляет app_metadata позже, поэтому
--    Edge Function telegram-auth сама записывает profiles.telegram_id после создания пользователя.
--    У служебной почты аккаунтов Telegram (@me-wish.invalid) имя из почты не берётся.

alter table public.profiles add column if not exists telegram_id bigint;
create unique index if not exists profiles_telegram_id_key on public.profiles (telegram_id)
  where telegram_id is not null;

revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, avatar_path, default_list_id) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  app jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  v_name text;
  v_list_id uuid;
  v_tg bigint;
begin
  -- Telegram: id из app_metadata (только сервер), имя «Имя Фамилия» и фото — в user_metadata
  if (app ->> 'telegram_id') ~ '^[0-9]{1,20}$' then
    v_tg := (app ->> 'telegram_id')::bigint;
  end if;

  v_name := nullif(btrim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), '');
  -- у аккаунтов Telegram почта служебная — из неё имя не берём
  if v_name is null and v_tg is null and coalesce(new.email, '') not like '%@me-wish.invalid' then
    v_name := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;

  insert into public.profiles (id, display_name, avatar_url, telegram_id)
  values (
    new.id,
    coalesce(v_name, ''),
    nullif(coalesce(meta ->> 'avatar_url', meta ->> 'picture'), ''),
    v_tg
  );

  insert into public.lists (title, icon, color, created_by)
  values ('Мои желания', 'heart', 'lavender', new.id)
  returning id into v_list_id;
  -- участие редактором добавляет триггер lists_add_creator

  update public.profiles set default_list_id = v_list_id where id = new.id;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
