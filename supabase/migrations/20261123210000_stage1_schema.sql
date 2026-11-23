-- ТЗ 003-a · Схема этапа 1: профили, списки, участники, желания, появления желаний в списках.
-- Права — DOMAIN §4, поля — DOMAIN §3. Поля будущих этапов (голоса, брони, видимость, архив) не добавляются.

-- ─────────────────────────────────────────────────────────────
-- Таблицы
-- ─────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  avatar_path text,
  default_list_id uuid,
  created_at timestamptz not null default now()
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) > 0),
  description text,
  event_date date,
  icon text not null default 'heart' check (icon in (
    'heart', 'gift', 'cake', 'home', 'plane', 'suitcase', 'shirt', 'sneaker', 'tech', 'phone',
    'camera', 'book', 'dumbbell', 'ball', 'child', 'ring', 'tree', 'star', 'sparkles', 'music',
    'game', 'paw', 'coffee', 'pot', 'flower', 'palette', 'car', 'bike', 'tent', 'gem'
  )),
  color text not null default 'lavender' check (color in (
    'lavender', 'lime', 'pink', 'blue', 'peach', 'mint', 'sand', 'gray'
  )),
  cover_mode text not null default 'collage' check (cover_mode in ('collage', 'icon')),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_default_list_id_fkey
  foreign key (default_list_id) references public.lists (id) on delete set null;

create table public.list_members (
  list_id uuid not null references public.lists (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  added_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) > 0),
  description text,
  image_path text,
  source_url text,
  price integer check (price >= 0), -- целые рубли (D-072)
  status text not null default 'active' check (status in ('active', 'booked', 'purchased', 'gifted')),
  completed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  wish_id uuid not null references public.wishes (id) on delete cascade,
  priority smallint not null default 3 check (priority between 1 and 5),
  position double precision not null default 0,
  added_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (list_id, wish_id)
);

-- Индексы под RLS и частые выборки
create index list_members_user_id_idx on public.list_members (user_id);
create index lists_created_by_idx on public.lists (created_by);
create index wishes_created_by_idx on public.wishes (created_by);
create index list_items_list_id_idx on public.list_items (list_id);
create index list_items_wish_id_idx on public.list_items (wish_id);
create index profiles_default_list_id_idx on public.profiles (default_list_id);

-- ─────────────────────────────────────────────────────────────
-- Служебные триггеры
-- ─────────────────────────────────────────────────────────────

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger lists_set_updated_at before update on public.lists
  for each row execute function public.set_updated_at();
create trigger wishes_set_updated_at before update on public.wishes
  for each row execute function public.set_updated_at();

-- Неизменяемые поля: автор списка/желания, желание в появлении, кто добавил
create function public.keep_immutable_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'lists' or tg_table_name = 'wishes' then
    new.id := old.id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  elsif tg_table_name = 'list_items' then
    new.id := old.id;
    new.wish_id := old.wish_id;
    new.added_by := old.added_by;
    new.added_at := old.added_at;
  elsif tg_table_name = 'profiles' then
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger lists_keep_immutable before update on public.lists
  for each row execute function public.keep_immutable_columns();
create trigger wishes_keep_immutable before update on public.wishes
  for each row execute function public.keep_immutable_columns();
create trigger list_items_keep_immutable before update on public.list_items
  for each row execute function public.keep_immutable_columns();
create trigger profiles_keep_immutable before update on public.profiles
  for each row execute function public.keep_immutable_columns();

-- completed_at: ставится при переходе в purchased/gifted, сбрасывается при возврате
create function public.wishes_track_completed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('purchased', 'gifted') then
    if tg_op = 'INSERT' then
      new.completed_at := now();
    elsif old.status not in ('purchased', 'gifted') then
      new.completed_at := now();
    else
      -- «Куплено» ↔ «Подарили»: дата исполнения не меняется
      new.completed_at := coalesce(old.completed_at, now());
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger wishes_track_completed before insert or update on public.wishes
  for each row execute function public.wishes_track_completed();

