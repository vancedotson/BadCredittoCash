-- Disposable local database only. All synthetic rows are rolled back.
begin;
do $$
declare
  c uuid := gen_random_uuid();
  v_actor_id uuid := gen_random_uuid();
  submission uuid := gen_random_uuid();
  session_id uuid;
  attempt_id uuid;
  v_receipt_id uuid;
  path text;
  v_obligation_id uuid;
  v_later_obligation_id uuid;
  initial_due timestamptz;
  receipt_count integer;
  bureau text;
  v_same_contact uuid;
  v_same_submission uuid;
  v_same_session uuid;
  v_same_attempt uuid;
  v_previous_same_receipt uuid;
  v_same_obligation uuid;
  v_contact_export jsonb;
begin
  if extract(epoch from ((timestamptz '2026-10-31 12:00:00 America/New_York' + interval '48 hours')
    - timestamptz '2026-10-31 12:00:00 America/New_York')) <> 172800 then
    raise exception 'ASSERT: 48-hour deadline changed across a daylight-saving transition';
  end if;
  if has_function_privilege('anon', 'public.list_credit_report_followups_v1()', 'execute')
    or has_function_privilege('authenticated', 'public.assign_credit_report_followup_v1(uuid,uuid,uuid)', 'execute') then
    raise exception 'ASSERT: public client role can access follow-up queue RPCs';
  end if;

  insert into public.contacts(id,email,name) values(c, 'followup-fixture@example.test', 'Follow-up Fixture');
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values(v_actor_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
      'followup-fixture-actor@example.test','',now(),'{}'::jsonb,'{}'::jsonb,now(),now());
  insert into public.crm_users(user_id,role,display_name) values(v_actor_id,'admin','Follow-up Test Actor');
  for bureau in select unnest(array['transunion','equifax']) loop
    session_id := gen_random_uuid(); submission := gen_random_uuid(); attempt_id := gen_random_uuid();
    insert into public.events(id,event_key,contact_id,email,client_event_id)
      values(submission,'credit_check_submitted',c,'followup-fixture@example.test','followup-'||session_id::text);
    insert into public.credit_report_upload_sessions(id,submission_id,contact_id,token_hash,expires_at)
      values(session_id,submission,c,encode(gen_random_bytes(32),'hex'),now()+interval '2 days');
    path := c::text||'/'||session_id::text||'/'||attempt_id::text||'.pdf';
    perform public.begin_credit_report_upload_v1(attempt_id,session_id,path);
    insert into public.credit_report_uploads(id,session_id,submission_id,contact_id,bureau,file_name,object_path,byte_size,uploaded_at)
      values(attempt_id,session_id,submission,c,bureau,'report.pdf',path,100,now()-interval '5 days');
    if exists(select 1 from public.credit_report_followup_receipts where contact_id=c)
      or exists(select 1 from public.credit_report_followup_obligations where contact_id=c) then
      raise exception 'ASSERT: partial bureau set created a follow-up';
    end if;
    perform public.finish_credit_report_upload_v1(attempt_id);
  end loop;

  -- A registered upload attempt with no committed receipt creates no event.
  session_id := gen_random_uuid(); submission := gen_random_uuid(); attempt_id := gen_random_uuid();
  insert into public.events(id,event_key,contact_id,email,client_event_id)
    values(submission,'credit_check_submitted',c,'followup-fixture@example.test','followup-failed-'||session_id::text);
  insert into public.credit_report_upload_sessions(id,submission_id,contact_id,token_hash,expires_at)
    values(session_id,submission,c,encode(gen_random_bytes(32),'hex'),now()+interval '2 days');
  path := c::text||'/'||session_id::text||'/'||attempt_id::text||'.pdf';
  perform public.begin_credit_report_upload_v1(attempt_id,session_id,path);
  if exists(select 1 from public.credit_report_followup_receipts where receipt_id=attempt_id)
    or exists(select 1 from public.credit_report_followup_obligations where contact_id=c) then
    raise exception 'ASSERT: failed upload without a committed receipt created an obligation';
  end if;
  delete from public.credit_report_upload_attempts where id=attempt_id;
  delete from public.credit_report_upload_sessions where id=session_id;
  delete from public.events where id=submission;

  -- This third receipt is committed while its upload-attempt finalization is
  -- deliberately left pending, modeling a lost response after receipt commit.
  session_id := gen_random_uuid(); submission := gen_random_uuid(); attempt_id := gen_random_uuid();
  insert into public.events(id,event_key,contact_id,email,client_event_id)
    values(submission,'credit_check_submitted',c,'followup-fixture@example.test','followup-third-'||session_id::text);
  insert into public.credit_report_upload_sessions(id,submission_id,contact_id,token_hash,expires_at)
    values(session_id,submission,c,encode(gen_random_bytes(32),'hex'),now()+interval '2 days');
  path := c::text||'/'||session_id::text||'/'||attempt_id::text||'.pdf';
  perform public.begin_credit_report_upload_v1(attempt_id,session_id,path);
  insert into public.credit_report_uploads(id,session_id,submission_id,contact_id,bureau,file_name,object_path,byte_size,uploaded_at)
    values(attempt_id,session_id,submission,c,'experian','report.pdf',path,100,'2000-01-01T00:00:00Z');
  v_receipt_id := attempt_id;
  select id,due_at into v_obligation_id,initial_due from public.credit_report_followup_obligations where contact_id=c and state='open';
  if v_obligation_id is null then raise exception 'ASSERT: full-set receipt did not create an obligation'; end if;
  if (select due_at-uploaded_at from public.credit_report_followup_receipts where receipt_id=v_receipt_id) <> interval '48 hours' then
    raise exception 'ASSERT: deadline is not exactly 48 elapsed hours from server receipt time';
  end if;
  if (select uploaded_at from public.credit_report_uploads where id=v_receipt_id) <= '2001-01-01T00:00:00Z'::timestamptz then
    raise exception 'ASSERT: client-provided receipt timestamp was trusted';
  end if;
  if (select state from public.credit_report_upload_attempts where id=attempt_id) <> 'pending' then
    raise exception 'ASSERT: test did not preserve the ambiguous-finalization state';
  end if;

  perform public.ensure_credit_report_followup_for_receipt_v1(v_receipt_id);
  select count(*) into receipt_count from public.credit_report_followup_receipts where contact_id=c;
  if receipt_count <> 1 then raise exception 'ASSERT: retry created a duplicate qualifying-receipt event'; end if;
  if not public.finish_credit_report_upload_v1(attempt_id) then raise exception 'ASSERT: ambiguous receipt did not reconcile as committed'; end if;

  -- A later full-set replacement adds its own trace but never extends an open deadline.
  session_id := gen_random_uuid(); submission := gen_random_uuid(); attempt_id := gen_random_uuid();
  insert into public.events(id,event_key,contact_id,email,client_event_id)
    values(submission,'credit_check_submitted',c,'followup-fixture@example.test','followup-replacement-'||session_id::text);
  insert into public.credit_report_upload_sessions(id,submission_id,contact_id,token_hash,expires_at)
    values(session_id,submission,c,encode(gen_random_bytes(32),'hex'),now()+interval '2 days');
  path := c::text||'/'||session_id::text||'/'||attempt_id::text||'.pdf';
  perform public.begin_credit_report_upload_v1(attempt_id,session_id,path);
  insert into public.credit_report_uploads(id,session_id,submission_id,contact_id,bureau,file_name,object_path,byte_size)
    values(attempt_id,session_id,submission,c,'equifax','report.pdf',path,100);
  if (select due_at from public.credit_report_followup_obligations where id=v_obligation_id) <> initial_due then
    raise exception 'ASSERT: later open receipt extended the earliest due time';
  end if;
  select count(*) into receipt_count from public.credit_report_followup_receipts where obligation_id=v_obligation_id;
  if receipt_count <> 2 then raise exception 'ASSERT: replacement receipt trace was not retained'; end if;
  if not public.finish_credit_report_upload_v1(attempt_id) then raise exception 'ASSERT: replacement receipt did not finalize'; end if;

  -- Reconciliation is idempotent and does not create a new obligation when the
  -- trigger already captured the current latest receipt.
  perform public.reconcile_credit_report_followup_receipts_v1(100);
  select count(*) into receipt_count from public.credit_report_followup_obligations where contact_id=c;
  if receipt_count <> 1 then raise exception 'ASSERT: receipt reconciliation duplicated an open obligation'; end if;

  -- A successful contact closes the obligation; the next full-set replacement
  -- creates a new one with a new 48-hour deadline.
  perform public.assign_credit_report_followup_v1(v_obligation_id, v_actor_id, v_actor_id);
  perform public.record_credit_report_followup_contact_v1(v_obligation_id, v_actor_id, clock_timestamp(), 'phone', 'no_answer');
  if (select state from public.credit_report_followup_obligations where id=v_obligation_id) <> 'open' then
    raise exception 'ASSERT: unanswered attempt incorrectly closed the obligation';
  end if;
  perform public.record_credit_report_followup_contact_v1(v_obligation_id, v_actor_id, clock_timestamp(), 'phone', 'reached');
  if (select state from public.credit_report_followup_obligations where id=v_obligation_id) <> 'completed'
    or (select count(*) from public.credit_report_followup_audit where obligation_id=v_obligation_id and action='contact_recorded') <> 2 then
    raise exception 'ASSERT: reached outcome did not complete and audit the contact';
  end if;
  session_id := gen_random_uuid(); submission := gen_random_uuid(); attempt_id := gen_random_uuid();
  insert into public.events(id,event_key,contact_id,email,client_event_id)
    values(submission,'credit_check_submitted',c,'followup-fixture@example.test','followup-after-completion-'||session_id::text);
  insert into public.credit_report_upload_sessions(id,submission_id,contact_id,token_hash,expires_at)
    values(session_id,submission,c,encode(gen_random_bytes(32),'hex'),now()+interval '2 days');
  path := c::text||'/'||session_id::text||'/'||attempt_id::text||'.pdf';
  perform public.begin_credit_report_upload_v1(attempt_id,session_id,path);
  insert into public.credit_report_uploads(id,session_id,submission_id,contact_id,bureau,file_name,object_path,byte_size)
    values(attempt_id,session_id,submission,c,'transunion','report.pdf',path,100);
  select id into v_later_obligation_id from public.credit_report_followup_obligations where contact_id=c and state='open';
  if v_later_obligation_id is null or v_later_obligation_id=v_obligation_id then
    raise exception 'ASSERT: post-completion replacement did not open a new obligation';
  end if;

  -- A synthetic reached outcome is responsible for completed state, unlike an attempt.
  if exists(select 1 from public.credit_report_followup_contact_attempts where obligation_id=v_later_obligation_id) then
    raise exception 'ASSERT: fixture unexpectedly recorded a customer contact';
  end if;
  if not exists(select 1 from public.credit_report_followup_receipts where receipt_id=attempt_id and due_at-uploaded_at=interval '48 hours') then
    raise exception 'ASSERT: post-completion replacement lost its exact deadline';
  end if;
  if public.reconcile_credit_report_followup_receipts_v1(100)->>'hasMore' <> 'false' then
    raise exception 'ASSERT: receipt reconciliation did not settle';
  end if;

  insert into public.contact_trash(contact_id,email,name,payload,deleted_by)
    values(c,'followup-fixture@example.test','Follow-up Fixture','{}'::jsonb,v_actor_id);
  delete from public.contacts where id=c;
  if not exists(select 1 from public.credit_report_followup_obligations where contact_id=c) then
    raise exception 'ASSERT: recoverable trash deleted follow-up metadata';
  end if;
  insert into public.contacts(id,email,name) values(c,'followup-fixture@example.test','Follow-up Fixture');
  delete from public.contact_trash where contact_id=c;

  -- The v3 backup keeps useful audit evidence but removes actor and assignee UUIDs.
  if exists (
    select 1 from jsonb_array_elements(
      public.export_crm_backup_v3()->'tables'->'credit_report_followup_audit'
    ) as exported_audit(audit_json)
    where audit_json->>'actor_id' is not null
      or audit_json->'before_state' ? 'assignedTo'
      or audit_json->'after_state' ? 'assignedTo'
      or audit_json->>'actor_name' is null
      or audit_json->>'action' is null
      or audit_json->>'created_at' is null
  ) then
    raise exception 'ASSERT: backup exposed an assignment UUID or omitted audit evidence';
  end if;

  -- The admin-only contact privacy export includes every active-contact queue
  -- record without report object metadata or staff UUIDs.
  v_contact_export := public.export_crm_contact_v1(c);
  -- Version 4 (payment requests, 20260929120000) wraps the v3 follow-up export.
  if v_contact_export->>'version' <> '4'
    or jsonb_array_length(v_contact_export->'creditReportFollowupObligations') <> 2
    or jsonb_array_length(v_contact_export->'creditReportFollowupReceipts') <> 3
    or jsonb_array_length(v_contact_export->'creditReportFollowupContactAttempts') <> 2
    or jsonb_array_length(v_contact_export->'creditReportFollowupAudit') < 4
    or public.export_crm_contact_v1(gen_random_uuid()) is not null
    or has_function_privilege('anon', 'public.export_crm_contact_v1(uuid)', 'execute') then
    raise exception 'ASSERT: contact privacy export omitted queue data or exposed the RPC';
  end if;
  if exists (select 1 from jsonb_array_elements(v_contact_export->'creditReportFollowupObligations') as exported(row_json)
             where row_json->>'assigned_to' is not null or row_json->>'completed_by' is not null)
    or exists (select 1 from jsonb_array_elements(v_contact_export->'creditReportFollowupContactAttempts') as exported(row_json)
             where row_json->>'actor_id' is not null)
    or exists (select 1 from jsonb_array_elements(v_contact_export->'creditReportFollowupAudit') as exported(row_json)
             where row_json->>'actor_id' is not null
               or row_json->'before_state' ? 'assignedTo'
               or row_json->'after_state' ? 'assignedTo')
    or exists (select 1 from jsonb_array_elements(v_contact_export->'creditReportFollowupReceipts') as exported(row_json)
             where row_json ? 'object_path' or row_json ? 'file_name' or row_json ? 'byte_size') then
    raise exception 'ASSERT: contact privacy export exposed staff IDs or report object metadata';
  end if;

  -- Permanent contact purge removes queue history along with contact metadata.
  perform public.finish_credit_report_upload_v1(attempt_id);
  perform public.begin_credit_report_purge_v1(c);
  perform public.purge_crm_contact_v1(c);
  if exists(select 1 from public.credit_report_followup_obligations where contact_id=c)
    or exists(select 1 from public.credit_report_followup_receipts where contact_id=c) then
    raise exception 'ASSERT: permanent purge retained follow-up metadata';
  end if;

  -- A same-session bureau replacement follows the upload upsert conflict path.
  -- The old trace remains, the replacement gets its own receipt trace, and the
  -- open due time cannot move later than its earliest qualifying deadline.
  v_same_contact := gen_random_uuid();
  v_same_submission := gen_random_uuid();
  v_same_session := gen_random_uuid();
  insert into public.contacts(id,email,name)
    values(v_same_contact,'same-session-fixture@example.test','Same Session Fixture');
  insert into public.events(id,event_key,contact_id,email,client_event_id)
    values(v_same_submission,'credit_check_submitted',v_same_contact,'same-session-fixture@example.test','followup-same-session-'||v_same_session::text);
  insert into public.credit_report_upload_sessions(id,submission_id,contact_id,token_hash,expires_at)
    values(v_same_session,v_same_submission,v_same_contact,encode(gen_random_bytes(32),'hex'),now()+interval '2 days');

  foreach bureau in array array['transunion','equifax','experian'] loop
    v_same_attempt := gen_random_uuid();
    path := v_same_contact::text||'/'||v_same_session::text||'/'||v_same_attempt::text||'.pdf';
    perform public.begin_credit_report_upload_v1(v_same_attempt,v_same_session,path);
    insert into public.credit_report_uploads(id,session_id,submission_id,contact_id,bureau,file_name,object_path,byte_size)
      values(v_same_attempt,v_same_session,v_same_submission,v_same_contact,bureau,'report.pdf',path,100);
    if not public.finish_credit_report_upload_v1(v_same_attempt) then
      raise exception 'ASSERT: same-session initial receipt did not finalize';
    end if;
  end loop;

  select id,due_at into v_same_obligation,initial_due
    from public.credit_report_followup_obligations where contact_id=v_same_contact and state='open';
  select u.id into v_previous_same_receipt from public.credit_report_uploads u
    where u.session_id=v_same_session and u.bureau='experian';
  if v_same_obligation is null or v_previous_same_receipt is null then
    raise exception 'ASSERT: same-session full set did not create its queue obligation';
  end if;

  v_same_attempt := gen_random_uuid();
  path := v_same_contact::text||'/'||v_same_session::text||'/'||v_same_attempt::text||'.pdf';
  perform public.begin_credit_report_upload_v1(v_same_attempt,v_same_session,path);
  insert into public.credit_report_uploads(id,session_id,submission_id,contact_id,bureau,file_name,object_path,byte_size)
    values(v_same_attempt,v_same_session,v_same_submission,v_same_contact,'experian','replacement.pdf',path,100)
    on conflict on constraint credit_report_uploads_session_id_bureau_key do update set
      id=excluded.id, submission_id=excluded.submission_id, contact_id=excluded.contact_id,
      file_name=excluded.file_name, object_path=excluded.object_path,
      byte_size=excluded.byte_size, uploaded_at=excluded.uploaded_at;
  if not public.finish_credit_report_upload_v1(v_same_attempt) then
    raise exception 'ASSERT: same-session replacement receipt did not finalize';
  end if;
  if not exists(select 1 from public.credit_report_followup_receipts where receipt_id=v_previous_same_receipt and obligation_id=v_same_obligation)
    or not exists(select 1 from public.credit_report_followup_receipts where receipt_id=v_same_attempt and obligation_id=v_same_obligation)
    or (select count(*) from public.credit_report_followup_receipts where obligation_id=v_same_obligation) <> 2 then
    raise exception 'ASSERT: same-session ON CONFLICT replacement did not retain old and new receipt traces';
  end if;
  if (select due_at from public.credit_report_followup_obligations where id=v_same_obligation) <> initial_due then
    raise exception 'ASSERT: same-session replacement extended the earliest open deadline';
  end if;

  -- Both contacts now have queue records. A contact export must contain only
  -- that contact's obligations, traces, outcomes, and audit.
  v_contact_export := public.export_crm_contact_v1(v_same_contact);
  if jsonb_array_length(v_contact_export->'creditReportFollowupObligations') <> 1
    or jsonb_array_length(v_contact_export->'creditReportFollowupReceipts') <> 2
    or jsonb_array_length(v_contact_export->'creditReportFollowupContactAttempts') <> 0
    or jsonb_array_length(v_contact_export->'creditReportFollowupAudit') <> 1
    or exists (select 1 from jsonb_array_elements(v_contact_export->'creditReportFollowupObligations') as exported(row_json)
               where (row_json->>'contact_id')::uuid <> v_same_contact)
    or exists (select 1 from jsonb_array_elements(v_contact_export->'creditReportFollowupReceipts') as exported(row_json)
               where (row_json->>'contact_id')::uuid <> v_same_contact) then
    raise exception 'ASSERT: second contact export included another contact or lost its own queue rows';
  end if;
  v_contact_export := public.export_crm_contact_v1(c);
  if jsonb_array_length(v_contact_export->'creditReportFollowupObligations') <> 2
    or jsonb_array_length(v_contact_export->'creditReportFollowupReceipts') <> 3
    or jsonb_array_length(v_contact_export->'creditReportFollowupContactAttempts') <> 2
    or exists (select 1 from jsonb_array_elements(v_contact_export->'creditReportFollowupObligations') as exported(row_json)
               where (row_json->>'contact_id')::uuid <> c)
    or exists (select 1 from jsonb_array_elements(v_contact_export->'creditReportFollowupReceipts') as exported(row_json)
               where (row_json->>'contact_id')::uuid <> c) then
    raise exception 'ASSERT: first contact export included another contact or lost its own queue rows';
  end if;
end;
$$;
rollback;
