-- Additive live webinar records. No sessions or customer messages are created
-- by this migration. Public capture and worker delivery are separately gated.
create table public.live_webinar_sessions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 100),
  title text not null check (length(trim(title)) between 1 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null check (length(timezone) between 1 and 100),
  status text not null default 'draft' check (status in ('draft','scheduled','cancelled')),
  embed_url text check (embed_url is null or embed_url ~ '^https://'),
  replay_url text check (replay_url is null or replay_url ~ '^https://'),
  replay_published boolean not null default false,
  replay_available_until timestamptz,
  automation_enabled boolean not null default false,
  schedule_version integer not null default 1 check (schedule_version > 0),
  attendance_grace_minutes integer not null default 15 check (attendance_grace_minutes between 5 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours'),
  check (not replay_published or replay_url is not null),
  check (replay_available_until is null or replay_available_until > ends_at)
);

alter table public.contacts add column stage_mode text not null default 'manual'
  check (stage_mode in ('manual','automatic'));

create table public.live_webinar_registrations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  session_id uuid not null references public.live_webinar_sessions(id) on delete restrict,
  registered_at timestamptz not null default now(),
  registered_schedule_version integer not null default 1,
  cancelled_at timestamptz,
  first_room_opened_at timestamptz,
  attended_at timestamptz,
  last_presence_at timestamptz,
  replay_opened_at timestamptz,
  booking_started_at timestamptz,
  post_session_outcome text check (post_session_outcome in ('attended','no_attendance')),
  access_version integer not null default 1 check (access_version > 0),
  attribution jsonb not null default '{}'::jsonb check (pg_column_size(attribution) <= 32768),
  timezone text not null default 'UTC',
  marketing_consent boolean not null default false,
  consent_version text,
  consent_text text,
  consent_country text,
  notifications_paused boolean not null default false,
  last_scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id,session_id),
  unique (id,contact_id),
  unique (id,session_id)
);
create index live_webinar_sessions_schedule_idx on public.live_webinar_sessions(status,starts_at);
create index live_webinar_registrations_session_idx on public.live_webinar_registrations(session_id,registered_at);
create index live_webinar_registrations_sync_idx on public.live_webinar_registrations(last_scheduled_at nulls first);
create index events_live_session_idx on public.events((properties->>'sessionId'),occurred_at desc)
  where properties->>'funnel' = 'live';

alter table public.bookings
  add column live_session_id uuid references public.live_webinar_sessions(id) on delete restrict,
  add column live_registration_id uuid,
  add constraint bookings_live_registration_session_fk foreign key (live_registration_id,live_session_id)
    references public.live_webinar_registrations(id,session_id) deferrable initially deferred,
  add constraint bookings_live_registration_contact_fk foreign key (live_registration_id,contact_id)
    references public.live_webinar_registrations(id,contact_id) deferrable initially deferred,
  add constraint bookings_live_registration_has_session check (live_registration_id is null or live_session_id is not null);
create index bookings_live_session_idx on public.bookings(live_session_id) where live_session_id is not null;

alter table public.sequence_enrollments
  add column context_key text not null default 'legacy',
  add column live_registration_id uuid,
  add constraint enrollments_live_registration_contact_fk foreign key (live_registration_id,contact_id)
    references public.live_webinar_registrations(id,contact_id) on delete cascade,
  add constraint enrollments_context_consistent check (
    (context_key = 'legacy' and live_registration_id is null and sequence_key <> 'live_webinar')
    or (live_registration_id is not null and context_key = 'live:' || live_registration_id::text and sequence_key = 'live_webinar')
  );
drop index public.sequence_enrollments_contact_sequence_unique;
create unique index sequence_enrollments_contact_sequence_context_unique
  on public.sequence_enrollments(contact_id,sequence_key,context_key);
alter table public.scheduled_messages add column delivery_key text;
update public.scheduled_messages set delivery_key = template_key where delivery_key is null;
alter table public.scheduled_messages alter column delivery_key set not null;
drop index public.scheduled_messages_enrollment_template_unique;
create unique index scheduled_messages_enrollment_delivery_unique on public.scheduled_messages(enrollment_id,delivery_key);

-- Legacy booking writers omit delivery_key. Preserve their signatures and
-- row identities while requiring live writers to supply their deterministic key.
create function public.guard_email_delivery_key_v1()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.delivery_key is distinct from old.delivery_key then
    raise exception 'delivery_key_is_immutable';
  end if;
  if new.delivery_key is null then
    if exists (select 1 from public.sequence_enrollments where id = new.enrollment_id and context_key = 'legacy') then
      new.delivery_key := new.template_key;
    else raise exception 'live_delivery_key_required'; end if;
  end if;
  if not exists (select 1 from public.sequence_enrollments where id = new.enrollment_id and contact_id = new.contact_id) then
    raise exception 'message_contact_mismatch';
  end if;
  return new;
end; $$;
create trigger scheduled_messages_delivery_key_guard before insert or update on public.scheduled_messages
  for each row execute function public.guard_email_delivery_key_v1();

create function public.guard_live_webinar_session_v1()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'invalid_timezone';
  end if;
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.slug <> old.slug then raise exception 'session_identity_is_immutable'; end if;
    if new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at
      or new.timezone is distinct from old.timezone or new.status is distinct from old.status then
      new.schedule_version := old.schedule_version + 1;
    else new.schedule_version := old.schedule_version; end if;
  else new.schedule_version := greatest(coalesce(new.schedule_version,1),1); end if;
  new.updated_at := now();
  return new;
end; $$;
create trigger live_webinar_session_guard before insert or update on public.live_webinar_sessions
  for each row execute function public.guard_live_webinar_session_v1();
create trigger live_webinar_registrations_updated before update on public.live_webinar_registrations
  for each row execute function public.set_updated_at();

alter table public.live_webinar_sessions enable row level security;
alter table public.live_webinar_registrations enable row level security;
create policy live_sessions_read on public.live_webinar_sessions for select to authenticated using (public.is_crm_user());
create policy live_sessions_write on public.live_webinar_sessions for all to authenticated using (public.is_crm_writer()) with check (public.is_crm_writer());
create policy live_registrations_read on public.live_webinar_registrations for select to authenticated using (public.is_crm_user());
-- Authenticated registration writes are reserved for admin trash restoration;
-- browser participation and registration always go through server-only RPCs.
create policy live_registrations_admin on public.live_webinar_registrations for all to authenticated using (public.is_crm_admin()) with check (public.is_crm_admin());
revoke all on public.live_webinar_sessions, public.live_webinar_registrations from public,anon;
grant select,insert,update,delete on public.live_webinar_sessions, public.live_webinar_registrations to authenticated,service_role;
revoke all on function public.guard_email_delivery_key_v1(), public.guard_live_webinar_session_v1() from public,anon,authenticated;
