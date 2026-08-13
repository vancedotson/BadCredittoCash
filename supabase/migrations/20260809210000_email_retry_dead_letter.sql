create or replace function public.fail_scheduled_email(
  p_message_id uuid,
  p_last_error text,
  p_retryable boolean,
  p_max_attempts integer default 3
)
returns table (outcome text, attempts integer, retry_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  message public.scheduled_messages;
  contact_email text;
  next_attempt timestamptz;
begin
  if p_max_attempts < 1 or p_max_attempts > 5 then
    raise exception 'invalid_max_attempts';
  end if;

  select * into message
  from public.scheduled_messages
  where id = p_message_id
  for update;

  if message.id is null or message.status <> 'sending' then
    return;
  end if;

  select email::text into contact_email
  from public.contacts where id = message.contact_id;

  if p_retryable and message.attempts < p_max_attempts then
    next_attempt := now() + case message.attempts
      when 1 then interval '5 minutes'
      when 2 then interval '30 minutes'
      else interval '2 hours'
    end;

    update public.scheduled_messages
    set status = 'scheduled', scheduled_for = next_attempt,
        last_error = left(coalesce(p_last_error, 'Transient delivery error'), 500),
        updated_at = now()
    where id = message.id;

    insert into public.events (
      event_key, contact_id, email, client_event_id, properties
    ) values (
      'email_retry_scheduled', message.contact_id, contact_email,
      'email-retry:' || message.id::text || ':' || message.attempts::text,
      jsonb_build_object(
        'templateKey', message.template_key,
        'attempt', message.attempts,
        'retryAt', next_attempt,
        'reason', left(coalesce(p_last_error, 'Transient delivery error'), 500)
      )
    ) on conflict (client_event_id) do nothing;

    return query select 'retrying'::text, message.attempts, next_attempt;
    return;
  end if;

  update public.scheduled_messages
  set status = 'failed',
      last_error = left(coalesce(p_last_error, 'Permanent delivery error'), 500),
      updated_at = now()
  where id = message.id;

  insert into public.events (
    event_key, contact_id, email, client_event_id, properties
  ) values (
    'email_dead_lettered', message.contact_id, contact_email,
    'email-dead-letter:' || message.id::text,
    jsonb_build_object(
      'templateKey', message.template_key,
      'attempts', message.attempts,
      'retryable', p_retryable,
      'reason', left(coalesce(p_last_error, 'Permanent delivery error'), 500)
    )
  ) on conflict (client_event_id) do nothing;

  return query select 'failed'::text, message.attempts, null::timestamptz;
end;
$$;

revoke all on function public.fail_scheduled_email(uuid, text, boolean, integer)
from public, anon, authenticated;
grant execute on function public.fail_scheduled_email(uuid, text, boolean, integer)
to service_role;

