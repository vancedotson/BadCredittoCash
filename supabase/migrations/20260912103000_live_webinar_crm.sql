create or replace function public.search_crm_contacts_live_v1(
  p_search text,
  p_stage text,
  p_segment text,
  p_source text,
  p_owner text,
  p_tag text,
  p_view text,
  p_sort text,
  p_dir text,
  p_page integer,
  p_page_size integer,
  p_funnel text default null,
  p_session_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with enriched as (
  select
    c.id, c.name, c.email::text as email, c.phone,
    coalesce(c.utm->>'utm_source', c.source, 'direct') as source,
    c.utm, case when c.stage='call_booked' then 'booked' else c.stage end as stage, c.lost_reason,
    coalesce(c.owner_name, owner.display_name) as owner,
    c.created_at, c.updated_at, c.stage_changed_at,
    coalesce(tag_data.tags, array[]::text[]) as tags,
    coalesce(event_data.event_count, 0)::integer as event_count,
    coalesce(event_data.last_activity_at, c.updated_at, c.created_at) as last_activity_at,
    coalesce(event_data.watch_pct, 0)::integer as watch_pct,
    coalesce(event_data.booked, false) as booked,
    coalesce(note_data.note_count, 0)::integer as note_count,
    coalesce(task_data.open_task_count, 0)::integer as open_task_count,
    coalesce(task_data.has_overdue_task, false) as has_overdue_task,
    task_data.next_task,
    case
      when coalesce(event_data.booked, false) then 'booked'
      when coalesce(event_data.booking_started, false) then 'booking_abandon'
      when coalesce(event_data.offer_clicked, false) then 'offer_click_no_book'
      when coalesce(event_data.high_watch, false) then 'high_watch'
      when coalesce(event_data.mid_watch, false) then 'mid_watch'
      when coalesce(event_data.low_watch, false) then 'low_watch'
      when coalesce(event_data.registered, false) then 'registered_no_show'
      else 'lead'
    end as segment
  from public.contacts c
  left join public.crm_users owner on owner.user_id = c.owner_id
  left join lateral (
    select array_agg(t.name::text order by t.name::text) as tags
    from public.contact_tags ct
    join public.tags t on t.id = ct.tag_id
    where ct.contact_id = c.id
  ) tag_data on true
  left join lateral (
    select
      count(*) as event_count,
      max(e.occurred_at) as last_activity_at,
      bool_or(e.event_key = 'call_booked') as booked,
      bool_or(coalesce(e.properties->>'funnel','') <> 'live' and e.event_key = 'call_booking_started') as booking_started,
      bool_or(coalesce(e.properties->>'funnel','') <> 'live' and e.event_key = 'offer_cta_clicked') as offer_clicked,
      bool_or(coalesce(e.properties->>'funnel','') <> 'live' and e.event_key in ('webinar_completed', 'webinar_watch_90', 'webinar_watch_75')) as high_watch,
      bool_or(coalesce(e.properties->>'funnel','') <> 'live' and e.event_key = 'webinar_watch_50') as mid_watch,
      bool_or(coalesce(e.properties->>'funnel','') <> 'live' and e.event_key in ('webinar_room_opened', 'webinar_watch_25')) as low_watch,
      bool_or(coalesce(e.properties->>'funnel','') <> 'live' and e.event_key in ('webinar_registered', 'webinar_confirmed_view')) as registered,
      case
        when bool_or(coalesce(e.properties->>'funnel','') <> 'live' and e.event_key = 'webinar_completed') then 100
        when bool_or(coalesce(e.properties->>'funnel','') <> 'live' and e.event_key = 'webinar_watch_90') then 90
        when bool_or(coalesce(e.properties->>'funnel','') <> 'live' and e.event_key = 'webinar_watch_75') then 75
        when bool_or(coalesce(e.properties->>'funnel','') <> 'live' and e.event_key = 'webinar_watch_50') then 50
        when bool_or(coalesce(e.properties->>'funnel','') <> 'live' and e.event_key = 'webinar_watch_25') then 25
        when bool_or(coalesce(e.properties->>'funnel','') <> 'live' and e.event_key = 'webinar_room_opened') then 5
        else 0
      end as watch_pct
    from public.events e
    where e.contact_id = c.id or e.email = c.email
  ) event_data on true
  left join lateral (
    select count(*) as note_count from public.notes n where n.contact_id = c.id
  ) note_data on true
  left join lateral (
    select
      count(*) filter (where not t.done) as open_task_count,
      bool_or(not t.done and t.due_at < now()) as has_overdue_task,
      (array_agg(
        jsonb_build_object(
          'title', t.title,
          'dueDate', t.due_at,
          'overdue', t.due_at is not null and t.due_at < now()
        ) order by t.due_at asc nulls last
      ) filter (where not t.done))[1] as next_task
    from public.tasks t where t.contact_id = c.id
  ) task_data on true
), filtered as (
  select * from enriched e
  where (nullif(trim(p_search), '') is null
      or lower(e.name) like '%' || lower(trim(p_search)) || '%'
      or lower(e.email) like '%' || lower(trim(p_search)) || '%')
    and (nullif(p_stage, '') is null or e.stage = p_stage)
    and (p_session_id is null or exists(select 1 from public.live_webinar_registrations r where r.contact_id=e.id and r.session_id=p_session_id) or exists(select 1 from public.bookings b where b.contact_id=e.id and b.live_session_id=p_session_id))
    and (nullif(p_funnel,'') is null
      or (p_funnel='live' and (exists(select 1 from public.live_webinar_registrations r where r.contact_id=e.id) or exists(select 1 from public.events v where v.contact_id=e.id and v.properties->>'funnel'='live')))
      or (p_funnel='evergreen' and exists(select 1 from public.events v where v.contact_id=e.id and coalesce(v.properties->>'funnel','')<>'live' and v.event_key in ('webinar_registered','webinar_confirmed_view','webinar_room_opened'))))
    and (nullif(p_segment, '') is null or e.segment = p_segment)
    and (nullif(p_source, '') is null or e.source = p_source)
    and (nullif(p_owner, '') is null
      or (p_owner = '__none__' and e.owner is null)
      or (p_owner <> '__none__' and e.owner = p_owner))
    and (nullif(p_tag, '') is null or p_tag = any(e.tags))
    and (
      nullif(p_view, '') is null
      or (p_view = 'hot' and not e.booked and e.segment in ('high_watch', 'offer_click_no_book', 'booking_abandon'))
      or (p_view = 'nofollow' and not e.booked and e.open_task_count = 0 and e.segment in ('registered_no_show', 'low_watch', 'mid_watch', 'high_watch'))
      or (p_view = 'booked' and e.booked)
      or (p_view = 'clients' and e.stage = 'won')
      or (p_view = 'week' and e.created_at >= now() - interval '7 days')
    )
), ordered as (
  select * from filtered
  order by
    case when p_sort = 'name' and p_dir = 'asc' then name end asc,
    case when p_sort = 'name' and p_dir <> 'asc' then name end desc,
    case when p_sort = 'created' and p_dir = 'asc' then created_at end asc,
    case when p_sort = 'created' and p_dir <> 'asc' then created_at end desc,
    case when p_sort = 'stage' and p_dir = 'asc' then array_position(array['new','registered','engaged','booked','won','lost'], stage) end asc,
    case when p_sort = 'stage' and p_dir <> 'asc' then array_position(array['new','registered','engaged','booked','won','lost'], stage) end desc,
    case when p_sort = 'watch' and p_dir = 'asc' then watch_pct end asc,
    case when p_sort = 'watch' and p_dir <> 'asc' then watch_pct end desc,
    case when p_sort not in ('name','created','stage','watch') and p_dir = 'asc' then last_activity_at end asc,
    case when p_sort not in ('name','created','stage','watch') and p_dir <> 'asc' then last_activity_at end desc,
    id asc
), page_rows as (
  select * from ordered
  offset (greatest(1, p_page) - 1) * greatest(1, least(100000, p_page_size))
  limit greatest(1, least(100000, p_page_size))
), stage_counts as (
  select coalesce(jsonb_object_agg(stage, amount), '{}'::jsonb) as counts
  from (select stage, count(*) as amount from filtered group by stage) grouped
)
select jsonb_build_object(
  'rows', coalesce((select jsonb_agg(to_jsonb(page_rows)) from page_rows), '[]'::jsonb),
  'matchingIds', coalesce((select jsonb_agg(id) from filtered), '[]'::jsonb),
  'total', (select count(*) from filtered),
  'booked', (select count(*) from filtered where booked),
  'avgWatchPct', coalesce((select round(avg(watch_pct)) from filtered where watch_pct > 0), 0),
  'byStage', (select counts from stage_counts),
  'sources', coalesce((select jsonb_agg(source order by source) from (select distinct source from enriched) source_list), '[]'::jsonb)
);
$$;

revoke all on function public.search_crm_contacts_live_v1(text,text,text,text,text,text,text,text,text,integer,integer,text,uuid) from public;
grant execute on function public.search_crm_contacts_live_v1(text,text,text,text,text,text,text,text,text,integer,integer,text,uuid) to authenticated;

create or replace function public.search_crm_contacts(
  p_search text,p_stage text,p_segment text,p_source text,p_owner text,p_tag text,p_view text,p_sort text,p_dir text,p_page integer,p_page_size integer
)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select public.search_crm_contacts_live_v1(p_search,p_stage,p_segment,p_source,p_owner,p_tag,p_view,p_sort,p_dir,p_page,p_page_size,null,null);
$$;

create or replace function public.consume_rate_limit(
  p_bucket text,
  p_key_hash text,
  p_window_seconds integer,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_window timestamptz;
  current_count integer;
begin
  if p_bucket not in ('registration', 'booking', 'tracking', 'live-question', 'live-activity') then raise exception 'invalid_bucket'; end if;
  if p_key_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_key_hash'; end if;
  if p_window_seconds < 10 or p_window_seconds > 3600 then raise exception 'invalid_window'; end if;
  if p_limit < 1 or p_limit > 1000 then raise exception 'invalid_limit'; end if;

  current_window := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds);

  delete from public.rate_limit_counters
  where bucket = p_bucket and key_hash = p_key_hash
    and window_start < current_window - interval '1 hour';

  insert into public.rate_limit_counters (bucket, key_hash, window_start, request_count)
  values (p_bucket, p_key_hash, current_window, 1)
  on conflict (bucket, key_hash, window_start) do update
  set request_count = public.rate_limit_counters.request_count + 1
  returning request_count into current_count;

  return current_count <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;

create or replace function public.get_crm_funnel_metrics_v1(p_owner text default '')
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with identified_events as (
  select
    e.event_key,
    coalesce(e.contact_id::text, lower(e.email::text)) as identity_key
  from public.events e
  left join public.contacts c
    on c.id = e.contact_id or (e.contact_id is null and c.email = e.email)
  left join public.crm_users owner on owner.user_id = c.owner_id
  where (e.contact_id is not null or e.email is not null)
    and coalesce(e.properties->>'funnel','') <> 'live'
    and (
      nullif(p_owner, '') is null
      or (p_owner = '__none__' and c.id is not null and coalesce(c.owner_name, owner.display_name) is null)
      or (p_owner <> '__none__' and coalesce(c.owner_name, owner.display_name) = p_owner)
    )
), stages(event_key, stage_order) as (
  values
    ('webinar_registered', 1),
    ('webinar_confirmed_view', 2),
    ('webinar_room_opened', 3),
    ('webinar_watch_25', 4),
    ('webinar_watch_50', 5),
    ('webinar_watch_75', 6),
    ('webinar_watch_90', 7),
    ('webinar_completed', 8),
    ('call_booked', 9)
), counts as (
  select s.event_key, s.stage_order, count(distinct e.identity_key)::integer as amount
  from stages s
  left join identified_events e on e.event_key = s.event_key
  group by s.event_key, s.stage_order
)
select coalesce(jsonb_object_agg(event_key, amount order by stage_order), '{}'::jsonb)
from counts;
$$;

revoke all on function public.get_crm_funnel_metrics_v1(text) from public;
grant execute on function public.get_crm_funnel_metrics_v1(text) to authenticated;

comment on function public.get_crm_funnel_metrics_v1(text) is
  'Returns deduplicated CRM funnel counts directly from durable events, optionally filtered by owner.';


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
    'live_presence', 'live_question_asked', 'live_replay_opened', 'page_viewed', 'funnel_error', 'webinar_registered', 'email_queued', 'email_sent', 'webinar_confirmed_view',
    'quiz_started', 'quiz_completed', 'goal_replied', 'webinar_room_opened',
    'webinar_watch_25', 'webinar_watch_50', 'webinar_watch_75', 'webinar_watch_90', 'webinar_completed',
    'offer_cta_clicked', 'call_page_view', 'call_booking_started',
    'call_booked', 'call_booking_abandoned', 'cta_clicked'
  ];
