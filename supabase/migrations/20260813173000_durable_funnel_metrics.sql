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
