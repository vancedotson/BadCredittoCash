create function public.register_live_webinar_v1(
  p_session_id uuid,p_name text,p_email text,p_phone text default null,p_visitor_id text default null,
  p_first_touch jsonb default '{}'::jsonb,p_last_touch jsonb default '{}'::jsonb,
  p_marketing_consent boolean default false,p_consent_version text default null,
  p_consent_text text default null,p_consent_country text default null,p_timezone text default 'UTC'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.live_webinar_sessions; c public.contacts; r public.live_webinar_registrations;
  normalized_email text:=lower(trim(p_email)); normalized_visitor text:=nullif(trim(p_visitor_id),'');
begin
  select * into s from public.live_webinar_sessions where id=p_session_id for share;
  if s.id is null or s.status<>'scheduled' or s.ends_at<=now() then raise exception 'live_session_unavailable'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 160 then raise exception 'invalid_name'; end if;
  if normalized_email is null or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(normalized_email)>320 then raise exception 'invalid_email'; end if;
  if p_phone is not null and p_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'invalid_phone'; end if;
  if pg_column_size(coalesce(p_first_touch,'{}'::jsonb))>16384 or pg_column_size(coalesce(p_last_touch,'{}'::jsonb))>16384 then raise exception 'attribution_too_large'; end if;
  if normalized_visitor is not null and length(normalized_visitor)>100 then raise exception 'invalid_visitor_id'; end if;
  if p_consent_version is null or length(p_consent_version) not between 1 and 100 then raise exception 'invalid_consent_version'; end if;
  if p_consent_text is null or length(p_consent_text) not between 1 and 1000 then raise exception 'invalid_consent_text'; end if;
  if p_consent_country is not null and p_consent_country !~ '^[A-Z]{2}$' then raise exception 'invalid_consent_country'; end if;
  if p_timezone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'invalid_timezone'; end if;
  -- Trash is an explicit operator decision; public registration cannot silently
  -- recreate a removed contact or resume their former sequences.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(normalized_email,9120));
  if exists (select 1 from public.contact_trash where email=normalized_email) then raise exception 'contact_unavailable'; end if;
  insert into public.contacts(name,email,phone,source,utm,first_touch,last_touch,stage,stage_mode,
    marketing_consent,consent_version,consent_text,consent_country,consent_at)
    values(trim(p_name),normalized_email,p_phone,'vance-live-webinar',coalesce(p_last_touch,'{}'::jsonb),
      coalesce(p_first_touch,'{}'::jsonb),coalesce(p_last_touch,'{}'::jsonb),'registered','automatic',
      coalesce(p_marketing_consent,false),p_consent_version,p_consent_text,p_consent_country,now())
    on conflict(email) do update set name=excluded.name,phone=coalesce(excluded.phone,public.contacts.phone),
      first_touch=case when public.contacts.first_touch='{}'::jsonb then excluded.first_touch else public.contacts.first_touch end,
      last_touch=excluded.last_touch,
      marketing_consent=case when public.contacts.email_suppressed_at is not null or public.contacts.unsubscribed_at is not null
        then public.contacts.marketing_consent else public.contacts.marketing_consent or excluded.marketing_consent end,
      consent_version=case when excluded.marketing_consent and public.contacts.unsubscribed_at is null and public.contacts.email_suppressed_at is null then excluded.consent_version else public.contacts.consent_version end,
      consent_text=case when excluded.marketing_consent and public.contacts.unsubscribed_at is null and public.contacts.email_suppressed_at is null then excluded.consent_text else public.contacts.consent_text end,
      consent_country=case when excluded.marketing_consent and public.contacts.unsubscribed_at is null and public.contacts.email_suppressed_at is null then excluded.consent_country else public.contacts.consent_country end,
      consent_at=case when excluded.marketing_consent and public.contacts.unsubscribed_at is null and public.contacts.email_suppressed_at is null then now() else public.contacts.consent_at end
    returning * into c;
  insert into public.live_webinar_registrations(contact_id,session_id,registered_schedule_version,attribution,timezone,
    marketing_consent,consent_version,consent_text,consent_country)
    values(c.id,s.id,s.schedule_version,jsonb_build_object('firstTouch',coalesce(p_first_touch,'{}'::jsonb),'lastTouch',coalesce(p_last_touch,'{}'::jsonb)),
      p_timezone,coalesce(p_marketing_consent,false),p_consent_version,p_consent_text,p_consent_country)
    on conflict(contact_id,session_id) do nothing;
  select * into r from public.live_webinar_registrations where contact_id=c.id and session_id=s.id for update;
  if r.cancelled_at is not null then raise exception 'live_registration_cancelled'; end if;
  if normalized_visitor is not null then
    update public.events set contact_id=c.id,email=normalized_email where visitor_id=normalized_visitor and contact_id is null;
  end if;
  insert into public.events(event_key,contact_id,email,visitor_id,client_event_id,properties)
    values('webinar_registered',c.id,c.email,normalized_visitor,'live-registration:'||r.id::text,
      jsonb_build_object('funnel','live','source','vance-live-webinar','sessionId',s.id,'registrationId',r.id,'sessionTitle',s.title,
        'firstTouch',coalesce(p_first_touch,'{}'::jsonb),'lastTouch',coalesce(p_last_touch,'{}'::jsonb),
        'marketingConsent',coalesce(p_marketing_consent,false),'consentVersion',p_consent_version))
    on conflict(client_event_id) do nothing;
  -- A durable joining intent is committed even when delivery is administratively
  -- paused. Retries never reset its status, attempts, or provider receipt.
  perform public.enqueue_live_webinar_message_v1(r.id,'live_confirmation:1','confirmation',r.registered_at,s.ends_at);
  perform public.sync_live_webinar_registration_messages_v1(r.id);
  return jsonb_build_object('contact_id',c.id,'registration_id',r.id,'session_id',s.id,'email',c.email,'access_version',r.access_version);
