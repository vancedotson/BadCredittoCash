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

  -- A repeat event is a no-op, and late-arriving shallower events cannot move a
  -- contact backwards or reset the clock on a deeper active sequence.
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
  if enrollment.id is not null then return enrollment; end if;

  -- Advancing through the funnel stops earlier, incompatible follow-up.
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
