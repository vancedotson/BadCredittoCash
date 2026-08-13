create extension if not exists pg_trgm;

create index if not exists contacts_name_trgm_idx
  on public.contacts using gin (lower(name) gin_trgm_ops);
create index if not exists contacts_email_trgm_idx
  on public.contacts using gin (lower(email::text) gin_trgm_ops);

create or replace function public.search_crm_contacts(
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
  p_page_size integer
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
    c.utm, c.stage, c.lost_reason,
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
      bool_or(e.event_key = 'call_booking_started') as booking_started,
      bool_or(e.event_key = 'offer_cta_clicked') as offer_clicked,
      bool_or(e.event_key in ('webinar_completed', 'webinar_watch_90', 'webinar_watch_75')) as high_watch,
      bool_or(e.event_key = 'webinar_watch_50') as mid_watch,
      bool_or(e.event_key in ('webinar_room_opened', 'webinar_watch_25')) as low_watch,
      bool_or(e.event_key in ('webinar_registered', 'webinar_confirmed_view')) as registered,
      case
        when bool_or(e.event_key = 'webinar_completed') then 100
        when bool_or(e.event_key = 'webinar_watch_90') then 90
        when bool_or(e.event_key = 'webinar_watch_75') then 75
        when bool_or(e.event_key = 'webinar_watch_50') then 50
        when bool_or(e.event_key = 'webinar_watch_25') then 25
        when bool_or(e.event_key = 'webinar_room_opened') then 5
        else 0
      end as watch_pct
    from public.events e
    where e.email = c.email
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

revoke all on function public.search_crm_contacts(text,text,text,text,text,text,text,text,text,integer,integer) from public;
grant execute on function public.search_crm_contacts(text,text,text,text,text,text,text,text,text,integer,integer) to authenticated;
