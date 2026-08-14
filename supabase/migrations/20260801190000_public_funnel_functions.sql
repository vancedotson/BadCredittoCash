create or replace function public.register_funnel_lead(
  p_name text,
  p_email text,
  p_phone text default null,
  p_source text default 'vance-webinar',
  p_utm jsonb default '{}'::jsonb
)
returns public.contacts
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(p_email));
  result public.contacts;
begin
  if length(trim(p_name)) < 1 or length(trim(p_name)) > 160 then
    raise exception 'invalid_name';
  end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(normalized_email::text) > 320 then
    raise exception 'invalid_email';
  end if;
  if p_phone is not null and length(p_phone) > 40 then
    raise exception 'invalid_phone';
  end if;

  insert into public.contacts (name, email, phone, source, utm, first_touch, last_touch)
  values (
    trim(p_name),
    normalized_email,
    nullif(trim(p_phone), ''),
    coalesce(nullif(trim(p_source), ''), 'vance-webinar'),
    coalesce(p_utm, '{}'::jsonb),
    coalesce(p_utm, '{}'::jsonb),
    coalesce(p_utm, '{}'::jsonb)
  )
  on conflict (email) do update set
    name = excluded.name,
    phone = coalesce(excluded.phone, public.contacts.phone),
    last_touch = excluded.last_touch,
    updated_at = now()
  returning * into result;

  return result;
end;
$$;

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
  result uuid;
  allowed_events constant text[] := array[
    'webinar_registered', 'email_queued', 'email_sent', 'webinar_confirmed_view',
    'quiz_started', 'quiz_completed', 'goal_replied', 'webinar_room_opened',
    'webinar_watch_25', 'webinar_watch_50', 'webinar_watch_75', 'webinar_watch_90', 'webinar_completed',
    'offer_cta_clicked', 'call_page_view', 'call_booking_started',
    'call_booked', 'call_booking_abandoned', 'cta_clicked'
  ];
begin
  if not (p_event_key = any(allowed_events)) then
    raise exception 'invalid_event';
  end if;
  if pg_column_size(coalesce(p_properties, '{}'::jsonb)) > 16384 then
    raise exception 'properties_too_large';
  end if;
  if p_client_event_id is not null and length(p_client_event_id) > 160 then
    raise exception 'invalid_event_id';
  end if;

  if normalized_email is not null then
    select id into matched_contact_id from public.contacts where email = normalized_email;
  end if;

  insert into public.events (event_key, contact_id, email, client_event_id, properties)
  values (p_event_key, matched_contact_id, normalized_email, nullif(p_client_event_id, ''), coalesce(p_properties, '{}'::jsonb))
  on conflict (client_event_id) do update set client_event_id = excluded.client_event_id
  returning id into result;

  return result;
end;
$$;

revoke all on function public.register_funnel_lead(text, text, text, text, jsonb) from public;
revoke all on function public.record_funnel_event(text, text, jsonb, text) from public;
grant execute on function public.register_funnel_lead(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.record_funnel_event(text, text, jsonb, text) to anon, authenticated;
