-- Bound and serialize recovery of interrupted credit-report uploads and
-- obsolete replacement objects. This migration is source-only until reviewed
-- and explicitly applied to a database.

alter table public.credit_report_upload_attempts
  add column state text not null default 'pending',
  add column last_activity_at timestamptz not null default now(),
  add column upload_lease_until timestamptz,
  add column reconciliation_token uuid,
  add column reconciliation_lease_until timestamptz,
  add column next_reconcile_at timestamptz not null default now(),
  add column last_failure_code text;

update public.credit_report_upload_attempts
set state = case when completed_at is null then 'pending' else 'completed' end,
    last_activity_at = started_at,
    upload_lease_until = case when completed_at is null then started_at + interval '15 minutes' else null end,
    next_reconcile_at = started_at + interval '24 hours';

alter table public.credit_report_upload_attempts
  add constraint credit_report_upload_attempts_state_check check (state in ('pending', 'completed', 'abandoned')),
  add constraint credit_report_upload_attempts_failure_check check (last_failure_code is null or last_failure_code in ('storage_check_failed', 'storage_remove_failed', 'database_check_failed', 'unexpected_error'));
create index credit_report_upload_attempts_reconcile_idx
  on public.credit_report_upload_attempts(state, next_reconcile_at, last_activity_at);

create table public.credit_report_obsolete_objects (
  object_path text primary key,
  contact_id uuid not null,
  queued_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  reconciliation_token uuid,
  reconciliation_lease_until timestamptz,
  last_failure_code text check (last_failure_code is null or last_failure_code in ('storage_check_failed', 'storage_remove_failed', 'database_check_failed', 'unexpected_error'))
);
create index credit_report_obsolete_objects_reconcile_idx
  on public.credit_report_obsolete_objects(next_attempt_at, queued_at);
alter table public.credit_report_obsolete_objects enable row level security;
revoke all on public.credit_report_obsolete_objects from public, anon, authenticated;
grant all on public.credit_report_obsolete_objects to service_role;

create or replace function public.begin_credit_report_upload_v1(p_attempt_id uuid, p_session_id uuid, p_object_path text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare session_row public.credit_report_upload_sessions%rowtype;
begin
  select * into session_row from public.credit_report_upload_sessions where id = p_session_id;
  if not found then raise exception 'credit_report_session_unavailable'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(session_row.contact_id::text, 9142));
  if exists (select 1 from public.credit_report_purge_blocks where contact_id = session_row.contact_id)
     or not exists (select 1 from public.contacts where id = session_row.contact_id)
     or session_row.expires_at <= now() then raise exception 'credit_report_session_unavailable'; end if;
  if p_object_path <> session_row.contact_id::text || '/' || p_session_id::text || '/' || p_attempt_id::text || '.pdf' then
    raise exception 'credit_report_path_invalid';
  end if;
  insert into public.credit_report_upload_attempts(id, session_id, contact_id, object_path, state, last_activity_at, upload_lease_until)
  values (p_attempt_id, session_row.id, session_row.contact_id, p_object_path, 'pending', now(), now() + interval '30 minutes');
  return true;
end;
$$;

create or replace function public.renew_credit_report_upload_v1(p_attempt_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target_contact uuid;
begin
  select contact_id into target_contact from public.credit_report_upload_attempts where id = p_attempt_id;
  if target_contact is null then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_contact::text, 9142));
  update public.credit_report_upload_attempts
  set last_activity_at = now(), upload_lease_until = now() + interval '30 minutes'
  where id = p_attempt_id and contact_id = target_contact and state = 'pending'
    and reconciliation_token is null
    and not exists (select 1 from public.credit_report_purge_blocks where contact_id = target_contact);
  return found;
end;
$$;

create or replace function public.finish_credit_report_upload_v1(p_attempt_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target_contact uuid; target_path text;
begin
  select contact_id, object_path into target_contact, target_path
  from public.credit_report_upload_attempts where id = p_attempt_id;
  if target_contact is null then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_contact::text, 9142));
  update public.credit_report_upload_attempts a
  set state = 'completed', completed_at = coalesce(completed_at, now()), upload_lease_until = null,
      reconciliation_token = null, reconciliation_lease_until = null, last_failure_code = null
  where a.id = p_attempt_id and a.contact_id = target_contact and a.object_path = target_path
    and a.state = 'pending' and a.reconciliation_token is null
    and exists (select 1 from public.credit_report_uploads u where u.id = a.id and u.object_path = a.object_path);
  return found;
