-- Disposable local database only. Every fixture is rolled back.
begin;
do $$
declare
  c uuid := gen_random_uuid();
  c_recent uuid := gen_random_uuid();
  submission uuid := gen_random_uuid();
  session_id uuid := gen_random_uuid();
  other_session_id uuid := gen_random_uuid();
  attempt_id uuid := gen_random_uuid();
  path text;
  claim record;
  counts jsonb;
  purge jsonb;
  rejected boolean;
begin
  if has_function_privilege('anon', 'public.claim_credit_report_attempts_v1(integer,uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.finish_credit_report_attempt_reconciliation_v1(uuid,uuid,boolean,boolean)', 'execute') then
    raise exception 'ASSERT: client role can invoke reconciliation RPCs';
  end if;

  insert into public.contacts(id,email,name) values(c, 'reconcile-fixture@example.test', 'Reconcile Fixture');
  insert into public.events(id,event_key,contact_id,email,client_event_id)
    values(submission,'credit_check_submitted',c,'reconcile-fixture@example.test','reconcile-fixture');
  insert into public.credit_report_upload_sessions(id,submission_id,contact_id,token_hash,expires_at)
    values(session_id,submission,c,repeat('a',64),now()+interval '2 days');
  insert into public.credit_report_upload_sessions(id,submission_id,contact_id,token_hash,expires_at)
    values(other_session_id,submission,c,repeat('c',64),now()+interval '2 days');
  path := c::text || '/' || session_id::text || '/' || attempt_id::text || '.pdf';

  -- A canonical-looking receipt without a registered attempt is rejected.
  rejected := false;
  begin
    insert into public.credit_report_uploads(id,session_id,submission_id,contact_id,bureau,file_name,object_path,byte_size)
      values(gen_random_uuid(),session_id,submission,c,'transunion','unregistered.pdf',
        c::text||'/'||session_id::text||'/'||gen_random_uuid()::text||'.pdf',100);
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'ASSERT: receipt without a registered upload attempt was accepted'; end if;

  -- A valid attempt cannot be replayed under another session or object key.
  if not public.begin_credit_report_upload_v1(attempt_id,session_id,path) then
    raise exception 'ASSERT: upload attempt was not registered';
  end if;
  rejected := false;
  begin
    insert into public.credit_report_uploads(id,session_id,submission_id,contact_id,bureau,file_name,object_path,byte_size)
      values(attempt_id,other_session_id,submission,c,'equifax','wrong-session.pdf',path,100);
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'ASSERT: receipt with a mismatched session was accepted'; end if;
  rejected := false;
  begin
    insert into public.credit_report_uploads(id,session_id,submission_id,contact_id,bureau,file_name,object_path,byte_size)
      values(attempt_id,session_id,submission,c,'equifax','wrong-path.pdf',c::text||'/wrong/path.pdf',100);
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'ASSERT: receipt with a mismatched object path was accepted'; end if;

  -- A deliberately old started_at is not stale while a recent activity lease exists.
  update public.credit_report_upload_attempts set started_at=now()-interval '2 days', last_activity_at=now(), upload_lease_until=now()+interval '30 minutes' where id=attempt_id;
  counts := public.credit_report_reconciliation_counts_v1(25,null);
  if (counts->>'attempts')::integer <> 0 then raise exception 'ASSERT: recent active attempt was eligible'; end if;

  update public.credit_report_upload_attempts set last_activity_at=now()-interval '25 hours', upload_lease_until=now()-interval '1 hour' where id=attempt_id;
  counts := public.credit_report_reconciliation_counts_v1(25,null);
  if (counts->>'attempts')::integer <> 1 then raise exception 'ASSERT: stale objectless attempt was not eligible'; end if;

  select * into claim from public.claim_credit_report_attempts_v1(25,null);
  if claim.attempt_id is distinct from attempt_id or claim.object_path is distinct from path then
    raise exception 'ASSERT: claim did not return only the registered exact path';
  end if;
  if public.finish_credit_report_upload_v1(attempt_id) then
    raise exception 'ASSERT: upload finalized after reconciliation claim';
  end if;
  if public.finish_credit_report_attempt_reconciliation_v1(attempt_id,claim.claim_token,false,false) <> 'abandoned' then
    raise exception 'ASSERT: objectless stale attempt was not abandoned';
  end if;
  if exists(select 1 from public.credit_report_upload_attempts where id=attempt_id and (state<>'abandoned' or completed_at is not null)) then
    raise exception 'ASSERT: failed attempt was mislabeled completed';
  end if;
  if exists(select 1 from public.claim_credit_report_attempts_v1(25,null)) then
    raise exception 'ASSERT: abandoned attempt was immediately reclaimed before its retry time';
  end if;

  -- A recent attempt remains pending and permanently blocks purge preparation.
  attempt_id := gen_random_uuid();
  submission := gen_random_uuid();
  session_id := gen_random_uuid();
  insert into public.contacts(id,email,name) values(c_recent, 'reconcile-recent@example.test', 'Recent Fixture');
  insert into public.events(id,event_key,contact_id,email,client_event_id)
    values(submission,'credit_check_submitted',c_recent,'reconcile-recent@example.test','reconcile-recent');
  insert into public.credit_report_upload_sessions(id,submission_id,contact_id,token_hash,expires_at)
    values(session_id,submission,c_recent,repeat('b',64),now()+interval '2 days');
  path := c_recent::text || '/' || session_id::text || '/' || attempt_id::text || '.pdf';
  perform public.begin_credit_report_upload_v1(attempt_id,session_id,path);
  purge := public.begin_credit_report_purge_v1(c_recent);
  if (purge->>'pending')::integer <> 1 then raise exception 'ASSERT: recent attempt did not block purge'; end if;
  if public.renew_credit_report_upload_v1(attempt_id) then raise exception 'ASSERT: purge did not fence active lease renewals'; end if;
  if exists(select 1 from public.claim_credit_report_attempts_v1(25,c_recent)) then
    raise exception 'ASSERT: recent attempt was claimed during purge';
  end if;
end;
$$;
rollback;
