create or replace function public.export_crm_contact_v1(p_contact_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  contact_row public.contacts%rowtype;
begin
  select * into contact_row from public.contacts where id = p_contact_id;
  if not found then return null; end if;

  return jsonb_build_object(
    'format', 'vance-crm-contact-export',
    'version', 1,
    'exportedAt', now(),
    'contact', to_jsonb(contact_row),
    'tags', coalesce((select jsonb_agg(to_jsonb(t) order by t.name::text) from public.contact_tags ct join public.tags t on t.id = ct.tag_id where ct.contact_id = p_contact_id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.occurred_at) from public.events e where e.contact_id = p_contact_id or e.email = contact_row.email), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at) from public.notes n where n.contact_id = p_contact_id), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.tasks t where t.contact_id = p_contact_id), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at) from public.bookings b where b.contact_id = p_contact_id), '[]'::jsonb),
    'sequenceEnrollments', coalesce((select jsonb_agg(to_jsonb(se) order by se.enrolled_at) from public.sequence_enrollments se where se.contact_id = p_contact_id), '[]'::jsonb),
    'scheduledMessages', coalesce((select jsonb_agg(to_jsonb(sm) order by sm.created_at) from public.scheduled_messages sm where sm.contact_id = p_contact_id), '[]'::jsonb),
    'providerEvents', coalesce((
      select jsonb_agg(to_jsonb(pe) order by pe.occurred_at)
      from public.email_provider_events pe
      where pe.provider_message_id in (
        select sm.provider_message_id from public.scheduled_messages sm
        where sm.contact_id = p_contact_id and sm.provider_message_id is not null
      )
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.set_crm_contact_suppression_v1(p_contact_id uuid, p_suppressed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_email public.citext;
begin
  update public.contacts
  set email_suppressed_at = case when p_suppressed then coalesce(email_suppressed_at, now()) else null end,
      email_suppression_reason = case when p_suppressed then 'crm_manual' else null end,
      marketing_consent = case when p_suppressed then false else marketing_consent end,
      unsubscribed_at = case when p_suppressed then coalesce(unsubscribed_at, now()) else null end,
      updated_at = now()
  where id = p_contact_id
  returning email into changed_email;
  if changed_email is null then return null; end if;

  if p_suppressed then
    update public.scheduled_messages
    set status = 'cancelled', last_error = 'Cancelled after manual CRM suppression', updated_at = now()
    where contact_id = p_contact_id and status in ('scheduled', 'sending', 'failed');
    update public.sequence_enrollments
    set status = 'stopped', stopped_at = now(), stop_reason = 'crm_manual_suppression'
    where contact_id = p_contact_id and status = 'active';
    insert into public.events(event_key, contact_id, email, client_event_id, properties)
    values ('email_unsubscribed', p_contact_id, changed_email, 'crm-suppression:' || p_contact_id::text, jsonb_build_object('source', 'crm_manual'))
    on conflict (client_event_id) do nothing;
  end if;

  return jsonb_build_object('contactId', p_contact_id, 'suppressed', p_suppressed);
end;
$$;

create or replace function public.purge_crm_contact_v1(p_contact_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  contact_email public.citext;
begin
  select email into contact_email from public.contacts where id = p_contact_id for update;
  if contact_email is null then
    select email into contact_email from public.contact_trash where contact_id = p_contact_id;
  end if;
  if contact_email is null then return false; end if;

  delete from public.email_provider_events
  where provider_message_id in (
    select provider_message_id from public.scheduled_messages
    where contact_id = p_contact_id and provider_message_id is not null
  );
  delete from public.scheduled_messages where contact_id = p_contact_id;
  delete from public.sequence_enrollments where contact_id = p_contact_id;
  delete from public.bookings where contact_id = p_contact_id;
  delete from public.notes where contact_id = p_contact_id;
  delete from public.tasks where contact_id = p_contact_id;
  delete from public.contact_tags where contact_id = p_contact_id;
  delete from public.events where contact_id = p_contact_id or email = contact_email;
  delete from public.crm_notifications where contact_id = p_contact_id;
  delete from public.contacts where id = p_contact_id;
  delete from public.contact_trash where contact_id = p_contact_id;
  delete from public.audit_log where entity_type = 'contact' and entity_id = p_contact_id::text;
  return true;
end;
$$;

revoke all on function public.export_crm_contact_v1(uuid) from public, anon, authenticated;
revoke all on function public.set_crm_contact_suppression_v1(uuid, boolean) from public, anon, authenticated;
revoke all on function public.purge_crm_contact_v1(uuid) from public, anon, authenticated;
grant execute on function public.export_crm_contact_v1(uuid) to service_role;
grant execute on function public.set_crm_contact_suppression_v1(uuid, boolean) to service_role;
grant execute on function public.purge_crm_contact_v1(uuid) to service_role;
