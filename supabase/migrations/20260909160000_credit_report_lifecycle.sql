-- Reports survive recoverable CRM Trash. Access always requires an active
-- contact; permanent deletion coordinates private Storage with the database.
alter table public.credit_report_upload_sessions
  drop constraint credit_report_upload_sessions_submission_id_fkey,
  drop constraint credit_report_upload_sessions_contact_id_fkey;
alter table public.credit_report_uploads
  drop constraint credit_report_uploads_submission_id_fkey,
  drop constraint credit_report_uploads_contact_id_fkey;

create table public.credit_report_purge_blocks (
  contact_id uuid primary key,
  purge_started_at timestamptz not null default now()
);
create table public.credit_report_upload_attempts (
  id uuid primary key,
  session_id uuid not null,
  contact_id uuid not null,
  object_path text not null unique,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index credit_report_upload_attempts_contact_idx on public.credit_report_upload_attempts(contact_id);
alter table public.credit_report_purge_blocks enable row level security;
alter table public.credit_report_upload_attempts enable row level security;
revoke all on public.credit_report_purge_blocks, public.credit_report_upload_attempts from public, anon, authenticated;
grant all on public.credit_report_purge_blocks, public.credit_report_upload_attempts to service_role;

create function public.guard_credit_report_write_v1()
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
      select 1 from public.credit_report_upload_sessions
      where id = new.session_id and contact_id = new.contact_id and submission_id = new.submission_id and expires_at > now()
    ) then raise exception 'credit_report_session_unavailable'; end if;
  end if;
  return new;
end;
$$;
create trigger credit_report_session_write_guard
  before insert or update of contact_id, submission_id, token_hash on public.credit_report_upload_sessions
  for each row execute function public.guard_credit_report_write_v1();
create trigger credit_report_metadata_write_guard
  before insert or update on public.credit_report_uploads
  for each row execute function public.guard_credit_report_write_v1();

create function public.begin_credit_report_upload_v1(p_attempt_id uuid, p_session_id uuid, p_object_path text)
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
  insert into public.credit_report_upload_attempts(id, session_id, contact_id, object_path)
  values (p_attempt_id, p_session_id, session_row.contact_id, p_object_path);
  return true;
end;
$$;

create function public.finish_credit_report_upload_v1(p_attempt_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.credit_report_upload_attempts set completed_at = coalesce(completed_at, now()) where id = p_attempt_id;
  return found;
end;
$$;

create function public.begin_credit_report_purge_v1(p_contact_id uuid)
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
  select count(*) into pending_count from public.credit_report_upload_attempts where contact_id = p_contact_id and completed_at is null;
  return jsonb_build_object('found', true, 'pending', pending_count);
end;
$$;

-- Keep the existing CRM record cleanup, but require completed Storage cleanup
-- before its public service-role entry point can permanently delete a contact.
alter function public.purge_crm_contact_v1(uuid) rename to purge_crm_contact_records_v1;
revoke all on function public.purge_crm_contact_records_v1(uuid) from public, anon, authenticated, service_role;
create function public.purge_crm_contact_v1(p_contact_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_contact_id::text, 9142));
  if not exists (select 1 from public.credit_report_purge_blocks where contact_id = p_contact_id) then
    raise exception 'credit_report_purge_not_prepared';
  end if;
  if exists (select 1 from public.credit_report_upload_attempts where contact_id = p_contact_id and completed_at is null) then
    raise exception 'credit_report_upload_still_pending';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'credit-reports' and name like p_contact_id::text || '/%') then
    raise exception 'credit_report_files_not_deleted';
  end if;
  delete from public.credit_report_uploads where contact_id = p_contact_id;
  delete from public.credit_report_upload_sessions where contact_id = p_contact_id;
  delete from public.credit_report_upload_attempts where contact_id = p_contact_id;
  perform public.purge_crm_contact_records_v1(p_contact_id);
  -- The marker remains to reject late/replayed upload registrations.
  return true;
end;
$$;

revoke all on function public.guard_credit_report_write_v1() from public, anon, authenticated;
revoke all on function public.begin_credit_report_upload_v1(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.finish_credit_report_upload_v1(uuid) from public, anon, authenticated;
revoke all on function public.begin_credit_report_purge_v1(uuid) from public, anon, authenticated;
revoke all on function public.purge_crm_contact_v1(uuid) from public, anon, authenticated;
grant execute on function public.begin_credit_report_upload_v1(uuid, uuid, text) to service_role;
grant execute on function public.finish_credit_report_upload_v1(uuid) to service_role;
grant execute on function public.begin_credit_report_purge_v1(uuid) to service_role;
grant execute on function public.purge_crm_contact_v1(uuid) to service_role;
