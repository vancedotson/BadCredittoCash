create or replace function public.export_crm_backup_v1()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'format', 'vance-crm-backup',
    'version', 1,
    'exportedAt', now(),
    'tables', jsonb_build_object(
      'contacts', coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object('owner_id', null)) from public.contacts c), '[]'::jsonb),
      'events', coalesce((select jsonb_agg(to_jsonb(e)) from public.events e), '[]'::jsonb),
      'notes', coalesce((select jsonb_agg(to_jsonb(n) || jsonb_build_object('author_id', null)) from public.notes n), '[]'::jsonb),
      'tasks', coalesce((select jsonb_agg(to_jsonb(t) || jsonb_build_object('owner_id', null)) from public.tasks t), '[]'::jsonb),
      'tags', coalesce((select jsonb_agg(to_jsonb(t)) from public.tags t), '[]'::jsonb),
      'contact_tags', coalesce((select jsonb_agg(to_jsonb(ct)) from public.contact_tags ct), '[]'::jsonb),
      'bookings', coalesce((select jsonb_agg(to_jsonb(b)) from public.bookings b), '[]'::jsonb),
      'sequence_enrollments', coalesce((select jsonb_agg(to_jsonb(se)) from public.sequence_enrollments se), '[]'::jsonb),
      'scheduled_messages', coalesce((select jsonb_agg(to_jsonb(sm)) from public.scheduled_messages sm), '[]'::jsonb),
      'settings', coalesce((select jsonb_agg(to_jsonb(s) || jsonb_build_object('updated_by', null)) from public.settings s), '[]'::jsonb)
    )
  );
$$;

revoke all on function public.export_crm_backup_v1() from public;
grant execute on function public.export_crm_backup_v1() to service_role;