end;
$$;

create or replace function public.guard_credit_report_write_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.contact_id::text, 9142));
  if exists (select 1 from public.credit_report_purge_blocks where contact_id = new.contact_id)
     or not exists (select 1 from public.contacts where id = new.contact_id) then
    raise exception 'credit_report_contact_unavailable';
  end if;
  if not exists (select 1 from public.events where id = new.submission_id and contact_id = new.contact_id and event_key = 'credit_check_submitted') then
    raise exception 'credit_report_intake_unavailable';
  end if;
  if tg_table_name = 'credit_report_uploads' then
    if not exists (
      select 1 from public.credit_report_upload_sessions s
      join public.credit_report_upload_attempts a on a.id = new.id
      where s.id = new.session_id and s.contact_id = new.contact_id and s.submission_id = new.submission_id and s.expires_at > now()
        and a.session_id = new.session_id and a.contact_id = new.contact_id and a.object_path = new.object_path
        and a.state = 'pending' and a.reconciliation_token is null
    ) then raise exception 'credit_report_session_unavailable'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.begin_credit_report_purge_v1(p_contact_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pending_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_contact_id::text, 9142));
  if not exists (select 1 from public.contacts where id = p_contact_id)
     and not exists (select 1 from public.contact_trash where contact_id = p_contact_id)
     and not exists (select 1 from public.credit_report_upload_sessions where contact_id = p_contact_id)
     and not exists (select 1 from public.credit_report_uploads where contact_id = p_contact_id)
     and not exists (select 1 from public.credit_report_upload_attempts where contact_id = p_contact_id)
     and not exists (select 1 from storage.objects where bucket_id = 'credit-reports' and name like p_contact_id::text || '/%') then
    return jsonb_build_object('found', false, 'pending', 0);
  end if;
  insert into public.credit_report_purge_blocks(contact_id) values (p_contact_id) on conflict do nothing;
  update public.credit_report_upload_sessions set expires_at = least(expires_at, now()) where contact_id = p_contact_id;
  select count(*) into pending_count from public.credit_report_upload_attempts
    where contact_id = p_contact_id and state = 'pending';
  return jsonb_build_object('found', true, 'pending', pending_count);
end;
$$;

