create or replace function public.clear_booking_google_event(p_booking_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.bookings
  set provider = null, provider_event_id = null, updated_at = now()
  where id = p_booking_id;
  if not found then raise exception 'booking_not_found'; end if;
end;
$$;

revoke all on function public.clear_booking_google_event(uuid) from public,anon,authenticated;
grant execute on function public.clear_booking_google_event(uuid) to service_role;
