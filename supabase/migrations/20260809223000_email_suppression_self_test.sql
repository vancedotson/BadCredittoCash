do $$
declare
  test_contact_id uuid;
  test_enrollment_id uuid;
  test_provider_message_id text := 'self-test-' || gen_random_uuid()::text;
  test_event_id text := 'self-test-' || gen_random_uuid()::text;
begin
  insert into public.contacts (
    email, name, source, marketing_consent, consent_version, consent_at
  ) values (
    '__email_suppression_self_test__@example.invalid',
    'Email suppression self-test',
    'self_test',
    true,
    'self-test',
    now()
  ) returning id into test_contact_id;

  insert into public.sequence_enrollments (contact_id, sequence_key)
  values (test_contact_id, 'pre_webinar')
  returning id into test_enrollment_id;

  insert into public.scheduled_messages (
    enrollment_id, contact_id, template_key, scheduled_for, status,
    attempts, provider_message_id, sent_at
  ) values (
    test_enrollment_id, test_contact_id, 'pre_webinar:1', now(), 'sent',
    1, test_provider_message_id, now()
  );

  insert into public.scheduled_messages (
    enrollment_id, contact_id, template_key, scheduled_for, status
  ) values (
    test_enrollment_id, test_contact_id, 'pre_webinar:2', now() + interval '1 hour', 'scheduled'
  );

  if not public.apply_resend_email_event(
    test_event_id,
    'email.bounced',
    test_provider_message_id,
    now(),
    jsonb_build_object('reason', 'Automated suppression self-test'),
    true
  ) then
    raise exception 'email suppression self-test: provider event was not applied';
  end if;

  if not exists (
    select 1 from public.contacts
    where id = test_contact_id
      and email_suppressed_at is not null
      and email_suppression_reason = 'bounced'
      and marketing_consent = false
  ) then
    raise exception 'email suppression self-test: contact was not suppressed';
  end if;

  if not exists (
    select 1 from public.sequence_enrollments
    where id = test_enrollment_id
      and status = 'stopped'
      and stop_reason = 'email_suppressed'
  ) then
    raise exception 'email suppression self-test: enrollment was not stopped';
  end if;

  if exists (
    select 1 from public.scheduled_messages
    where contact_id = test_contact_id and status = 'scheduled'
  ) then
    raise exception 'email suppression self-test: queued email was not cancelled';
  end if;

  if not exists (
    select 1 from public.events
    where contact_id = test_contact_id and event_key = 'email_bounced'
  ) then
    raise exception 'email suppression self-test: CRM event was not recorded';
  end if;

  delete from public.email_provider_events where provider_event_id = test_event_id;
  delete from public.events where contact_id = test_contact_id;
  delete from public.contacts where id = test_contact_id;
end;
$$;
