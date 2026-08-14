create or replace function public.claim_operational_digest_v1(
  p_digest_key text,
  p_digest_date date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare affected_rows integer := 0;
begin
  insert into public.operational_digest_runs (digest_key, digest_date, status)
  values (p_digest_key, p_digest_date, 'processing')
  on conflict (digest_key, digest_date) do update
    set status = 'processing', last_error = null, updated_at = now()
    where public.operational_digest_runs.status = 'failed'
      and public.operational_digest_runs.updated_at <= now() - interval '5 minutes';
  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

create or replace function public.list_overdue_digest_tasks_v1(p_limit integer default 50)
returns table (title text, due_at timestamptz, contact_name text)
language sql
security definer
set search_path = ''
stable
as $$
  select task.title, task.due_at, contact.name
  from public.tasks task
  join public.contacts contact on contact.id = task.contact_id
  where not task.done and task.due_at is not null and task.due_at < now()
  order by task.due_at, task.id
  limit greatest(1, least(50, p_limit));
$$;

revoke all on function public.list_overdue_digest_tasks_v1(integer) from public, anon, authenticated;
grant execute on function public.list_overdue_digest_tasks_v1(integer) to service_role;
