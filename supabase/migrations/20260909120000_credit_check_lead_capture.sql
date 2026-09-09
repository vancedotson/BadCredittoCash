-- Dedicated lead magnet intake. No webinar registration, marketing consent,
-- sequence enrollment, or delivery calls are part of this transaction.
create or replace function public.submit_credit_check_v1(
  p_name text,
  p_email text,
  p_phone text,
  p_answers jsonb,
  p_first_touch jsonb default '{}'::jsonb,
  p_last_touch jsonb default '{}'::jsonb,
  p_visitor_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(p_email));
  contact_id uuid;
  submission_id uuid := gen_random_uuid();
  answer_summary text;
begin
  if p_name is null or length(trim(p_name)) < 2 or length(trim(p_name)) > 160 then raise exception 'invalid_name'; end if;
  if normalized_email is null or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(normalized_email) > 320 then raise exception 'invalid_email'; end if;
  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'invalid_phone'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or pg_column_size(p_answers) > 8192 then raise exception 'invalid_answers'; end if;
  if not (p_answers ?& array['how', 'recognize', 'report', 'disputed', 'urgency'])
    or (select count(*) from jsonb_object_keys(p_answers)) <> 5 then raise exception 'incomplete_answers'; end if;
  if jsonb_typeof(p_answers->'how') <> 'array' then raise exception 'invalid_how_answer'; end if;
  if jsonb_array_length(p_answers->'how') < 1 or jsonb_array_length(p_answers->'how') > 6 then raise exception 'invalid_how_answer'; end if;
  if exists (select 1 from jsonb_array_elements(p_answers->'how') a where jsonb_typeof(a) <> 'string') then raise exception 'invalid_how_answer'; end if;
  if exists (select 1 from jsonb_each(p_answers) a where a.key <> 'how' and jsonb_typeof(a.value) <> 'string') then raise exception 'invalid_answer_type'; end if;
  if jsonb_typeof(coalesce(p_first_touch, '{}'::jsonb)) <> 'object' or pg_column_size(coalesce(p_first_touch, '{}'::jsonb)) > 16384 then raise exception 'invalid_first_touch'; end if;
  if jsonb_typeof(coalesce(p_last_touch, '{}'::jsonb)) <> 'object' or pg_column_size(coalesce(p_last_touch, '{}'::jsonb)) > 16384 then raise exception 'invalid_last_touch'; end if;
  if p_visitor_id is not null and p_visitor_id !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception 'invalid_visitor_id'; end if;

  insert into public.contacts (name, email, phone, source, utm, first_touch, last_touch)
  values (
    trim(p_name), normalized_email, p_phone, 'credit-check',
    coalesce(p_last_touch, '{}'::jsonb), coalesce(p_first_touch, '{}'::jsonb), coalesce(p_last_touch, '{}'::jsonb)
  )
  on conflict (email) do nothing
  returning id into contact_id;

  -- Existing contacts retain their name, phone, owner, source, stage, suppression,
  -- and consent. The submitted details are saved in this intake's event + note.
  if contact_id is null then
    select c.id into contact_id from public.contacts c where c.email = normalized_email::public.citext for key share;
  end if;
  if contact_id is null then raise exception 'contact_unavailable'; end if;

  insert into public.events (id, event_key, contact_id, email, visitor_id, client_event_id, properties)
  values (
    submission_id, 'credit_check_submitted', contact_id, normalized_email, p_visitor_id,
    'credit-check:' || submission_id::text,
    jsonb_build_object(
      'source', 'credit-check', 'version', 1, 'name', trim(p_name), 'phone', p_phone,
      'answers', p_answers, 'firstTouch', coalesce(p_first_touch, '{}'::jsonb),
      'lastTouch', coalesce(p_last_touch, '{}'::jsonb)
    )
  );

  select string_agg(
    question.label || ': ' || case
      when jsonb_typeof(p_answers->question.key) = 'array' then
        (select string_agg(answer, ', ') from jsonb_array_elements_text(p_answers->question.key) answer)
      else p_answers->>question.key
    end,
    E'\n' order by question.position
  ) into answer_summary
  from (values
    (1, 'how', 'How they contact you'),
    (2, 'recognize', 'Do you recognize the debt'),
    (3, 'report', 'On your credit report'),
    (4, 'disputed', 'Have you disputed it'),
    (5, 'urgency', 'How soon you want it handled')
  ) as question(position, key, label);

  insert into public.notes (contact_id, body)
  values (
    contact_id,
    'Credit-check lead magnet' || E'\n' || 'Submitted name: ' || trim(p_name) || E'\n'
    || 'Email: ' || normalized_email || E'\n' || 'Phone: ' || p_phone || E'\n\n' || answer_summary
  );

  return submission_id;
end;
$$;

revoke all on function public.submit_credit_check_v1(text, text, text, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.submit_credit_check_v1(text, text, text, jsonb, jsonb, jsonb, text) to service_role;
