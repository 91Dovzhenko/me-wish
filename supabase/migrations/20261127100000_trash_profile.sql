-- ТЗ 003-e · Корзина, профиль, автоочистка.
-- 1) Экран корзины: trash_items(), восстановление в выбранный список, «Очистить корзину».
-- 2) Автоочистка через 30 дней: purge_trash() по расписанию pg_cron.
-- 3) Уборка файлов Storage (фото без желаний, аватары без профиля): Edge Function storage-cleanup
--    по расписанию; список файлов отдаёт storage_orphans() (только service role).
-- 4) Аватары: закрытый бакет avatars, проверка имени и аватара в профиле.

-- ─────────────────────────────────────────────────────────────
-- Корзина
-- ─────────────────────────────────────────────────────────────

-- Удалённые желания пользователя: по участию в списке (в том числе в удалённом — участие сохраняется).
-- security definer — потому что название удалённого списка политика lists не отдаёт.
create function public.trash_items()
returns table (
  item_id uuid,
  wish_id uuid,
  title text,
  image_path text,
  list_id uuid,
  list_title text,
  list_alive boolean,
  deleted_at timestamptz,
  added_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select li.id, w.id, w.title, w.image_path, l.id, l.title, l.deleted_at is null, li.deleted_at, li.added_at
  from public.list_items li
  join public.list_members m on m.list_id = li.list_id and m.user_id = (select auth.uid())
  join public.wishes w on w.id = li.wish_id
  join public.lists l on l.id = li.list_id
  where li.deleted_at is not null
  order by li.deleted_at desc, li.added_at desc, li.id;
$$;

-- Восстановить в другой список (список желания удалён, D-082). security invoker: политика list_items
-- пускает, только если пользователь — редактор старого и нового списка, а новый не удалён.
create function public.restore_list_item_to(p_item_id uuid, p_list_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.list_items set list_id = p_list_id, deleted_at = null
  where id = p_item_id and deleted_at is not null;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- «Очистить корзину»: удалить навсегда показанные пользователю желания из корзины.
-- Удаляются появления в списках, где пользователь — редактор; затем желания, у которых не осталось
-- появлений, и удалённые списки без появлений. Возвращает пути фото удалённых желаний —
-- приложение сразу удаляет файлы (то, что не удалилось, подберёт ночная уборка).
create function public.empty_trash(p_item_ids uuid[])
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_wishes uuid[];
  v_lists uuid[];
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  with gone as (
    delete from public.list_items li
    using public.list_members m
    where li.id = any(p_item_ids)
      and li.deleted_at is not null
      and m.list_id = li.list_id and m.user_id = v_uid and m.role = 'editor'
    returning li.wish_id, li.list_id
  )
  select array_agg(distinct wish_id), array_agg(distinct list_id) into v_wishes, v_lists from gone;

  delete from public.lists l
  where l.id = any(v_lists) and l.deleted_at is not null
    and not exists (select 1 from public.list_items li where li.list_id = l.id);

  return query
    with d as (
      delete from public.wishes w
      where w.id = any(v_wishes)
        and not exists (select 1 from public.list_items li where li.wish_id = w.id)
      returning w.image_path
    )
    select d.image_path from d where d.image_path is not null;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Автоочистка (SPEC 5.7): раз в сутки
-- ─────────────────────────────────────────────────────────────

-- Появления старше p_days дней в корзине → желания без появлений → удалённые списки без появлений.
-- Файлы фото удаляет Edge Function storage-cleanup (из SQL Storage удалять нельзя — триггер protect_delete).
create function public.purge_trash(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_items integer;
  v_wishes integer;
  v_lists integer;
begin
  delete from public.list_items
  where deleted_at is not null and deleted_at < now() - make_interval(days => p_days);
  get diagnostics v_items = row_count;

  -- желание без единого появления (желание и появление создаются одной транзакцией — add_wish)
  delete from public.wishes w
  where not exists (select 1 from public.list_items li where li.wish_id = w.id);
  get diagnostics v_wishes = row_count;

  delete from public.lists l
  where l.deleted_at is not null
    and not exists (select 1 from public.list_items li where li.list_id = l.id);
  get diagnostics v_lists = row_count;

  return jsonb_build_object('items', v_items, 'wishes', v_wishes, 'lists', v_lists);
end;
$$;

-- Файлы, на которые ничего не ссылается и которые не менялись больше суток
-- (сутки — чтобы не задеть фото, загруженное в открытую форму).
create function public.storage_orphans(p_min_age interval default interval '1 day')
returns table (bucket_id text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.bucket_id, o.name
  from storage.objects o
  where coalesce(o.updated_at, o.created_at) < now() - p_min_age
    and (
      (o.bucket_id = 'wish-photos'
        and not exists (select 1 from public.wishes w where w.image_path = o.name))
      or (o.bucket_id = 'avatars'
        and not exists (select 1 from public.profiles p where p.avatar_path = o.name))
    )
  order by o.created_at
  limit 1000;
$$;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- 03:00 UTC — корзина; 03:15 UTC — файлы (адрес проекта и секрет — в Vault, см. docs/tech/trash-profile.md)
select cron.schedule('me-wish-purge-trash', '0 3 * * *', $$select public.purge_trash()$$);
select cron.schedule(
  'me-wish-storage-cleanup',
  '15 3 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'me_wish_project_url')
      || '/functions/v1/storage-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cleanup-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'me_wish_cleanup_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- ─────────────────────────────────────────────────────────────
-- Профиль: имя и свой аватар (D-091)
-- ─────────────────────────────────────────────────────────────

-- Путь аватара: <user_id>/<uuid>.(webp|jpg)
create function public.is_avatar_path(p_path text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$';
$$;

-- Имя: не пустое, до 60 символов (проверяется только при смене — у старых профилей могло быть пустым).
-- Аватар: только файл из своей папки — иначе можно было бы сослаться на чужой и читать его.
create function public.profiles_check_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.display_name is distinct from old.display_name then
    new.display_name := btrim(coalesce(new.display_name, ''));
    if char_length(new.display_name) = 0 or char_length(new.display_name) > 60 then
      raise exception 'invalid_name' using errcode = '22023';
    end if;
  end if;
  if new.avatar_path is distinct from old.avatar_path and new.avatar_path is not null
     and (select auth.uid()) is not null then
    if not public.is_avatar_path(new.avatar_path)
       or split_part(new.avatar_path, '/', 1) <> (select auth.uid())::text then
      raise exception 'avatar_path_forbidden' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_check_fields before update on public.profiles
  for each row execute function public.profiles_check_fields();

-- Закрытый бакет аватаров: сжатая копия ~400×400
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Аватар видят сам пользователь и участники общих с ним списков (этап 2) — только текущий аватар профиля
create function public.can_view_avatar(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(p_name, '/', 1) = (select auth.uid())::text
    or exists (
      select 1 from public.profiles p
      where p.avatar_path = p_name and public.shares_list_with(p.id)
    );
$$;

create policy "avatars: читать своё и участникам общих списков" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and public.can_view_avatar(name));

create policy "avatars: загружать в свою папку" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and public.is_avatar_path(name)
  );

create policy "avatars: перезаписывать своё" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text)
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and public.is_avatar_path(name)
  );

create policy "avatars: удалять своё" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

-- ─────────────────────────────────────────────────────────────
-- Права на функции
-- ─────────────────────────────────────────────────────────────

revoke execute on function
  public.trash_items(),
  public.restore_list_item_to(uuid, uuid),
  public.empty_trash(uuid[]),
  public.purge_trash(integer),
  public.storage_orphans(interval),
  public.profiles_check_fields(),
  public.is_avatar_path(text),
  public.can_view_avatar(text)
from public, anon;

grant execute on function
  public.trash_items(),
  public.restore_list_item_to(uuid, uuid),
  public.empty_trash(uuid[]),
  public.is_avatar_path(text),
  public.can_view_avatar(text)
to authenticated;

-- автоочистка и список файлов — только сервер
revoke execute on function public.purge_trash(integer), public.storage_orphans(interval) from authenticated;
grant execute on function public.storage_orphans(interval) to service_role;
revoke execute on function public.profiles_check_fields() from authenticated;
