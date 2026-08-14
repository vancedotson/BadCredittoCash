create table public.operational_digest_runs (
  digest_key text not null,
  digest_date date not null,
  status text not null check (status in ('processing', 'sent', 'failed')),
  item_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (digest_key, digest_date)
);

alter table public.operational_digest_runs enable row level security;

create or replace function public.claim_operational_digest_v1(
  p_digest_key text,
  p_digest_date date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.operational_digest_runs (digest_key, digest_date, status)
  values (p_digest_key, p_digest_date, 'processing')
  on conflict (digest_key, digest_date) do nothing;
  return found;
end;
$$;

create or replace function public.complete_operational_digest_v1(
  p_digest_key text,
  p_digest_date date,
  p_status text,
  p_item_count integer,
  p_last_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('sent', 'failed') then
    raise exception 'Invalid digest status';
  end if;
  update public.operational_digest_runs
  set status = p_status,
      item_count = greatest(0, p_item_count),
      last_error = case when p_status = 'failed' then left(coalesce(p_last_error, 'Unknown error'), 500) else null end,
      updated_at = now()
  where digest_key = p_digest_key and digest_date = p_digest_date;
end;
$$;

revoke all on table public.operational_digest_runs from public, anon, authenticated;
revoke all on function public.claim_operational_digest_v1(text, date) from public, anon, authenticated;
revoke all on function public.complete_operational_digest_v1(text, date, text, integer, text) from public, anon, authenticated;
grant execute on function public.claim_operational_digest_v1(text, date) to service_role;
grant execute on function public.complete_operational_digest_v1(text, date, text, integer, text) to service_role;
