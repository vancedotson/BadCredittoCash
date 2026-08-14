create or replace function public.is_crm_writer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.crm_users
    where user_id = (select auth.uid()) and role in ('admin', 'staff')
  );
$$;

revoke all on function public.is_crm_writer() from public;
grant execute on function public.is_crm_writer() to authenticated;

drop policy if exists contacts_crm_all on public.contacts;
drop policy if exists events_crm_all on public.events;
drop policy if exists notes_crm_all on public.notes;
drop policy if exists tasks_crm_all on public.tasks;
drop policy if exists tags_crm_all on public.tags;
drop policy if exists contact_tags_crm_all on public.contact_tags;
drop policy if exists bookings_crm_all on public.bookings;
drop policy if exists enrollments_crm_all on public.sequence_enrollments;
drop policy if exists messages_crm_all on public.scheduled_messages;

create policy contacts_crm_read on public.contacts for select to authenticated using (public.is_crm_user());
create policy contacts_crm_write on public.contacts for all to authenticated using (public.is_crm_writer()) with check (public.is_crm_writer());
create policy events_crm_read on public.events for select to authenticated using (public.is_crm_user());
create policy events_crm_write on public.events for all to authenticated using (public.is_crm_writer()) with check (public.is_crm_writer());
create policy notes_crm_read on public.notes for select to authenticated using (public.is_crm_user());
create policy notes_crm_write on public.notes for all to authenticated using (public.is_crm_writer()) with check (public.is_crm_writer());
create policy tasks_crm_read on public.tasks for select to authenticated using (public.is_crm_user());
create policy tasks_crm_write on public.tasks for all to authenticated using (public.is_crm_writer()) with check (public.is_crm_writer());
create policy tags_crm_read on public.tags for select to authenticated using (public.is_crm_user());
create policy tags_crm_write on public.tags for all to authenticated using (public.is_crm_writer()) with check (public.is_crm_writer());
create policy contact_tags_crm_read on public.contact_tags for select to authenticated using (public.is_crm_user());
create policy contact_tags_crm_write on public.contact_tags for all to authenticated using (public.is_crm_writer()) with check (public.is_crm_writer());
create policy bookings_crm_read on public.bookings for select to authenticated using (public.is_crm_user());
create policy bookings_crm_write on public.bookings for all to authenticated using (public.is_crm_writer()) with check (public.is_crm_writer());
create policy enrollments_crm_read on public.sequence_enrollments for select to authenticated using (public.is_crm_user());
create policy enrollments_crm_write on public.sequence_enrollments for all to authenticated using (public.is_crm_writer()) with check (public.is_crm_writer());
create policy messages_crm_read on public.scheduled_messages for select to authenticated using (public.is_crm_user());
create policy messages_crm_write on public.scheduled_messages for all to authenticated using (public.is_crm_writer()) with check (public.is_crm_writer());
