alter table public.contacts add column if not exists consent_text text;
alter table public.contacts add column if not exists consent_country text;

create or replace function public.register_webinar_lead_v2(
  p_name text,
  p_email text,
  p_phone text default null,
  p_source text default 'vance-webinar',
  p_first_touch jsonb default '{}'::jsonb,
  p_last_touch jsonb default '{}'::jsonb,
  p_visitor_id text default null,
  p_marketing_consent boolean default false,
  p_consent_version text default null,
  p_consent_text text default null,
  p_consent_country text default null
)
returns public.contacts
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(p_email));
  normalized_visitor text := nullif(trim(p_visitor_id), '');
  result public.contacts;
begin
  if length(trim(p_name)) < 1 or length(trim(p_name)) > 160 then raise exception 'invalid_name'; end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(normalized_email) > 320 then raise exception 'invalid_email'; end if;
  if p_phone is not null and p_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'invalid_phone'; end if;
  if pg_column_size(coalesce(p_first_touch, '{}'::jsonb)) > 16384 then raise exception 'first_touch_too_large'; end if;
  if pg_column_size(coalesce(p_last_touch, '{}'::jsonb)) > 16384 then raise exception 'last_touch_too_large'; end if;
  if normalized_visitor is not null and length(normalized_visitor) > 100 then raise exception 'invalid_visitor_id'; end if;
  if p_consent_version is null or length(p_consent_version) > 100 then raise exception 'invalid_consent_version'; end if;
  if p_consent_text is null or length(p_consent_text) > 1000 then raise exception 'invalid_consent_text'; end if;
  if p_consent_country is not null and p_consent_country !~ '^[A-Z]{2}$' then raise exception 'invalid_consent_country'; end if;

  insert into public.contacts (
    name, email, phone, source, utm, first_touch, last_touch,
    marketing_consent, consent_version, consent_text, consent_at, consent_country
  )
  values (
    trim(p_name), normalized_email, p_phone,
    coalesce(nullif(trim(p_source), ''), 'vance-webinar'),
    coalesce(p_last_touch, '{}'::jsonb), coalesce(p_first_touch, '{}'::jsonb), coalesce(p_last_touch, '{}'::jsonb),
    p_marketing_consent, p_consent_version, p_consent_text, now(), p_consent_country
  )
  on conflict (email) do update set
    name = excluded.name,
    phone = coalesce(excluded.phone, public.contacts.phone),
    source = excluded.source,
    utm = excluded.utm,
    first_touch = case when public.contacts.first_touch = '{}'::jsonb then excluded.first_touch else public.contacts.first_touch end,
    last_touch = excluded.last_touch,
    marketing_consent = excluded.marketing_consent,
    consent_version = excluded.consent_version,
    consent_text = excluded.consent_text,
    consent_at = excluded.consent_at,
    consent_country = excluded.consent_country,
    updated_at = now()
  returning * into result;

  if normalized_visitor is not null then
    update public.events set contact_id = result.id, email = normalized_email
    where visitor_id = normalized_visitor and contact_id is null;
  end if;

  insert into public.events (event_key, contact_id, email, visitor_id, client_event_id, properties)
  values (
    'webinar_registered', result.id, normalized_email, normalized_visitor,
    'registration:' || result.id::text,
    jsonb_build_object(
      'source', result.source,
      'firstTouch', coalesce(p_first_touch, '{}'::jsonb),
      'lastTouch', coalesce(p_last_touch, '{}'::jsonb),
      'marketingConsent', p_marketing_consent,
      'consentVersion', p_consent_version
    )
  )
  on conflict (client_event_id) do nothing;

  return result;
end;
$$;

revoke all on function public.register_webinar_lead_v2(text, text, text, text, jsonb, jsonb, text, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.register_webinar_lead_v2(text, text, text, text, jsonb, jsonb, text, boolean, text, text, text) to service_role;
