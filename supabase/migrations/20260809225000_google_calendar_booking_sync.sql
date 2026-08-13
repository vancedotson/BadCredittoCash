create or replace function public.set_booking_google_event(
  p_booking_id uuid,
  p_provider_event_id text
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if nullif(p_provider_event_id, '') is null or length(p_provider_event_id) > 500 then
    raise exception 'invalid_provider_event_id';
  end if;
  update public.bookings
  set provider = 'google_calendar', provider_event_id = p_provider_event_id, updated_at = now()
  where id = p_booking_id;
  if not found then raise exception 'booking_not_found'; end if;
end;
$$;

create or replace function public.get_booking_calendar_details(p_booking_id uuid)
returns table (
  booking_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  status public.booking_status,
  provider_event_id text,
  contact_name text,
  contact_email text,
  contact_phone text
)
language sql stable security definer set search_path = ''
as $$
  select booking.id, booking.starts_at, booking.ends_at, booking.timezone,
    booking.status, booking.provider_event_id, contact.name,
    contact.email::text, contact.phone
  from public.bookings as booking
  join public.contacts as contact on contact.id = booking.contact_id
  where booking.id = p_booking_id;
$$;

revoke all on function public.set_booking_google_event(uuid,text) from public,anon,authenticated;
revoke all on function public.get_booking_calendar_details(uuid) from public,anon,authenticated;
grant execute on function public.set_booking_google_event(uuid,text) to service_role;
grant execute on function public.get_booking_calendar_details(uuid) to service_role;
