-- ТЗ 004-a · Участники и приглашения (D-113, D-116, D-117).
-- 1) Приглашения: таблица invites (в базе только sha256 токена), создать / посмотреть / принять / отозвать.
-- 2) Управление участниками: сменить роль, убрать, выйти; «Удалить» совместного списка — у всех.
-- 3) Правило «у пользователя всегда есть хотя бы один живой список, где он редактор» (D-082) теперь
--    считает только списки, где он редактор; список по умолчанию — только такой (D-117).

-- ─────────────────────────────────────────────────────────────
-- Приглашения
-- ─────────────────────────────────────────────────────────────

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz
);

create index invites_list_id_idx on public.invites (list_id);

alter table public.invites enable row level security;

-- Редакторы списка видят его ссылки (без токенов — их в базе нет). Создать, отозвать, принять — функциями.
create policy "invites: читать редакторам" on public.invites
  for select to authenticated using (public.is_list_editor(list_id));

revoke all on public.invites from anon, authenticated;
grant select on public.invites to authenticated;

create function public.invite_token_hash(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

-- Создать ссылку: только редактор живого списка. Токен (64 hex, ~244 бита) возвращается один раз.
create function public.create_invite(p_list_id uuid, p_role text)
returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_id uuid;
  v_exp timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'bad_role' using errcode = '22023';
  end if;
  if not public.is_list_editor(p_list_id) or not public.is_list_alive(p_list_id) then
    raise exception 'list_not_found' using errcode = 'P0002';
  end if;
  insert into public.invites (list_id, role, token_hash, created_by)
  values (p_list_id, p_role, public.invite_token_hash(v_token), (select auth.uid()))
  returning id, invites.expires_at into v_id, v_exp;
  return query select v_id, v_token, v_exp;
end;
$$;

-- Отозвать: любой редактор списка
create function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invites i set revoked_at = now()
  where i.id = p_invite_id and i.revoked_at is null and public.is_list_editor(i.list_id);
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Действующее приглашение по токену: не отозвано, не истекло, список не удалён
create function public.find_valid_invite(p_token text)
returns public.invites
language sql
stable
security definer
set search_path = ''
as $$
  select i.*
  from public.invites i
  join public.lists l on l.id = i.list_id and l.deleted_at is null
  where i.token_hash = public.invite_token_hash(coalesce(p_token, ''))
    and i.revoked_at is null
    and i.expires_at > now();
$$;

-- Карточка приглашения до принятия — минимум данных. Вызывает только сервер (Edge Function invite-preview
-- подписывает ссылки на фото обложки и аватар), клиенту по токену список целиком не открывается.
create function public.invite_preview(p_token text)
returns table (
  list_id uuid,
  title text,
  icon text,
  color text,
  cover_mode text,
  item_count integer,
  cover_photos text[],
  role text,
  inviter_name text,
  inviter_avatar_url text,
  inviter_avatar_path text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.id, l.title, l.icon, l.color, l.cover_mode,
    (select count(*)::integer from public.list_items li where li.list_id = l.id and li.deleted_at is null),
    coalesce((
      select array_agg(x.image_path order by x.added_at desc)
      from (
        select w.image_path, li.added_at
        from public.list_items li join public.wishes w on w.id = li.wish_id
        where li.list_id = l.id and li.deleted_at is null and w.image_path is not null
        order by li.added_at desc
        limit 4
      ) x
    ), '{}'),
    i.role, p.display_name, p.avatar_url, p.avatar_path, i.expires_at
  from public.find_valid_invite(p_token) i
  join public.lists l on l.id = i.list_id
  left join public.profiles p on p.id = i.created_by;
$$;

-- Принять: добавляет в участники с ролью приглашения; существующую роль не понижает.
create function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  inv public.invites;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into inv from public.find_valid_invite(p_token);
  if inv.id is null then
    raise exception 'invite_invalid' using errcode = 'P0002';
  end if;
  insert into public.list_members as m (list_id, user_id, role)
  values (inv.list_id, v_uid, inv.role)
  on conflict (list_id, user_id) do update
    set role = case when m.role = 'editor' then 'editor' else excluded.role end;
  return inv.list_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Свой список и список по умолчанию (D-082, D-117)
-- ─────────────────────────────────────────────────────────────

-- После того как пользователь потерял список (убрали, понизили, удалили у всех):
-- если у него не осталось живого списка, где он редактор, — создаётся «Мои желания»;
-- список по умолчанию — только живой, где он редактор (иначе первый такой по дате создания).
create function public.fix_user_lists(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first uuid;
begin
  select l.id into v_first
  from public.lists l
  join public.list_members m on m.list_id = l.id and m.user_id = p_user and m.role = 'editor'
  where l.deleted_at is null
  order by l.created_at, l.id
  limit 1;

  if v_first is null then
    insert into public.lists (title, icon, color, created_by)
    values ('Мои желания', 'heart', 'lavender', p_user)
    returning id into v_first;
  end if;

  update public.profiles p set default_list_id = v_first
  where p.id = p_user
    and (
      p.default_list_id is null
      or not exists (
        select 1
        from public.lists l
        join public.list_members m on m.list_id = l.id and m.user_id = p_user and m.role = 'editor'
        where l.id = p.default_list_id and l.deleted_at is null
      )
    );
end;
$$;

-- Сколько у пользователя живых списков, где он редактор
create function public.editor_list_count(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.lists l
  join public.list_members m on m.list_id = l.id and m.user_id = p_user and m.role = 'editor'
  where l.deleted_at is null;
$$;

-- ─────────────────────────────────────────────────────────────
-- Удаление списка — у всех участников (переписано)
-- ─────────────────────────────────────────────────────────────

-- Мягкое удаление без проверок прав — общая часть delete_list и «вышел последний редактор»
create function public.soft_delete_list(p_list_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  r record;
begin
  -- желания — в корзину (уже лежавшие сохраняют дату)
  update public.list_items li set deleted_at = v_now
  where li.list_id = p_list_id and li.deleted_at is null;
  update public.lists l set deleted_at = v_now where l.id = p_list_id;
  -- ссылки удалённого списка больше не действуют (find_valid_invite и так проверяет список)
  update public.invites i set revoked_at = v_now where i.list_id = p_list_id and i.revoked_at is null;
  -- участие сохраняется (корзина видна редакторам, D-117); списки по умолчанию и «свой список» — у всех
  for r in select m.user_id from public.list_members m where m.list_id = p_list_id loop
    perform public.fix_user_lists(r.user_id);
  end loop;
end;
$$;

create or replace function public.delete_list(p_list_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
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

  -- Последний список, где я редактор, удалить нельзя (D-082)
  if public.editor_list_count(v_uid) <= 1 then
    raise exception 'last_list' using errcode = 'P0001', hint = 'Нельзя удалить единственный список';
  end if;

  perform public.soft_delete_list(p_list_id);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Участники
-- ─────────────────────────────────────────────────────────────

-- Сменить роль другого участника: только редактор, не себя
create function public.set_member_role(p_list_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'bad_role' using errcode = '22023';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'not_self' using errcode = '22023';
  end if;
  if not public.is_list_editor(p_list_id) or not public.is_list_alive(p_list_id) then
    raise exception 'list_not_found' using errcode = 'P0002';
  end if;
  update public.list_members m set role = p_role
  where m.list_id = p_list_id and m.user_id = p_user_id;
  if not found then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
  if p_role = 'viewer' then
    perform public.fix_user_lists(p_user_id);
  end if;
end;
$$;

-- Убрать участника: только редактор, не себя (для себя — «Выйти»). Его желания остаются в списке.
create function public.remove_member(p_list_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'not_self' using errcode = '22023';
  end if;
  if not public.is_list_editor(p_list_id) or not public.is_list_alive(p_list_id) then
    raise exception 'list_not_found' using errcode = 'P0002';
  end if;
  delete from public.list_members m where m.list_id = p_list_id and m.user_id = p_user_id;
  if not found then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
  perform public.fix_user_lists(p_user_id);
end;
$$;

-- Выйти из списка. Свой единственный список, где я редактор, оставить нельзя (D-082).
-- Если я последний редактор — список удаляется у всех (желания — в корзину). Возвращает 'left' или 'deleted'.
create function public.leave_list(p_list_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_editors integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform 1 from public.profiles p where p.id = v_uid for update;
  perform 1 from public.lists l where l.id = p_list_id and l.deleted_at is null for update;
  if not found then
    raise exception 'list_not_found' using errcode = 'P0002';
  end if;
  select m.role into v_role from public.list_members m where m.list_id = p_list_id and m.user_id = v_uid;
  if v_role is null then
    raise exception 'list_not_found' using errcode = 'P0002';
  end if;

  if v_role = 'editor' and public.editor_list_count(v_uid) <= 1 then
    raise exception 'last_list' using errcode = 'P0001', hint = 'Нельзя выйти из единственного списка';
  end if;

  select count(*) into v_editors
  from public.list_members m where m.list_id = p_list_id and m.role = 'editor' and m.user_id <> v_uid;

  if v_role = 'editor' and v_editors = 0 then
    -- последний редактор: список удаляется у всех, моё участие остаётся — для корзины (D-117)
    perform public.soft_delete_list(p_list_id);
    return 'deleted';
  end if;

  delete from public.list_members m where m.list_id = p_list_id and m.user_id = v_uid;
  perform public.fix_user_lists(v_uid);
  return 'left';
end;
$$;

-- Список по умолчанию — только свой живой список, где я редактор (зрителю туда не добавить желание)
drop policy "profiles: менять свой" on public.profiles;
create policy "profiles: менять свой" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (default_list_id is null or (public.is_list_editor(default_list_id) and public.is_list_alive(default_list_id)))
  );

-- ─────────────────────────────────────────────────────────────
-- Права на функции
-- ─────────────────────────────────────────────────────────────

revoke execute on function
  public.invite_token_hash(text),
  public.create_invite(uuid, text),
  public.revoke_invite(uuid),
  public.find_valid_invite(text),
  public.invite_preview(text),
  public.accept_invite(text),
  public.fix_user_lists(uuid),
  public.editor_list_count(uuid),
  public.soft_delete_list(uuid),
  public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid),
  public.leave_list(uuid)
from public, anon, authenticated;

grant execute on function
  public.create_invite(uuid, text),
  public.revoke_invite(uuid),
  public.accept_invite(text),
  public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid),
  public.leave_list(uuid)
to authenticated;

-- карточку приглашения отдаёт Edge Function invite-preview
grant execute on function public.invite_preview(text), public.find_valid_invite(text), public.invite_token_hash(text)
  to service_role;

-- invites — в Realtime: ссылки в «Участниках» обновляются у всех редакторов
alter publication supabase_realtime add table public.invites;
