-- Backups are complete snapshots. Restoring an older v1 snapshot explicitly
-- removes newer live records along with the rest of the replaced CRM data.
-- Imported participants are paused and old joining credentials are revoked.
create function public.upgrade_live_crm_rows_v1(p_table text,p_rows jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(case p_table
    when 'contacts' then jsonb_build_object('stage_mode','manual')||v
    when 'sequence_enrollments' then jsonb_build_object('context_key','legacy','live_registration_id',null)||v
    when 'scheduled_messages' then jsonb_build_object('delivery_key',v->>'template_key')||v
    when 'live_webinar_sessions' then v||jsonb_build_object('automation_enabled',false)
    when 'live_webinar_registrations' then v||jsonb_build_object('notifications_paused',true,'access_version',coalesce((v->>'access_version')::integer,1)+1)
    else v end),'[]'::jsonb)
  from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) v;
$$;

alter function public.export_crm_contact_v1(uuid) rename to export_crm_contact_pre_live_v1;
revoke all on function public.export_crm_contact_pre_live_v1(uuid) from public,anon,authenticated,service_role;
create function public.export_crm_contact_v1(p_contact_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.export_crm_contact_pre_live_v1(p_contact_id)||jsonb_build_object(
    'version',2,
    'liveWebinarRegistrations',coalesce((select jsonb_agg(to_jsonb(r) order by r.registered_at) from public.live_webinar_registrations r where r.contact_id=p_contact_id),'[]'::jsonb),
    'liveWebinarSessions',coalesce((select jsonb_agg(to_jsonb(s) order by s.starts_at) from public.live_webinar_sessions s where s.id in (
      select session_id from public.live_webinar_registrations where contact_id=p_contact_id
      union select live_session_id from public.bookings where contact_id=p_contact_id and live_session_id is not null
    )),'[]'::jsonb));
$$;

alter function public.export_crm_backup_v1() rename to export_crm_backup_pre_live_v1;
revoke all on function public.export_crm_backup_pre_live_v1() from public,anon,authenticated,service_role;
create function public.export_crm_backup_v2()
returns jsonb language sql stable security definer set search_path = '' as $$
  with base as materialized (select public.export_crm_backup_pre_live_v1() as payload)
  select jsonb_set(jsonb_set(base.payload,'{version}','2'::jsonb),'{tables}',
    (base.payload->'tables')||jsonb_build_object(
      'live_webinar_sessions',coalesce((select jsonb_agg(to_jsonb(s)) from public.live_webinar_sessions s),'[]'::jsonb),
      'live_webinar_registrations',coalesce((select jsonb_agg(to_jsonb(r)) from public.live_webinar_registrations r),'[]'::jsonb)
    )) from base;
$$;
create function public.export_crm_backup_v1()
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.export_crm_backup_v2();
$$;

revoke all on function public.upgrade_live_crm_rows_v1(text,jsonb),public.export_crm_contact_v1(uuid),
  public.export_crm_backup_v2(),public.export_crm_backup_v1() from public,anon,authenticated;
-- The pure row upgrader is needed by the existing SECURITY INVOKER trash restore.
grant execute on function public.upgrade_live_crm_rows_v1(text,jsonb) to authenticated,service_role;
grant execute on function public.export_crm_contact_v1(uuid),public.export_crm_backup_v2(),public.export_crm_backup_v1() to service_role;

create or replace function public.restore_crm_backup_v1(p_backup jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare table_data jsonb := p_backup->'tables'; restored_contacts integer;
begin
  if coalesce(p_backup->>'format', '') <> 'vance-crm-backup' or coalesce((p_backup->>'version')::integer, 0) not in (1,2) then raise exception 'unsupported_backup_format'; end if;
  if jsonb_typeof(table_data) <> 'object' then raise exception 'missing_backup_tables'; end if;

  -- Explicit predicates are required by Supabase's safe-update guard. These are
  -- intentionally whole-table replacements inside this single transaction.
  delete from public.scheduled_messages where id is not null;
  delete from public.sequence_enrollments where id is not null;
  delete from public.bookings where id is not null;
  delete from public.notes where id is not null;
  delete from public.tasks where id is not null;
  delete from public.contact_tags where contact_id is not null;
  delete from public.tags where id is not null;
  delete from public.events where id is not null;
  delete from public.live_webinar_registrations where id is not null;
  delete from public.contacts where id is not null;
  delete from public.live_webinar_sessions where id is not null;
  delete from public.settings where key is not null;

  insert into public.contacts select * from jsonb_populate_recordset(null::public.contacts, public.upgrade_live_crm_rows_v1('contacts',table_data->'contacts'));
  get diagnostics restored_contacts = row_count;
  insert into public.events select * from jsonb_populate_recordset(null::public.events, coalesce(table_data->'events', '[]'::jsonb));
  insert into public.notes select * from jsonb_populate_recordset(null::public.notes, coalesce(table_data->'notes', '[]'::jsonb));
  insert into public.tasks select * from jsonb_populate_recordset(null::public.tasks, coalesce(table_data->'tasks', '[]'::jsonb));
  insert into public.tags select * from jsonb_populate_recordset(null::public.tags, coalesce(table_data->'tags', '[]'::jsonb));
  insert into public.contact_tags select * from jsonb_populate_recordset(null::public.contact_tags, coalesce(table_data->'contact_tags', '[]'::jsonb));
  insert into public.live_webinar_sessions select * from jsonb_populate_recordset(null::public.live_webinar_sessions, public.upgrade_live_crm_rows_v1('live_webinar_sessions',table_data->'live_webinar_sessions'));
  insert into public.live_webinar_registrations select * from jsonb_populate_recordset(null::public.live_webinar_registrations, public.upgrade_live_crm_rows_v1('live_webinar_registrations',table_data->'live_webinar_registrations'));
  insert into public.bookings select * from jsonb_populate_recordset(null::public.bookings, coalesce(table_data->'bookings', '[]'::jsonb));
  insert into public.sequence_enrollments select * from jsonb_populate_recordset(null::public.sequence_enrollments, public.upgrade_live_crm_rows_v1('sequence_enrollments',table_data->'sequence_enrollments'));
  insert into public.scheduled_messages select * from jsonb_populate_recordset(null::public.scheduled_messages, public.upgrade_live_crm_rows_v1('scheduled_messages',table_data->'scheduled_messages'));
  insert into public.settings select * from jsonb_populate_recordset(null::public.settings, coalesce(table_data->'settings', '[]'::jsonb));

  update public.scheduled_messages set status = 'cancelled', last_error = 'Restored from full CRM backup; not resent automatically', updated_at = now() where status in ('scheduled', 'sending');
  perform public.sync_crm_notifications();
  return jsonb_build_object('contacts', restored_contacts, 'restored_at', now());
end; $$;

revoke all on function public.restore_crm_backup_v1(jsonb) from public;
grant execute on function public.restore_crm_backup_v1(jsonb) to service_role;


create or replace function public.trash_contact(p_contact_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  contact_row public.contacts%rowtype;
  snapshot jsonb;
begin
  if not public.is_crm_admin() then raise exception 'administrator_required'; end if;

  select * into contact_row from public.contacts where id = p_contact_id for update;
  if not found then return false; end if;

  snapshot := jsonb_build_object(
    'contact', to_jsonb(contact_row),
    'live_webinar_registrations',coalesce((select jsonb_agg(to_jsonb(r)) from public.live_webinar_registrations r where r.contact_id=p_contact_id),'[]'::jsonb),
    'live_webinar_sessions',coalesce((select jsonb_agg(to_jsonb(s)) from public.live_webinar_sessions s where s.id in (
      select session_id from public.live_webinar_registrations where contact_id=p_contact_id
      union select live_session_id from public.bookings where contact_id=p_contact_id and live_session_id is not null
    )),'[]'::jsonb),
    'tags', coalesce((select jsonb_agg(t.name::text order by t.name::text) from public.contact_tags ct join public.tags t on t.id = ct.tag_id where ct.contact_id = p_contact_id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e)) from public.events e where e.email = contact_row.email or e.contact_id = p_contact_id), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(to_jsonb(n)) from public.notes n where n.contact_id = p_contact_id), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t)) from public.tasks t where t.contact_id = p_contact_id), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(to_jsonb(b)) from public.bookings b where b.contact_id = p_contact_id), '[]'::jsonb),
    'enrollments', coalesce((select jsonb_agg(to_jsonb(se)) from public.sequence_enrollments se where se.contact_id = p_contact_id), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(to_jsonb(sm)) from public.scheduled_messages sm where sm.contact_id = p_contact_id), '[]'::jsonb)
  );

  insert into public.contact_trash(contact_id, email, name, payload, deleted_by, deleted_at)
  values (p_contact_id, contact_row.email, contact_row.name, snapshot, (select auth.uid()), now())
  on conflict (contact_id) do update set
    email = excluded.email, name = excluded.name, payload = excluded.payload,
    deleted_by = excluded.deleted_by, deleted_at = excluded.deleted_at;

  delete from public.events where email = contact_row.email or contact_id = p_contact_id;
  delete from public.contacts where id = p_contact_id;
  return true;