create function public.credit_report_reconciliation_counts_v1(p_limit integer, p_contact_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare attempt_count integer; obsolete_count integer; has_more boolean;
begin
  if p_limit < 1 or p_limit > 25 then raise exception 'credit_report_batch_limit_invalid'; end if;
  with candidates as (
    select 'attempt'::text as kind, a.next_reconcile_at as sort_at, a.id::text as tie_breaker
    from public.credit_report_upload_attempts a
    where (p_contact_id is null or a.contact_id = p_contact_id)
      and (a.reconciliation_lease_until is null or a.reconciliation_lease_until <= now())
      and ((a.state = 'pending' and a.last_activity_at <= now() - interval '24 hours'
            and (a.upload_lease_until is null or a.upload_lease_until <= now()))
        or (a.state = 'abandoned' and a.next_reconcile_at <= now()))
    union all
    select 'obsolete', q.next_attempt_at, q.object_path
    from public.credit_report_obsolete_objects q
    where (p_contact_id is null or q.contact_id = p_contact_id)
      and q.next_attempt_at <= now()
      and (q.reconciliation_lease_until is null or q.reconciliation_lease_until <= now())
  ), bounded as (
    select kind from candidates order by sort_at, kind, tie_breaker limit p_limit + 1
  )
  select count(*) filter (where kind = 'attempt'), count(*) filter (where kind = 'obsolete'), count(*) > p_limit
  into attempt_count, obsolete_count, has_more from bounded;
  return jsonb_build_object('attempts', attempt_count, 'obsoleteObjects', obsolete_count, 'hasMore', has_more);
end;
$$;

create function public.claim_credit_report_attempts_v1(p_limit integer, p_contact_id uuid default null)
returns table(attempt_id uuid, contact_id uuid, object_path text, claim_token uuid, previous_state text)
language plpgsql security definer set search_path = '' as $$
declare candidate record; attempt_row public.credit_report_upload_attempts%rowtype; claimed integer := 0; token uuid;
begin
  if p_limit < 1 or p_limit > 25 then raise exception 'credit_report_batch_limit_invalid'; end if;
  for candidate in
    select a.id, a.contact_id from public.credit_report_upload_attempts a
    where (p_contact_id is null or a.contact_id = p_contact_id)
      and (a.reconciliation_lease_until is null or a.reconciliation_lease_until <= now())
      and ((a.state = 'pending' and a.last_activity_at <= now() - interval '24 hours'
            and (a.upload_lease_until is null or a.upload_lease_until <= now()))
        or (a.state = 'abandoned' and a.next_reconcile_at <= now()))
    order by a.next_reconcile_at, a.started_at, a.contact_id, a.id
    limit p_limit * 5
  loop
    exit when claimed >= p_limit;
    if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(candidate.contact_id::text, 9142)) then
      continue;
    end if;
    select * into attempt_row from public.credit_report_upload_attempts a
    where a.id = candidate.id for update skip locked;
    if not found or (attempt_row.reconciliation_lease_until is not null and attempt_row.reconciliation_lease_until > now()) then
      continue;
    end if;
    if not ((attempt_row.state = 'pending' and attempt_row.last_activity_at <= now() - interval '24 hours'
              and (attempt_row.upload_lease_until is null or attempt_row.upload_lease_until <= now()))
          or (attempt_row.state = 'abandoned' and attempt_row.next_reconcile_at <= now())) then
      continue;
    end if;
    token := gen_random_uuid();
    update public.credit_report_upload_attempts set reconciliation_token = token,
      reconciliation_lease_until = now() + interval '10 minutes' where id = attempt_row.id;
    attempt_id := attempt_row.id; contact_id := attempt_row.contact_id; object_path := attempt_row.object_path;
    claim_token := token; previous_state := attempt_row.state;
    claimed := claimed + 1;
    return next;
  end loop;
end;
$$;

create function public.finish_credit_report_attempt_reconciliation_v1(
  p_attempt_id uuid, p_claim_token uuid, p_object_exists boolean, p_object_removed boolean default false
)
returns text language plpgsql security definer set search_path = '' as $$
declare attempt_row public.credit_report_upload_attempts%rowtype; has_receipt boolean;
begin
  select * into attempt_row from public.credit_report_upload_attempts where id = p_attempt_id;
  if not found then raise exception 'credit_report_attempt_missing'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(attempt_row.contact_id::text, 9142));
  select * into attempt_row from public.credit_report_upload_attempts where id = p_attempt_id for update;
  if attempt_row.reconciliation_token is distinct from p_claim_token then raise exception 'credit_report_claim_lost'; end if;
  select exists (select 1 from public.credit_report_uploads u where u.id = attempt_row.id and u.contact_id = attempt_row.contact_id and u.object_path = attempt_row.object_path)
    into has_receipt;
  if p_object_exists and has_receipt then
    if not exists (select 1 from storage.objects where bucket_id = 'credit-reports' and name = attempt_row.object_path) then
      raise exception 'credit_report_object_not_confirmed';
    end if;
    update public.credit_report_upload_attempts set state = 'completed', completed_at = coalesce(completed_at, now()),
      upload_lease_until = null, reconciliation_token = null, reconciliation_lease_until = null,
      next_reconcile_at = now() + interval '24 hours', last_failure_code = null where id = p_attempt_id;
    return 'completed';
  end if;
  if p_object_exists and not p_object_removed then raise exception 'credit_report_object_removal_unconfirmed'; end if;
  if exists (select 1 from storage.objects where bucket_id = 'credit-reports' and name = attempt_row.object_path) then
    raise exception 'credit_report_object_still_exists';
  end if;
  -- If a receipt points at a missing object, remove just that broken receipt so
  -- an upload can replace it. Never use failure to mark an attempt completed.
  delete from public.credit_report_uploads u where u.id = attempt_row.id and u.contact_id = attempt_row.contact_id and u.object_path = attempt_row.object_path;
  update public.credit_report_upload_attempts set state = 'abandoned', completed_at = null,
    upload_lease_until = null, reconciliation_token = null, reconciliation_lease_until = null,
    next_reconcile_at = now() + interval '1 hour', last_failure_code = null where id = p_attempt_id;
  return 'abandoned';
