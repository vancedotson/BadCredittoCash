-- Manual CRM "Charge card" (Authorize.net Accept.js / AcceptUI opaque data).
-- Forward-only companion to 20260929120000_payment_requests.sql: nothing in that
-- file is edited. A charge is recorded as a payment request row with
-- kind = 'charge' so apply_payment_transaction_v1 stays the only writer of paid
-- state. Card data never reaches this database; only the processor's
-- transaction id, status, card brand and last four digits are stored.

alter table public.payment_requests
  add column kind text not null default 'link' check (kind in ('link', 'charge')),
  add column charge_started_at timestamptz,
  add constraint payment_requests_charge_started_check check (kind <> 'charge' or charge_started_at is not null);
create index payment_requests_open_charge_idx on public.payment_requests(contact_id, charge_started_at desc)
  where kind = 'charge' and status = 'open';

-- Backups written before this migration carry no kind. jsonb_populate_recordset
-- yields NULL for a missing key (not the column default), so default it here.
create function public.default_payment_request_kind_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.kind := coalesce(new.kind, 'link');
  return new;
end;
$$;
create trigger payment_requests_default_kind
  before insert on public.payment_requests
  for each row execute function public.default_payment_request_kind_v1();

alter table public.payment_request_events drop constraint payment_request_events_action_check;
alter table public.payment_request_events add constraint payment_request_events_action_check check (action in (
  'created', 'link_emailed', 'checkout_started', 'checkout_failed', 'paid', 'failed', 'held',
  'voided', 'refunded', 'cancelled', 'duplicate_payment', 'paid_after_cancel', 'amount_mismatch', 'ignored',
  'charge_failed', 'charge_unknown'
));

-- One CRM list item; adds kind. Otherwise unchanged.
create or replace function public.payment_request_item_v1(p_request_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'kind', p.kind, 'reference', p.reference, 'linkToken', p.link_token,
    'amountCents', p.amount_cents, 'currency', p.currency, 'description', p.description,
    'status', p.status, 'createdAt', p.created_at, 'createdByName', p.created_by_name,
    'paidAt', p.paid_at, 'transactionId', p.transaction_id, 'transactionStatus', p.transaction_status,
    'paidAmountCents', p.paid_amount_cents, 'cardBrand', p.card_brand, 'cardLast4', p.card_last4,
    'payerEmail', p.payer_email, 'failureReason', p.failure_reason, 'failedAt', p.failed_at,
    'heldTransactionId', p.held_transaction_id, 'cancelledAt', p.cancelled_at,
    'checkoutCount', p.checkout_count, 'lastCheckoutAt', p.last_checkout_at,
    'emailSendCount', p.email_send_count, 'lastEmailQueuedAt', p.last_email_queued_at,
    'lastEmail', (
      select jsonb_build_object('status', m.status, 'scheduledFor', m.scheduled_for, 'sentAt', m.sent_at, 'lastError', m.last_error)
      from public.scheduled_messages m join public.sequence_enrollments e on e.id = m.enrollment_id
      where e.payment_request_id = p.id
      order by m.created_at desc, m.id desc limit 1
    ),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('action', x.action, 'actorName', x.actor_name, 'createdAt', x.created_at, 'details', x.details)
        order by x.created_at desc, x.id desc)
      from (select ev.* from public.payment_request_events ev where ev.request_id = p.id
        order by ev.created_at desc, ev.id desc limit 20) x
    ), '[]'::jsonb)
  ) from public.payment_requests p where p.id = p_request_id;
$$;

