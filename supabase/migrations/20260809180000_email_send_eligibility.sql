alter table public.contacts
  add column if not exists email_suppressed_at timestamptz,
  add column if not exists email_suppression_reason text,
  add column if not exists unsubscribed_at timestamptz;

create index if not exists contacts_email_suppressed_idx
on public.contacts (email_suppressed_at)
where email_suppressed_at is not null;

create or replace function public.email_message_is_eligible(
  p_contact_id uuid,
  p_enrollment_id uuid,
  p_template_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select contact.email_suppressed_at is null
      and enrollment.status = 'active'
      and (
        enrollment.sequence_key = 'onboarding'
        or p_template_key = 'pre_webinar:1'
        or contact.marketing_consent = true
      )
      and not (
        enrollment.sequence_key <> 'onboarding'
        and exists (
          select 1 from public.events as event
          where event.contact_id = contact.id and event.event_key = 'call_booked'
        )
      )
      and not (
        enrollment.sequence_key = 'pre_webinar'
        and p_template_key <> 'pre_webinar:1'
        and exists (
          select 1 from public.events as event
          where event.contact_id = contact.id
            and event.event_key in (
              'webinar_room_opened', 'webinar_watch_25', 'webinar_watch_50',
              'webinar_watch_75', 'webinar_watch_90', 'webinar_completed'
            )
        )
      )
    from public.contacts as contact
    join public.sequence_enrollments as enrollment
      on enrollment.id = p_enrollment_id and enrollment.contact_id = contact.id
    where contact.id = p_contact_id
  ), false);
$$;

revoke all on function public.email_message_is_eligible(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.email_message_is_eligible(uuid, uuid, text)
to service_role;

create or replace function public.claim_scheduled_email(p_email text, p_template_key text)
returns table (id uuid, template_key text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_id uuid;
begin
  update public.scheduled_messages as message
  set status = 'sending', attempts = message.attempts + 1,
      last_error = null, updated_at = now()
  where message.id = (
    select queued.id
    from public.scheduled_messages as queued
    join public.contacts as contact on contact.id = queued.contact_id
    where contact.email = lower(trim(p_email))
      and queued.template_key = p_template_key
      and queued.status = 'scheduled'
      and queued.scheduled_for <= now() + interval '1 minute'
      and public.email_message_is_eligible(
        queued.contact_id, queued.enrollment_id, queued.template_key
      )
    order by queued.scheduled_for, queued.id
    for update of queued skip locked
    limit 1
  )
  returning message.id into claimed_id;

  if claimed_id is not null then
    return query select claimed_id, p_template_key;
  end if;
end;
$$;

revoke all on function public.claim_scheduled_email(text, text)
from public, anon, authenticated;
grant execute on function public.claim_scheduled_email(text, text)
to service_role;

create or replace function public.claim_due_scheduled_emails(p_limit integer default 10)
returns table (message_id uuid, email text, template_key text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 10 then
    raise exception 'invalid_limit';
  end if;

  update public.scheduled_messages
  set status = 'scheduled', updated_at = now()
  where status = 'sending' and updated_at < now() - interval '15 minutes';

  update public.scheduled_messages as message
  set status = 'cancelled',
      last_error = 'Cancelled at send time: contact no longer eligible',
      updated_at = now()
  where message.status = 'scheduled'
    and message.scheduled_for <= now()
    and not public.email_message_is_eligible(
      message.contact_id, message.enrollment_id, message.template_key
    );

  return query
  with due as (
    select queued.id
    from public.scheduled_messages as queued
    where queued.status = 'scheduled'
      and queued.scheduled_for <= now()
      and public.email_message_is_eligible(
        queued.contact_id, queued.enrollment_id, queued.template_key
      )
    order by queued.scheduled_for, queued.id
    for update of queued skip locked
    limit p_limit
  ), claimed as (
    update public.scheduled_messages as message
    set status = 'sending', attempts = message.attempts + 1,
        last_error = null, updated_at = now()
    from due
    where message.id = due.id
    returning message.id, message.contact_id, message.template_key
  )
  select claimed.id, contact.email::text, claimed.template_key
  from claimed
  join public.contacts as contact on contact.id = claimed.contact_id;
end;
$$;

revoke all on function public.claim_due_scheduled_emails(integer)
from public, anon, authenticated;
grant execute on function public.claim_due_scheduled_emails(integer)
to service_role;

