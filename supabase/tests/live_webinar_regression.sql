-- Run only against a disposable database rebuilt from the checked-in migrations.
-- No provider requests occur. Every fixture and assertion rolls back.
begin;
do $$
declare
  a uuid; b uuid; running uuid; disabled uuid; c_id uuid; r_a uuid; r_b uuid; r_live uuid;
  v jsonb; again jsonb; e public.sequence_enrollments; msg uuid; q1 uuid; q2 uuid; q_retry uuid;
  booked public.bookings; saved jsonb; old_saved jsonb; before_source text; old_key uuid;
  presence_one uuid; presence_two uuid; presence_before timestamptz;
begin
  insert into public.live_webinar_sessions(slug,title,starts_at,ends_at,timezone,status,embed_url,automation_enabled)
    values('sql-live-a','SQL live A',now()+interval '2 days',now()+interval '2 days 1 hour','America/New_York','scheduled','https://example.test/player',true) returning id into a;
  insert into public.live_webinar_sessions(slug,title,starts_at,ends_at,timezone,status,embed_url,automation_enabled)
    values('sql-live-b','SQL live B',now()+interval '3 days',now()+interval '3 days 1 hour','Europe/Lisbon','scheduled','https://example.test/player',true) returning id into b;
  insert into public.live_webinar_sessions(slug,title,starts_at,ends_at,timezone,status,embed_url,automation_enabled)
    values('sql-live-running','SQL running',now()-interval '1 minute',now()+interval '1 hour','UTC','scheduled','https://example.test/player',true) returning id into running;
  insert into public.live_webinar_sessions(slug,title,starts_at,ends_at,timezone,status)
    values('sql-live-draft','SQL draft',now()+interval '2 days',now()+interval '2 days 1 hour','UTC','draft') returning id into disabled;

  begin
    perform public.register_live_webinar_v1(disabled,'SQL User','sql-live@example.test',p_consent_version=>'v1',p_consent_text=>'Test consent');
    raise exception 'ASSERT: draft registration was accepted';
  exception when others then if sqlerrm<>'live_session_unavailable' then raise; end if; end;
  if exists(select 1 from public.contacts where email='sql-live@example.test') then raise exception 'ASSERT: draft created a contact'; end if;

  insert into public.contacts(name,email,source,first_touch,stage,marketing_consent)
    values('SQL User','sql-live@example.test','facebook','{"utm_source":"first"}','won',true) returning id into c_id;
  v:=public.register_live_webinar_v1(a,'SQL User','SQL-LIVE@example.test',p_first_touch=>'{"utm_source":"replacement"}',p_marketing_consent=>true,p_consent_version=>'v1',p_consent_text=>'Test consent');
  r_a:=(v->>'registration_id')::uuid;
  again:=public.register_live_webinar_v1(a,'SQL User','sql-live@example.test',p_marketing_consent=>true,p_consent_version=>'v1',p_consent_text=>'Test consent');
  if v<>again or (v->>'contact_id')::uuid<>c_id then raise exception 'ASSERT: duplicate registration changed identity'; end if;
  if (select count(*) from public.live_webinar_registrations where contact_id=c_id and session_id=a)<>1 then raise exception 'ASSERT: duplicate registration rows'; end if;
  if not exists(select 1 from public.contacts where id=c_id and source='facebook' and first_touch->>'utm_source'='first' and stage='won' and stage_mode='manual') then raise exception 'ASSERT: original attribution or sales decision changed'; end if;
  v:=public.register_live_webinar_v1(b,'SQL User','sql-live@example.test',p_marketing_consent=>true,p_consent_version=>'v1',p_consent_text=>'Test consent'); r_b:=(v->>'registration_id')::uuid;
  if r_a=r_b or (select count(*) from public.contacts where email='sql-live@example.test')<>1 then raise exception 'ASSERT: repeated session contact dedup failed'; end if;
  if (select count(*) from public.scheduled_messages m join public.sequence_enrollments x on x.id=m.enrollment_id where x.live_registration_id in(r_a,r_b) and m.template_key='live_confirmation:1')<>2 then raise exception 'ASSERT: confirmation identity not scoped by registration'; end if;

  -- Booked/client contacts still receive their explicitly requested logistics.
  select id into msg from public.claim_live_webinar_email_v1(r_a);
  if msg is null then raise exception 'ASSERT: requested logistics blocked by won stage'; end if;
  perform public.complete_scheduled_email(msg,'sent','sql-provider-confirmation',null,now());
  perform public.register_live_webinar_v1(a,'SQL User','sql-live@example.test',p_consent_version=>'v1',p_consent_text=>'Test consent');
  if not exists(select 1 from public.scheduled_messages where id=msg and status='sent' and provider_message_id='sql-provider-confirmation') then raise exception 'ASSERT: registration retry reset delivered email'; end if;
  if exists(select 1 from public.claim_live_webinar_email_v1(r_a)) then raise exception 'ASSERT: confirmation resent'; end if;
  if exists(select 1 from public.claim_scheduled_email('sql-live@example.test','live_confirmation:1')) then raise exception 'ASSERT: legacy claim consumed live message'; end if;
  if exists(select 1 from public.claim_due_scheduled_emails(100) where payload->>'funnel'='live') then raise exception 'ASSERT: old worker claimed live message'; end if;

  -- Legacy progression is isolated from every live enrollment.
  e:=public.enqueue_funnel_sequence('sql-live@example.test','pre_webinar',jsonb_build_array(jsonb_build_object('templateKey','pre_webinar:1','scheduledFor',now())));
  perform public.enqueue_funnel_sequence('sql-live@example.test','low_watch',jsonb_build_array(jsonb_build_object('templateKey','low_watch:1','scheduledFor',now())));
  if exists(select 1 from public.sequence_enrollments where live_registration_id in(r_a,r_b) and status<>'active') then raise exception 'ASSERT: legacy progression stopped live sessions'; end if;
  if not public.email_message_is_eligible_v2((select m.id from public.scheduled_messages m join public.sequence_enrollments x on x.id=m.enrollment_id where x.live_registration_id=r_b and m.template_key='live_confirmation:1')) then raise exception 'ASSERT: legacy progression cancelled requested session B logistics'; end if;

  -- Independent activity and question idempotency, with authoritative server time.
  v:=public.register_live_webinar_v1(running,'SQL Participant','sql-participant@example.test',p_marketing_consent=>true,p_consent_version=>'v1',p_consent_text=>'Test consent'); r_live:=(v->>'registration_id')::uuid;
  if not exists(select 1 from public.contacts where id=(v->>'contact_id')::uuid and source='vance-live-webinar')
    or not exists(select 1 from public.events where contact_id=(v->>'contact_id')::uuid and event_key='webinar_registered' and properties->>'source'='vance-live-webinar') then raise exception 'ASSERT: canonical live source changed'; end if;
  q1:=public.update_live_webinar_activity_v1(r_live,running,1,'live_question_asked','question-one','{"question":"First question?","funnel":"forged","sessionId":"forged"}');
  q_retry:=public.update_live_webinar_activity_v1(r_live,running,1,'live_question_asked','question-one','{"question":"Changed retry must not replace the question"}');
  q2:=public.update_live_webinar_activity_v1(r_live,running,1,'live_question_asked','question-two','{"question":"Second question?"}');
  if q1<>q_retry or q1=q2 then raise exception 'ASSERT: question idempotency failed'; end if;
  if not exists(select 1 from public.events where id=q1 and properties->>'question'='First question?' and properties->>'funnel'='live' and properties->>'sessionId'=running::text and email='sql-participant@example.test') then raise exception 'ASSERT: question context or content incorrect'; end if;
  if not exists(select 1 from public.live_webinar_registrations where id=r_live and attended_at is not null) then raise exception 'ASSERT: in-session question did not record attendance evidence'; end if;
  if not exists(select 1 from public.contacts where id=(v->>'contact_id')::uuid and stage='engaged' and stage_mode='automatic') then raise exception 'ASSERT: automatic stage failed'; end if;
  presence_one:=public.update_live_webinar_activity_v1(r_live,running,1,'live_presence','heartbeat-one','{}');
  -- Move the timestamp back to make a missed heartbeat update observable even
  -- in one transaction (where PostgreSQL now() otherwise remains constant).
  update public.live_webinar_registrations set last_presence_at=now()-interval '30 seconds' where id=r_live returning last_presence_at into presence_before;
  presence_two:=public.update_live_webinar_activity_v1(r_live,running,1,'live_presence','heartbeat-two','{}');
  if presence_one<>presence_two or (select count(*) from public.events where event_key='live_presence' and properties->>'registrationId'=r_live::text)<>1 then raise exception 'ASSERT: heartbeat pulses appended duplicate CRM evidence'; end if;
  if not exists(select 1 from public.live_webinar_registrations where id=r_live and last_presence_at>presence_before) then raise exception 'ASSERT: repeated heartbeat did not refresh latest presence'; end if;
  update public.live_webinar_registrations set last_presence_at=now()-interval '30 seconds' where id=r_live;
  perform public.update_live_webinar_activity_v1(r_live,running,1,'live_presence','heartbeat-two','{}');
  if not exists(select 1 from public.live_webinar_registrations where id=r_live and last_presence_at>presence_before) then raise exception 'ASSERT: repeated heartbeat ID bypassed latest presence update'; end if;
  if (select count(*) from public.events where event_key='live_question_asked' and properties->>'registrationId'=r_live::text)<>2 then raise exception 'ASSERT: heartbeat dedup changed distinct question history'; end if;
  begin
    perform public.update_live_webinar_activity_v1(r_live,running,99,'live_presence','forged-token','{}'); raise exception 'ASSERT: revoked token accepted';
  exception when others then if sqlerrm<>'live_participant_unavailable' then raise; end if; end;
  begin
    perform public.update_live_webinar_activity_v1(r_live,running,1,'live_question_asked','bad-question','{"question":" "}'); raise exception 'ASSERT: invalid question accepted';
  exception when others then if sqlerrm<>'invalid_question' then raise; end if; end;
  begin
    perform public.update_live_webinar_activity_v1(r_a,a,1,'live_presence','early-presence','{}'); raise exception 'ASSERT: early presence accepted';
  exception when others then if sqlerrm<>'live_room_unavailable' then raise; end if; end;
  begin
    perform public.update_live_webinar_activity_v1(r_live,running,1,'live_replay_opened','unpublished','{}'); raise exception 'ASSERT: unpublished replay accepted';
  exception when others then if sqlerrm<>'live_replay_unavailable' then raise; end if; end;

  -- Live-only contacts remain outside evergreen watch/no-show segmentation.
  v:=public.search_crm_contacts_live_v1('sql-participant','','','','','','','created','desc',1,25,'live',running);
  if v->>'total'<>'1' or v#>>'{rows,0,segment}'<>'lead' or v#>>'{rows,0,watch_pct}'<>'0' then raise exception 'ASSERT: live events leaked into evergreen search classification: %',v; end if;

  -- Session changes cancel stale pending content and generate one durable update.
  update public.live_webinar_sessions set starts_at=starts_at+interval '1 day',ends_at=ends_at+interval '1 day' where id=b;
  perform public.sync_live_webinar_registration_messages_v1(r_b);
  perform public.sync_live_webinar_registration_messages_v1(r_b);
  if (select count(*) from public.scheduled_messages m join public.sequence_enrollments x on x.id=m.enrollment_id where x.live_registration_id=r_b and template_key='live_rescheduled:1')<>1 then raise exception 'ASSERT: reschedule update duplicated'; end if;
  if exists(select 1 from public.scheduled_messages m join public.sequence_enrollments x on x.id=m.enrollment_id where x.live_registration_id=r_b and m.status='scheduled' and m.payload->>'sessionVersion'='1') then raise exception 'ASSERT: stale reminder survived reschedule'; end if;
  update public.live_webinar_sessions set status='cancelled' where id=b;
  perform public.sync_live_webinar_registration_messages_v1(r_b);
  select id into msg from public.claim_live_webinar_email_v1(r_b,'live_cancelled:1');
  if msg is null then raise exception 'ASSERT: cancellation notice unavailable'; end if;

  -- Booking retains the single authoritative event; a cold call need not enroll.
  booked:=public.book_live_funnel_call_v1('SQL Cold','sql-cold@example.test',null,now()+interval '5 days',now()+interval '5 days 30 minutes','UTC',p_session_id=>a);
  if booked.live_session_id<>a or booked.live_registration_id is not null then raise exception 'ASSERT: cold booking attribution wrong'; end if;
  if (select count(*) from public.events where contact_id=booked.contact_id and event_key='call_booked')<>1 then raise exception 'ASSERT: booking event duplicated'; end if;
  if not exists(select 1 from public.events where contact_id=booked.contact_id and event_key='call_booked' and properties->>'funnel'='live' and properties->>'sessionId'=a::text) then raise exception 'ASSERT: server booking event missing attribution'; end if;
  if exists(select 1 from public.live_webinar_registrations where contact_id=booked.contact_id) then raise exception 'ASSERT: cold booking fabricated participation'; end if;

  -- Unsubscribe never gets cleared by registering for a different live session.
  perform public.unsubscribe_contact_from_message(msg);
  perform public.register_live_webinar_v1(running,'SQL User','sql-live@example.test',p_marketing_consent=>true,p_consent_version=>'v2',p_consent_text=>'New test consent');
  if not exists(select 1 from public.contacts where id=c_id and not marketing_consent and unsubscribed_at is not null) then raise exception 'ASSERT: registration cleared unsubscribe'; end if;
  if exists(select 1 from public.sequence_enrollments where live_registration_id=r_a and status<>'active') then raise exception 'ASSERT: unsubscribe globally stopped live logistics'; end if;

  -- Privacy exports cover question text and session participation.
  v:=public.export_crm_contact_v1(c_id);
  if jsonb_array_length(v->'liveWebinarRegistrations')<>3 then raise exception 'ASSERT: privacy export missing registrations'; end if;
  saved:=public.export_crm_backup_v2();
  if saved->>'version'<>'2' or jsonb_array_length(saved#>'{tables,live_webinar_sessions}')<4 then raise exception 'ASSERT: backup missing live tables'; end if;
  perform public.restore_crm_backup_v1(saved);
  if exists(select 1 from public.live_webinar_sessions where automation_enabled) then raise exception 'ASSERT: restore enabled automation'; end if;
  if exists(select 1 from public.live_webinar_registrations where not notifications_paused or access_version<2) then raise exception 'ASSERT: restore resumed participants or retained old tokens'; end if;
  if exists(select 1 from public.scheduled_messages where status in ('scheduled','sending')) then raise exception 'ASSERT: restored messages are sendable'; end if;
  -- An authentic v1 backup has no live rows or new non-null fields. Upgrade it
  -- with defaults and verify that new records are removed by full replacement.
  old_saved:=jsonb_set(saved,'{version}','1'::jsonb);
  old_saved:=jsonb_set(old_saved,'{tables,live_webinar_sessions}','[]'::jsonb);
  old_saved:=jsonb_set(old_saved,'{tables,live_webinar_registrations}','[]'::jsonb);
  old_saved:=jsonb_set(old_saved,'{tables,sequence_enrollments}',coalesce((select jsonb_agg(item-'context_key'-'live_registration_id') from jsonb_array_elements(saved#>'{tables,sequence_enrollments}') item where item->>'context_key'='legacy'),'[]'::jsonb));
  old_saved:=jsonb_set(old_saved,'{tables,scheduled_messages}',coalesce((select jsonb_agg(item-'delivery_key') from jsonb_array_elements(saved#>'{tables,scheduled_messages}') item where item->>'template_key' not like 'live_%'),'[]'::jsonb));
  old_saved:=jsonb_set(old_saved,'{tables,contacts}',(select jsonb_agg(item-'stage_mode') from jsonb_array_elements(saved#>'{tables,contacts}') item));
  old_saved:=jsonb_set(old_saved,'{tables,bookings}',(select jsonb_agg(item-'live_session_id'-'live_registration_id') from jsonb_array_elements(saved#>'{tables,bookings}') item));
  perform public.restore_crm_backup_v1(old_saved);
  if exists(select 1 from public.live_webinar_registrations) or exists(select 1 from public.live_webinar_sessions) then raise exception 'ASSERT: v1 restore retained newer live data'; end if;
  if exists(select 1 from public.contacts where stage_mode<>'manual') then raise exception 'ASSERT: old contact stage ownership reinterpreted'; end if;
end;
$$;
rollback;
