alter table public.crm_notifications
  drop constraint if exists crm_notifications_kind_check;

alter table public.crm_notifications
  add constraint crm_notifications_kind_check
  check (kind in ('overdue', 'cooling', 'nofollow', 'booking', 'high_intent'));

create or replace function public.notify_crm_users_of_high_intent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_contact public.contacts%rowtype;
  signal_label text;
begin
  if new.event_key not in (
    'webinar_watch_75',
    'webinar_watch_90',
    'webinar_completed',
    'offer_cta_clicked',
    'call_booking_started'
  ) then
    return new;
  end if;

  select c.*
  into matched_contact
  from public.contacts c
  where c.id = new.contact_id
     or (new.contact_id is null and new.email is not null and c.email = new.email)
  order by (c.id = new.contact_id) desc
  limit 1;

  if matched_contact.id is null then
    return new;
  end if;

  signal_label := case new.event_key
    when 'webinar_watch_75' then 'Watched 75% of the training'
    when 'webinar_watch_90' then 'Watched 90% of the training'
    when 'webinar_completed' then 'Finished the training'
    when 'offer_cta_clicked' then 'Clicked to book a call'
    when 'call_booking_started' then 'Started booking a call'
  end;

  insert into public.crm_notifications (
    user_id,
    source_key,
    kind,
    title,
    subtitle,
    href,
    tone,
    contact_id
  )
  select
    u.user_id,
    'high-intent:' || matched_contact.id::text,
    'high_intent',
    matched_contact.name || ' is showing high intent',
    signal_label,
    '/crm/contacts/' || matched_contact.id::text,
    'success',
    matched_contact.id
  from public.crm_users u
  on conflict (user_id, source_key) do nothing;

  return new;
end;
$$;

drop trigger if exists events_create_high_intent_notifications on public.events;
create trigger events_create_high_intent_notifications
after insert on public.events
for each row execute function public.notify_crm_users_of_high_intent();

revoke all on function public.notify_crm_users_of_high_intent() from public;
