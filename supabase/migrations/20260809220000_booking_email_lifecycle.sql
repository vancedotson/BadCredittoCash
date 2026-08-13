alter table public.scheduled_messages
  add column if not exists payload jsonb not null default '{}'::jsonb;

create or replace function public.enqueue_funnel_sequence(p_email text, p_sequence_key text, p_messages jsonb)
returns public.sequence_enrollments
language plpgsql security definer set search_path = ''
as $$
declare
  normalized_email text := lower(trim(p_email));
  matched_contact_id uuid;
  enrollment public.sequence_enrollments;
  message jsonb;
  target_rank integer;
  allowed_sequences constant text[] := array['pre_webinar','nurture','onboarding','registered_no_show','low_watch','mid_watch','high_watch','offer_click_no_book','booking_abandon'];
begin
  if not (p_sequence_key = any(allowed_sequences)) then raise exception 'invalid_sequence'; end if;
  if jsonb_typeof(p_messages) <> 'array' or jsonb_array_length(p_messages) > 20 then raise exception 'invalid_messages'; end if;
  select id into matched_contact_id from public.contacts where email = normalized_email;
  if matched_contact_id is null then raise exception 'contact_not_found'; end if;

  target_rank := case p_sequence_key
    when 'pre_webinar' then 0 when 'registered_no_show' then 0
    when 'low_watch' then 1 when 'mid_watch' then 2 when 'high_watch' then 3
    when 'offer_click_no_book' then 4 when 'booking_abandon' then 5
    when 'onboarding' then 10 else 0 end;

  select * into enrollment
  from public.sequence_enrollments
  where contact_id = matched_contact_id and status = 'active'
    and (case sequence_key
      when 'pre_webinar' then 0 when 'registered_no_show' then 0
      when 'low_watch' then 1 when 'mid_watch' then 2 when 'high_watch' then 3
      when 'offer_click_no_book' then 4 when 'booking_abandon' then 5
      when 'onboarding' then 10 else 0 end) >= target_rank
  order by (case sequence_key
      when 'pre_webinar' then 0 when 'registered_no_show' then 0
      when 'low_watch' then 1 when 'mid_watch' then 2 when 'high_watch' then 3
      when 'offer_click_no_book' then 4 when 'booking_abandon' then 5
      when 'onboarding' then 10 else 0 end) desc
  limit 1;
  if enrollment.id is not null and enrollment.sequence_key <> p_sequence_key then return enrollment; end if;

  if target_rank between 1 and 10 then
    update public.scheduled_messages set status = 'cancelled', updated_at = now()
    where contact_id = matched_contact_id and status = 'scheduled'
      and enrollment_id in (
        select id from public.sequence_enrollments
        where contact_id = matched_contact_id and status = 'active' and sequence_key <> p_sequence_key
      );
    update public.sequence_enrollments
    set status = 'stopped', stopped_at = now(), stop_reason = case when p_sequence_key = 'onboarding' then 'call_booked' else 'segment_advanced' end
    where contact_id = matched_contact_id and status = 'active' and sequence_key <> p_sequence_key;
  end if;

  if enrollment.id is null then
    insert into public.sequence_enrollments (contact_id, sequence_key)
    values (matched_contact_id, p_sequence_key)
    on conflict (contact_id, sequence_key) do update
    set status = 'active', enrolled_at = now(), stopped_at = null, stop_reason = null
    returning * into enrollment;
  end if;

  for message in select value from jsonb_array_elements(p_messages)
  loop
    if nullif(message->>'templateKey', '') is null or length(message->>'templateKey') > 120
      or (message->>'scheduledFor')::timestamptz < now() - interval '5 minutes'
      or (message->>'scheduledFor')::timestamptz > now() + interval '370 days'
      or pg_column_size(coalesce(message->'payload', '{}'::jsonb)) > 8192
    then raise exception 'invalid_message'; end if;
    insert into public.scheduled_messages (
      enrollment_id, contact_id, template_key, scheduled_for, status,
      attempts, last_error, provider_message_id, sent_at, payload
    ) values (
      enrollment.id, matched_contact_id, message->>'templateKey',
      (message->>'scheduledFor')::timestamptz, 'scheduled', 0, null, null, null,
      coalesce(message->'payload', '{}'::jsonb)
    )
    on conflict (enrollment_id, template_key) do update set
      scheduled_for = excluded.scheduled_for, status = 'scheduled', attempts = 0,
      last_error = null, provider_message_id = null, sent_at = null,
      payload = excluded.payload, updated_at = now();
  end loop;
  return enrollment;
end;
$$;

revoke all on function public.enqueue_funnel_sequence(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_funnel_sequence(text, text, jsonb) to service_role;

drop function if exists public.claim_scheduled_email(text, text);
create function public.claim_scheduled_email(p_email text, p_template_key text)
returns table (id uuid, template_key text, payload jsonb)
language plpgsql security definer set search_path = ''
as $$
declare claimed_id uuid;
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
      and public.email_message_is_eligible(queued.contact_id, queued.enrollment_id, queued.template_key)
    order by queued.scheduled_for, queued.id
    for update of queued skip locked limit 1
  ) returning message.id into claimed_id;
  if claimed_id is not null then
    return query select message.id, message.template_key, message.payload
    from public.scheduled_messages as message where message.id = claimed_id;
  end if;
end;
$$;
revoke all on function public.claim_scheduled_email(text, text) from public, anon, authenticated;
grant execute on function public.claim_scheduled_email(text, text) to service_role;

