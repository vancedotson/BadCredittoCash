create table if not exists public.rate_limit_counters (
  bucket text not null,
  key_hash text not null,
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (bucket, key_hash, window_start)
);

alter table public.rate_limit_counters enable row level security;
revoke all on table public.rate_limit_counters from public, anon, authenticated;

create or replace function public.consume_rate_limit(
  p_bucket text,
  p_key_hash text,
  p_window_seconds integer,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_window timestamptz;
  current_count integer;
begin
  if p_bucket not in ('registration', 'booking', 'tracking') then raise exception 'invalid_bucket'; end if;
  if p_key_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_key_hash'; end if;
  if p_window_seconds < 10 or p_window_seconds > 3600 then raise exception 'invalid_window'; end if;
  if p_limit < 1 or p_limit > 1000 then raise exception 'invalid_limit'; end if;

  current_window := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds);

  delete from public.rate_limit_counters
  where bucket = p_bucket and key_hash = p_key_hash
    and window_start < current_window - interval '1 hour';

  insert into public.rate_limit_counters (bucket, key_hash, window_start, request_count)
  values (p_bucket, p_key_hash, current_window, 1)
  on conflict (bucket, key_hash, window_start) do update
  set request_count = public.rate_limit_counters.request_count + 1
  returning request_count into current_count;

  return current_count <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