begin
  if p_event_key in ('live_presence','live_question_asked','live_replay_opened') then raise exception 'live_participant_rpc_required'; end if;
  if not (p_event_key = any(allowed_events)) then raise exception 'invalid_event'; end if;
  if pg_column_size(coalesce(p_properties, '{}'::jsonb)) > 16384 then raise exception 'properties_too_large'; end if;
  if p_client_event_id is not null and length(p_client_event_id) > 160 then raise exception 'invalid_event_id'; end if;
  if event_visitor_id is not null and length(event_visitor_id) > 100 then raise exception 'invalid_visitor_id'; end if;

  if normalized_email is not null then
    select id into matched_contact_id from public.contacts where email = normalized_email;
  elsif event_visitor_id is not null then
    select contact_id into matched_contact_id from public.events where visitor_id = event_visitor_id and contact_id is not null order by occurred_at desc limit 1;
  end if;

  if matched_contact_id is not null and normalized_email is null then
    select email::text into normalized_email from public.contacts where id=matched_contact_id;
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

create or replace function public.notify_crm_users_of_high_intent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_contact public.contacts%rowtype;
  signal_label text;
begin
  if new.event_key not in (
    'live_question_asked',
    'webinar_watch_75',
    'webinar_watch_90',
    'webinar_completed',
    'offer_cta_clicked',
    'call_booking_started'
  ) then
    return new;
  end if;

  select c.*
  into matched_contact
  from public.contacts c
  where c.id = new.contact_id
     or (new.contact_id is null and new.email is not null and c.email = new.email)
  order by (c.id = new.contact_id) desc
  limit 1;

  if matched_contact.id is null then
    return new;
  end if;

  signal_label := case new.event_key
    when 'live_question_asked' then 'Asked a question during ' || coalesce(new.properties->>'sessionTitle','a live webinar')
    when 'webinar_watch_75' then 'Watched 75% of the training'
    when 'webinar_watch_90' then 'Watched 90% of the training'
    when 'webinar_completed' then 'Finished the training'
    when 'offer_cta_clicked' then 'Clicked to book a call'
    when 'call_booking_started' then 'Started booking a call'
  end;

  insert into public.crm_notifications (
    user_id,
    source_key,
    kind,
    title,
    subtitle,
    href,
    tone,
    contact_id
  )
  select
    u.user_id,
    'high-intent:' || matched_contact.id::text || case when new.properties->>'funnel'='live' then ':live:' || coalesce(new.properties->>'sessionId','direct') else '' end,
    'high_intent',
    matched_contact.name || ' is showing high intent',
    signal_label,
    '/crm/contacts/' || matched_contact.id::text,
    'success',
    matched_contact.id
  from public.crm_users u
  on conflict (user_id, source_key) do nothing;

  return new;
