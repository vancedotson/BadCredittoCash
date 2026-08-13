create unique index if not exists bookings_active_slot_unique
on public.bookings (starts_at)
where status in ('pending', 'confirmed');

create or replace function public.book_funnel_call(
  p_name text,
  p_email text,
  p_phone text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text,
  p_intake_answers jsonb default '{}'::jsonb,
  p_utm jsonb default '{}'::jsonb
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(p_email));
  matched_contact public.contacts;
  result public.bookings;
begin
  if length(trim(p_name)) < 1 or length(trim(p_name)) > 160 then raise exception 'invalid_name'; end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid_email'; end if;
  if p_phone is not null and length(p_phone) > 40 then raise exception 'invalid_phone'; end if;
  if p_starts_at < now() or p_starts_at > now() + interval '45 days' then raise exception 'invalid_start'; end if;
  if p_ends_at <> p_starts_at + interval '30 minutes' then raise exception 'invalid_duration'; end if;
  if length(p_timezone) < 1 or length(p_timezone) > 100 then raise exception 'invalid_timezone'; end if;
  if pg_column_size(coalesce(p_intake_answers, '{}'::jsonb)) > 16384 then raise exception 'intake_too_large'; end if;

  insert into public.contacts (name, email, phone, source, utm, first_touch, last_touch, stage, stage_changed_at)
  values (trim(p_name), normalized_email, nullif(trim(p_phone), ''), 'booking', coalesce(p_utm, '{}'::jsonb), coalesce(p_utm, '{}'::jsonb), coalesce(p_utm, '{}'::jsonb), 'call_booked', now())
  on conflict (email) do update set
    name = excluded.name,
    phone = coalesce(excluded.phone, public.contacts.phone),
    last_touch = excluded.last_touch,
    stage = 'call_booked',
    stage_changed_at = case when public.contacts.stage <> 'call_booked' then now() else public.contacts.stage_changed_at end,
    updated_at = now()
  returning * into matched_contact;

  insert into public.bookings (contact_id, starts_at, ends_at, timezone, status, provider, intake_answers)
  values (matched_contact.id, p_starts_at, p_ends_at, p_timezone, 'confirmed', 'native', coalesce(p_intake_answers, '{}'::jsonb))
  returning * into result;

  insert into public.events (event_key, contact_id, email, properties)
  values ('call_booked', matched_contact.id, normalized_email, jsonb_build_object(
    'startsAt', p_starts_at,
    'endsAt', p_ends_at,
    'timezone', p_timezone,
    'intake', coalesce(p_intake_answers, '{}'::jsonb),
    'utm', coalesce(p_utm, '{}'::jsonb)
  ));

  return result;
end;
$$;

revoke all on function public.book_funnel_call(text, text, text, timestamptz, timestamptz, text, jsonb, jsonb) from public;
grant execute on function public.book_funnel_call(text, text, text, timestamptz, timestamptz, text, jsonb, jsonb) to anon, authenticated;
