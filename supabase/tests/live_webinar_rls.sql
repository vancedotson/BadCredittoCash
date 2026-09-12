-- Exercise authenticated table access and triggers under real SET ROLE, rather
-- than relying solely on the migration owner's bypass of row-level security.
begin;
insert into auth.users(id,email) values
  ('91200000-0000-4000-8000-000000000001','sql-staff@example.test'),
  ('91200000-0000-4000-8000-000000000002','sql-readonly@example.test'),
  ('91200000-0000-4000-8000-000000000003','sql-outsider@example.test');
insert into public.crm_users(user_id,role,display_name) values
  ('91200000-0000-4000-8000-000000000001','staff','SQL staff'),
  ('91200000-0000-4000-8000-000000000002','readonly','SQL readonly');
set local role authenticated;
select set_config('request.jwt.claim.sub','91200000-0000-4000-8000-000000000001',true);
insert into public.live_webinar_sessions(id,slug,title,starts_at,ends_at,timezone,status,embed_url)
values('91200000-0000-4000-8000-000000000010','sql-rls','SQL RLS',now()+interval '1 day',now()+interval '1 day 1 hour','UTC','scheduled','https://example.test/player');
reset role;
select public.register_live_webinar_v1('91200000-0000-4000-8000-000000000010','SQL Participant','sql-rls@example.test',p_consent_version=>'v1',p_consent_text=>'Test consent');
set local role authenticated;
select set_config('request.jwt.claim.sub','91200000-0000-4000-8000-000000000001',true);
do $$
declare amount integer;
begin
  select count(*) into amount from public.live_webinar_registrations r
    join public.live_webinar_sessions s on s.id=r.session_id
    join public.contacts c on c.id=r.contact_id
    join public.sequence_enrollments e on e.live_registration_id=r.id
    join public.scheduled_messages m on m.enrollment_id=e.id
    where s.id='91200000-0000-4000-8000-000000000010';
  if amount=0 then raise exception 'ASSERT: staff cannot read CRM joined session messages'; end if;
  update public.live_webinar_sessions set starts_at=starts_at+interval '1 day',ends_at=ends_at+interval '1 day'
    where id='91200000-0000-4000-8000-000000000010';
  if not found then raise exception 'ASSERT: staff cannot edit session'; end if;
  if not exists(select 1 from public.live_webinar_sessions where id='91200000-0000-4000-8000-000000000010' and schedule_version=2) then raise exception 'ASSERT: revoked trigger function privilege prevents staff scheduling'; end if;
  if exists(select 1 from public.live_webinar_registrations r join public.sequence_enrollments e on e.live_registration_id=r.id
    join public.scheduled_messages m on m.enrollment_id=e.id where r.session_id='91200000-0000-4000-8000-000000000010' and m.status='scheduled') then raise exception 'ASSERT: staff reschedule trigger failed to invalidate old message'; end if;
  update public.live_webinar_registrations set access_version=99 where session_id='91200000-0000-4000-8000-000000000010';
  if found then raise exception 'ASSERT: staff bypassed server-only participant authority'; end if;
end; $$;
select set_config('request.jwt.claim.sub','91200000-0000-4000-8000-000000000002',true);
do $$
begin
  if not exists(select 1 from public.live_webinar_sessions where id='91200000-0000-4000-8000-000000000010') then raise exception 'ASSERT: readonly member cannot read sessions'; end if;
  if not exists(select 1 from public.live_webinar_registrations where session_id='91200000-0000-4000-8000-000000000010') then raise exception 'ASSERT: readonly member cannot read registration history'; end if;
  update public.live_webinar_sessions set title='Forbidden' where id='91200000-0000-4000-8000-000000000010';
  if found then raise exception 'ASSERT: readonly member changed session'; end if;
end; $$;
select set_config('request.jwt.claim.sub','91200000-0000-4000-8000-000000000003',true);
do $$
begin
  if exists(select 1 from public.live_webinar_sessions) or exists(select 1 from public.live_webinar_registrations) then raise exception 'ASSERT: nonmember can inspect CRM sessions'; end if;
end; $$;
reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.live_webinar_registrations limit 1;
    raise exception 'ASSERT: anonymous role has participant table privileges';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
rollback;
