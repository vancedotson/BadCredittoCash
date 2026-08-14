create table if not exists public.contact_trash (
  contact_id uuid primary key,
  email public.citext not null,
  name text not null,
  payload jsonb not null,
  deleted_by uuid references public.crm_users(user_id) on delete set null,
  deleted_at timestamptz not null default now()
);

create index if not exists contact_trash_deleted_at_idx on public.contact_trash(deleted_at desc);

alter table public.contact_trash enable row level security;
create policy contact_trash_admin_all on public.contact_trash
  for all to authenticated using (public.is_crm_admin()) with check (public.is_crm_admin());
grant select, insert, update, delete on public.contact_trash to authenticated;

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
  select (jsonb_populate_record(null::public.contacts, snapshot->'contact')).*;

  insert into public.events
  select * from jsonb_populate_recordset(null::public.events, coalesce(snapshot->'events', '[]'::jsonb));
  insert into public.notes
  select * from jsonb_populate_recordset(null::public.notes, coalesce(snapshot->'notes', '[]'::jsonb));
  insert into public.tasks
  select * from jsonb_populate_recordset(null::public.tasks, coalesce(snapshot->'tasks', '[]'::jsonb));
  insert into public.bookings
  select * from jsonb_populate_recordset(null::public.bookings, coalesce(snapshot->'bookings', '[]'::jsonb));
  insert into public.sequence_enrollments
  select * from jsonb_populate_recordset(null::public.sequence_enrollments, coalesce(snapshot->'enrollments', '[]'::jsonb));
  insert into public.scheduled_messages
  select * from jsonb_populate_recordset(null::public.scheduled_messages, coalesce(snapshot->'messages', '[]'::jsonb));

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