-- Создатель списка автоматически становится редактором
create function public.add_list_creator_as_editor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.list_members (list_id, user_id, role)
  values (new.id, new.created_by, 'editor')
  on conflict (list_id, user_id) do update set role = 'editor';
  return new;
end;
$$;

create trigger lists_add_creator after insert on public.lists
  for each row execute function public.add_list_creator_as_editor();

-- ─────────────────────────────────────────────────────────────
-- Проверки прав (security definer, чтобы политики не зацикливались на RLS)
-- ─────────────────────────────────────────────────────────────

create function public.is_list_member(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.list_members m
    where m.list_id = p_list_id and m.user_id = (select auth.uid())
  );
$$;

create function public.is_list_editor(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.list_members m
    where m.list_id = p_list_id and m.user_id = (select auth.uid()) and m.role = 'editor'
  );
$$;

-- Видит желание: участник хотя бы одного списка, где оно есть (включая корзину)
create function public.can_view_wish(p_wish_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.list_items li
    join public.list_members m on m.list_id = li.list_id
    where li.wish_id = p_wish_id and m.user_id = (select auth.uid())
  );
$$;

-- Меняет общие поля желания: редактор хотя бы одного его списка (DOMAIN §4)
create function public.can_edit_wish(p_wish_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.list_items li
    join public.list_members m on m.list_id = li.list_id
    where li.wish_id = p_wish_id and m.user_id = (select auth.uid()) and m.role = 'editor'
  );
$$;

-- Можно положить желание в список: своё (только что созданное) или то, что уже можно редактировать.
-- Без этой проверки можно было бы «подцепить» чужое желание к своему списку и прочитать его.
create function public.can_link_wish(p_wish_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wishes w
    where w.id = p_wish_id and w.created_by = (select auth.uid())
  ) or public.can_edit_wish(p_wish_id);
$$;

-- Есть ли общий список с пользователем (для показа имени и аватара)
create function public.shares_list_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.list_members mine
    join public.list_members theirs on theirs.list_id = mine.list_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.lists enable row level security;
alter table public.list_members enable row level security;
alter table public.wishes enable row level security;
alter table public.list_items enable row level security;

-- profiles: свою строку целиком читаю и меняю. Чужие — только имя и аватар через profiles_public().
create policy "profiles: читать свой" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: менять свой" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (default_list_id is null or public.is_list_member(default_list_id))
  );
-- insert/delete нет: профиль создаёт триггер первого входа, удаляется вместе с аккаунтом.

-- lists: видят участники. created_by — чтобы insert … returning работал до появления участия.
create policy "lists: читать участникам" on public.lists
  for select to authenticated
  using (public.is_list_member(id) or created_by = (select auth.uid()));
create policy "lists: создавать от своего имени" on public.lists
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "lists: менять редакторам" on public.lists
  for update to authenticated
  using (public.is_list_editor(id)) with check (public.is_list_editor(id));
create policy "lists: удалять редакторам" on public.lists
  for delete to authenticated using (public.is_list_editor(id));

-- list_members: участники видят состав своих списков. Изменение состава — этап 2 (приглашения).
create policy "list_members: читать участникам" on public.list_members
  for select to authenticated using (public.is_list_member(list_id));

-- wishes
create policy "wishes: читать через участие" on public.wishes
  for select to authenticated
  using (public.can_view_wish(id) or created_by = (select auth.uid()));
create policy "wishes: создавать от своего имени" on public.wishes
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "wishes: менять редакторам" on public.wishes
  for update to authenticated
  using (public.can_edit_wish(id)) with check (public.can_edit_wish(id));
create policy "wishes: удалять редакторам" on public.wishes
  for delete to authenticated using (public.can_edit_wish(id));

