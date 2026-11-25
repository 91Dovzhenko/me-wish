-- ТЗ 004-b · Как выглядят совместные списки.
-- 1) list_items.deleted_by — кто удалил желание в корзину (и при удалении списка у всех).
--    Ставит и очищает только триггер по deleted_at; клиент подменить не может.
-- 2) trash_items(): корзина — удалённые желания из списков, где я редактор (в том числе удалённые
--    другими, D-117); имя и аватар удалившего, если это не я; зритель удалённого не видит.

alter table public.list_items
  add column if not exists deleted_by uuid references auth.users (id) on delete set null;

-- Кто удалил: при постановке deleted_at — вызывающий (auth.uid(); в функциях security definer это тоже
-- тот, кто их вызвал), при восстановлении — пусто; без смены deleted_at значение не меняется.
-- Автоочистка и сервер (auth.uid() пустой) прежнее значение не трогают.
create function public.list_items_track_deleted()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.deleted_by := case when new.deleted_at is not null then (select auth.uid()) end;
    return new;
  end if;
  if new.deleted_at is distinct from old.deleted_at then
    if new.deleted_at is null then
      new.deleted_by := null;
    else
      new.deleted_by := coalesce((select auth.uid()), old.deleted_by);
    end if;
  else
    new.deleted_by := old.deleted_by;
  end if;
  return new;
end;
$$;

create trigger list_items_track_deleted before insert or update on public.list_items
  for each row execute function public.list_items_track_deleted();

revoke execute on function public.list_items_track_deleted() from public, anon, authenticated;

-- Корзина (переписана): только списки, где я редактор
drop function if exists public.trash_items();
create function public.trash_items()
returns table (
  item_id uuid,
  wish_id uuid,
  title text,
  image_path text,
  list_id uuid,
  list_title text,
  list_alive boolean,
  -- в списке есть кто-то кроме меня (для «Удалить навсегда… удалятся и у других»)
  list_shared boolean,
  deleted_at timestamptz,
  added_at timestamptz,
  -- кто удалил, если не я (имя и аватар — как в profiles_public)
  deleted_by uuid,
  deleted_by_name text,
  deleted_by_avatar_url text,
  deleted_by_avatar_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    li.id, w.id, w.title, w.image_path, l.id, l.title, l.deleted_at is null,
    exists (select 1 from public.list_members o where o.list_id = l.id and o.user_id <> (select auth.uid())),
    li.deleted_at, li.added_at,
    case when li.deleted_by <> (select auth.uid()) then li.deleted_by end,
    case when li.deleted_by <> (select auth.uid()) then p.display_name end,
    case when li.deleted_by <> (select auth.uid()) then p.avatar_url end,
    case when li.deleted_by <> (select auth.uid()) then p.avatar_path end
  from public.list_items li
  join public.list_members m
    on m.list_id = li.list_id and m.user_id = (select auth.uid()) and m.role = 'editor'
  join public.wishes w on w.id = li.wish_id
  join public.lists l on l.id = li.list_id
  left join public.profiles p on p.id = li.deleted_by
  where li.deleted_at is not null
  order by li.deleted_at desc, li.added_at desc, li.id;
$$;

revoke execute on function public.trash_items() from public, anon;
grant execute on function public.trash_items() to authenticated;
