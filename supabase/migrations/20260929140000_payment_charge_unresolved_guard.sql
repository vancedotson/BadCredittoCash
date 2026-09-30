-- Manual "Charge card" safety follow-up. Forward-only: nothing in
-- 20260929120000_payment_requests.sql or 20260929130000_payment_request_charge.sql
-- is edited.
--
-- 1. Any open charge row for the contact that has no charge_failed event blocks
--    every new charge until staff resolve it with Check status or cancel it,
--    regardless of its age. An open charge without a definite failure may have
--    charged the card: the Worker can die mid-charge, the best-effort
--    charge_unknown event can fail to record, the route can 500 on an
--    unexpected throw, and a held (responseCode 4) row stays open. The
--    two-minute guard alone let a second charge through once the window passed.
--    Inside the first two minutes the error is payment_charge_in_progress;
--    after that it is payment_charge_unresolved.
-- 2. get_payment_request_v1 reads one request by id, so Check status and the
--    charge result reload find a request however old it is (the list RPC is
--    capped at 200 rows).

-- Same signature as 20260929130000; only the charge guard changes.
create or replace function public.create_payment_request_v1(
  p_contact_id uuid, p_amount_cents integer, p_description text, p_actor_id uuid, p_reference text, p_link_token text,
  p_kind text default 'link'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_name text; contact_row public.contacts%rowtype; clean_description text := trim(coalesce(p_description, '')); new_id uuid;
  blocking_count integer; blocking_stale boolean;
begin
  select display_name into actor_name from public.crm_users where user_id = p_actor_id and role in ('admin', 'staff');
  if not found then raise exception 'payment_request_actor_invalid'; end if;
  if p_kind is null or p_kind not in ('link', 'charge') then raise exception 'payment_request_kind_invalid'; end if;
  select * into contact_row from public.contacts where id = p_contact_id;
  if not found then raise exception 'payment_request_contact_unavailable'; end if;
  if p_amount_cents is null or p_amount_cents < 100 or p_amount_cents > 2500000 then
    raise exception 'payment_request_amount_invalid';
  end if;
  if length(clean_description) < 3 or length(clean_description) > 255 or clean_description ~ '[[:cntrl:]]' then
    raise exception 'payment_request_description_invalid';
  end if;
  if p_kind = 'charge' then
    -- Serialize charges per contact so two concurrent clicks cannot both pass the guard.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_contact_id::text, 9143));
    -- Any open charge without a definite failure (charge_failed) blocks, whatever
    -- its age. If any blocking row is older than two minutes (or has no start
    -- time) the result is reported as unresolved rather than in progress.
    select count(*), coalesce(bool_or(q.charge_started_at is null
        or q.charge_started_at <= clock_timestamp() - interval '2 minutes'), false)
      into blocking_count, blocking_stale
      from public.payment_requests q
      where q.contact_id = p_contact_id and q.kind = 'charge' and q.status = 'open'
        and not exists (select 1 from public.payment_request_events ev where ev.request_id = q.id and ev.action = 'charge_failed');
    if blocking_count > 0 then
      if blocking_stale then raise exception 'payment_charge_unresolved'; end if;
      raise exception 'payment_charge_in_progress';
    end if;
  end if;
  insert into public.payment_requests(contact_id, reference, link_token, amount_cents, description, created_by, created_by_name, kind, charge_started_at)
  values (p_contact_id, p_reference, p_link_token, p_amount_cents, clean_description, p_actor_id, coalesce(actor_name, 'CRM user'),
    p_kind, case when p_kind = 'charge' then clock_timestamp() end)
  returning id into new_id;
  insert into public.payment_request_events(request_id, actor_id, actor_name, action, details)
  values (new_id, p_actor_id, coalesce(actor_name, 'CRM user'), 'created',
    jsonb_build_object('amountCents', p_amount_cents, 'reference', p_reference, 'kind', p_kind));
  insert into public.events(event_key, contact_id, email, properties)
  values ('payment_request_created', contact_row.id, contact_row.email, jsonb_build_object(
    'amountCents', p_amount_cents, 'reference', p_reference, 'description', clean_description, 'kind', p_kind));
  return public.payment_request_item_v1(new_id);
end;
$$;

-- One CRM item by id. Same actor rule as create/cancel (admin or staff), and
-- the same visibility as list_payment_requests_v1: NULL when the contact is
-- missing or trashed, or when the request belongs to another contact.
create function public.get_payment_request_v1(p_request_id uuid, p_contact_id uuid, p_actor_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.crm_users where user_id = p_actor_id and role in ('admin', 'staff')) then
    raise exception 'payment_request_actor_invalid';
  end if;
  if not exists (select 1 from public.contacts c where c.id = p_contact_id) then return null; end if;
  if not exists (select 1 from public.payment_requests p where p.id = p_request_id and p.contact_id = p_contact_id) then
    return null;
  end if;
  return public.payment_request_item_v1(p_request_id);
end;
$$;

revoke all on function public.create_payment_request_v1(uuid,integer,text,uuid,text,text,text),
  public.get_payment_request_v1(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.create_payment_request_v1(uuid,integer,text,uuid,text,text,text),
  public.get_payment_request_v1(uuid,uuid,uuid)
  to service_role;
