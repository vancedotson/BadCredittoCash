create unique index if not exists sequence_enrollments_contact_sequence_unique
on public.sequence_enrollments (contact_id, sequence_key);

create unique index if not exists scheduled_messages_enrollment_template_unique
on public.scheduled_messages (enrollment_id, template_key);

create or replace function public.enqueue_funnel_sequence(p_email text, p_sequence_key text, p_messages jsonb)
returns public.sequence_enrollments
language plpgsql security definer set search_path = ''
as $$
declare
  normalized_email text := lower(trim(p_email));
  matched_contact_id uuid;
  enrollment public.sequence_enrollments;
  message jsonb;
  allowed_sequences constant text[] := array['pre_webinar','nurture','onboarding','registered_no_show','low_watch','mid_watch','high_watch','offer_click_no_book','booking_abandon'];
begin
  if not (p_sequence_key = any(allowed_sequences)) then raise exception 'invalid_sequence'; end if;
  if jsonb_typeof(p_messages) <> 'array' or jsonb_array_length(p_messages) > 20 then raise exception 'invalid_messages'; end if;
  select id into matched_contact_id from public.contacts where email = normalized_email;
  if matched_contact_id is null then raise exception 'contact_not_found'; end if;

  if p_sequence_key = 'onboarding' then
    update public.sequence_enrollments set status = 'stopped', stopped_at = now(), stop_reason = 'call_booked'
    where contact_id = matched_contact_id and status = 'active' and sequence_key <> 'onboarding';
    update public.scheduled_messages set status = 'cancelled', updated_at = now()
    where contact_id = matched_contact_id and status = 'scheduled';
  end if;

  insert into public.sequence_enrollments (contact_id, sequence_key)
  values (matched_contact_id, p_sequence_key)
  on conflict (contact_id, sequence_key) do update
  set status = 'active', enrolled_at = now(), stopped_at = null, stop_reason = null
  returning * into enrollment;

  for message in select value from jsonb_array_elements(p_messages)
  loop
    if nullif(message->>'templateKey', '') is null or length(message->>'templateKey') > 120
      or (message->>'scheduledFor')::timestamptz < now() - interval '5 minutes'
      or (message->>'scheduledFor')::timestamptz > now() + interval '370 days'
    then raise exception 'invalid_message'; end if;
    insert into public.scheduled_messages (enrollment_id, contact_id, template_key, scheduled_for, status, attempts, last_error, provider_message_id, sent_at)
    values (enrollment.id, matched_contact_id, message->>'templateKey', (message->>'scheduledFor')::timestamptz, 'scheduled', 0, null, null, null)
    on conflict (enrollment_id, template_key) do update set
      scheduled_for = excluded.scheduled_for, status = 'scheduled', attempts = 0,
      last_error = null, provider_message_id = null, sent_at = null, updated_at = now();
  end loop;
  return enrollment;
end;
$$;

revoke all on function public.enqueue_funnel_sequence(text, text, jsonb) from public;
grant execute on function public.enqueue_funnel_sequence(text, text, jsonb) to anon, authenticated;
