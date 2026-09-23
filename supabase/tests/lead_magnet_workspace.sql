-- Disposable database only, rebuilt from checked-in migrations. No Storage or
-- provider requests occur; every synthetic identity and receipt rolls back.
begin;
insert into auth.users(id,email) values
  ('91300000-0000-4000-8000-000000000001','lm-admin@example.test'),
  ('91300000-0000-4000-8000-000000000002','lm-staff@example.test'),
  ('91300000-0000-4000-8000-000000000003','lm-readonly@example.test'),
  ('91300000-0000-4000-8000-000000000004','lm-outsider@example.test');
insert into public.crm_users(user_id,role,display_name) values
  ('91300000-0000-4000-8000-000000000001','admin','SQL admin'),
  ('91300000-0000-4000-8000-000000000002','staff','SQL staff'),
  ('91300000-0000-4000-8000-000000000003','readonly','SQL readonly');

create temporary table lead_magnet_test_ids(label text primary key, id uuid not null);
grant select on lead_magnet_test_ids to authenticated;
insert into public.contacts(id,name,email,source,stage,owner_name) values
  ('91300000-0000-4000-8000-000000000101','SQL Existing Client','lm-existing@example.test','facebook','won','Original owner'),
  ('91300000-0000-4000-8000-000000000102','SQL Partial','lm-partial@example.test','credit-check','call_booked',null),
  ('91300000-0000-4000-8000-000000000103','SQL Waiting 100%','lm-waiting@example.test','credit-check','legacy-unknown',null),
  ('91300000-0000-4000-8000-000000000104','SQL Trashed','lm-trashed@example.test','credit-check','new',null),
  ('91300000-0000-4000-8000-000000000105','SQL Purging','lm-purging@example.test','credit-check','new',null),
  ('91300000-0000-4000-8000-000000000106','SQL Source Only','lm-source-only@example.test','credit-check','new',null);
do $$
declare first_intake uuid; latest_intake uuid; intake uuid; participant record;
begin
  first_intake := public.submit_credit_check_v1('Changed submitted name','LM-EXISTING@example.test','+14055550101','{"companies":["Midland Credit Management"]}');
  latest_intake := public.submit_credit_check_v1('Changed submitted name','lm-existing@example.test','+14055550101','{"companies":["Portfolio Recovery Associates","True Accord"]}');
  update public.events set occurred_at=now()-interval '45 days' where id=first_intake;
  update public.events set occurred_at=now()-interval '1 day' where id=latest_intake;
  insert into lead_magnet_test_ids values ('first',first_intake),('latest',latest_intake);
  for participant in select * from (values
    ('partial','lm-partial@example.test',2), ('waiting','lm-waiting@example.test',3),
    ('trashed','lm-trashed@example.test',4), ('purging','lm-purging@example.test',5)
  ) fixture(label,email,days) loop
    intake := public.submit_credit_check_v1('SQL submitted name',participant.email,'+14055550102','{"companies":["Midland Credit Management"]}');
    update public.events set occurred_at=now()-make_interval(days=>participant.days) where id=intake;
    insert into lead_magnet_test_ids values(participant.label,intake);
  end loop;
end; $$;

insert into public.credit_report_upload_sessions(id,submission_id,contact_id,token_hash,expires_at)
select fixture.session_id::uuid, test.id, fixture.contact_id::uuid, repeat(fixture.token_digit,64), now()+interval '7 days'
from (values
  ('91300000-0000-4000-8000-000000000301','first','91300000-0000-4000-8000-000000000101','1'),
  ('91300000-0000-4000-8000-000000000302','latest','91300000-0000-4000-8000-000000000101','2'),
  ('91300000-0000-4000-8000-000000000303','partial','91300000-0000-4000-8000-000000000102','3'),
  ('91300000-0000-4000-8000-000000000304','trashed','91300000-0000-4000-8000-000000000104','4'),
  ('91300000-0000-4000-8000-000000000305','purging','91300000-0000-4000-8000-000000000105','5')
) fixture(session_id,label,contact_id,token_digit) join lead_magnet_test_ids test on test.label=fixture.label;

