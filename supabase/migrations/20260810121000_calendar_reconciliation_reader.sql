create or replace function public.list_google_bookings_for_reconciliation(p_limit integer default 25)
returns table (
  booking_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  provider_event_id text
)
language sql stable security definer set search_path = ''
as $$
  select booking.id, booking.starts_at, booking.ends_at, booking.timezone,
    booking.provider_event_id
  from public.bookings as booking
  where booking.status in ('pending','confirmed')
    and booking.provider = 'google_calendar'
    and booking.provider_event_id is not null
    and booking.ends_at >= now()
    and booking.starts_at <= now() + interval '370 days'
  order by booking.starts_at
  limit greatest(1, least(coalesce(p_limit, 25), 50));
$$;

revoke all on function public.list_google_bookings_for_reconciliation(integer)
from public,anon,authenticated;
grant execute on function public.list_google_bookings_for_reconciliation(integer)
to service_role;
