alter table public.crm_notifications
  drop constraint if exists crm_notifications_kind_check;

alter table public.crm_notifications
  add constraint crm_notifications_kind_check
  check (kind in (
    'overdue', 'cooling', 'nofollow', 'booking', 'high_intent',
    'failed_email', 'failed_booking', 'new_lead'
  ));

create or replace function public.notify_crm_users_of_new_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.crm_notifications (
    user_id, source_key, kind, title, subtitle, href, tone, contact_id
  )
  select
    user_row.user_id,
    'new_lead:' || new.id::text,
    'new_lead',
    new.name || ' is a new lead',
    new.email::text,
    '/crm/contacts/' || new.id::text,
    'neutral',
    new.id
  from public.crm_users user_row
  on conflict (user_id, source_key) do nothing;

  return new;
end;
$$;

drop trigger if exists contacts_create_new_lead_notifications on public.contacts;
create trigger contacts_create_new_lead_notifications
after insert on public.contacts
for each row execute function public.notify_crm_users_of_new_lead();

revoke all on function public.notify_crm_users_of_new_lead() from public;
