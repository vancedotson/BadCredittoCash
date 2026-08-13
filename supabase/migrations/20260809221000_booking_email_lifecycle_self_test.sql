do $$
declare
  test_contact_id uuid;
  test_booking_id uuid;
  rescheduled_start timestamptz := date_trunc('minute', now()) + interval '40 days 7 hours 17 minutes';
  rescheduled_end timestamptz;
begin
  rescheduled_end := rescheduled_start + interval '30 minutes';

  insert into public.contacts (email, name, source, marketing_consent)
  values ('__booking_email_self_test__@example.invalid', 'Booking email self-test', 'self_test', true)
  returning id into test_contact_id;

  insert into public.bookings (contact_id, starts_at, ends_at, timezone, status)
  values (
    test_contact_id,
    rescheduled_start - interval '1 day',
    rescheduled_end - interval '1 day',
    'Europe/Lisbon',
    'confirmed'
  )
  returning id into test_booking_id;

  perform public.reschedule_booking_and_notify(
    test_booking_id,
    rescheduled_start,
    rescheduled_end,
    now() + interval '5 minutes'
  );

  if not exists (
    select 1
    from public.scheduled_messages
    where contact_id = test_contact_id
      and template_key like 'booking_rescheduled:%'
      and status = 'scheduled'
      and payload->>'bookingId' = test_booking_id::text
      and payload->>'timezone' = 'Europe/Lisbon'
  ) then
    raise exception 'booking lifecycle self-test: reschedule email was not queued';
  end if;

  if not exists (
    select 1
    from public.scheduled_messages
    where contact_id = test_contact_id
      and template_key like 'booking_reminder:%'
      and status = 'scheduled'
      and payload->>'startsAt' is not null
  ) then
    raise exception 'booking lifecycle self-test: reminder email was not queued';
  end if;

  perform public.cancel_booking_and_notify(test_booking_id);

  if not exists (
    select 1 from public.bookings
    where id = test_booking_id and status = 'cancelled'
  ) then
    raise exception 'booking lifecycle self-test: booking was not cancelled';
  end if;

  if exists (
    select 1
    from public.scheduled_messages
    where contact_id = test_contact_id
      and template_key like 'booking_reminder:%'
      and status = 'scheduled'
  ) then
    raise exception 'booking lifecycle self-test: reminder remained scheduled after cancellation';
  end if;

  if not exists (
    select 1
    from public.scheduled_messages
    where contact_id = test_contact_id
      and template_key like 'booking_cancelled:%'
      and status = 'scheduled'
  ) then
    raise exception 'booking lifecycle self-test: cancellation email was not queued';
  end if;

  if (select count(*) from public.events
      where contact_id = test_contact_id
        and event_key in ('call_rescheduled', 'call_cancelled')) <> 2 then
    raise exception 'booking lifecycle self-test: lifecycle events were not recorded';
  end if;

  delete from public.events where contact_id = test_contact_id;
  delete from public.contacts where id = test_contact_id;
end;
$$;
