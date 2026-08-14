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

  return query
  with due as (
    select queued.id
    from public.scheduled_messages as queued
    join public.sequence_enrollments as enrollment on enrollment.id = queued.enrollment_id
    where queued.status = 'scheduled'
      and queued.scheduled_for <= now()
      and enrollment.status = 'active'
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