drop function if exists public.claim_due_scheduled_emails(integer);
create function public.claim_due_scheduled_emails(p_limit integer default 10)
returns table (message_id uuid, email text, template_key text, payload jsonb)
language plpgsql security definer set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 10 then raise exception 'invalid_limit'; end if;
  update public.scheduled_messages set status = 'scheduled', updated_at = now()
  where status = 'sending' and updated_at < now() - interval '15 minutes';
  update public.scheduled_messages as message
  set status = 'cancelled', last_error = 'Cancelled at send time: contact no longer eligible', updated_at = now()
  where message.status = 'scheduled' and message.scheduled_for <= now()
    and not public.email_message_is_eligible(message.contact_id, message.enrollment_id, message.template_key);
  return query
  with due as (
    select queued.id from public.scheduled_messages as queued
    where queued.status = 'scheduled' and queued.scheduled_for <= now()
      and public.email_message_is_eligible(queued.contact_id, queued.enrollment_id, queued.template_key)
    order by queued.scheduled_for, queued.id
    for update of queued skip locked limit p_limit
  ), claimed as (
    update public.scheduled_messages as message
    set status = 'sending', attempts = message.attempts + 1, last_error = null, updated_at = now()
    from due where message.id = due.id
    returning message.id, message.contact_id, message.template_key, message.payload
  )
  select claimed.id, contact.email::text, claimed.template_key, claimed.payload
  from claimed join public.contacts as contact on contact.id = claimed.contact_id;
end;
$$;
revoke all on function public.claim_due_scheduled_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_due_scheduled_emails(integer) to service_role;

create or replace function public.reschedule_booking_and_notify(
  p_booking_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_reminder_at timestamptz
)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare booking public.bookings; matched_enrollment_id uuid; message_payload jsonb;
begin
  if p_starts_at <= now() or p_starts_at > now() + interval '45 days'
    or p_ends_at <> p_starts_at + interval '30 minutes'
    or p_reminder_at < now() - interval '5 minutes'
  then raise exception 'invalid_booking_time'; end if;
  update public.bookings set starts_at = p_starts_at, ends_at = p_ends_at, updated_at = now()
  where id = p_booking_id and status in ('pending','confirmed') returning * into booking;
  if booking.id is null then raise exception 'booking_not_found'; end if;
  select id into matched_enrollment_id from public.sequence_enrollments
  where contact_id = booking.contact_id and sequence_key = 'onboarding';
  if matched_enrollment_id is null then
    insert into public.sequence_enrollments(contact_id,sequence_key)
    values(booking.contact_id,'onboarding') returning id into matched_enrollment_id;
  end if;
  message_payload := jsonb_build_object('bookingId',booking.id,'startsAt',booking.starts_at,'timezone',booking.timezone);
  update public.scheduled_messages as message set status='cancelled',updated_at=now()
  where message.enrollment_id=matched_enrollment_id and message.status='scheduled'
    and (message.template_key='onboarding:2' or message.template_key like 'booking_reminder:%');
  insert into public.scheduled_messages(enrollment_id,contact_id,template_key,scheduled_for,payload)
  values(matched_enrollment_id,booking.contact_id,'booking_rescheduled:'||booking.id::text||':'||gen_random_uuid()::text,now(),message_payload);
  insert into public.scheduled_messages(enrollment_id,contact_id,template_key,scheduled_for,payload)
  values(matched_enrollment_id,booking.contact_id,'booking_reminder:'||booking.id::text||':'||gen_random_uuid()::text,p_reminder_at,message_payload);
  insert into public.events(event_key,contact_id,email,properties)
  select 'call_rescheduled',booking.contact_id,contact.email,jsonb_build_object('startsAt',booking.starts_at,'timezone',booking.timezone)
  from public.contacts as contact where contact.id=booking.contact_id;
  return booking;
end;
$$;

create or replace function public.cancel_booking_and_notify(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare booking public.bookings; matched_enrollment_id uuid; message_payload jsonb;
begin
  update public.bookings set status='cancelled',updated_at=now()
  where id=p_booking_id and status in ('pending','confirmed') returning * into booking;
  if booking.id is null then raise exception 'booking_not_found'; end if;
  select id into matched_enrollment_id from public.sequence_enrollments
  where contact_id=booking.contact_id and sequence_key='onboarding';
  if matched_enrollment_id is null then
    insert into public.sequence_enrollments(contact_id,sequence_key)
    values(booking.contact_id,'onboarding') returning id into matched_enrollment_id;
  end if;
  message_payload := jsonb_build_object('bookingId',booking.id,'startsAt',booking.starts_at,'timezone',booking.timezone);
  update public.scheduled_messages as message set status='cancelled',updated_at=now()
  where message.enrollment_id=matched_enrollment_id and message.status='scheduled';
  insert into public.scheduled_messages(enrollment_id,contact_id,template_key,scheduled_for,payload)
  values(matched_enrollment_id,booking.contact_id,'booking_cancelled:'||booking.id::text||':'||gen_random_uuid()::text,now(),message_payload);
  insert into public.events(event_key,contact_id,email,properties)
  select 'call_cancelled',booking.contact_id,contact.email,jsonb_build_object('startsAt',booking.starts_at,'timezone',booking.timezone)
  from public.contacts as contact where contact.id=booking.contact_id;
  return booking;
end;
$$;

revoke all on function public.reschedule_booking_and_notify(uuid,timestamptz,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.cancel_booking_and_notify(uuid) from public,anon,authenticated;
grant execute on function public.reschedule_booking_and_notify(uuid,timestamptz,timestamptz,timestamptz) to service_role;
grant execute on function public.cancel_booking_and_notify(uuid) to service_role;
