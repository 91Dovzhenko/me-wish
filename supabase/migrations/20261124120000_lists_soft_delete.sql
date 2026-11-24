-- ТЗ 003-b · Списки: удаление без потери желаний (D-082).
-- Список удаляется мягко (lists.deleted_at), его желания уходят в корзину (list_items.deleted_at).
-- Удалить можно только через функцию delete_list(): она не даёт удалить последний список
-- и переносит «список по умолчанию». Напрямую клиент не может ни удалить строку, ни поставить deleted_at.

alter table public.lists add column deleted_at timestamptz;

create index lists_alive_created_idx on public.lists (created_at) where deleted_at is null;

-- ─────────────────────────────────────────────────────────────
-- Проверка: список существует и не удалён (security definer — не зависит от RLS вызывающего)
-- ─────────────────────────────────────────────────────────────

create function public.is_list_alive(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.lists l where l.id = p_list_id and l.deleted_at is null);
$$;

-- ─────────────────────────────────────────────────────────────
-- Права на lists: удалённый список не виден и не меняется; удалять строки и менять deleted_at нельзя
-- ─────────────────────────────────────────────────────────────

drop policy "lists: читать участникам" on public.lists;
create policy "lists: читать участникам" on public.lists
  for select to authenticated
  using (deleted_at is null and (public.is_list_member(id) or created_by = (select auth.uid())));

drop policy "lists: менять редакторам" on public.lists;
create policy "lists: менять редакторам" on public.lists
  for update to authenticated
  using (deleted_at is null and public.is_list_editor(id))
  with check (deleted_at is null and public.is_list_editor(id));

-- Жёсткого удаления нет: иначе каскад стёр бы появления желаний (list_items)
drop policy "lists: удалять редакторам" on public.lists;
revoke delete on public.lists from authenticated;

-- Менять можно только поля настроек; id, автор, даты и deleted_at — нет
revoke update on public.lists from authenticated;
grant update (title, description, event_date, icon, color, cover_mode) on public.lists to authenticated;

-- ─────────────────────────────────────────────────────────────
-- list_items: в удалённый список нельзя добавить или переместить желание.
-- Чтение не меняется: участие в удалённом списке сохраняется, поэтому корзина (003-e)
-- видит желания удалённого списка и может перенести их в другой список (update list_id + deleted_at = null).
-- ─────────────────────────────────────────────────────────────

drop policy "list_items: добавлять редакторам" on public.list_items;
create policy "list_items: добавлять редакторам" on public.list_items
  for insert to authenticated
  with check (
    public.is_list_editor(list_id)
    and public.is_list_alive(list_id)
    and added_by = (select auth.uid())
    and public.can_link_wish(wish_id)
  );

drop policy "list_items: менять редакторам" on public.list_items;
create policy "list_items: менять редакторам" on public.list_items
  for update to authenticated
  using (public.is_list_editor(list_id))
  with check (public.is_list_editor(list_id) and public.is_list_alive(list_id));

-- ─────────────────────────────────────────────────────────────
-- profiles: списком по умолчанию может быть только свой неудалённый список
-- ─────────────────────────────────────────────────────────────

drop policy "profiles: менять свой" on public.profiles;
create policy "profiles: менять свой" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (
      default_list_id is null
      or (public.is_list_member(default_list_id) and public.is_list_alive(default_list_id))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Удаление списка
-- ─────────────────────────────────────────────────────────────

create function public.delete_list(p_list_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_now timestamptz := now();
  v_alive integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Удаления одного пользователя идут по очереди: два одновременных запроса не удалят оба последних списка
  perform 1 from public.profiles p where p.id = v_uid for update;

  perform 1 from public.lists l where l.id = p_list_id and l.deleted_at is null for update;
  if not found or not public.is_list_editor(p_list_id) then
    raise exception 'list_not_found' using errcode = 'P0002';
  end if;

  -- Последний список удалить нельзя (D-082)
  select count(*) into v_alive
  from public.lists l
  join public.list_members m on m.list_id = l.id and m.user_id = v_uid
  where l.deleted_at is null;
  if v_alive <= 1 then
    raise exception 'last_list' using errcode = 'P0001', hint = 'Нельзя удалить единственный список';
  end if;

  -- Желания списка — в корзину (уже лежавшие в корзине сохраняют свою дату удаления)
  update public.list_items li set deleted_at = v_now
  where li.list_id = p_list_id and li.deleted_at is null;

  update public.lists l set deleted_at = v_now where l.id = p_list_id;

  -- У всех, для кого это был список по умолчанию, — первый из оставшихся по дате создания
  update public.profiles p
  set default_list_id = (
    select l.id
    from public.lists l
    join public.list_members m on m.list_id = l.id and m.user_id = p.id
    where l.deleted_at is null
    order by l.created_at, l.id
    limit 1
  )
  where p.default_list_id = p_list_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Сводка по спискам: удалённые не показываются; для экрана списка — активные и исполненные
-- (исполненные — за всё время, в отличие от главной, где только текущий год)
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
  ), 0)::bigint as done_sum
from public.lists l
left join public.list_items li on li.list_id = l.id
left join public.wishes w on w.id = li.wish_id
where l.deleted_at is null
group by l.id;

revoke all on public.list_overview from anon;

-- Дашборд главной: желания удалённых списков не считаются (они и так в корзине — это страховка)
create or replace function public.dashboard_summary(p_tz text default 'UTC')
returns table (
  active_count integer,
  active_sum bigint,
  done_year integer,
  done_count integer,
  done_sum bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select extract(year from (now() at time zone p_tz))::integer as yr
  ),
  my_wishes as (
    select distinct w.id, w.price, w.status, w.completed_at
    from public.wishes w
    join public.list_items li on li.wish_id = w.id and li.deleted_at is null
    join public.lists l on l.id = li.list_id and l.deleted_at is null
    join public.list_members m on m.list_id = li.list_id and m.user_id = (select auth.uid())
  )
  select
    (count(*) filter (where status in ('active', 'booked')))::integer,
    coalesce(sum(price) filter (where status in ('active', 'booked')), 0)::bigint,
    (select yr from params),
    (count(*) filter (
      where status in ('purchased', 'gifted')
        and extract(year from (completed_at at time zone p_tz))::integer = (select yr from params)
    ))::integer,
    coalesce(sum(price) filter (
      where status in ('purchased', 'gifted')
        and extract(year from (completed_at at time zone p_tz))::integer = (select yr from params)
    ), 0)::bigint
  from my_wishes;
$$;

-- ─────────────────────────────────────────────────────────────
-- Права на функции
-- ─────────────────────────────────────────────────────────────

revoke execute on function public.is_list_alive(uuid), public.delete_list(uuid) from public, anon;
grant execute on function public.is_list_alive(uuid), public.delete_list(uuid) to authenticated;
