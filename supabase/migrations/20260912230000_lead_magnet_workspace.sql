-- CRM-only receipt metadata. Private report tables and Storage policies remain
-- service-only; downloads still use the authenticated contact-scoped endpoint.
create index if not exists events_credit_check_contact_date_idx
  on public.events(contact_id, occurred_at desc, id desc)
  where event_key = 'credit_check_submitted';
create index if not exists credit_report_uploads_contact_bureau_date_idx
  on public.credit_report_uploads(contact_id, bureau, uploaded_at desc, id desc);

create or replace function public.get_lead_magnet_workspace_v1(
  p_search text default '',
  p_status text default 'all',
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  result jsonb;
  search_term text := lower(left(trim(coalesce(p_search, '')), 200));
  status_filter text := case when p_status in ('waiting', 'partial', 'complete') then p_status else 'all' end;
  requested_page integer := greatest(1, coalesce(p_page, 1));
  page_size integer := greatest(1, least(100, coalesce(p_page_size, 25)));
begin
  if auth.uid() is null or not public.is_crm_user() then
    raise exception 'crm_membership_required' using errcode = '42501';
  end if;

  with intakes as materialized (
    select e.id, e.contact_id, e.occurred_at, e.properties
    from public.events e
    join public.contacts c on c.id = e.contact_id
    where e.event_key = 'credit_check_submitted'
      and not exists (select 1 from public.credit_report_purge_blocks b where b.contact_id = c.id)
  ), intake_counts as (
    select contact_id, min(occurred_at) as first_submitted_at, max(occurred_at) as last_submitted_at, count(*) as submission_count
    from intakes group by contact_id
  ), latest_intakes as (
    select distinct on (contact_id) contact_id, properties
    from intakes order by contact_id, occurred_at desc, id desc
  ), latest_reports as (
    select distinct on (u.contact_id, u.bureau)
      u.contact_id, u.id, u.submission_id, u.bureau, u.file_name, u.uploaded_at, u.byte_size
    from public.credit_report_uploads u
    -- Receipts survive backup restoration independently of intake events. Once
    -- this active person has an intake, include all their retained sessions.
    join intake_counts i on i.contact_id = u.contact_id
    join public.credit_report_upload_sessions s on s.id = u.session_id and s.contact_id = u.contact_id and s.submission_id = u.submission_id
    order by u.contact_id, u.bureau, u.uploaded_at desc, u.id desc
  ), report_counts as (
    select contact_id, count(*) as report_count, jsonb_agg(jsonb_build_object(
      'id', id, 'submissionId', submission_id, 'bureau', bureau,
      'fileName', file_name, 'uploadedAt', uploaded_at, 'byteSize', byte_size
    ) order by array_position(array['transunion','equifax','experian'], bureau)) as reports
    from latest_reports group by contact_id
  ), people as materialized (
    select c.id as contact_id, c.name, c.email::text as email, c.phone,
      coalesce(c.owner_name, owner.display_name) as owner,
      case when c.stage = 'call_booked' then 'booked'
        when c.stage in ('new','registered','engaged','booked','won','lost') then c.stage else 'new' end as stage,
      coalesce((select jsonb_agg(company order by position) from jsonb_array_elements(
        case when jsonb_typeof(latest.properties #> '{answers,companies}') = 'array'
          then latest.properties #> '{answers,companies}' else '[]'::jsonb end
      ) with ordinality selected(company, position) where jsonb_typeof(company) = 'string'), '[]'::jsonb) as companies,
      intake.first_submitted_at, intake.last_submitted_at, intake.submission_count,
      coalesce(reports.report_count, 0) as report_count, coalesce(reports.reports, '[]'::jsonb) as reports
    from intake_counts intake
    join public.contacts c on c.id = intake.contact_id
    join latest_intakes latest on latest.contact_id = intake.contact_id
    left join public.crm_users owner on owner.user_id = c.owner_id
    left join report_counts reports on reports.contact_id = c.id
  ), filtered as materialized (
    select * from people
    where (search_term = '' or strpos(lower(name), search_term) > 0 or strpos(lower(email), search_term) > 0)
      and (status_filter = 'all'
        or (status_filter = 'waiting' and report_count = 0)
        or (status_filter = 'partial' and report_count between 1 and 2)
        or (status_filter = 'complete' and report_count = 3))
  ), bounds as (
    select count(*) as total, least(requested_page::bigint, greatest(1::bigint, (count(*) + page_size - 1) / page_size)) as page from filtered
  ), page_rows as (
    select * from filtered order by last_submitted_at desc, contact_id
    offset (select (page - 1) * page_size from bounds) limit page_size
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'contactId', contact_id, 'name', name, 'email', email, 'phone', phone, 'owner', owner, 'stage', stage,
      'companies', companies, 'firstSubmittedAt', first_submitted_at, 'lastSubmittedAt', last_submitted_at,
      'submissionCount', submission_count, 'reports', reports
    ) order by last_submitted_at desc, contact_id) from page_rows), '[]'::jsonb),
    'total', (select total from bounds), 'page', (select page from bounds), 'pageSize', page_size,
    'summary', (select jsonb_build_object(
      'totalSignups', count(*), 'newLast30Days', count(*) filter (where first_submitted_at >= now() - interval '30 days'),
      'waiting', count(*) filter (where report_count = 0),
      'partial', count(*) filter (where report_count between 1 and 2), 'complete', count(*) filter (where report_count = 3)
    ) from people)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_lead_magnet_workspace_v1(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.get_lead_magnet_workspace_v1(text,text,integer,integer) to authenticated;
comment on function public.get_lead_magnet_workspace_v1(text,text,integer,integer) is
  'CRM members only: unique active credit-check participants, global signup/report counts, paginated metadata and latest receipt per bureau. No private Storage paths or upload capabilities.';
