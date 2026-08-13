create table if not exists public.calendar_integrations (
  provider text primary key,
  refresh_token_ciphertext text not null,
  calendar_id text not null default 'primary',
  account_email text,
  timezone text not null default 'Europe/Lisbon',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_integrations_provider_check check (provider = 'google')
);

alter table public.calendar_integrations enable row level security;

create or replace function public.save_google_calendar_connection(
  p_refresh_token_ciphertext text,
  p_calendar_id text default 'primary',
  p_account_email text default null,
  p_timezone text default 'Europe/Lisbon'
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if nullif(p_refresh_token_ciphertext, '') is null
    or length(p_refresh_token_ciphertext) > 8192
    or nullif(p_calendar_id, '') is null
    or length(p_calendar_id) > 500
    or length(coalesce(p_account_email, '')) > 320
    or nullif(p_timezone, '') is null
    or length(p_timezone) > 100
  then raise exception 'invalid_calendar_connection'; end if;

  insert into public.calendar_integrations (
    provider, refresh_token_ciphertext, calendar_id, account_email, timezone
  ) values (
    'google', p_refresh_token_ciphertext, p_calendar_id,
    nullif(lower(trim(p_account_email)), ''), p_timezone
  )
  on conflict (provider) do update set
    refresh_token_ciphertext = excluded.refresh_token_ciphertext,
    calendar_id = excluded.calendar_id,
    account_email = excluded.account_email,
    timezone = excluded.timezone,
    connected_at = now(),
    updated_at = now();
end;
$$;

create or replace function public.get_google_calendar_connection()
returns table (
  refresh_token_ciphertext text,
  calendar_id text,
  account_email text,
  timezone text,
  connected_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select integration.refresh_token_ciphertext, integration.calendar_id,
    integration.account_email, integration.timezone, integration.connected_at
  from public.calendar_integrations as integration
  where integration.provider = 'google';
$$;

revoke all on table public.calendar_integrations from public, anon, authenticated;
revoke all on function public.save_google_calendar_connection(text,text,text,text) from public,anon,authenticated;
revoke all on function public.get_google_calendar_connection() from public,anon,authenticated;
grant execute on function public.save_google_calendar_connection(text,text,text,text) to service_role;
grant execute on function public.get_google_calendar_connection() to service_role;
