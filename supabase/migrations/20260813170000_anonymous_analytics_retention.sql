create index if not exists events_anonymous_retention_idx
on public.events (occurred_at, id)
where contact_id is null and email is null;

create or replace function public.cleanup_anonymous_analytics_v1(
  p_batch_size integer default 500
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if p_batch_size < 1 or p_batch_size > 1000 then
    raise exception 'invalid_batch_size';
  end if;

  with expired as (
    select id
    from public.events
    where contact_id is null
      and email is null
      and occurred_at < now() - interval '90 days'
    order by occurred_at, id
    limit p_batch_size
    for update skip locked
  )
  delete from public.events as event
  using expired
  where event.id = expired.id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_anonymous_analytics_v1(integer) from public, anon, authenticated;
grant execute on function public.cleanup_anonymous_analytics_v1(integer) to service_role;

comment on function public.cleanup_anonymous_analytics_v1(integer) is
  'Deletes at most 1,000 unclaimed anonymous events older than 90 days. Contact and email-linked CRM history is preserved.';