end; $$;

create function public.update_live_webinar_activity_v1(
  p_registration_id uuid,p_session_id uuid,p_access_version integer,p_event_key text,p_client_event_id text,p_properties jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.live_webinar_registrations; s public.live_webinar_sessions; result uuid; normalized_question text;
  c_email text; event_identity text; in_session boolean;
begin
  if p_event_key is null or p_event_key not in ('webinar_confirmed_view','webinar_room_opened','live_presence','live_question_asked',
    'live_replay_opened','call_page_view','call_booking_started','offer_cta_clicked') then raise exception 'invalid_live_event'; end if;
  if p_client_event_id is null or length(p_client_event_id) not between 1 and 160 then raise exception 'invalid_event_id'; end if;
  if jsonb_typeof(coalesce(p_properties,'{}'::jsonb))<>'object' or pg_column_size(coalesce(p_properties,'{}'::jsonb))>8192 then raise exception 'invalid_properties'; end if;
  select * into s from public.live_webinar_sessions where id=p_session_id for share;
  select * into r from public.live_webinar_registrations where id=p_registration_id and session_id=p_session_id for update;
  if r.id is null or r.access_version is distinct from p_access_version or r.cancelled_at is not null
    or s.id is null or s.status<>'scheduled' then raise exception 'live_participant_unavailable'; end if;
  select email::text into c_email from public.contacts where id=r.contact_id;
  if c_email is null then raise exception 'contact_unavailable'; end if;
  -- Presence records one durable evidence event per participant, while each
  -- verified heartbeat below refreshes the registration's latest presence time.
  -- Other successfully persisted submissions remain acknowledged on a retry
  -- after the room closes. Revocation is still checked above for every request.
  event_identity:='live:'||r.id::text||':'||p_event_key
    ||case when p_event_key='live_presence' then '' else ':'||md5(p_client_event_id) end;
  select id into result from public.events where client_event_id=event_identity;
  if result is not null and p_event_key<>'live_presence' then return result; end if;
  normalized_question:=trim(coalesce(p_properties->>'question',''));
  if p_event_key='live_question_asked' and length(normalized_question) not between 2 and 1000 then raise exception 'invalid_question'; end if;
  if p_event_key in ('webinar_room_opened','live_presence','live_question_asked') and
    (s.embed_url is null or now()<s.starts_at-interval '15 minutes' or now()>s.ends_at+make_interval(mins=>s.attendance_grace_minutes)) then
    raise exception 'live_room_unavailable';
  end if;
  if p_event_key='live_presence' and (now()<s.starts_at or now()>s.ends_at) then raise exception 'live_session_not_started'; end if;
  if p_event_key='live_replay_opened' and (not s.replay_published or s.replay_url is null or now()<s.ends_at
    or (s.replay_available_until is not null and s.replay_available_until<=now())) then raise exception 'live_replay_unavailable'; end if;
  if result is null then
    insert into public.events(event_key,contact_id,email,client_event_id,properties)
      values(p_event_key,r.contact_id,c_email,event_identity,
        (coalesce(p_properties,'{}'::jsonb)-'question'-'email'-'visitorId'-'accessToken'-'token')
        ||jsonb_build_object('funnel','live','sessionId',s.id,'registrationId',r.id,'sessionTitle',s.title)
        ||case when p_event_key='live_question_asked' then jsonb_build_object('question',normalized_question) else '{}'::jsonb end)
      returning id into result;
  end if;
  in_session:=now()>=s.starts_at and now()<=s.ends_at;
  update public.live_webinar_registrations set
    first_room_opened_at=case when p_event_key='webinar_room_opened' then coalesce(first_room_opened_at,now()) else first_room_opened_at end,
    attended_at=case when in_session and p_event_key in ('live_presence','live_question_asked') then coalesce(attended_at,now()) else attended_at end,
    last_presence_at=case when in_session and p_event_key='live_presence' then clock_timestamp()
      when in_session and p_event_key='live_question_asked' then now() else last_presence_at end,
    replay_opened_at=case when p_event_key='live_replay_opened' then coalesce(replay_opened_at,now()) else replay_opened_at end,
    booking_started_at=case when p_event_key='call_booking_started' then now() else booking_started_at end,
    last_scheduled_at=case when in_session and p_event_key in ('live_presence','live_question_asked') then null else last_scheduled_at end
    where id=r.id;
  if p_event_key in ('live_question_asked','live_presence') then
    update public.contacts set stage='engaged',stage_changed_at=now()
      where id=r.contact_id and stage_mode='automatic' and stage in ('new','registered');
  end if;
  return result;
end; $$;

create function public.book_live_funnel_call_v1(
  p_name text,p_email text,p_phone text,p_starts_at timestamptz,p_ends_at timestamptz,p_timezone text,
  p_intake_answers jsonb default '{}'::jsonb,p_utm jsonb default '{}'::jsonb,p_visitor_id text default null,
  p_session_id uuid default null,p_registration_id uuid default null
)
returns public.bookings language plpgsql security definer set search_path = '' as $$
declare result public.bookings; existing_stage text; existing_changed_at timestamptz; new_event_id uuid;
begin
  if p_session_id is not null and not exists (select 1 from public.live_webinar_sessions where id=p_session_id and status<>'draft') then raise exception 'live_session_unavailable'; end if;
  if p_registration_id is not null and not exists (
    select 1 from public.live_webinar_registrations r join public.contacts c on c.id=r.contact_id
      where r.id=p_registration_id and r.session_id=p_session_id and c.email=lower(trim(p_email)) and r.cancelled_at is null
  ) then raise exception 'live_registration_mismatch'; end if;
  select stage,stage_changed_at into existing_stage,existing_changed_at from public.contacts where email=lower(trim(p_email)) for update;
  result:=public.book_funnel_call_v2(p_name,p_email,p_phone,p_starts_at,p_ends_at,p_timezone,p_intake_answers,p_utm,p_visitor_id);
  -- Live registration/booking must preserve explicit sales decisions, while the
  -- booking and its authoritative conversion event are still fully recorded.
  if existing_stage in ('won','lost') then
    update public.contacts set stage=existing_stage,stage_changed_at=existing_changed_at where id=result.contact_id;
  end if;
  update public.bookings set live_session_id=p_session_id,live_registration_id=p_registration_id where id=result.id returning * into result;
  select id into new_event_id from public.events where contact_id=result.contact_id and event_key='call_booked'
    and (properties->>'startsAt')::timestamptz=p_starts_at and created_at>=transaction_timestamp()
    order by created_at desc,id desc limit 1;
  update public.events set properties=properties||jsonb_strip_nulls(jsonb_build_object('funnel','live','sessionId',p_session_id,'registrationId',p_registration_id,'bookingId',result.id)) where id=new_event_id;
  return result;
end; $$;

create function public.invalidate_live_session_messages_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.schedule_version<>old.schedule_version then
    update public.scheduled_messages m set status='cancelled',last_error='Live session logistics changed',updated_at=now()
      where m.status in ('scheduled','failed') and m.enrollment_id in (
        select e.id from public.sequence_enrollments e join public.live_webinar_registrations r on r.id=e.live_registration_id where r.session_id=new.id);
  end if;
  if new.schedule_version<>old.schedule_version or new.replay_published is distinct from old.replay_published
    or new.replay_available_until is distinct from old.replay_available_until or new.automation_enabled is distinct from old.automation_enabled then
    update public.live_webinar_registrations set last_scheduled_at=null where session_id=new.id;
  end if;
  return new;
end; $$;
create trigger live_session_message_invalidation after update on public.live_webinar_sessions
  for each row execute function public.invalidate_live_session_messages_v1();

revoke all on function public.register_live_webinar_v1(uuid,text,text,text,text,jsonb,jsonb,boolean,text,text,text,text),
  public.update_live_webinar_activity_v1(uuid,uuid,integer,text,text,jsonb),
  public.book_live_funnel_call_v1(text,text,text,timestamptz,timestamptz,text,jsonb,jsonb,text,uuid,uuid),public.invalidate_live_session_messages_v1()
  from public,anon,authenticated;
grant execute on function public.register_live_webinar_v1(uuid,text,text,text,text,jsonb,jsonb,boolean,text,text,text,text),
  public.update_live_webinar_activity_v1(uuid,uuid,integer,text,text,jsonb),
  public.book_live_funnel_call_v1(text,text,text,timestamptz,timestamptz,text,jsonb,jsonb,text,uuid,uuid) to service_role;