end;
$$;

create function public.release_credit_report_attempt_reconciliation_v1(p_attempt_id uuid, p_claim_token uuid, p_failure_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target_contact uuid;
begin
  if p_failure_code not in ('storage_check_failed', 'storage_remove_failed', 'database_check_failed', 'unexpected_error') then
    raise exception 'credit_report_failure_code_invalid';
  end if;
  select contact_id into target_contact from public.credit_report_upload_attempts where id = p_attempt_id;
  if target_contact is null then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_contact::text, 9142));
  update public.credit_report_upload_attempts set reconciliation_token = null,
    reconciliation_lease_until = null, next_reconcile_at = now() + interval '15 minutes',
    last_failure_code = p_failure_code
  where id = p_attempt_id and reconciliation_token = p_claim_token;
  return found;
end;
$$;

create function public.enqueue_credit_report_obsolete_object_v1(p_contact_id uuid, p_object_path text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_object_path !~ ('^' || p_contact_id::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$') then
    raise exception 'credit_report_path_invalid';
  end if;
  insert into public.credit_report_obsolete_objects(object_path, contact_id)
  values (p_object_path, p_contact_id)
  on conflict (object_path) do update set next_attempt_at = least(credit_report_obsolete_objects.next_attempt_at, now());
  return true;
end;
$$;

create function public.claim_credit_report_obsolete_objects_v1(p_limit integer, p_contact_id uuid default null)
returns table(contact_id uuid, object_path text, claim_token uuid)
language plpgsql security definer set search_path = '' as $$
declare candidate record; queue_row public.credit_report_obsolete_objects%rowtype; claimed integer := 0; token uuid;
begin
  if p_limit < 1 or p_limit > 25 then raise exception 'credit_report_batch_limit_invalid'; end if;
  for candidate in
    select q.object_path, q.contact_id from public.credit_report_obsolete_objects q
    where (p_contact_id is null or q.contact_id = p_contact_id)
      and q.next_attempt_at <= now()
      and (q.reconciliation_lease_until is null or q.reconciliation_lease_until <= now())
    order by q.next_attempt_at, q.queued_at, q.object_path limit p_limit * 5
  loop
    exit when claimed >= p_limit;
    if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(candidate.contact_id::text, 9142)) then continue; end if;
    select * into queue_row from public.credit_report_obsolete_objects q
      where q.object_path = candidate.object_path for update skip locked;
    if not found or queue_row.next_attempt_at > now()
      or (queue_row.reconciliation_lease_until is not null and queue_row.reconciliation_lease_until > now()) then continue; end if;
    token := gen_random_uuid();
    update public.credit_report_obsolete_objects as q set reconciliation_token = token,
      reconciliation_lease_until = now() + interval '10 minutes' where q.object_path = queue_row.object_path;
    contact_id := queue_row.contact_id; object_path := queue_row.object_path; claim_token := token;
    claimed := claimed + 1;
    return next;
  end loop;
end;
$$;

create function public.finish_credit_report_obsolete_object_v1(p_object_path text, p_claim_token uuid, p_failure_code text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare queue_row public.credit_report_obsolete_objects%rowtype;
begin
  select * into queue_row from public.credit_report_obsolete_objects where object_path = p_object_path;
  if not found then return 'missing'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(queue_row.contact_id::text, 9142));
  select * into queue_row from public.credit_report_obsolete_objects where object_path = p_object_path for update;
  if queue_row.reconciliation_token is distinct from p_claim_token then raise exception 'credit_report_claim_lost'; end if;
  if exists (select 1 from public.credit_report_uploads where object_path = p_object_path) then
    update public.credit_report_obsolete_objects set reconciliation_token = null, reconciliation_lease_until = null,
      next_attempt_at = now() + interval '1 hour', last_failure_code = null where object_path = p_object_path;
    return 'protected_current';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'credit-reports' and name = p_object_path) then
    if p_failure_code is null then raise exception 'credit_report_object_still_exists'; end if;
    if p_failure_code not in ('storage_check_failed', 'storage_remove_failed', 'database_check_failed', 'unexpected_error') then
      raise exception 'credit_report_failure_code_invalid';
    end if;
    update public.credit_report_obsolete_objects set reconciliation_token = null, reconciliation_lease_until = null,
      next_attempt_at = now() + interval '15 minutes', last_failure_code = p_failure_code where object_path = p_object_path;
    return 'deferred';
  end if;
  delete from public.credit_report_obsolete_objects where object_path = p_object_path and reconciliation_token = p_claim_token;
  return 'removed';
