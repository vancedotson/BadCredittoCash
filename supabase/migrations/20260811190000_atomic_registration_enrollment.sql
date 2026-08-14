create or replace function public.register_webinar_lead_and_enqueue_v1(
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
  p_consent_country text default null,
  p_messages jsonb default '[]'::jsonb
)
returns public.contacts
language plpgsql
security definer
set search_path = ''
as $$
declare
  registered_contact public.contacts;
begin
  select * into registered_contact
  from public.register_webinar_lead_v2(
    p_name,
    p_email,
    p_phone,
    p_source,
    p_first_touch,
    p_last_touch,
    p_visitor_id,
    p_marketing_consent,
    p_consent_version,
    p_consent_text,
    p_consent_country
  );

  perform public.enqueue_funnel_sequence(
    registered_contact.email,
    'pre_webinar',
    p_messages
  );

  perform public.record_funnel_event(
    'email_queued',
    registered_contact.email,
    jsonb_build_object(
      'sequence', 'pre_webinar',
      'name', 'Pre-webinar (get them to watch)',
      'emails', jsonb_array_length(p_messages)
    ),
    'registration-email-queued:' || registered_contact.id::text
  );

  return registered_contact;
end;
$$;

revoke all on function public.register_webinar_lead_and_enqueue_v1(
  text, text, text, text, jsonb, jsonb, text, boolean, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.register_webinar_lead_and_enqueue_v1(
  text, text, text, text, jsonb, jsonb, text, boolean, text, text, text, jsonb
) to service_role;
