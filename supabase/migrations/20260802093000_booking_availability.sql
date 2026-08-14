create or replace function public.get_booked_slots(
  p_from timestamptz,
  p_to timestamptz
)
returns table (starts_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to <= p_from or p_to > p_from + interval '60 days' then
    raise exception 'invalid_range';
  end if;

  return query
  select b.starts_at
  from public.bookings b
  where b.status in ('pending', 'confirmed')
    and b.starts_at >= p_from
    and b.starts_at < p_to
  order by b.starts_at;
end;
$$;

revoke all on function public.get_booked_slots(timestamptz, timestamptz) from public;
grant execute on function public.get_booked_slots(timestamptz, timestamptz) to anon, authenticated;
