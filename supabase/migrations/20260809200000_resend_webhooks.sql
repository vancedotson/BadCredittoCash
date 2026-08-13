alter table public.scheduled_messages
  add column if not exists provider_status text,
  add column if not exists delivered_at timestamptz,
  add column if not exists opened_at timestamptz,
  add column if not exists clicked_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists complained_at timestamptz;

create table if not exists public.email_provider_events (
  provider_event_id text primary key,
  provider text not null,
  provider_message_id text not null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists email_provider_events_message_idx
on public.email_provider_events (provider_message_id, occurred_at desc);

alter table public.email_provider_events enable row level security;

create or replace function public.apply_resend_email_event(
  p_event_id text,
  p_event_type text,
  p_provider_message_id text,
  p_occurred_at timestamptz,
  p_details jsonb default '{}'::jsonb,
  p_allow_suppression boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_message public.scheduled_messages;
  matched_email public.citext;
  inserted_count integer;
  suppression_event boolean := p_event_type in (
    'email.bounced', 'email.complained', 'email.suppressed'
  );
begin
  if p_event_id is null or length(p_event_id) > 200
    or p_provider_message_id is null or length(p_provider_message_id) > 200
    or p_event_type not in (
      'email.sent', 'email.delivered', 'email.delivery_delayed',
      'email.bounced', 'email.complained', 'email.failed',
      'email.suppressed', 'email.opened', 'email.clicked'
    )
    or p_occurred_at is null
    or pg_column_size(coalesce(p_details, '{}'::jsonb)) > 4096
  then raise exception 'invalid_provider_event'; end if;

  select * into matched_message
  from public.scheduled_messages
  where provider_message_id = p_provider_message_id;
  if matched_message.id is null then return false; end if;

  insert into public.email_provider_events (
    provider_event_id, provider, provider_message_id,
    event_type, details, occurred_at
  ) values (
    p_event_id, 'resend', p_provider_message_id,
    p_event_type, coalesce(p_details, '{}'::jsonb), p_occurred_at
  ) on conflict (provider_event_id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then return false; end if;

  update public.scheduled_messages
  set provider_status = replace(p_event_type, 'email.', ''),
      status = case
        when p_event_type in ('email.bounced', 'email.complained', 'email.failed', 'email.suppressed')
          then 'failed'::public.message_status
        else status
      end,
      delivered_at = case when p_event_type = 'email.delivered' then p_occurred_at else delivered_at end,
      opened_at = case when p_event_type = 'email.opened' then coalesce(opened_at, p_occurred_at) else opened_at end,
      clicked_at = case when p_event_type = 'email.clicked' then coalesce(clicked_at, p_occurred_at) else clicked_at end,
      bounced_at = case when p_event_type in ('email.bounced', 'email.suppressed') then p_occurred_at else bounced_at end,
      complained_at = case when p_event_type = 'email.complained' then p_occurred_at else complained_at end,
      last_error = case
        when p_event_type in ('email.bounced', 'email.complained', 'email.failed', 'email.suppressed')
          then left(coalesce(p_details->>'reason', p_event_type), 500)
        else last_error
      end,
      updated_at = now()
  where id = matched_message.id;

  select email into matched_email
  from public.contacts where id = matched_message.contact_id;

  insert into public.events (
    event_key, contact_id, email, client_event_id, properties, occurred_at
  ) values (
    replace(p_event_type, '.', '_'), matched_message.contact_id, matched_email,
    'resend:' || p_event_id,
    jsonb_build_object(
      'provider', 'resend',
      'templateKey', matched_message.template_key,
      'providerStatus', replace(p_event_type, 'email.', '')
    ),
    p_occurred_at
  ) on conflict (client_event_id) do nothing;

  if suppression_event and p_allow_suppression then
    update public.contacts
    set email_suppressed_at = coalesce(email_suppressed_at, p_occurred_at),
        email_suppression_reason = replace(p_event_type, 'email.', ''),
        marketing_consent = false,
        updated_at = now()
    where id = matched_message.contact_id;

    update public.scheduled_messages
    set status = 'cancelled',
        last_error = 'Cancelled after provider suppression',
        updated_at = now()
    where contact_id = matched_message.contact_id
      and status in ('scheduled', 'failed')
      and id <> matched_message.id;

    update public.sequence_enrollments
    set status = 'stopped', stopped_at = now(), stop_reason = 'email_suppressed'
    where contact_id = matched_message.contact_id and status = 'active';
  end if;

  return true;
end;
$$;

revoke all on function public.apply_resend_email_event(text, text, text, timestamptz, jsonb, boolean)
from public, anon, authenticated;
grant execute on function public.apply_resend_email_event(text, text, text, timestamptz, jsonb, boolean)
to service_role;

