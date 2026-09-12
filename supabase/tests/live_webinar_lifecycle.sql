-- Disposable database only. Tests use real PostgreSQL transactions and rollback.
begin;
do $$
declare
  s uuid; past_s uuid; a jsonb; r uuid; c uuid; msg uuid; branch_msg uuid; first_question uuid;
  account_id uuid:=gen_random_uuid(); snapshot jsonb; enrollment public.sequence_enrollments; token_before integer;
begin
  if has_function_privilege('anon','public.register_live_webinar_v1(uuid,text,text,text,text,jsonb,jsonb,boolean,text,text,text,text)','execute')
    or has_function_privilege('authenticated','public.update_live_webinar_activity_v1(uuid,uuid,integer,text,text,jsonb)','execute')
    or has_function_privilege('authenticated','public.email_message_is_eligible_v2(uuid)','execute') then raise exception 'ASSERT: public role can call privileged live RPC'; end if;
  insert into auth.users(id,email) values(account_id,'sql-admin@example.test');
  insert into public.crm_users(user_id,role,display_name) values(account_id,'admin','SQL Admin');
  perform set_config('request.jwt.claim.sub',account_id::text,true);
  insert into public.live_webinar_sessions(slug,title,starts_at,ends_at,timezone,status,embed_url,automation_enabled)
    values('sql-lifecycle','SQL lifecycle',now()+interval '10 minutes',now()+interval '70 minutes','UTC','scheduled','https://example.test/player',false) returning id into s;
  a:=public.register_live_webinar_v1(s,'SQL Lifecycle','sql-lifecycle@example.test',p_marketing_consent=>true,p_consent_version=>'v1',p_consent_text=>'Test consent');
  r:=(a->>'registration_id')::uuid;c:=(a->>'contact_id')::uuid;
  if exists(select 1 from public.claim_live_webinar_email_v1(r)) then raise exception 'ASSERT: automation-disabled session delivered'; end if;
  perform public.claim_due_scheduled_emails_v2(100,true);
  if not exists(select 1 from public.scheduled_messages m join public.sequence_enrollments e on e.id=m.enrollment_id where e.live_registration_id=r and m.template_key='live_confirmation:1' and m.status='scheduled') then raise exception 'ASSERT: paused session permanently consumed confirmation'; end if;
  if exists(select 1 from public.scheduled_messages m join public.sequence_enrollments e on e.id=m.enrollment_id where e.live_registration_id=r and m.template_key in ('live_reminder_day:1','live_reminder_soon:1')) then raise exception 'ASSERT: late registration queued stale reminders'; end if;
  perform public.update_live_webinar_activity_v1(r,s,1,'webinar_room_opened','room-opened','{}');
  if exists(select 1 from public.live_webinar_registrations where id=r and attended_at is not null) then raise exception 'ASSERT: doors-open entry fabricated attendance'; end if;
  -- A live room visit must not invalidate an unrelated evergreen reminder.
  enrollment:=public.enqueue_funnel_sequence('sql-lifecycle@example.test','pre_webinar',jsonb_build_array(jsonb_build_object('templateKey','pre_webinar:2','scheduledFor',now())));
  if not public.email_message_is_eligible(c,enrollment.id,'pre_webinar:2') then raise exception 'ASSERT: live room blocked evergreen message'; end if;
  update public.live_webinar_sessions set automation_enabled=true where id=s;
  select id into msg from public.claim_live_webinar_email_v1(r);
  if msg is null then raise exception 'ASSERT: enabling automation did not resume queued confirmation'; end if;
  if not public.release_scheduled_email_claim_v1(msg) then raise exception 'ASSERT: unacknowledged claim could not be released'; end if;
  select id into msg from public.claim_live_webinar_email_v1(r);
  perform public.complete_scheduled_email(msg,'sent','sql-lifecycle-provider',null,now());
  if public.release_scheduled_email_claim_v1(msg) then raise exception 'ASSERT: release reset sent history'; end if;

  -- Setting the server's test schedule to the past permits deterministic absolute
  -- scheduling assertions without accepting client-supplied attendance times.
  update public.live_webinar_sessions set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id=s;
  perform public.sync_live_webinar_registration_messages_v1(r);
  select m.id into branch_msg from public.scheduled_messages m join public.sequence_enrollments e on e.id=m.enrollment_id where e.live_registration_id=r and m.delivery_key='post-session';
  if not exists(select 1 from public.scheduled_messages where id=branch_msg and template_key='live_no_show:1') then raise exception 'ASSERT: missing post-session no-attendance branch'; end if;
  if not public.email_message_is_eligible_v2(branch_msg) then raise exception 'ASSERT: correct post-session branch ineligible'; end if;
  update public.live_webinar_registrations set attended_at=now()-interval '90 minutes' where id=r;
  if public.email_message_is_eligible_v2(branch_msg) then raise exception 'ASSERT: late attendance permits contradictory no-show'; end if;
  perform public.sync_live_webinar_registration_messages_v1(r);
  if not exists(select 1 from public.scheduled_messages where id=branch_msg and template_key='live_attended:1' and public.email_message_is_eligible_v2(id)) then raise exception 'ASSERT: unclaimed post-session branch not reconciled'; end if;
  select id into msg from public.claim_live_webinar_email_v1(r,'live_attended:1');
  perform public.complete_scheduled_email(msg,'sent','sql-post-provider',null,now());
  update public.live_webinar_registrations set attended_at=null where id=r;
  perform public.sync_live_webinar_registration_messages_v1(r);
  if not exists(select 1 from public.scheduled_messages where id=branch_msg and template_key='live_attended:1' and status='sent') then raise exception 'ASSERT: sent post-session branch changed'; end if;
  if (select count(*) from public.scheduled_messages m join public.sequence_enrollments e on e.id=m.enrollment_id where e.live_registration_id=r and m.template_key in ('live_attended:1','live_no_show:1'))<>1 then raise exception 'ASSERT: more than one post-session branch'; end if;

  update public.live_webinar_sessions set replay_url='https://example.test/replay',replay_published=true,replay_available_until=now()+interval '1 hour' where id=s;
  perform public.sync_live_webinar_registration_messages_v1(r);
  select m.id into msg from public.scheduled_messages m join public.sequence_enrollments e on e.id=m.enrollment_id where e.live_registration_id=r and m.template_key='live_replay:1';
  if msg is null or not public.email_message_is_eligible_v2(msg) then raise exception 'ASSERT: published replay unavailable'; end if;
  perform public.update_live_webinar_activity_v1(r,s,1,'live_replay_opened','replay','{}');
  if exists(select 1 from public.live_webinar_registrations where id=r and attended_at is not null) then raise exception 'ASSERT: replay opening fabricated live attendance'; end if;
  update public.live_webinar_sessions set replay_available_until=now()-interval '1 minute' where id=s;
  if public.email_message_is_eligible_v2(msg) then raise exception 'ASSERT: expired replay message still eligible'; end if;

  -- Recoverable Trash includes registration/session history and preserves sends.
  select access_version into token_before from public.live_webinar_registrations where id=r;
  if not public.trash_contact(c) then raise exception 'ASSERT: could not trash contact'; end if;
  if exists(select 1 from public.live_webinar_registrations where contact_id=c) then raise exception 'ASSERT: trash left active participant'; end if;
  select payload into snapshot from public.contact_trash where contact_id=c;
  if jsonb_array_length(snapshot->'live_webinar_registrations')<>1 then raise exception 'ASSERT: trash snapshot omitted participant'; end if;
  if public.restore_contact_from_trash(c)<>c then raise exception 'ASSERT: wrong restored contact'; end if;
  if not exists(select 1 from public.live_webinar_registrations where id=r and access_version=token_before+1 and notifications_paused and replay_opened_at is not null) then raise exception 'ASSERT: trash restore lost history or resumed participation'; end if;
  if exists(select 1 from public.scheduled_messages where contact_id=c and status in ('scheduled','sending')) then raise exception 'ASSERT: trash restore replayed pending email'; end if;
  perform public.sync_live_webinar_messages_v1();
  if exists(select 1 from public.scheduled_messages where contact_id=c and status='scheduled') then raise exception 'ASSERT: sync resumed paused restored participant'; end if;
  -- Permanent privacy erasure retains shared sessions but removes participants.
  perform public.begin_credit_report_purge_v1(c);
  perform public.purge_crm_contact_v1(c);
  if exists(select 1 from public.live_webinar_registrations where contact_id=c) or exists(select 1 from public.events where contact_id=c or email='sql-lifecycle@example.test') then raise exception 'ASSERT: privacy purge retained personal activity'; end if;
  if not exists(select 1 from public.live_webinar_sessions where id=s) then raise exception 'ASSERT: personal erasure deleted a shared session'; end if;

  -- Capture and participation reports operate while session email is disabled.
  insert into public.live_webinar_sessions(slug,title,starts_at,ends_at,timezone,status,embed_url,automation_enabled)
    values('sql-report-without-email','SQL report without email',now()+interval '1 hour',now()+interval '2 hours','UTC','scheduled','https://example.test/player',false) returning id into past_s;
  a:=public.register_live_webinar_v1(past_s,'SQL Reporting','sql-reporting@example.test',p_marketing_consent=>true,p_consent_version=>'v1',p_consent_text=>'Test consent');
  r:=(a->>'registration_id')::uuid;
  update public.live_webinar_sessions set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id=past_s;
  perform public.sync_live_webinar_messages_v1();
  if not exists(select 1 from public.live_webinar_registrations where id=r and post_session_outcome='no_attendance') then raise exception 'ASSERT: disabled email prevented attendance classification'; end if;
  if exists(select 1 from public.claim_due_scheduled_emails_v2(100,true) where payload->>'sessionId'=past_s::text) then raise exception 'ASSERT: attendance classification delivered disabled session email'; end if;
  if not exists(select 1 from public.scheduled_messages m join public.sequence_enrollments e on e.id=m.enrollment_id where e.live_registration_id=r and m.template_key='live_no_show:1' and m.status='scheduled') then raise exception 'ASSERT: disabled email consumed paused post-session intent'; end if;

  -- A recording first published long after a session can still notify its
  -- registrants. The enqueue-time deadline stays fixed across cron retries.
  insert into public.live_webinar_sessions(slug,title,starts_at,ends_at,timezone,status,embed_url,automation_enabled)
    values('sql-late-replay','SQL late replay',now()+interval '1 hour',now()+interval '2 hours','UTC','scheduled','https://example.test/player',true) returning id into past_s;
  a:=public.register_live_webinar_v1(past_s,'SQL Late Replay','sql-late-replay@example.test',p_marketing_consent=>true,p_consent_version=>'v1',p_consent_text=>'Test consent');
  r:=(a->>'registration_id')::uuid;
  update public.live_webinar_sessions set starts_at=now()-interval '121 days',ends_at=now()-interval '120 days',
    replay_published=true,replay_url='https://example.test/late-replay',replay_available_until=null where id=past_s;
  perform public.sync_live_webinar_messages_v1();
  select m.id into msg from public.scheduled_messages m join public.sequence_enrollments e on e.id=m.enrollment_id where e.live_registration_id=r and m.delivery_key='replay';
  if msg is null or not public.email_message_is_eligible_v2(msg) then raise exception 'ASSERT: late no-expiry replay notification is missing or already expired'; end if;
  select payload into snapshot from public.scheduled_messages where id=msg;
  if (snapshot->>'sendDeadline')::timestamptz<>now()+interval '7 days' then raise exception 'ASSERT: late replay deadline not anchored to enqueue time'; end if;
  perform public.sync_live_webinar_messages_v1();
  if (select payload from public.scheduled_messages where id=msg)<>snapshot then raise exception 'ASSERT: replay retry changed provider payload'; end if;
  select id into msg from public.claim_live_webinar_email_v1(r,'live_replay:1');
  perform public.complete_scheduled_email(msg,'sent','sql-late-replay-provider',null,now());
  perform public.sync_live_webinar_messages_v1();
  if (select count(*) from public.scheduled_messages m join public.sequence_enrollments e on e.id=m.enrollment_id where e.live_registration_id=r and m.delivery_key='replay')<>1
    or not exists(select 1 from public.scheduled_messages where id=msg and status='sent') then raise exception 'ASSERT: late replay was re-enrolled after delivery'; end if;
end;
$$;
rollback;
