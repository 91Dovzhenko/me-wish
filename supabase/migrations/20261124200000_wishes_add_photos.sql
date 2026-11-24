-- ТЗ 003-c · Добавление желания и фото.
-- 1) Атомарное создание желания вместе с появлением в списке — функция add_wish().
-- 2) Фото желаний: закрытый бакет wish-photos, доступ по RLS (читают участники списков, где лежит желание).
-- 3) Защита wishes.image_path: сослаться можно только на файл из своей папки.
-- 4) Фото для коллажа обложки — поле list_overview.cover_photos.

-- ─────────────────────────────────────────────────────────────
-- Формат пути фото: <user_id>/<wish_id>.(webp|jpg)
-- ─────────────────────────────────────────────────────────────

create function public.is_wish_photo_path(p_path text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$';
$$;

create index wishes_image_path_idx on public.wishes (image_path) where image_path is not null;

-- Сослаться на фото можно только из своей папки. Иначе можно было бы вписать в своё желание
-- путь к чужому фото и прочитать его через политику «участник списка видит фото желания».
-- Сервер (service role, этап 4) — без проверки: у него нет auth.uid().
create function public.wishes_check_image_path()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.image_path is not null
     and (tg_op = 'INSERT' or new.image_path is distinct from old.image_path)
     and (select auth.uid()) is not null then
    if not public.is_wish_photo_path(new.image_path)
       or split_part(new.image_path, '/', 1) <> (select auth.uid())::text then
      raise exception 'bad_image_path' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger wishes_check_image_path before insert or update on public.wishes
  for each row execute function public.wishes_check_image_path();

-- ─────────────────────────────────────────────────────────────
-- Добавление желания: желание + появление в списке в одной транзакции.
-- security invoker — действуют обычные политики: желание от своего имени,
-- список — неудалённый, где вызывающий редактор. Ошибка на любом шаге откатывает оба insert.
-- p_wish_id задаёт клиент: под этим id заранее загружается фото (<uid>/<wish_id>.webp).
-- ─────────────────────────────────────────────────────────────

create function public.add_wish(
  p_wish_id uuid,
  p_list_id uuid,
  p_title text,
  p_price integer default null,
  p_source_url text default null,
  p_description text default null,
  p_priority smallint default 3,
  p_image_path text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid := coalesce(p_wish_id, gen_random_uuid());
  v_title text := btrim(coalesce(p_title, ''));
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_url text := nullif(btrim(coalesce(p_source_url, '')), '');
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(v_title) = 0 or char_length(v_title) > 200 then
    raise exception 'bad_title' using errcode = '22023';
  end if;
  if p_price is not null and (p_price < 0 or p_price > 999999999) then
    raise exception 'bad_price' using errcode = '22023';
  end if;
  if p_priority is null or p_priority not between 1 and 5 then
    raise exception 'bad_priority' using errcode = '22023';
  end if;
  if v_desc is not null and char_length(v_desc) > 2000 then
    raise exception 'bad_description' using errcode = '22023';
  end if;
  if v_url is not null and (char_length(v_url) > 2048 or v_url !~* '^https?://') then
    raise exception 'bad_url' using errcode = '22023';
  end if;
  if p_image_path is not null and split_part(p_image_path, '/', 2) <> v_id::text || '.' || split_part(p_image_path, '.', 2) then
    raise exception 'bad_image_path' using errcode = '22023';
  end if;

  insert into public.wishes (id, title, description, image_path, source_url, price, created_by)
  values (v_id, v_title, v_desc, p_image_path, v_url, p_price, v_uid);

  insert into public.list_items (list_id, wish_id, priority, added_by)
  values (p_list_id, v_id, p_priority, v_uid);

  return v_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Хранилище фото желаний
-- ─────────────────────────────────────────────────────────────

-- Закрытый бакет: в него попадает только сжатая копия (~800×800, WEBP или JPEG)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wish-photos', 'wish-photos', false, 2097152, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Фото видно, если вызывающий видит желание, которое на него ссылается (участник его списка)
create function public.can_view_wish_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wishes w
    where w.image_path = p_name and public.can_view_wish(w.id)
  );
$$;

-- Менять или удалять файл в своей папке можно, пока на него не ссылается желание,
-- а после — только редактору этого желания
create function public.can_manage_wish_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(p_name, '/', 1) = (select auth.uid())::text
    and (
      not exists (select 1 from public.wishes w where w.image_path = p_name)
      or exists (
        select 1 from public.wishes w
        where w.image_path = p_name and public.can_edit_wish(w.id)
      )
    );
$$;

create policy "wish-photos: читать своё и фото видимых желаний" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'wish-photos'
    and (
      split_part(name, '/', 1) = (select auth.uid())::text
      or public.can_view_wish_photo(name)
    )
  );

