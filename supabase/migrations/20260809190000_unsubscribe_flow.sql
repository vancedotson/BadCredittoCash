create or replace function public.unsubscribe_contact_from_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_contact_id uuid;
  matched_email public.citext;
begin
  select contact.id, contact.email
  into matched_contact_id, matched_email
  from public.scheduled_messages as message
  join public.contacts as contact on contact.id = message.contact_id
  where message.id = p_message_id;

  if matched_contact_id is null then return false; end if;

  update public.contacts
  set marketing_consent = false,
      unsubscribed_at = coalesce(unsubscribed_at, now()),
      updated_at = now()
  where id = matched_contact_id;

  update public.scheduled_messages as message
  set status = 'cancelled',
      last_error = 'Cancelled after unsubscribe',
      updated_at = now()
  where message.contact_id = matched_contact_id
    and message.status in ('scheduled', 'failed')
    and message.enrollment_id in (
      select enrollment.id
      from public.sequence_enrollments as enrollment
      where enrollment.contact_id = matched_contact_id
        and enrollment.sequence_key <> 'onboarding'
    );

  update public.sequence_enrollments
  set status = 'stopped', stopped_at = now(), stop_reason = 'unsubscribed'
  where contact_id = matched_contact_id
    and status = 'active'
    and sequence_key <> 'onboarding';

  insert into public.events (event_key, contact_id, email, client_event_id, properties)
  values (
    'email_unsubscribed', matched_contact_id, matched_email,
    'unsubscribe:' || matched_contact_id::text,
    jsonb_build_object('source', 'email_link')
  )
  on conflict (client_event_id) do nothing;

  return true;
end;
$$;

revoke all on function public.unsubscribe_contact_from_message(uuid)
from public, anon, authenticated;
grant execute on function public.unsubscribe_contact_from_message(uuid)
to service_role;

