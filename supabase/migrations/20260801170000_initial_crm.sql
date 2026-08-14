create extension if not exists citext;
create extension if not exists pgcrypto;

create type public.crm_role as enum ('admin', 'staff', 'readonly');
create type public.booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
create type public.message_status as enum ('scheduled', 'sending', 'sent', 'cancelled', 'failed');

create table public.crm_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.crm_role not null default 'staff',
  display_name text,
  created_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  name text not null,
  phone text,
  source text not null default 'direct',
  utm jsonb not null default '{}'::jsonb,
  first_touch jsonb not null default '{}'::jsonb,
  last_touch jsonb not null default '{}'::jsonb,
  owner_id uuid references public.crm_users(user_id) on delete set null,
  stage text not null default 'new',
  stage_changed_at timestamptz not null default now(),
  lost_reason text,
  marketing_consent boolean not null default false,
  consent_version text,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  contact_id uuid references public.contacts(id) on delete set null,
  email citext,
  visitor_id text,
  session_id text,
  client_event_id text unique,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  body text not null,
  author_id uuid references public.crm_users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  title text not null,
  due_at timestamptz,
  done boolean not null default false,
  priority text not null default 'normal',
  task_type text not null default 'follow_up',
  owner_id uuid references public.crm_users(user_id) on delete set null,
  notes text,
  recurrence text not null default 'none',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name citext not null unique,
  created_at timestamptz not null default now()
);

create table public.contact_tags (
  contact_id uuid not null references public.contacts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (contact_id, tag_id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  status public.booking_status not null default 'pending',
  provider text,
  provider_event_id text unique,
  intake_answers jsonb not null default '{}'::jsonb,
  cancellation_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_valid_window check (ends_at > starts_at)
);

create table public.sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  sequence_key text not null,
  status text not null default 'active',
  enrolled_at timestamptz not null default now(),
  stopped_at timestamptz,
  stop_reason text
);

create table public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.sequence_enrollments(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  template_key text not null,
  scheduled_for timestamptz not null,
  status public.message_status not null default 'scheduled',
  provider_message_id text unique,
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.crm_users(user_id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.crm_users(user_id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index contacts_stage_idx on public.contacts(stage);
create index contacts_owner_idx on public.contacts(owner_id);
create index contacts_created_idx on public.contacts(created_at desc);
create index events_contact_time_idx on public.events(contact_id, occurred_at desc);
create index events_email_time_idx on public.events(email, occurred_at desc);
create index events_key_time_idx on public.events(event_key, occurred_at desc);
create index tasks_owner_due_idx on public.tasks(owner_id, due_at) where done = false;
create index tasks_contact_idx on public.tasks(contact_id, created_at desc);
create index bookings_starts_idx on public.bookings(starts_at) where status in ('pending', 'confirmed');
create index messages_due_idx on public.scheduled_messages(scheduled_for) where status = 'scheduled';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contacts_set_updated_at before update on public.contacts
for each row execute function public.set_updated_at();
create trigger notes_set_updated_at before update on public.notes
for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
create trigger bookings_set_updated_at before update on public.bookings
for each row execute function public.set_updated_at();
create trigger scheduled_messages_set_updated_at before update on public.scheduled_messages
for each row execute function public.set_updated_at();
create trigger settings_set_updated_at before update on public.settings
for each row execute function public.set_updated_at();

create or replace function public.is_crm_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.crm_users where user_id = (select auth.uid())
  );
$$;

create or replace function public.is_crm_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.crm_users
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_crm_user() from public;
revoke all on function public.is_crm_admin() from public;
grant execute on function public.is_crm_user() to authenticated;
grant execute on function public.is_crm_admin() to authenticated;

alter table public.crm_users enable row level security;
alter table public.contacts enable row level security;
alter table public.events enable row level security;
alter table public.notes enable row level security;
alter table public.tasks enable row level security;
alter table public.tags enable row level security;
alter table public.contact_tags enable row level security;
alter table public.bookings enable row level security;
alter table public.sequence_enrollments enable row level security;
alter table public.scheduled_messages enable row level security;
alter table public.settings enable row level security;
alter table public.audit_log enable row level security;

create policy crm_users_read on public.crm_users for select to authenticated using (public.is_crm_user());
create policy crm_users_admin_write on public.crm_users for all to authenticated using (public.is_crm_admin()) with check (public.is_crm_admin());

create policy contacts_crm_all on public.contacts for all to authenticated using (public.is_crm_user()) with check (public.is_crm_user());
create policy events_crm_all on public.events for all to authenticated using (public.is_crm_user()) with check (public.is_crm_user());
create policy notes_crm_all on public.notes for all to authenticated using (public.is_crm_user()) with check (public.is_crm_user());
create policy tasks_crm_all on public.tasks for all to authenticated using (public.is_crm_user()) with check (public.is_crm_user());
create policy tags_crm_all on public.tags for all to authenticated using (public.is_crm_user()) with check (public.is_crm_user());
create policy contact_tags_crm_all on public.contact_tags for all to authenticated using (public.is_crm_user()) with check (public.is_crm_user());
create policy bookings_crm_all on public.bookings for all to authenticated using (public.is_crm_user()) with check (public.is_crm_user());
create policy enrollments_crm_all on public.sequence_enrollments for all to authenticated using (public.is_crm_user()) with check (public.is_crm_user());
create policy messages_crm_all on public.scheduled_messages for all to authenticated using (public.is_crm_user()) with check (public.is_crm_user());
create policy settings_crm_read on public.settings for select to authenticated using (public.is_crm_user());
create policy settings_admin_write on public.settings for all to authenticated using (public.is_crm_admin()) with check (public.is_crm_admin());
create policy audit_crm_read on public.audit_log for select to authenticated using (public.is_crm_user());
create policy audit_crm_insert on public.audit_log for insert to authenticated with check (actor_id = (select auth.uid()));

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
