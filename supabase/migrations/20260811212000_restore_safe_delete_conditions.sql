create or replace function public.restore_crm_backup_v1(p_backup jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare table_data jsonb := p_backup->'tables'; restored_contacts integer;
begin
  if coalesce(p_backup->>'format', '') <> 'vance-crm-backup' or coalesce((p_backup->>'version')::integer, 0) <> 1 then raise exception 'unsupported_backup_format'; end if;
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
  delete from public.contacts where id is not null;
  delete from public.settings where key is not null;

  insert into public.contacts select * from jsonb_populate_recordset(null::public.contacts, coalesce(table_data->'contacts', '[]'::jsonb));
  get diagnostics restored_contacts = row_count;
  insert into public.events select * from jsonb_populate_recordset(null::public.events, coalesce(table_data->'events', '[]'::jsonb));
  insert into public.notes select * from jsonb_populate_recordset(null::public.notes, coalesce(table_data->'notes', '[]'::jsonb));
  insert into public.tasks select * from jsonb_populate_recordset(null::public.tasks, coalesce(table_data->'tasks', '[]'::jsonb));
  insert into public.tags select * from jsonb_populate_recordset(null::public.tags, coalesce(table_data->'tags', '[]'::jsonb));
  insert into public.contact_tags select * from jsonb_populate_recordset(null::public.contact_tags, coalesce(table_data->'contact_tags', '[]'::jsonb));
  insert into public.bookings select * from jsonb_populate_recordset(null::public.bookings, coalesce(table_data->'bookings', '[]'::jsonb));
  insert into public.sequence_enrollments select * from jsonb_populate_recordset(null::public.sequence_enrollments, coalesce(table_data->'sequence_enrollments', '[]'::jsonb));
  insert into public.scheduled_messages select * from jsonb_populate_recordset(null::public.scheduled_messages, coalesce(table_data->'scheduled_messages', '[]'::jsonb));
  insert into public.settings select * from jsonb_populate_recordset(null::public.settings, coalesce(table_data->'settings', '[]'::jsonb));

  update public.scheduled_messages set status = 'cancelled', last_error = 'Restored from full CRM backup; not resent automatically', updated_at = now() where status in ('scheduled', 'sending');
  perform public.sync_crm_notifications();
  return jsonb_build_object('contacts', restored_contacts, 'restored_at', now());
end; $$;

revoke all on function public.restore_crm_backup_v1(jsonb) from public;
grant execute on function public.restore_crm_backup_v1(jsonb) to service_role;