do $$
declare
  fixture record;
  session_row public.credit_report_upload_sessions%rowtype;
  object_path text;
begin
  for fixture in select * from (values
    ('91300000-0000-4000-8000-000000000201','91300000-0000-4000-8000-000000000301','transunion','old-transunion.pdf',40),
    ('91300000-0000-4000-8000-000000000202','91300000-0000-4000-8000-000000000302','transunion','latest-transunion.pdf',1),
    ('91300000-0000-4000-8000-000000000203','91300000-0000-4000-8000-000000000301','equifax','earlier-session-equifax.pdf',40),
    ('91300000-0000-4000-8000-000000000204','91300000-0000-4000-8000-000000000302','experian','latest-experian.pdf',1),
    ('91300000-0000-4000-8000-000000000205','91300000-0000-4000-8000-000000000303','transunion','partial-transunion.pdf',2),
    ('91300000-0000-4000-8000-000000000206','91300000-0000-4000-8000-000000000304','equifax','trashed-equifax.pdf',4),
    ('91300000-0000-4000-8000-000000000207','91300000-0000-4000-8000-000000000305','experian','purging-experian.pdf',5)
  ) uploads(report_id,session_id,bureau,file_name,days)
  loop
    select * into session_row from public.credit_report_upload_sessions where id=fixture.session_id::uuid;
    if not found then raise exception 'ASSERT: fixture upload session missing'; end if;
    object_path := session_row.contact_id::text||'/'||session_row.id::text||'/'||fixture.report_id||'.pdf';
    if not public.begin_credit_report_upload_v1(fixture.report_id::uuid,session_row.id,object_path) then
      raise exception 'ASSERT: fixture upload attempt was not registered';
    end if;
    insert into public.credit_report_uploads(id,session_id,submission_id,contact_id,bureau,file_name,object_path,byte_size,uploaded_at)
    values (fixture.report_id::uuid,session_row.id,session_row.submission_id,session_row.contact_id,
      fixture.bureau,fixture.file_name,object_path,1024,now()-make_interval(days=>fixture.days));
    if not public.finish_credit_report_upload_v1(fixture.report_id::uuid) then
      raise exception 'ASSERT: fixture upload attempt was not completed';
    end if;
  end loop;
end; $$;
insert into public.credit_report_purge_blocks(contact_id) values ('91300000-0000-4000-8000-000000000105');

