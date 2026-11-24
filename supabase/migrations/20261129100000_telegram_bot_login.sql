-- ТЗ 003-f2 · Вход через Telegram-бота по одноразовому коду (D-111).
-- Запрос на вход: код (его видит бот в /start login_<код>) + хэш секрета устройства (секрет остаётся только
-- в браузере). Живёт 10 минут, используется один раз. Клиенту таблица недоступна — только Edge Functions
-- (telegram-auth: создать / опросить / обменять на сессию; telegram-webhook: подтвердить из бота).

create table public.telegram_login_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Za-z0-9]{8,32}$'),
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'), -- sha256 секрета устройства
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'used')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  -- после «Start» в боте
  telegram_id bigint,
  first_name text,
  last_name text,
  username text,
  confirmed_at timestamptz,
  used_at timestamptz
);

create index telegram_login_requests_created_at_idx on public.telegram_login_requests (created_at);

-- RLS включена, политик для клиентов нет; права тоже убраны — работает только service role
alter table public.telegram_login_requests enable row level security;
revoke all on public.telegram_login_requests from anon, authenticated;

-- Уборка: запросы старше суток (использованные, просроченные, брошенные)
create function public.purge_login_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.telegram_login_requests where created_at < now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.purge_login_requests() from public, anon, authenticated;

select cron.schedule('me-wish-purge-login-requests', '30 3 * * *', $$select public.purge_login_requests()$$);