-- The signature gains p_kind, so the six-argument version is dropped first; two
-- overloads that both accept six named arguments would be ambiguous to PostgREST.
drop function public.create_payment_request_v1(uuid, integer, text, uuid, text, text);
create function public.create_payment_request_v1(
  p_contact_id uuid, p_amount_cents integer, p_description text, p_actor_id uuid, p_reference text, p_link_token text,
  p_kind text default 'link'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_name text; contact_row public.contacts%rowtype; clean_description text := trim(coalesce(p_description, '')); new_id uuid;
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
    if exists (
      select 1 from public.payment_requests q
      where q.contact_id = p_contact_id and q.kind = 'charge' and q.status = 'open'
        and q.charge_started_at > clock_timestamp() - interval '2 minutes'
    ) then
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

-- Charge rows have no customer-facing link: the public lookup and checkout never serve them.
create or replace function public.find_payment_request_by_token_v1(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'reference', p.reference, 'amountCents', p.amount_cents, 'currency', p.currency,
    'description', p.description, 'status', p.status, 'paidAt', p.paid_at, 'transactionId', p.transaction_id,
    'held', p.held_transaction_id is not null, 'cancelledAt', p.cancelled_at,
    'contactFirstName', nullif(split_part(trim(c.name), ' ', 1), ''),
    'payable', p.status in ('open', 'failed') and p.held_transaction_id is null
  )
  from public.payment_requests p join public.contacts c on c.id = p.contact_id
  where p_token ~ '^[A-Za-z0-9_-]{43}$' and p.link_token = p_token and p.kind = 'link';
$$;

create or replace function public.begin_payment_checkout_v1(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.payment_requests%rowtype; c_email text; c_name text;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'payment_request_missing'; end if;
  select * into r from public.payment_requests where link_token = p_token and kind = 'link' for update;
  if not found then raise exception 'payment_request_missing'; end if;
  select c.email::text, c.name into c_email, c_name from public.contacts c where c.id = r.contact_id;
  if not found then raise exception 'payment_request_missing'; end if;
  if r.status not in ('open', 'failed') or r.held_transaction_id is not null then
    raise exception 'payment_request_not_payable';
  end if;
  update public.payment_requests set checkout_count = checkout_count + 1, last_checkout_at = clock_timestamp()
    where id = r.id;
  insert into public.payment_request_events(request_id, actor_name, action, details)
  values (r.id, 'client', 'checkout_started', jsonb_build_object('checkoutCount', r.checkout_count + 1));
  return jsonb_build_object('id', r.id, 'reference', r.reference, 'amountCents', r.amount_cents,
    'description', r.description, 'contactEmail', c_email, 'contactName', c_name);
end;
$$;

-- Unchanged from 20260929120000 except that transaction id '0' is rejected only
-- for an approval. Sandbox Test Mode reports transId 0 for approvals (never a
-- real charge), while real declines legitimately report transId 0.
create or replace function public.apply_payment_transaction_v1(
  p_reference text, p_transaction_id text, p_outcome text, p_details jsonb, p_source text
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  r public.payment_requests%rowtype;
  d jsonb := case when jsonb_typeof(p_details) = 'object' then p_details else '{}'::jsonb end;
  v_amount integer; v_submitted timestamptz; v_status text; v_brand text; v_last4 text; v_email text; v_reason text;
  v_source text := left(coalesce(nullif(trim(p_source), ''), 'unknown'), 40);
  v_event jsonb; c_email public.citext; c_exists boolean;
begin
  if p_outcome is null or p_outcome not in ('approved', 'declined', 'error', 'held', 'voided', 'refunded') then
    raise exception 'payment_outcome_invalid';
  end if;
  if p_transaction_id is null or p_transaction_id !~ '^[A-Za-z0-9_-]{1,64}$'
    or (p_transaction_id = '0' and p_outcome = 'approved') then
    raise exception 'payment_transaction_invalid';
  end if;
  select * into r from public.payment_requests where reference = p_reference for update;
  if not found then return 'unknown_reference'; end if;

  if jsonb_typeof(d->'amountCents') = 'number' and (d->>'amountCents')::numeric between 0 and 2147483647 then
    v_amount := round((d->>'amountCents')::numeric)::integer;
  end if;
  begin
    v_submitted := nullif(d->>'submittedAt', '')::timestamptz;
  exception when others then v_submitted := null;
  end;
  if v_submitted > clock_timestamp() + interval '1 day' then v_submitted := null; end if;
  v_status := left(nullif(trim(d->>'transactionStatus'), ''), 60);
  v_brand := left(nullif(trim(d->>'cardBrand'), ''), 40);
  v_last4 := case when d->>'cardLast4' ~ '^[0-9]{4}$' then d->>'cardLast4' end;
  v_email := left(nullif(trim(d->>'payerEmail'), ''), 254);
  v_reason := left(nullif(trim(d->>'reason'), ''), 255);
  v_event := jsonb_strip_nulls(jsonb_build_object('transactionId', p_transaction_id, 'source', v_source,
    'amountCents', v_amount, 'transactionStatus', v_status, 'responseCode', d->'responseCode'));
  select c.email, true into c_email, c_exists from public.contacts c where c.id = r.contact_id;
  c_exists := coalesce(c_exists, false);

  if p_outcome = 'approved' then
    if r.status = 'paid' then
      if r.transaction_id = p_transaction_id then return 'already_paid'; end if;
      if not exists (select 1 from public.payment_request_events where request_id = r.id
          and action = 'duplicate_payment' and details->>'transactionId' = p_transaction_id) then
        insert into public.payment_request_events(request_id, actor_name, action, details)
        values (r.id, 'authorize.net', 'duplicate_payment', v_event);
      end if;
      return 'duplicate_payment';
    end if;
    update public.payment_requests set status = 'paid', paid_at = coalesce(v_submitted, clock_timestamp()),
      transaction_id = p_transaction_id, transaction_status = v_status, paid_amount_cents = v_amount,
      card_brand = v_brand, card_last4 = v_last4, payer_email = v_email,
      held_transaction_id = null, failure_reason = null
      where id = r.id;
    insert into public.payment_request_events(request_id, actor_name, action, details)
    values (r.id, 'authorize.net', 'paid', v_event);
    if v_amount is not null and v_amount <> r.amount_cents then
      insert into public.payment_request_events(request_id, actor_name, action, details)
      values (r.id, 'authorize.net', 'amount_mismatch', v_event || jsonb_build_object('expectedAmountCents', r.amount_cents));
    end if;
    if r.status = 'cancelled' then
      insert into public.payment_request_events(request_id, actor_name, action, details)
      values (r.id, 'authorize.net', 'paid_after_cancel', v_event);
    end if;
    update public.scheduled_messages set status = 'cancelled', last_error = 'Payment received', updated_at = now()
      where status = 'scheduled'
        and enrollment_id in (select e.id from public.sequence_enrollments e where e.payment_request_id = r.id);
    if c_exists then
      insert into public.events(event_key, contact_id, email, properties)
      values ('payment_received', r.contact_id, c_email, jsonb_strip_nulls(jsonb_build_object(
        'amountCents', r.amount_cents, 'paidAmountCents', v_amount, 'reference', r.reference,
        'description', r.description, 'transactionId', p_transaction_id)));
    end if;
    return 'paid';
  end if;

  if p_outcome in ('declined', 'error') then
    if r.status in ('paid', 'cancelled') then
      if not exists (select 1 from public.payment_request_events where request_id = r.id
          and action = 'ignored' and details->>'transactionId' = p_transaction_id) then
        insert into public.payment_request_events(request_id, actor_name, action, details)
        values (r.id, 'authorize.net', 'ignored', v_event || jsonb_build_object('outcome', p_outcome));
      end if;
      return 'ignored';
    end if;
    if exists (select 1 from public.payment_request_events where request_id = r.id
        and action = 'failed' and details->>'transactionId' = p_transaction_id) then
      return 'failed';
    end if;
    update public.payment_requests set status = 'failed',
      failure_reason = coalesce(v_reason, case when p_outcome = 'declined' then 'Card declined' else 'Processing error' end),
      failed_at = clock_timestamp(),
      held_transaction_id = case when held_transaction_id = p_transaction_id then null else held_transaction_id end
      where id = r.id;
    insert into public.payment_request_events(request_id, actor_name, action, details)
    values (r.id, 'authorize.net', 'failed', v_event || jsonb_build_object('outcome', p_outcome));
    if c_exists then
      insert into public.events(event_key, contact_id, email, properties)
      values ('payment_failed', r.contact_id, c_email, jsonb_build_object(
        'amountCents', r.amount_cents, 'reference', r.reference, 'description', r.description));
    end if;
    return 'failed';
  end if;

  if p_outcome = 'held' then
    if r.status in ('paid', 'cancelled') then
      if not exists (select 1 from public.payment_request_events where request_id = r.id
          and action = 'ignored' and details->>'transactionId' = p_transaction_id) then
        insert into public.payment_request_events(request_id, actor_name, action, details)
        values (r.id, 'authorize.net', 'ignored', v_event || jsonb_build_object('outcome', p_outcome));
      end if;
      return 'ignored';
    end if;
    if r.held_transaction_id is distinct from p_transaction_id then
      update public.payment_requests set held_transaction_id = p_transaction_id where id = r.id;
      insert into public.payment_request_events(request_id, actor_name, action, details)
      values (r.id, 'authorize.net', 'held', v_event);
    end if;
    return 'held';
  end if;

  -- voided / refunded: recorded only. Refunds and voids happen in Authorize.net.
  if not exists (select 1 from public.payment_request_events where request_id = r.id
      and action = p_outcome and details->>'transactionId' = p_transaction_id) then
    insert into public.payment_request_events(request_id, actor_name, action, details)
    values (r.id, 'authorize.net', p_outcome, v_event);
  end if;
  return 'recorded';
end;
$$;

-- Unchanged from 20260929120000 except that charge rows never get a link email.
create or replace function public.queue_payment_request_email_v1(p_request_id uuid, p_actor_id uuid, p_contact_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_name text; r public.payment_requests%rowtype; c public.contacts%rowtype; e_id uuid; m_id uuid; key text;
begin
  select display_name into actor_name from public.crm_users where user_id = p_actor_id and role in ('admin', 'staff');
  if not found then raise exception 'payment_request_actor_invalid'; end if;
  select * into r from public.payment_requests where id = p_request_id for update;
  if not found or (p_contact_id is not null and r.contact_id <> p_contact_id) then
    raise exception 'payment_request_missing';
  end if;
  if r.kind <> 'link' or r.status not in ('open', 'failed') then raise exception 'payment_request_not_payable'; end if;
  select * into c from public.contacts where id = r.contact_id;
  if not found then raise exception 'payment_request_contact_unavailable'; end if;
  if c.email_suppressed_at is not null then raise exception 'payment_email_suppressed'; end if;
  if r.last_email_queued_at is not null and r.last_email_queued_at > clock_timestamp() - interval '60 seconds' then
    raise exception 'payment_email_too_soon';
  end if;

  insert into public.sequence_enrollments(contact_id, sequence_key, context_key, payment_request_id)
  values (r.contact_id, 'payment_request', 'payment:' || r.id::text, r.id)
  on conflict (contact_id, sequence_key, context_key) do update set status = 'active', stopped_at = null, stop_reason = null
  returning id into e_id;

  key := 'payment_request:' || r.id::text || ':' || gen_random_uuid()::text;
  insert into public.scheduled_messages(enrollment_id, contact_id, template_key, delivery_key, scheduled_for, payload)
  values (e_id, r.contact_id, key, key, now(), jsonb_build_object(
    'paymentRequestId', r.id, 'paymentLinkToken', r.link_token, 'amountCents', r.amount_cents,
    'paymentDescription', r.description, 'paymentReference', r.reference,
    'firstName', nullif(split_part(trim(c.name), ' ', 1), '')))
  returning id into m_id;

  update public.payment_requests set email_send_count = email_send_count + 1, last_email_queued_at = clock_timestamp()
    where id = r.id;
  insert into public.payment_request_events(request_id, actor_id, actor_name, action, details)
  values (r.id, p_actor_id, coalesce(actor_name, 'CRM user'), 'link_emailed', jsonb_build_object('messageId', m_id));
  return jsonb_build_object('messageId', m_id, 'templateKey', key, 'email', c.email::text);
end;
$$;

revoke all on function public.default_payment_request_kind_v1() from public, anon, authenticated;
revoke all on function public.payment_request_item_v1(uuid),
  public.create_payment_request_v1(uuid,integer,text,uuid,text,text,text),
  public.find_payment_request_by_token_v1(text), public.begin_payment_checkout_v1(text),
  public.apply_payment_transaction_v1(text,text,text,jsonb,text),
  public.queue_payment_request_email_v1(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function
  public.create_payment_request_v1(uuid,integer,text,uuid,text,text,text),
  public.find_payment_request_by_token_v1(text), public.begin_payment_checkout_v1(text),
  public.apply_payment_transaction_v1(text,text,text,jsonb,text),
  public.queue_payment_request_email_v1(uuid,uuid,uuid)
  to service_role;