set local role authenticated;
select set_config('request.jwt.claim.sub','91300000-0000-4000-8000-000000000001',true);
select public.trash_contact('91300000-0000-4000-8000-000000000104');
do $$
declare v jsonb; filtered jsonb; first_page jsonb; second_page jsonb; person jsonb; receipt jsonb;
begin
  v := public.get_lead_magnet_workspace_v1();
  if v->>'total'<>'3' or v->>'page'<>'1' or v->>'pageSize'<>'25'
     or v->'summary' <> '{"totalSignups":3,"newLast30Days":2,"waiting":1,"partial":1,"complete":1}'::jsonb
  then raise exception 'ASSERT: deduplicated global counts, Trash or purge omission failed: %',v; end if;
  if exists(select 1 from jsonb_array_elements(v->'rows') r where r->>'email' in ('lm-trashed@example.test','lm-purging@example.test','lm-source-only@example.test')) then
    raise exception 'ASSERT: inactive contact or source-only contact leaked'; end if;
  person := v#>'{rows,0}';
  if person->>'contactId'<>'91300000-0000-4000-8000-000000000101' or person->>'submissionCount'<>'2'
     or person->>'stage'<>'won' or person->>'owner'<>'Original owner'
     or person->'companies'<>'["Portfolio Recovery Associates","True Accord"]'::jsonb
     or (person->>'firstSubmittedAt')::timestamptz<>now()-interval '45 days'
     or (person->>'lastSubmittedAt')::timestamptz<>now()-interval '1 day'
  then raise exception 'ASSERT: returning contact or latest intake changed: %',person; end if;
  if not exists(select 1 from public.contacts where id='91300000-0000-4000-8000-000000000101' and source='facebook' and stage='won') then
    raise exception 'ASSERT: intake/reader overwrote original source or sales stage'; end if;
  if jsonb_array_length(person->'reports')<>3 then raise exception 'ASSERT: reports are not distinct per bureau'; end if;
  receipt:=person#>'{reports,0}';
  if receipt->>'bureau'<>'transunion' or receipt->>'fileName'<>'latest-transunion.pdf'
     or receipt->>'submissionId'<>(select id::text from lead_magnet_test_ids where label='latest') then
    raise exception 'ASSERT: newer bureau upload was not selected: %',receipt; end if;
  if person#>>'{reports,1,fileName}'<>'earlier-session-equifax.pdf'
     or person#>>'{reports,1,submissionId}'<>(select id::text from lead_magnet_test_ids where label='first') then
    raise exception 'ASSERT: earlier session receipt or download intake identity lost'; end if;
  if v::text like '%sql-private%' or v::text like '%token_hash%' or v::text like '%object_path%' then
    raise exception 'ASSERT: private path or capability exposed'; end if;

  filtered:=public.get_lead_magnet_workspace_v1('EXISTING@','complete');
  if filtered->>'total'<>'1' or filtered->'summary'<>v->'summary' then raise exception 'ASSERT: case-insensitive email search changed global counts'; end if;
  filtered:=public.get_lead_magnet_workspace_v1('sql partial','partial');
  if filtered->>'total'<>'1' or filtered#>>'{rows,0,stage}'<>'booked' then raise exception 'ASSERT: name search, partial status or booking stage alias incorrect'; end if;
  filtered:=public.get_lead_magnet_workspace_v1('%','waiting');
  if filtered->>'total'<>'1' or filtered#>>'{rows,0,stage}'<>'new' then raise exception 'ASSERT: literal percent search or legacy stage fallback incorrect'; end if;
  filtered:=public.get_lead_magnet_workspace_v1('_','all');
  if filtered->>'total'<>'0' or filtered->'rows'<>'[]'::jsonb or filtered->'summary'<>v->'summary' then raise exception 'ASSERT: empty filter or underscore search incorrect'; end if;
  filtered:=public.get_lead_magnet_workspace_v1('sql partial','waiting');
  if filtered->>'total'<>'0' then raise exception 'ASSERT: incompatible search/status not intersected'; end if;
  first_page:=public.get_lead_magnet_workspace_v1('','all',1,2);
  second_page:=public.get_lead_magnet_workspace_v1('','all',2,2);
  if jsonb_array_length(first_page->'rows')<>2 or jsonb_array_length(second_page->'rows')<>1
     or second_page->>'total'<>'3' or second_page#>>'{rows,0,email}'<>'lm-waiting@example.test' then
    raise exception 'ASSERT: database pagination or stable ordering incorrect'; end if;
  filtered:=public.get_lead_magnet_workspace_v1('','all',2147483647,2);
  if filtered<>second_page then raise exception 'ASSERT: out-of-bounds page not safely clamped'; end if;
  filtered:=public.get_lead_magnet_workspace_v1(null,null,null,null);
  if filtered<>v then raise exception 'ASSERT: null defaults differ'; end if;
end; $$;