end;
$$;


create or replace function public.sync_crm_notifications()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare inserted_count integer := 0; new_count integer := 0;
begin
  insert into public.crm_notifications (
    user_id, source_key, kind, title, subtitle, href, tone, contact_id, task_id
  )
  select u.user_id,
    'overdue:' || t.id::text || ':' || extract(epoch from t.due_at)::bigint::text,
    'overdue', t.title, c.name || ' · overdue', '/crm/contacts/' || c.id::text,
    'danger', c.id, t.id
  from public.tasks t
  join public.contacts c on c.id = t.contact_id
  cross join public.crm_users u
  where not t.done and t.due_at is not null and t.due_at < now()
  on conflict (user_id, source_key) do nothing;
  get diagnostics inserted_count = row_count;

  with event_rollup as (
    select c.id as contact_id, c.name, c.email,
      max(e.occurred_at) as last_activity_at,
      bool_or((coalesce(e.properties->>'funnel','') <> 'live' or e.event_key='call_booked') and e.event_key in ('webinar_completed','webinar_watch_90','webinar_watch_75','offer_cta_clicked','call_booking_started')) as high_intent,
      bool_or(e.event_key = 'call_booked') as booked
    from public.contacts c
    join public.events e on e.email = c.email
    group by c.id, c.name, c.email
  )
  insert into public.crm_notifications (
    user_id, source_key, kind, title, subtitle, href, tone, contact_id
  )
  select u.user_id,
    'cooling:' || r.contact_id::text || ':' || extract(epoch from r.last_activity_at)::bigint::text,
    'cooling', r.name || ' is cooling off',
    floor(extract(epoch from (now() - r.last_activity_at)) / 86400)::integer::text || 'd quiet',
    '/crm/contacts/' || r.contact_id::text, 'warn', r.contact_id
  from event_rollup r
  cross join public.crm_users u
  where r.high_intent and not r.booked and r.last_activity_at <= now() - interval '2 days'
  on conflict (user_id, source_key) do nothing;
  get diagnostics new_count = row_count;
  inserted_count := inserted_count + new_count;

  with event_rollup as (
    select c.id as contact_id, c.name,
      max(e.occurred_at) as last_activity_at,
      bool_or((coalesce(e.properties->>'funnel','') <> 'live' or e.event_key='call_booked') and e.event_key in ('webinar_registered','webinar_confirmed_view','webinar_room_opened','webinar_watch_25','webinar_watch_50')) as needs_followup,
      bool_or((coalesce(e.properties->>'funnel','') <> 'live' or e.event_key='call_booked') and e.event_key in ('webinar_completed','webinar_watch_90','webinar_watch_75','offer_cta_clicked','call_booking_started','call_booked')) as progressed
    from public.contacts c
    join public.events e on e.email = c.email
    group by c.id, c.name
  )
  insert into public.crm_notifications (
    user_id, source_key, kind, title, subtitle, href, tone, contact_id
  )
  select u.user_id,
    'nofollow:' || r.contact_id::text || ':' || extract(epoch from r.last_activity_at)::bigint::text,
    'nofollow', 'No follow-up set for ' || r.name,
    floor(extract(epoch from (now() - r.last_activity_at)) / 86400)::integer::text || 'd quiet',
    '/crm/contacts/' || r.contact_id::text, 'neutral', r.contact_id
  from event_rollup r
  cross join public.crm_users u
  where r.needs_followup and not r.progressed
    and r.last_activity_at <= now() - interval '3 days'
    and not exists (select 1 from public.tasks t where t.contact_id = r.contact_id and not t.done)
  on conflict (user_id, source_key) do nothing;
  get diagnostics new_count = row_count;
  inserted_count := inserted_count + new_count;

  update public.crm_notifications n set resolved_at = now()
  where n.resolved_at is null and (
    (n.kind = 'overdue' and not exists (
      select 1 from public.tasks t where t.id = n.task_id and not t.done and t.due_at is not null and t.due_at < now()
    ))
    or (n.kind = 'cooling' and not exists (
      select 1 from public.contacts c
      join public.events e on e.email = c.email
      where c.id = n.contact_id
      group by c.id
      having bool_or((coalesce(e.properties->>'funnel','') <> 'live' or e.event_key='call_booked') and e.event_key in ('webinar_completed','webinar_watch_90','webinar_watch_75','offer_cta_clicked','call_booking_started'))
        and not bool_or(e.event_key = 'call_booked')
        and max(e.occurred_at) <= now() - interval '2 days'
    ))
    or (n.kind = 'nofollow' and not exists (
      select 1 from public.contacts c
      join public.events e on e.email = c.email
      where c.id = n.contact_id
        and not exists (select 1 from public.tasks t where t.contact_id = c.id and not t.done)
      group by c.id
      having bool_or((coalesce(e.properties->>'funnel','') <> 'live' or e.event_key='call_booked') and e.event_key in ('webinar_registered','webinar_confirmed_view','webinar_room_opened','webinar_watch_25','webinar_watch_50'))
        and not bool_or((coalesce(e.properties->>'funnel','') <> 'live' or e.event_key='call_booked') and e.event_key in ('webinar_completed','webinar_watch_90','webinar_watch_75','offer_cta_clicked','call_booking_started','call_booked'))
        and max(e.occurred_at) <= now() - interval '3 days'
    ))
  );

  return jsonb_build_object('inserted', inserted_count);
end;
$$;

revoke all on function public.notify_crm_users_of_booking() from public;
revoke all on function public.sync_crm_notifications() from public;
grant execute on function public.sync_crm_notifications() to authenticated, service_role;
