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
    and (message.template_key='onboarding:2'
      or message.template_key like 'onboarding:2:%'
      or message.template_key like 'booking_reminder:%');
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

revoke all on function public.reschedule_booking_and_notify(uuid,timestamptz,timestamptz,timestamptz)
from public,anon,authenticated;
grant execute on function public.reschedule_booking_and_notify(uuid,timestamptz,timestamptz,timestamptz)
to service_role;