-- Restore uses the existing lifecycle: retained private receipts become visible
-- again only when the active contact and intake events have been restored.
select public.restore_contact_from_trash('91300000-0000-4000-8000-000000000104');
do $$
declare v jsonb;
begin
  v:=public.get_lead_magnet_workspace_v1('lm-trashed@');
  if v->>'total'<>'1' or jsonb_array_length(v#>'{rows,0,reports}')<>1 then raise exception 'ASSERT: restored receipt inaccessible'; end if;
end; $$;
select public.trash_contact('91300000-0000-4000-8000-000000000104');

-- Older backup restoration can remove a newer intake event while deliberately
-- retaining that contact's PDF metadata. It must not turn saved PDFs into a
-- waiting state; upload-session expiry likewise never expires CRM file access.
reset role;
create temporary table lead_magnet_removed_event as
  select * from public.events where id=(select id from lead_magnet_test_ids where label='latest');
delete from public.events where id=(select id from lead_magnet_test_ids where label='latest');
update public.credit_report_upload_sessions set expires_at=now()-interval '1 day'
  where id in ('91300000-0000-4000-8000-000000000301','91300000-0000-4000-8000-000000000302');
set local role authenticated;
do $$
declare v jsonb;
begin
  v:=public.get_lead_magnet_workspace_v1('lm-existing@','complete');
  if v->>'total'<>'1' or v#>>'{rows,0,submissionCount}'<>'1'
     or jsonb_array_length(v#>'{rows,0,reports}')<>3
     or v#>>'{rows,0,reports,0,fileName}'<>'latest-transunion.pdf'
     or v#>>'{rows,0,reports,0,submissionId}'<>(select id::text from lead_magnet_test_ids where label='latest') then
    raise exception 'ASSERT: retained report hidden by missing event or expired upload capability'; end if;
end; $$;
reset role;
insert into public.events select * from lead_magnet_removed_event;
set local role authenticated;

-- Both staff and readonly CRM members may inspect receipt metadata, but direct
-- receipt/session/purge tables remain inaccessible to every authenticated role.
select set_config('request.jwt.claim.sub','91300000-0000-4000-8000-000000000002',true);
do $$ begin
  if public.get_lead_magnet_workspace_v1()->>'total'<>'3' then raise exception 'ASSERT: staff read denied'; end if;
end; $$;
select set_config('request.jwt.claim.sub','91300000-0000-4000-8000-000000000003',true);
do $$ begin
  if public.get_lead_magnet_workspace_v1()->>'total'<>'3' then raise exception 'ASSERT: readonly read denied'; end if;
  begin perform 1 from public.credit_report_uploads; raise exception 'ASSERT: direct receipt table opened'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.credit_report_upload_sessions; raise exception 'ASSERT: direct session table opened'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.credit_report_purge_blocks; raise exception 'ASSERT: direct purge table opened'; exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub','91300000-0000-4000-8000-000000000004',true);
do $$ begin
  begin perform public.get_lead_magnet_workspace_v1(); raise exception 'ASSERT: nonmember gained receipt access'; exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  begin perform public.get_lead_magnet_workspace_v1(); raise exception 'ASSERT: missing identity gained receipt access'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.get_lead_magnet_workspace_v1(); raise exception 'ASSERT: anonymous RPC access'; exception when insufficient_privilege then null; end;
end; $$;
reset role;

-- More than 1,000 participants proves aggregates and paging operate in SQL over
-- the full dataset, not the existing contact list's in-memory snapshot.
insert into public.contacts(id,name,email,source)
select ('91300000-0000-4000-8001-'||lpad(n::text,12,'0'))::uuid, 'SQL Bulk '||n,
  ('lm-bulk-'||n||'@example.test')::public.citext,'credit-check' from generate_series(1,1005) n;
insert into public.events(event_key,contact_id,email,properties,occurred_at)
select 'credit_check_submitted',id,email,'{"answers":{"companies":[]}}'::jsonb,now()-interval '10 days'
from public.contacts where email::text like 'lm-bulk-%@example.test';
set local role authenticated;
select set_config('request.jwt.claim.sub','91300000-0000-4000-8000-000000000003',true);
do $$
declare v jsonb;
begin
  v:=public.get_lead_magnet_workspace_v1('lm-bulk-','waiting',11,100);
  if v->>'total'<>'1005' or jsonb_array_length(v->'rows')<>5 or v->>'page'<>'11'
     or v#>>'{summary,totalSignups}'<>'1008' or v#>>'{summary,newLast30Days}'<>'1007'
     or v#>>'{summary,waiting}'<>'1006' then raise exception 'ASSERT: truncated full-dataset aggregation or pagination: %',v; end if;
  v:=public.get_lead_magnet_workspace_v1('','all',1,2147483647);
  if v->>'pageSize'<>'100' or jsonb_array_length(v->'rows')<>100 then raise exception 'ASSERT: maximum page size bypassed'; end if;
end; $$;
reset role;
rollback;
