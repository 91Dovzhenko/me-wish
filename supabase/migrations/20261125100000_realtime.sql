-- ТЗ 003-c-fix · Синхронизация между устройствами (D-105).
-- Таблицы попадают в публикацию supabase_realtime: открытое приложение получает изменения
-- и тихо перечитывает данные. Realtime проверяет политики RLS каждого подписчика —
-- изменения insert/update приходят только тем, кто и так может видеть строку.
-- (Об удалении строк Realtime сообщает всем подписчикам таблицы, но только первичный ключ —
-- без содержимого. Приложение по таким событиям лишь перечитывает свои данные.)

do $$
declare t text;
begin
  foreach t in array array['lists', 'list_items', 'wishes', 'profiles', 'list_members'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
