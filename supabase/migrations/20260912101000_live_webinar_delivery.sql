-- Legacy APIs remain callable with their existing arguments and results.
-- Their progression now touches only legacy enrollments.
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
  where contact_id = matched_contact_id and context_key = 'legacy' and status = 'active'
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
        where contact_id = matched_contact_id and context_key = 'legacy' and status = 'active' and sequence_key <> p_sequence_key
      );
    update public.sequence_enrollments
    set status = 'stopped', stopped_at = now(), stop_reason = case when p_sequence_key = 'onboarding' then 'call_booked' else 'segment_advanced' end
    where contact_id = matched_contact_id and context_key = 'legacy' and status = 'active' and sequence_key <> p_sequence_key;
  end if;

  if enrollment.id is null then
    insert into public.sequence_enrollments (contact_id, sequence_key)
    values (matched_contact_id, p_sequence_key)
    on conflict (contact_id, sequence_key, context_key) do update
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
    on conflict (enrollment_id, delivery_key) do update set
      scheduled_for = excluded.scheduled_for, status = 'scheduled', attempts = 0,
      last_error = null, provider_message_id = null, sent_at = null,
      payload = excluded.payload, updated_at = now()
    where public.scheduled_messages.status not in ('sent','sending');
  end loop;
  return enrollment;
end;
$$;

revoke all on function public.enqueue_funnel_sequence(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_funnel_sequence(text, text, jsonb) to service_role;

create or replace function public.email_message_is_eligible(p_contact_id uuid,p_enrollment_id uuid,p_template_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select c.email_suppressed_at is null and e.status = 'active' and (
    (e.context_key = 'legacy'
      and (e.sequence_key = 'onboarding' or p_template_key = 'pre_webinar:1' or (c.marketing_consent and c.unsubscribed_at is null))
      and not (e.sequence_key <> 'onboarding' and exists (select 1 from public.events v where v.contact_id=c.id and v.event_key='call_booked'))
      and not (e.sequence_key='pre_webinar' and p_template_key <> 'pre_webinar:1' and exists (
        select 1 from public.events v where v.contact_id=c.id and coalesce(v.properties->>'funnel','') <> 'live'
        and v.event_key in ('webinar_room_opened','webinar_watch_25','webinar_watch_50','webinar_watch_75','webinar_watch_90','webinar_completed')
      )))
    or (e.live_registration_id is not null and exists (
      select 1 from public.live_webinar_registrations r join public.live_webinar_sessions s on s.id=r.session_id
      where r.id=e.live_registration_id and r.contact_id=c.id and r.cancelled_at is null
        and not r.notifications_paused and s.automation_enabled
        and ((p_template_key in ('live_confirmation:1','live_reminder_day:1','live_reminder_soon:1','live_rescheduled:1') and s.status='scheduled')
          or (p_template_key='live_cancelled:1' and s.status='cancelled')
          or (p_template_key in ('live_attended:1','live_no_show:1','live_replay:1') and s.status='scheduled'
            and c.marketing_consent and c.unsubscribed_at is null and c.stage not in ('won','lost','booked','call_booked')
            and not exists (select 1 from public.events v where v.contact_id=c.id and v.event_key='call_booked')))
    ))
  ) from public.contacts c join public.sequence_enrollments e on e.contact_id=c.id and e.id=p_enrollment_id
    where c.id=p_contact_id),false);
$$;

-- Exact-message eligibility also protects postponed sessions and expired retries.
-- The worker calls this again immediately before handing a message to Resend.
create function public.email_message_is_eligible_v2(p_message_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select public.email_message_is_eligible(m.contact_id,m.enrollment_id,m.template_key)
    and (e.context_key='legacy' or (
      m.payload->>'registrationId'=r.id::text and m.payload->>'sessionId'=s.id::text
      and m.payload->>'accessVersion'=r.access_version::text
      and m.payload->>'sessionVersion'=s.schedule_version::text
      and (nullif(m.payload->>'sendDeadline','') is null or (m.payload->>'sendDeadline')::timestamptz>now())
      and case m.template_key
        when 'live_confirmation:1' then now()<s.ends_at
        when 'live_reminder_day:1' then now()<s.starts_at-interval '15 minutes'
        when 'live_reminder_soon:1' then now()<s.starts_at
        when 'live_rescheduled:1' then now()<s.ends_at
        when 'live_cancelled:1' then s.status='cancelled'
        when 'live_attended:1' then now()>=s.ends_at+make_interval(mins=>s.attendance_grace_minutes) and r.attended_at is not null
        when 'live_no_show:1' then now()>=s.ends_at+make_interval(mins=>s.attendance_grace_minutes) and r.attended_at is null
        when 'live_replay:1' then s.replay_published and s.replay_url is not null and now()>=s.ends_at
          and (s.replay_available_until is null or s.replay_available_until>now())
        else false end
    ))
    from public.scheduled_messages m join public.sequence_enrollments e on e.id=m.enrollment_id
    left join public.live_webinar_registrations r on r.id=e.live_registration_id
    left join public.live_webinar_sessions s on s.id=r.session_id where m.id=p_message_id),false);
