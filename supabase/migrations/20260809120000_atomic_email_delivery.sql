create or replace function public.claim_scheduled_email(p_email text, p_template_key text)
returns table (id uuid, template_key text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_id uuid;
begin
  update public.scheduled_messages as message
  set status = 'sending', attempts = message.attempts + 1, last_error = null, updated_at = now()
  where message.id = (
    select queued.id
    from public.scheduled_messages as queued
    join public.contacts as contact on contact.id = queued.contact_id
    where contact.email = lower(trim(p_email))
      and queued.template_key = p_template_key
      and queued.status = 'scheduled'
      and queued.scheduled_for <= now() + interval '1 minute'
    order by queued.scheduled_for, queued.id
    for update of queued skip locked
    limit 1
  )
  returning message.id into claimed_id;

  if claimed_id is not null then
    return query
      select claimed_id, p_template_key;
  end if;
end;
$$;

revoke all on function public.claim_scheduled_email(text, text) from public, anon, authenticated;
grant execute on function public.claim_scheduled_email(text, text) to service_role;