end;
$$;

create function public.release_credit_report_obsolete_object_v1(p_object_path text, p_claim_token uuid, p_failure_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target_contact uuid;
begin
  if p_failure_code not in ('storage_check_failed', 'storage_remove_failed', 'database_check_failed', 'unexpected_error') then
    raise exception 'credit_report_failure_code_invalid';
  end if;
  select contact_id into target_contact from public.credit_report_obsolete_objects where object_path = p_object_path;
  if target_contact is null then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_contact::text, 9142));
  update public.credit_report_obsolete_objects set reconciliation_token = null, reconciliation_lease_until = null,
    next_attempt_at = now() + interval '15 minutes', last_failure_code = p_failure_code
  where object_path = p_object_path and reconciliation_token = p_claim_token;
  return found;
end;
$$;

create or replace function public.purge_crm_contact_v1(p_contact_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_contact_id::text, 9142));
  if not exists (select 1 from public.credit_report_purge_blocks where contact_id = p_contact_id) then
    raise exception 'credit_report_purge_not_prepared';
  end if;
  if exists (select 1 from public.credit_report_upload_attempts where contact_id = p_contact_id and state = 'pending') then
    raise exception 'credit_report_upload_still_pending';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'credit-reports' and name like p_contact_id::text || '/%') then
    raise exception 'credit_report_files_not_deleted';
  end if;
  delete from public.credit_report_uploads where contact_id = p_contact_id;
  delete from public.credit_report_upload_sessions where contact_id = p_contact_id;
  -- Keep abandoned rows as restricted exact-path tombstones so a late Storage
  -- completion can be removed by later bounded reconciliation passes.
  delete from public.credit_report_upload_attempts where contact_id = p_contact_id and state = 'completed';
  delete from public.credit_report_obsolete_objects where contact_id = p_contact_id;
  perform public.purge_crm_contact_records_v1(p_contact_id);
  return true;
end;
$$;

revoke all on function public.renew_credit_report_upload_v1(uuid) from public, anon, authenticated;
revoke all on function public.credit_report_reconciliation_counts_v1(integer,uuid) from public, anon, authenticated;
revoke all on function public.claim_credit_report_attempts_v1(integer,uuid) from public, anon, authenticated;
revoke all on function public.finish_credit_report_attempt_reconciliation_v1(uuid,uuid,boolean,boolean) from public, anon, authenticated;
revoke all on function public.release_credit_report_attempt_reconciliation_v1(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.enqueue_credit_report_obsolete_object_v1(uuid,text) from public, anon, authenticated;
revoke all on function public.claim_credit_report_obsolete_objects_v1(integer,uuid) from public, anon, authenticated;
revoke all on function public.finish_credit_report_obsolete_object_v1(text,uuid,text) from public, anon, authenticated;
revoke all on function public.release_credit_report_obsolete_object_v1(text,uuid,text) from public, anon, authenticated;
grant execute on function public.renew_credit_report_upload_v1(uuid) to service_role;
grant execute on function public.credit_report_reconciliation_counts_v1(integer,uuid) to service_role;
grant execute on function public.claim_credit_report_attempts_v1(integer,uuid) to service_role;
grant execute on function public.finish_credit_report_attempt_reconciliation_v1(uuid,uuid,boolean,boolean) to service_role;
grant execute on function public.release_credit_report_attempt_reconciliation_v1(uuid,uuid,text) to service_role;
grant execute on function public.enqueue_credit_report_obsolete_object_v1(uuid,text) to service_role;
grant execute on function public.claim_credit_report_obsolete_objects_v1(integer,uuid) to service_role;
grant execute on function public.finish_credit_report_obsolete_object_v1(text,uuid,text) to service_role;
grant execute on function public.release_credit_report_obsolete_object_v1(text,uuid,text) to service_role;
