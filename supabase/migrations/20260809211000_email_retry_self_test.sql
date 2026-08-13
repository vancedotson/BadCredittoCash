do $$
declare
  enrollment public.sequence_enrollments;
  retry_message_id uuid;
  failed_message_id uuid;
  retry_result record;
  failed_result record;
begin
  select * into enrollment
  from public.sequence_enrollments
  order by enrolled_at
  limit 1;

  if enrollment.id is null then
    raise exception 'retry_self_test_requires_enrollment';
  end if;

  insert into public.scheduled_messages (
    enrollment_id, contact_id, template_key, scheduled_for, status, attempts
  ) values (
    enrollment.id, enrollment.contact_id, '__retry_self_test__:1', now(), 'sending', 1
  ) returning id into retry_message_id;

  select * into retry_result
  from public.fail_scheduled_email(retry_message_id, 'Synthetic transient error', true, 3);

  if retry_result.outcome <> 'retrying'
    or retry_result.attempts <> 1
    or retry_result.retry_at <= now()
    or not exists (
      select 1 from public.scheduled_messages
      where id = retry_message_id and status = 'scheduled' and attempts = 1
    )
  then
    raise exception 'retry_self_test_failed';
  end if;

  insert into public.scheduled_messages (
    enrollment_id, contact_id, template_key, scheduled_for, status, attempts
  ) values (
    enrollment.id, enrollment.contact_id, '__retry_self_test__:2', now(), 'sending', 1
  ) returning id into failed_message_id;

  select * into failed_result
  from public.fail_scheduled_email(failed_message_id, 'Synthetic permanent error', false, 3);

  if failed_result.outcome <> 'failed'
    or failed_result.attempts <> 1
    or not exists (
      select 1 from public.scheduled_messages
      where id = failed_message_id and status = 'failed' and attempts = 1
    )
  then
    raise exception 'dead_letter_self_test_failed';
  end if;

  delete from public.events
  where client_event_id in (
    'email-retry:' || retry_message_id::text || ':1',
    'email-dead-letter:' || failed_message_id::text
  );
  delete from public.scheduled_messages
  where id in (retry_message_id, failed_message_id);
end;
$$;
