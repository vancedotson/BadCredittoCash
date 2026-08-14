create table public.crm_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.crm_users(user_id) on delete cascade,
  source_key text not null,
  kind text not null check (kind in ('overdue', 'cooling', 'nofollow', 'booking')),
  title text not null,
  subtitle text not null,
  href text not null,
  tone text not null check (tone in ('danger', 'warn', 'success', 'neutral')),
  contact_id uuid references public.contacts(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  read_at timestamptz,
  dismissed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_key)
);

create index crm_notifications_user_active_idx
  on public.crm_notifications(user_id, created_at desc)
  where dismissed_at is null and resolved_at is null;

create trigger crm_notifications_set_updated_at before update on public.crm_notifications
for each row execute function public.set_updated_at();

alter table public.crm_notifications enable row level security;
create policy notifications_own_read on public.crm_notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_own_update on public.crm_notifications
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, update on public.crm_notifications to authenticated;

create or replace function public.notify_crm_users_of_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare contact_name text;
begin
  select c.name into contact_name from public.contacts c where c.id = new.contact_id;
  insert into public.crm_notifications (
    user_id, source_key, kind, title, subtitle, href, tone, contact_id, booking_id
  )
  select u.user_id, 'booking:' || new.id::text, 'booking',
    coalesce(contact_name, 'A contact') || ' booked a call',
    to_char(new.starts_at at time zone new.timezone, 'Mon DD at HH12:MI AM') || ' · ' || new.timezone,
    '/crm/contacts/' || new.contact_id::text, 'success', new.contact_id, new.id
  from public.crm_users u
  on conflict (user_id, source_key) do nothing;
  return new;
end;
$$;

create trigger bookings_create_notifications
after insert on public.bookings
for each row execute function public.notify_crm_users_of_booking();

create or replace function public.sync_crm_notifications()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare inserted_count integer := 0; new_count integer := 0;
begin
  insert into public.crm_notifications (
    user_id, source_key, kind, title, subtitle, href, tone, contact_id, task_id
  )
  select u.user_id,
    'overdue:' || t.id::text || ':' || extract(epoch from t.due_at)::bigint::text,
    'overdue', t.title, c.name || ' · overdue', '/crm/contacts/' || c.id::text,
    'danger', c.id, t.id
  from public.tasks t
  join public.contacts c on c.id = t.contact_id
  cross join public.crm_users u
  where not t.done and t.due_at is not null and t.due_at < now()
  on conflict (user_id, source_key) do nothing;
  get diagnostics inserted_count = row_count;

  with event_rollup as (
    select c.id as contact_id, c.name, c.email,
      max(e.occurred_at) as last_activity_at,
      bool_or(e.event_key in ('webinar_completed','webinar_watch_90','webinar_watch_75','offer_cta_clicked','call_booking_started')) as high_intent,
      bool_or(e.event_key = 'call_booked') as booked
    from public.contacts c
    join public.events e on e.email = c.email
    group by c.id, c.name, c.email
  )
  insert into public.crm_notifications (
    user_id, source_key, kind, title, subtitle, href, tone, contact_id
  )
  select u.user_id,
    'cooling:' || r.contact_id::text || ':' || extract(epoch from r.last_activity_at)::bigint::text,
    'cooling', r.name || ' is cooling off',
    floor(extract(epoch from (now() - r.last_activity_at)) / 86400)::integer::text || 'd quiet',
    '/crm/contacts/' || r.contact_id::text, 'warn', r.contact_id
  from event_rollup r
  cross join public.crm_users u
  where r.high_intent and not r.booked and r.last_activity_at <= now() - interval '2 days'
  on conflict (user_id, source_key) do nothing;
  get diagnostics new_count = row_count;
  inserted_count := inserted_count + new_count;

  with event_rollup as (
    select c.id as contact_id, c.name,
      max(e.occurred_at) as last_activity_at,
      bool_or(e.event_key in ('webinar_registered','webinar_confirmed_view','webinar_room_opened','webinar_watch_25','webinar_watch_50')) as needs_followup,
      bool_or(e.event_key in ('webinar_completed','webinar_watch_90','webinar_watch_75','offer_cta_clicked','call_booking_started','call_booked')) as progressed
    from public.contacts c
    join public.events e on e.email = c.email
    group by c.id, c.name
  )
  insert into public.crm_notifications (
    user_id, source_key, kind, title, subtitle, href, tone, contact_id
  )
  select u.user_id,
    'nofollow:' || r.contact_id::text || ':' || extract(epoch from r.last_activity_at)::bigint::text,
    'nofollow', 'No follow-up set for ' || r.name,
    floor(extract(epoch from (now() - r.last_activity_at)) / 86400)::integer::text || 'd quiet',
    '/crm/contacts/' || r.contact_id::text, 'neutral', r.contact_id
  from event_rollup r
  cross join public.crm_users u
  where r.needs_followup and not r.progressed
    and r.last_activity_at <= now() - interval '3 days'
    and not exists (select 1 from public.tasks t where t.contact_id = r.contact_id and not t.done)
  on conflict (user_id, source_key) do nothing;
  get diagnostics new_count = row_count;
  inserted_count := inserted_count + new_count;

  update public.crm_notifications n set resolved_at = now()
  where n.resolved_at is null and (
    (n.kind = 'overdue' and not exists (
      select 1 from public.tasks t where t.id = n.task_id and not t.done and t.due_at is not null and t.due_at < now()
    ))
    or (n.kind = 'cooling' and not exists (
      select 1 from public.contacts c
      join public.events e on e.email = c.email
      where c.id = n.contact_id
      group by c.id
      having bool_or(e.event_key in ('webinar_completed','webinar_watch_90','webinar_watch_75','offer_cta_clicked','call_booking_started'))
        and not bool_or(e.event_key = 'call_booked')
        and max(e.occurred_at) <= now() - interval '2 days'
    ))
    or (n.kind = 'nofollow' and not exists (
      select 1 from public.contacts c
      join public.events e on e.email = c.email
      where c.id = n.contact_id
        and not exists (select 1 from public.tasks t where t.contact_id = c.id and not t.done)
      group by c.id
      having bool_or(e.event_key in ('webinar_registered','webinar_confirmed_view','webinar_room_opened','webinar_watch_25','webinar_watch_50'))
        and not bool_or(e.event_key in ('webinar_completed','webinar_watch_90','webinar_watch_75','offer_cta_clicked','call_booking_started','call_booked'))
        and max(e.occurred_at) <= now() - interval '3 days'
    ))
  );

  return jsonb_build_object('inserted', inserted_count);
end;
$$;

revoke all on function public.notify_crm_users_of_booking() from public;
revoke all on function public.sync_crm_notifications() from public;
grant execute on function public.sync_crm_notifications() to authenticated, service_role;