end;
$$;

create or replace function public.restore_contact_from_trash(p_contact_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  snapshot jsonb;
  restored_email public.citext;
begin
  if not public.is_crm_admin() then raise exception 'administrator_required'; end if;

  select payload, email into snapshot, restored_email
  from public.contact_trash where contact_id = p_contact_id for update;
  if not found then raise exception 'trash_entry_not_found'; end if;
  if exists (select 1 from public.contacts where email = restored_email) then
    raise exception 'contact_email_already_exists';
  end if;

  insert into public.contacts
  select (jsonb_populate_record(null::public.contacts, jsonb_build_object('stage_mode','manual') || (snapshot->'contact'))).*;

  insert into public.events
  select * from jsonb_populate_recordset(null::public.events, coalesce(snapshot->'events', '[]'::jsonb));
  insert into public.notes
  select * from jsonb_populate_recordset(null::public.notes, coalesce(snapshot->'notes', '[]'::jsonb));
  insert into public.tasks
  select * from jsonb_populate_recordset(null::public.tasks, coalesce(snapshot->'tasks', '[]'::jsonb));
  insert into public.live_webinar_sessions
  select * from jsonb_populate_recordset(null::public.live_webinar_sessions, public.upgrade_live_crm_rows_v1('live_webinar_sessions',snapshot->'live_webinar_sessions'))
  on conflict(id) do nothing;
  insert into public.live_webinar_registrations
  select * from jsonb_populate_recordset(null::public.live_webinar_registrations, public.upgrade_live_crm_rows_v1('live_webinar_registrations',snapshot->'live_webinar_registrations'));
  insert into public.bookings
  select * from jsonb_populate_recordset(null::public.bookings, coalesce(snapshot->'bookings', '[]'::jsonb));
  insert into public.sequence_enrollments
  select * from jsonb_populate_recordset(null::public.sequence_enrollments, public.upgrade_live_crm_rows_v1('sequence_enrollments',snapshot->'enrollments'));
  insert into public.scheduled_messages
  select * from jsonb_populate_recordset(null::public.scheduled_messages, public.upgrade_live_crm_rows_v1('scheduled_messages',snapshot->'messages'));

  insert into public.tags(name)
  select value::text::public.citext from jsonb_array_elements_text(coalesce(snapshot->'tags', '[]'::jsonb))
  on conflict (name) do nothing;
  insert into public.contact_tags(contact_id, tag_id)
  select p_contact_id, t.id
  from jsonb_array_elements_text(coalesce(snapshot->'tags', '[]'::jsonb)) tag_name
  join public.tags t on t.name = tag_name.value::public.citext
  on conflict do nothing;

  update public.scheduled_messages
  set status = 'cancelled', last_error = 'Restored from CRM trash; not resent automatically'
  where contact_id = p_contact_id and status in ('scheduled', 'sending');

  delete from public.contact_trash where contact_id = p_contact_id;
  return p_contact_id;
end;
$$;

revoke all on function public.trash_contact(uuid) from public;
revoke all on function public.restore_contact_from_trash(uuid) from public;
grant execute on function public.trash_contact(uuid) to authenticated;
grant execute on function public.restore_contact_from_trash(uuid) to authenticated;
