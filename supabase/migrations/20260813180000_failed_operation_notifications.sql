alter table public.crm_notifications
  drop constraint if exists crm_notifications_kind_check;

alter table public.crm_notifications
  add constraint crm_notifications_kind_check
  check (kind in (
    'overdue', 'cooling', 'nofollow', 'booking', 'high_intent',
    'failed_email', 'failed_booking'
  ));

create or replace function public.notify_crm_users_of_failed_operation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_contact public.contacts%rowtype;
  notification_kind text;
  notification_title text;
  notification_subtitle text;
  notification_href text;
begin
  if new.event_key = 'email_dead_lettered' then
    notification_kind := 'failed_email';
  elsif new.event_key = 'funnel_error' and new.properties->>'action' = 'booking' then
    notification_kind := 'failed_booking';
  else
    return new;
  end if;

  select c.* into matched_contact
  from public.contacts c
  where c.id = new.contact_id
     or (new.contact_id is null and new.email is not null and c.email = new.email)
  order by (c.id = new.contact_id) desc
  limit 1;

  if notification_kind = 'failed_email' then
    notification_title := 'Email permanently failed';
    notification_subtitle := coalesce(matched_contact.name, new.email::text, 'Unknown contact');
    notification_href := case when matched_contact.id is null
      then '/crm/sequences'
      else '/crm/contacts/' || matched_contact.id::text
    end;
  else
    notification_title := 'Booking attempt failed';
    notification_subtitle := coalesce(matched_contact.name, new.email::text, 'Unknown visitor');
    notification_href := case when matched_contact.id is null
      then '/crm/calendar'
      else '/crm/contacts/' || matched_contact.id::text
    end;
  end if;

  insert into public.crm_notifications (
    user_id, source_key, kind, title, subtitle, href, tone, contact_id
  )
  select
    u.user_id,
    notification_kind || ':' || new.id::text,
    notification_kind,
    notification_title,
    notification_subtitle,
    notification_href,
    'danger',
    matched_contact.id
  from public.crm_users u
  on conflict (user_id, source_key) do nothing;

  return new;
end;
$$;

drop trigger if exists events_create_failed_operation_notifications on public.events;
create trigger events_create_failed_operation_notifications
after insert on public.events
for each row execute function public.notify_crm_users_of_failed_operation();

revoke all on function public.notify_crm_users_of_failed_operation() from public;

insert into public.crm_notifications (
  user_id, source_key, kind, title, subtitle, href, tone, contact_id
)
select
  u.user_id,
  case when e.event_key = 'email_dead_lettered' then 'failed_email' else 'failed_booking' end || ':' || e.id::text,
  case when e.event_key = 'email_dead_lettered' then 'failed_email' else 'failed_booking' end,
  case when e.event_key = 'email_dead_lettered' then 'Email permanently failed' else 'Booking attempt failed' end,
  coalesce(c.name, e.email::text, 'Unknown visitor'),
  case when c.id is null
    then case when e.event_key = 'email_dead_lettered' then '/crm/sequences' else '/crm/calendar' end
    else '/crm/contacts/' || c.id::text
  end,
  'danger',
  c.id
from public.events e
cross join public.crm_users u
left join public.contacts c
  on c.id = e.contact_id or (e.contact_id is null and c.email = e.email)
where e.event_key = 'email_dead_lettered'
   or (e.event_key = 'funnel_error' and e.properties->>'action' = 'booking')
on conflict (user_id, source_key) do nothing;
