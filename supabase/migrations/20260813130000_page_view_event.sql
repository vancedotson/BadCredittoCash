create or replace function public.record_funnel_event(
  p_event_key text,
  p_email text default null,
  p_properties jsonb default '{}'::jsonb,
  p_client_event_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := nullif(lower(trim(p_email)), '');
  matched_contact_id uuid;
  event_visitor_id text := nullif(trim(p_properties->>'visitorId'), '');
  result uuid;
  allowed_events constant text[] := array[
    'page_viewed', 'webinar_registered', 'email_queued', 'email_sent', 'webinar_confirmed_view',
    'quiz_started', 'quiz_completed', 'goal_replied', 'webinar_room_opened',
    'webinar_watch_25', 'webinar_watch_50', 'webinar_watch_75', 'webinar_watch_90', 'webinar_completed',
    'offer_cta_clicked', 'call_page_view', 'call_booking_started',
    'call_booked', 'call_booking_abandoned', 'cta_clicked'
  ];
begin
  if not (p_event_key = any(allowed_events)) then raise exception 'invalid_event'; end if;
  if pg_column_size(coalesce(p_properties, '{}'::jsonb)) > 16384 then raise exception 'properties_too_large'; end if;
  if p_client_event_id is not null and length(p_client_event_id) > 160 then raise exception 'invalid_event_id'; end if;
  if event_visitor_id is not null and length(event_visitor_id) > 100 then raise exception 'invalid_visitor_id'; end if;

  if normalized_email is not null then
    select id into matched_contact_id from public.contacts where email = normalized_email;
  elsif event_visitor_id is not null then
    select contact_id into matched_contact_id from public.events where visitor_id = event_visitor_id and contact_id is not null order by occurred_at desc limit 1;
  end if;

  insert into public.events (event_key, contact_id, email, visitor_id, client_event_id, properties)
  values (p_event_key, matched_contact_id, normalized_email, event_visitor_id, nullif(p_client_event_id, ''), coalesce(p_properties, '{}'::jsonb))
  on conflict (client_event_id) do update set client_event_id = excluded.client_event_id
  returning id into result;
  return result;
end;
$$;

revoke all on function public.record_funnel_event(text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.record_funnel_event(text, text, jsonb, text) to service_role;
