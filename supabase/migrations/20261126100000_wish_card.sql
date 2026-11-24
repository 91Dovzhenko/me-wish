-- ТЗ 003-d · Открытая карточка желания: редактирование, удаление в корзину и отмена удаления.
-- Все функции — security invoker: действуют обычные политики RLS (менять может только редактор списка,
-- переносить — только в неудалённый список, где вызывающий тоже редактор).
-- Приоритет, статус и перенос в другой список приложение меняет обычным update — политики уже это покрывают.

-- ─────────────────────────────────────────────────────────────
-- Редактирование: поля желания + приоритет и список появления — одной транзакцией.
-- Если любая часть не прошла (нет прав, список удалён) — не меняется ничего.
-- ─────────────────────────────────────────────────────────────

create function public.update_wish(
  p_item_id uuid,
  p_list_id uuid,
  p_title text,
  p_price integer default null,
  p_source_url text default null,
  p_description text default null,
  p_priority smallint default 3,
  p_image_path text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_wish uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_url text := nullif(btrim(coalesce(p_source_url, '')), '');
begin
  if (select auth.uid()) is null then
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
  -- папку (только своя) проверяет триггер wishes_check_image_path
  if p_image_path is not null and not public.is_wish_photo_path(p_image_path) then
    raise exception 'bad_image_path' using errcode = '22023';
  end if;

  -- видно только участнику списка (RLS); в корзине не редактируется
  select li.wish_id into v_wish
  from public.list_items li
  where li.id = p_item_id and li.deleted_at is null;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- зритель: политика update отфильтрует строку → not_found; чужой или удалённый целевой список → 42501
  update public.list_items
  set priority = p_priority, list_id = p_list_id
  where id = p_item_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.wishes
  set title = v_title, price = p_price, source_url = v_url, description = v_desc, image_path = p_image_path
  where id = v_wish;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Удаление в корзину и отмена («Удалено · Отменить», D-080). Дата — по часам сервера.
-- ─────────────────────────────────────────────────────────────

create function public.trash_list_item(p_item_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.list_items set deleted_at = now()
  where id = p_item_id and deleted_at is null;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Возврат на место. Если список за это время удалили — политика не пустит (is_list_alive).
create function public.restore_list_item(p_item_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.list_items set deleted_at = null
  where id = p_item_id and deleted_at is not null;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Права на функции
-- ─────────────────────────────────────────────────────────────

revoke execute on function
  public.update_wish(uuid, uuid, text, integer, text, text, smallint, text),
  public.trash_list_item(uuid),
  public.restore_list_item(uuid)
from public, anon;

grant execute on function
  public.update_wish(uuid, uuid, text, integer, text, text, smallint, text),
  public.trash_list_item(uuid),
  public.restore_list_item(uuid)
to authenticated;