$$;

create function public.enqueue_live_webinar_message_v1(p_registration_id uuid,p_template_key text,p_delivery_key text,p_scheduled_for timestamptz,p_deadline timestamptz default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.live_webinar_registrations; s public.live_webinar_sessions; e_id uuid; result uuid; message_payload jsonb;
begin
  select * into r from public.live_webinar_registrations where id=p_registration_id;
  select * into s from public.live_webinar_sessions where id=r.session_id;
  if r.id is null or s.id is null then raise exception 'live_registration_not_found'; end if;
  insert into public.sequence_enrollments(contact_id,sequence_key,context_key,live_registration_id)
    values(r.contact_id,'live_webinar','live:'||r.id::text,r.id)
    on conflict(contact_id,sequence_key,context_key) do nothing;
  select id into e_id from public.sequence_enrollments where live_registration_id=r.id;
  message_payload := jsonb_build_object('funnel','live','registrationId',r.id,'sessionId',s.id,
    'accessVersion',r.access_version,'sessionVersion',s.schedule_version,'title',s.title,
    'startsAt',s.starts_at,'endsAt',s.ends_at,'timezone',s.timezone,'sendDeadline',p_deadline,'replayAvailableUntil',s.replay_available_until);
  insert into public.scheduled_messages(enrollment_id,contact_id,template_key,delivery_key,scheduled_for,payload)
    values(e_id,r.contact_id,p_template_key,p_delivery_key,p_scheduled_for,message_payload)
    on conflict(enrollment_id,delivery_key) do nothing returning id into result;
  return result;
end; $$;

create function public.sync_live_webinar_registration_messages_v1(p_registration_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare r public.live_webinar_registrations; s public.live_webinar_sessions; added integer:=0; message_id uuid; branch text;
begin
  select * into r from public.live_webinar_registrations where id=p_registration_id for update;
  if r.id is null then return 0; end if;
  select * into s from public.live_webinar_sessions where id=r.session_id;
  update public.live_webinar_registrations set last_scheduled_at=clock_timestamp() where id=r.id;
  if r.cancelled_at is not null or r.notifications_paused then return 0; end if;
  -- Revoking a token or changing logistics invalidates pending content but never
  -- changes sent history or attempts to retract an in-flight provider request.
  update public.scheduled_messages m set status='cancelled',last_error='Live session or participant version changed',updated_at=now()
    where m.enrollment_id in (select id from public.sequence_enrollments where live_registration_id=r.id)
      and m.status in ('scheduled','failed')
      and (m.payload->>'sessionVersion'<>s.schedule_version::text or m.payload->>'accessVersion'<>r.access_version::text);
  if s.status='cancelled' then
    message_id:=public.enqueue_live_webinar_message_v1(r.id,'live_cancelled:1','cancelled:'||s.schedule_version,now(),now()+interval '7 days');
    return case when message_id is null then 0 else 1 end;
  end if;
  if s.status<>'scheduled' then return 0; end if;
  if s.schedule_version>r.registered_schedule_version and now()<s.ends_at then
    message_id:=public.enqueue_live_webinar_message_v1(r.id,'live_rescheduled:1','rescheduled:'||s.schedule_version,now(),s.ends_at);
    if message_id is not null then added:=added+1; end if;
  end if;
  if r.registered_at<=s.starts_at-interval '24 hours' and now()<s.starts_at-interval '15 minutes' then
    message_id:=public.enqueue_live_webinar_message_v1(r.id,'live_reminder_day:1','day:'||s.schedule_version,
      s.starts_at-interval '24 hours',least(s.starts_at-interval '15 minutes',s.starts_at-interval '18 hours'));
    if message_id is not null then added:=added+1; end if;
  end if;
  if r.registered_at<=s.starts_at-interval '15 minutes' and now()<s.starts_at then
    message_id:=public.enqueue_live_webinar_message_v1(r.id,'live_reminder_soon:1','soon:'||s.schedule_version,s.starts_at-interval '15 minutes',s.starts_at);
    if message_id is not null then added:=added+1; end if;
  end if;
  if now()>=s.ends_at+make_interval(mins=>s.attendance_grace_minutes) then
    branch:=case when r.attended_at is null then 'live_no_show:1' else 'live_attended:1' end;
    update public.live_webinar_registrations set post_session_outcome=case when r.attended_at is null then 'no_attendance' else 'attended' end where id=r.id;
    message_id:=public.enqueue_live_webinar_message_v1(r.id,branch,'post-session',s.ends_at+make_interval(mins=>s.attendance_grace_minutes),s.ends_at+interval '7 days');
    if message_id is not null then added:=added+1; end if;
    -- Only an unsent, not-yet-claimed branch can change when late evidence arrives.
    update public.scheduled_messages m set template_key=branch
      where m.enrollment_id in (select id from public.sequence_enrollments where live_registration_id=r.id)
        and m.delivery_key='post-session' and m.status='scheduled' and m.template_key<>branch;
  end if;
  if s.replay_published and s.replay_url is not null and now()>=s.ends_at
    and (s.replay_available_until is null or now()<s.replay_available_until) then
    message_id:=public.enqueue_live_webinar_message_v1(r.id,'live_replay:1','replay',now(),coalesce(s.replay_available_until,now()+interval '7 days'));
    if message_id is not null then added:=added+1; end if;
  end if;
  return added;
end; $$;

create function public.sync_live_webinar_messages_v1(p_limit integer default 500)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r_id uuid; processed integer:=0; added integer:=0;
begin
  if p_limit<1 or p_limit>5000 then raise exception 'invalid_limit'; end if;
  for r_id in select r.id from public.live_webinar_registrations r
    join public.live_webinar_sessions s on s.id=r.session_id
    -- Participation reporting must continue while session delivery is disabled.
    -- Durable intents remain paused by the exact-message eligibility predicate.
    where not r.notifications_paused and r.cancelled_at is null and s.status<>'draft'
      and (s.ends_at>now()-interval '30 days' or s.replay_available_until>now()
        or (s.replay_published and s.replay_url is not null and s.replay_available_until is null and not exists (
          select 1 from public.sequence_enrollments e join public.scheduled_messages m on m.enrollment_id=e.id
            where e.live_registration_id=r.id and m.delivery_key='replay'
        )))
    order by r.last_scheduled_at nulls first,r.id for update of r skip locked limit p_limit
  loop added:=added+public.sync_live_webinar_registration_messages_v1(r_id); processed:=processed+1; end loop;
  return jsonb_build_object('processed',processed,'queued',added);
end; $$;

create or replace function public.claim_scheduled_email(p_email text,p_template_key text)
returns table(id uuid,template_key text,payload jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  return query with due as (
    select m.id from public.scheduled_messages m join public.contacts c on c.id=m.contact_id
      join public.sequence_enrollments e on e.id=m.enrollment_id
    where c.email=lower(trim(p_email)) and e.context_key='legacy' and m.template_key=p_template_key
      and m.status='scheduled' and m.scheduled_for<=now()+interval '1 minute'
      and public.email_message_is_eligible_v2(m.id)
    order by m.scheduled_for,m.id for update of m skip locked limit 1
  ) update public.scheduled_messages m set status='sending',attempts=m.attempts+1,last_error=null,updated_at=now()
      from due where m.id=due.id returning m.id,m.template_key,m.payload;
end; $$;

create function public.claim_live_webinar_email_v1(p_registration_id uuid,p_template_key text default 'live_confirmation:1')
returns table(id uuid,template_key text,payload jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  return query with due as (
    select m.id from public.scheduled_messages m join public.sequence_enrollments e on e.id=m.enrollment_id
    where e.live_registration_id=p_registration_id and m.template_key=p_template_key
      and m.status='scheduled' and m.scheduled_for<=now() and public.email_message_is_eligible_v2(m.id)
    order by m.scheduled_for,m.id for update of m skip locked limit 1
  ) update public.scheduled_messages m set status='sending',attempts=m.attempts+1,last_error=null,updated_at=now()
      from due where m.id=due.id returning m.id,m.template_key,m.payload;
end; $$;

create function public.claim_due_scheduled_emails_v2(p_limit integer default 10,p_include_live boolean default false)
returns table(message_id uuid,email text,template_key text,payload jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  if p_limit<1 or p_limit>100 then raise exception 'invalid_limit'; end if;
  update public.scheduled_messages set status='scheduled',updated_at=now()
    where status='sending' and updated_at<now()-interval '15 minutes'
      and (p_include_live or enrollment_id in (select id from public.sequence_enrollments where context_key='legacy'));
  update public.scheduled_messages m set status='cancelled',last_error='Cancelled at send time: no longer eligible',updated_at=now()
    where m.status='scheduled' and m.scheduled_for<=now() and not public.email_message_is_eligible_v2(m.id)
      and (p_include_live or m.enrollment_id in (select id from public.sequence_enrollments where context_key='legacy'))
      -- A disabled session is paused, not permanently consumed by an old worker.
      and not exists (select 1 from public.sequence_enrollments e join public.live_webinar_registrations r on r.id=e.live_registration_id
        join public.live_webinar_sessions s on s.id=r.session_id where e.id=m.enrollment_id and not s.automation_enabled);
  return query with due as (
    select m.id from public.scheduled_messages m where m.status='scheduled' and m.scheduled_for<=now()
      and (p_include_live or m.enrollment_id in (select id from public.sequence_enrollments where context_key='legacy'))
      and public.email_message_is_eligible_v2(m.id) order by m.scheduled_for,m.id for update of m skip locked limit p_limit
  ), claimed as (
    update public.scheduled_messages m set status='sending',attempts=m.attempts+1,last_error=null,updated_at=now()
      from due where m.id=due.id returning m.id,m.contact_id,m.template_key,m.payload
  ) select m.id,c.email::text,m.template_key,m.payload from claimed m join public.contacts c on c.id=m.contact_id;
end; $$;

create or replace function public.claim_due_scheduled_emails(p_limit integer default 10)
returns table(message_id uuid,email text,template_key text,payload jsonb)
language sql security definer set search_path = '' as $$
  select * from public.claim_due_scheduled_emails_v2(p_limit,false);
$$;

create function public.release_scheduled_email_claim_v1(p_message_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.scheduled_messages set status='scheduled',attempts=greatest(attempts-1,0),updated_at=now()
    where id=p_message_id and status='sending' and provider_message_id is null and sent_at is null;
  return found;
end; $$;

-- Marketing unsubscribe leaves requested webinar logistics available. Universal
-- suppression/complaint and manual CRM suppression still stop every context.
create or replace function public.unsubscribe_contact_from_message(p_message_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare c_id uuid; c_email public.citext;
begin
  select c.id,c.email into c_id,c_email from public.scheduled_messages m join public.contacts c on c.id=m.contact_id where m.id=p_message_id;
  if c_id is null then return false; end if;
  update public.contacts set marketing_consent=false,unsubscribed_at=coalesce(unsubscribed_at,now()),updated_at=now() where id=c_id;
  update public.scheduled_messages m set status='cancelled',last_error='Cancelled after unsubscribe',updated_at=now()
    where m.contact_id=c_id and m.status in ('scheduled','failed') and exists (
      select 1 from public.sequence_enrollments e where e.id=m.enrollment_id
        and ((e.context_key='legacy' and e.sequence_key<>'onboarding')
          or (e.live_registration_id is not null and m.template_key in ('live_attended:1','live_no_show:1','live_replay:1'))));
  update public.sequence_enrollments set status='stopped',stopped_at=now(),stop_reason='unsubscribed'
    where contact_id=c_id and status='active' and context_key='legacy' and sequence_key<>'onboarding';
  insert into public.events(event_key,contact_id,email,client_event_id,properties)
    values('email_unsubscribed',c_id,c_email,'unsubscribe:'||c_id::text,jsonb_build_object('source','email_link')) on conflict(client_event_id) do nothing;
  return true;
end; $$;

revoke all on function public.email_message_is_eligible_v2(uuid),public.enqueue_live_webinar_message_v1(uuid,text,text,timestamptz,timestamptz),
  public.sync_live_webinar_registration_messages_v1(uuid),public.sync_live_webinar_messages_v1(integer),public.claim_live_webinar_email_v1(uuid,text),
  public.claim_due_scheduled_emails_v2(integer,boolean),public.release_scheduled_email_claim_v1(uuid)
  from public,anon,authenticated;
grant execute on function public.email_message_is_eligible_v2(uuid),public.sync_live_webinar_messages_v1(integer),public.claim_live_webinar_email_v1(uuid,text),
  public.claim_due_scheduled_emails_v2(integer,boolean),public.release_scheduled_email_claim_v1(uuid) to service_role;