-- list_items
create policy "list_items: читать участникам" on public.list_items
  for select to authenticated using (public.is_list_member(list_id));
create policy "list_items: добавлять редакторам" on public.list_items
  for insert to authenticated
  with check (
    public.is_list_editor(list_id)
    and added_by = (select auth.uid())
    and public.can_link_wish(wish_id)
  );
create policy "list_items: менять редакторам" on public.list_items
  for update to authenticated
  using (public.is_list_editor(list_id)) with check (public.is_list_editor(list_id));
create policy "list_items: удалять редакторам" on public.list_items
  for delete to authenticated using (public.is_list_editor(list_id));

-- Анонимным посетителям таблицы не нужны (гостевой доступ — этап 4, через Edge Functions)
revoke all on public.profiles, public.lists, public.list_members, public.wishes, public.list_items from anon;

-- ─────────────────────────────────────────────────────────────
-- Чужие профили: только имя и аватар тех, с кем есть общий список
-- ─────────────────────────────────────────────────────────────

create function public.profiles_public()
returns table (id uuid, display_name text, avatar_url text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.avatar_url, p.avatar_path
  from public.profiles p
  where p.id = (select auth.uid()) or public.shares_list_with(p.id);
$$;

-- ─────────────────────────────────────────────────────────────
-- Сводка по спискам (для обложек и бокового меню). security_invoker — действует RLS.
-- Количество — карточки не в корзине; сумма — цены карточек не в корзине и не исполненных (DOMAIN §6).
-- ─────────────────────────────────────────────────────────────

create view public.list_overview
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
  max(li.added_at) filter (where li.deleted_at is null) as last_added_at
from public.lists l
left join public.list_items li on li.list_id = l.id
left join public.wishes w on w.id = li.wish_id
group by l.id;

revoke all on public.list_overview from anon;

-- ─────────────────────────────────────────────────────────────
-- Дашборд главной (D-050): активные и исполненные в текущем году.
-- Желание считается один раз, даже если лежит в нескольких списках. Корзина не считается.
-- p_tz — часовой пояс пользователя, чтобы «текущий год» совпадал с его календарём.
-- ─────────────────────────────────────────────────────────────

create function public.dashboard_summary(p_tz text default 'UTC')
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
-- Первый вход: профиль из данных Google, список «Мои желания», участие, список по умолчанию (D-048)
-- ─────────────────────────────────────────────────────────────

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text;
  v_list_id uuid;
begin
  v_name := nullif(btrim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), '');
  if v_name is null then
    v_name := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;

  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(v_name, ''), nullif(coalesce(meta ->> 'avatar_url', meta ->> 'picture'), ''));

  insert into public.lists (title, icon, color, created_by)
  values ('Мои желания', 'heart', 'lavender', new.id)
  returning id into v_list_id;
  -- участие редактором добавляет триггер lists_add_creator

  update public.profiles set default_list_id = v_list_id where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Права на функции: служебные — никому из клиентов, проверки и чтение — только вошедшим
-- ─────────────────────────────────────────────────────────────

revoke execute on function
  public.set_updated_at(),
  public.keep_immutable_columns(),
  public.wishes_track_completed(),
  public.add_list_creator_as_editor(),
  public.handle_new_user()
from public, anon, authenticated;

revoke execute on function
  public.is_list_member(uuid),
  public.is_list_editor(uuid),
  public.can_view_wish(uuid),
  public.can_edit_wish(uuid),
  public.can_link_wish(uuid),
  public.shares_list_with(uuid),
  public.profiles_public(),
  public.dashboard_summary(text)
from public, anon;

grant execute on function
  public.is_list_member(uuid),
  public.is_list_editor(uuid),
  public.can_view_wish(uuid),
  public.can_edit_wish(uuid),
  public.can_link_wish(uuid),
  public.shares_list_with(uuid),
  public.profiles_public(),
  public.dashboard_summary(text)
to authenticated;