create policy "wish-photos: загружать в свою папку" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'wish-photos'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and public.is_wish_photo_path(name)
  );

-- update нужен для перезаписи (повторная обрезка, «Другое фото» до сохранения)
create policy "wish-photos: перезаписывать своё" on storage.objects
  for update to authenticated
  using (bucket_id = 'wish-photos' and public.can_manage_wish_photo(name))
  with check (
    bucket_id = 'wish-photos'
    and public.is_wish_photo_path(name)
    and public.can_manage_wish_photo(name)
  );

create policy "wish-photos: удалять своё" on storage.objects
  for delete to authenticated
  using (bucket_id = 'wish-photos' and public.can_manage_wish_photo(name));

-- ─────────────────────────────────────────────────────────────
-- Сводка по спискам: + cover_photos — пути фото 4 последних добавленных
-- неудалённых желаний с фото (новые первыми), для коллажа обложки (D-095)
-- ─────────────────────────────────────────────────────────────

create or replace view public.list_overview
with (security_invoker = true)
as
select
  l.id,
  l.title,
  l.description,
  l.event_date,
  l.icon,
  l.color,
  l.cover_mode,
  l.created_by,
  l.created_at,
  l.updated_at,
  count(li.id) filter (where li.deleted_at is null)::integer as item_count,
  coalesce(sum(w.price) filter (
    where li.deleted_at is null and w.status in ('active', 'booked')
  ), 0)::bigint as total_price,
  max(li.added_at) filter (where li.deleted_at is null) as last_added_at,
  count(li.id) filter (
    where li.deleted_at is null and w.status in ('active', 'booked')
  )::integer as active_count,
  count(li.id) filter (
    where li.deleted_at is null and w.status in ('purchased', 'gifted')
  )::integer as done_count,
  coalesce(sum(w.price) filter (
    where li.deleted_at is null and w.status in ('purchased', 'gifted')
  ), 0)::bigint as done_sum,
  array(
    select w2.image_path
    from public.list_items li2
    join public.wishes w2 on w2.id = li2.wish_id
    where li2.list_id = l.id and li2.deleted_at is null and w2.image_path is not null
    order by li2.added_at desc, li2.id
    limit 4
  ) as cover_photos
from public.lists l
left join public.list_items li on li.list_id = l.id
left join public.wishes w on w.id = li.wish_id
where l.deleted_at is null
group by l.id;

revoke all on public.list_overview from anon;

-- ─────────────────────────────────────────────────────────────
-- Права на функции
-- ─────────────────────────────────────────────────────────────

revoke execute on function public.wishes_check_image_path() from public, anon, authenticated;

revoke execute on function
  public.is_wish_photo_path(text),
  public.add_wish(uuid, uuid, text, integer, text, text, smallint, text),
  public.can_view_wish_photo(text),
  public.can_manage_wish_photo(text)
from public, anon;

grant execute on function
  public.is_wish_photo_path(text),
  public.add_wish(uuid, uuid, text, integer, text, text, smallint, text),
  public.can_view_wish_photo(text),
  public.can_manage_wish_photo(text)
to authenticated;
