-- Disposable local database only. All synthetic rows are rolled back.
begin;
do $$
declare
  c uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_readonly uuid := gen_random_uuid();
  tok1 text := 'payA' || repeat('a', 39);
  tok2 text := 'payB' || repeat('b', 39);
  tok3 text := 'payC' || repeat('c', 39);
  tok4 text := 'payD' || repeat('d', 39);
  tok5 text := 'payE' || repeat('e', 39);
  tok6 text := 'payF' || repeat('f', 39);
  tok7 text := 'payG' || repeat('g', 39);
  tok8 text := 'payH' || repeat('h', 39);
  tok9 text := 'payI' || repeat('i', 39);
  item jsonb;
  found_json jsonb;
  r1 uuid; r2 uuid; r3 uuid; r4 uuid; r5 uuid; r6 uuid; r7 uuid; r8 uuid; r9 uuid; r10 uuid;
  v_old jsonb; v_links integer;
  result text;
  queued jsonb;
  m1 uuid; m2 uuid;
  v_count integer;
  v_backup jsonb;
  v_export jsonb;
  v_before integer;
begin
  -- (a) Client roles have no access to payment RPCs or tables.
  if has_function_privilege('anon', 'public.create_payment_request_v1(uuid,integer,text,uuid,text,text,text)', 'execute')
    or has_function_privilege('authenticated', 'public.create_payment_request_v1(uuid,integer,text,uuid,text,text,text)', 'execute')
    or has_function_privilege('anon', 'public.find_payment_request_by_token_v1(text)', 'execute')
    or has_function_privilege('authenticated', 'public.find_payment_request_by_token_v1(text)', 'execute')
    or has_function_privilege('anon', 'public.apply_payment_transaction_v1(text,text,text,jsonb,text)', 'execute')
    or has_function_privilege('authenticated', 'public.apply_payment_transaction_v1(text,text,text,jsonb,text)', 'execute')
    or has_function_privilege('anon', 'public.queue_payment_request_email_v1(uuid,uuid,uuid)', 'execute')
    or has_function_privilege('anon', 'public.begin_payment_checkout_v1(text)', 'execute')
    or has_function_privilege('authenticated', 'public.create_payment_request_v1(uuid,integer,text,uuid,text,text,text)', 'execute')
    or has_function_privilege('anon', 'public.create_payment_request_v1(uuid,integer,text,uuid,text,text,text)', 'execute')
    or has_function_privilege('authenticated', 'public.queue_payment_request_email_v1(uuid,uuid,uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.payment_request_item_v1(uuid)', 'execute')
    or has_function_privilege('anon', 'public.get_payment_request_v1(uuid,uuid,uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.get_payment_request_v1(uuid,uuid,uuid)', 'execute') then
    raise exception 'ASSERT: a client role can execute payment RPCs';
  end if;
  if has_table_privilege('anon', 'public.payment_requests', 'select')
    or has_table_privilege('authenticated', 'public.payment_requests', 'select')
    or has_table_privilege('anon', 'public.payment_request_events', 'select')
    or has_table_privilege('authenticated', 'public.payment_request_events', 'select')
    or has_table_privilege('anon', 'public.payment_webhook_events', 'select')
    or has_table_privilege('authenticated', 'public.payment_webhook_events', 'select') then
    raise exception 'ASSERT: a client role can read payment tables';
  end if;
  if not has_function_privilege('service_role', 'public.create_payment_request_v1(uuid,integer,text,uuid,text,text,text)', 'execute')
    or not has_function_privilege('service_role', 'public.get_payment_request_v1(uuid,uuid,uuid)', 'execute')
    or not has_table_privilege('service_role', 'public.payment_requests', 'select') then
    raise exception 'ASSERT: service_role lost payment access';
  end if;
  -- The six-argument overload was replaced, not kept beside the new one.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='create_payment_request_v1') <> 1 then
    raise exception 'ASSERT: create_payment_request_v1 has more than one overload';
  end if;

  insert into public.contacts(id,email,name) values(c, 'payment-fixture@example.test', 'Pat Payment Fixture');
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values(v_admin,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
      'payment-fixture-admin@example.test','',now(),'{}'::jsonb,'{}'::jsonb,now(),now()),
      (v_readonly,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
      'payment-fixture-readonly@example.test','',now(),'{}'::jsonb,'{}'::jsonb,now(),now());
  insert into public.crm_users(user_id,role,display_name) values(v_admin,'admin','Payment Test Admin'),
    (v_readonly,'readonly','Payment Test Readonly');

  -- (b) Create an open request with a timeline event; invalid inputs raise.
  item := public.create_payment_request_v1(c, 15000, '  Credit report review  ', v_admin, 'CRP-TEST2345', tok1);
  r1 := (item->>'id')::uuid;
  if item->>'status' <> 'open' or (item->>'amountCents')::integer <> 15000 or item->>'description' <> 'Credit report review'
    or item->>'linkToken' <> tok1 or item->>'createdByName' <> 'Payment Test Admin'
    or jsonb_array_length(item->'events') <> 1 or item->'events'->0->>'action' <> 'created' then
    raise exception 'ASSERT: create returned an unexpected item %', item;
  end if;
  if item->>'kind' <> 'link' or (select charge_started_at from public.payment_requests where id=r1) is not null then
    raise exception 'ASSERT: default request kind is not link %', item;
  end if;
  if not exists (select 1 from public.events where contact_id=c and event_key='payment_request_created'
      and (properties->>'amountCents')::integer=15000 and properties->>'reference'='CRP-TEST2345') then
    raise exception 'ASSERT: create did not record the timeline event';
  end if;
  begin
    perform public.create_payment_request_v1(c, 99, 'Too small', v_admin, 'CRP-TEST2399', 'payZ' || repeat('z', 39));
    raise exception 'ASSERT: 99 cents accepted';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_request_amount_invalid' then raise exception 'ASSERT: wrong error for 99 cents: %', sqlerrm; end if;
  end;
  begin
    perform public.create_payment_request_v1(c, 2500001, 'Too large', v_admin, 'CRP-TEST2399', 'payZ' || repeat('z', 39));
    raise exception 'ASSERT: 2,500,001 cents accepted';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_request_amount_invalid' then raise exception 'ASSERT: wrong error for max amount: %', sqlerrm; end if;
  end;
  begin
    perform public.create_payment_request_v1(c, 1000, 'ab', v_admin, 'CRP-TEST2399', 'payZ' || repeat('z', 39));
    raise exception 'ASSERT: 2-character description accepted';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_request_description_invalid' then raise exception 'ASSERT: wrong error for description: %', sqlerrm; end if;
  end;
  begin
    perform public.create_payment_request_v1(gen_random_uuid(), 1000, 'Unknown contact', v_admin, 'CRP-TEST2399', 'payZ' || repeat('z', 39));
    raise exception 'ASSERT: unknown contact accepted';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_request_contact_unavailable' then raise exception 'ASSERT: wrong error for unknown contact: %', sqlerrm; end if;
  end;
  begin
    perform public.create_payment_request_v1(c, 1000, 'Readonly actor', v_readonly, 'CRP-TEST2399', 'payZ' || repeat('z', 39));
    raise exception 'ASSERT: readonly actor created a request';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_request_actor_invalid' then raise exception 'ASSERT: wrong error for readonly actor: %', sqlerrm; end if;
  end;
  if (select count(*) from public.payment_requests where contact_id=c) <> 1 then
    raise exception 'ASSERT: rejected creates left rows behind';
  end if;

  -- (c) Public lookup exposes only display fields.
  found_json := public.find_payment_request_by_token_v1(tok1);
  if found_json is null or (found_json->>'payable')::boolean is not true or found_json->>'contactFirstName' <> 'Pat'
    or found_json ? 'linkToken' or found_json ? 'contactEmail' or found_json ? 'email'
    or found_json::text like '%payment-fixture@example.test%' or found_json::text like '%' || tok1 || '%' then
    raise exception 'ASSERT: public lookup returned unexpected data %', found_json;
  end if;
  if public.find_payment_request_by_token_v1('payY' || repeat('y', 39)) is not null
    or public.find_payment_request_by_token_v1('short') is not null then
    raise exception 'ASSERT: unknown or malformed token resolved';
  end if;

  -- (d) Checkout start is counted.
  item := public.begin_payment_checkout_v1(tok1);
  if item->>'reference' <> 'CRP-TEST2345' or item->>'contactEmail' <> 'payment-fixture@example.test'
    or (select checkout_count from public.payment_requests where id=r1) <> 1 then
    raise exception 'ASSERT: checkout start was not recorded %', item;
  end if;

  -- Queue a link email so the approval path can cancel it.
  queued := public.queue_payment_request_email_v1(r1, v_admin, c);
  m1 := (queued->>'messageId')::uuid;

  -- (e) Decline -> failed and still payable; approve -> paid; idempotency.
  result := public.apply_payment_transaction_v1('CRP-TEST2345', '6001', 'declined',
    '{"amountCents":15000,"transactionStatus":"declined","responseCode":2,"reason":"This transaction has been declined."}'::jsonb, 'webhook');
  if result <> 'failed' or (select status from public.payment_requests where id=r1) <> 'failed'
    or (select failure_reason from public.payment_requests where id=r1) is null
    or (public.find_payment_request_by_token_v1(tok1)->>'payable')::boolean is not true then
    raise exception 'ASSERT: declined attempt did not leave a retryable failed request';
  end if;
  -- Each RPC call is its own statement: an expression's subqueries share one
  -- snapshot and OR operands have no guaranteed evaluation order.
  result := public.apply_payment_transaction_v1('CRP-TEST2345', '6001', 'declined', '{}'::jsonb, 'webhook');
  if result <> 'failed'
    or (select count(*) from public.payment_request_events where request_id=r1 and action='failed') <> 1 then
    raise exception 'ASSERT: repeated decline was not idempotent';
  end if;
  if not exists (select 1 from public.events where contact_id=c and event_key='payment_failed') then
    raise exception 'ASSERT: decline did not record a timeline event';
  end if;
  result := public.apply_payment_transaction_v1('CRP-TEST2345', '6002', 'approved',
    '{"amountCents":15000,"transactionStatus":"capturedPendingSettlement","responseCode":1,"cardBrand":"Visa","cardLast4":"1111","payerEmail":"payer@example.test","submittedAt":"2026-09-29T12:00:00Z"}'::jsonb, 'webhook');
  if result <> 'paid' then raise exception 'ASSERT: approval returned %', result; end if;
  if not exists (select 1 from public.payment_requests where id=r1 and status='paid' and transaction_id='6002'
      and card_last4='1111' and card_brand='Visa' and paid_amount_cents=15000 and failure_reason is null
      and paid_at='2026-09-29T12:00:00Z'::timestamptz) then
    raise exception 'ASSERT: approval did not record paid fields';
  end if;
  if not exists (select 1 from public.events where contact_id=c and event_key='payment_received' and properties->>'transactionId'='6002') then
    raise exception 'ASSERT: approval did not record a payment_received event';
  end if;
  if (select status::text from public.scheduled_messages where id=m1) <> 'cancelled'
    or (select last_error from public.scheduled_messages where id=m1) <> 'Payment received' then
    raise exception 'ASSERT: approval did not cancel the queued link email';
  end if;
  result := public.apply_payment_transaction_v1('CRP-TEST2345', '6002', 'approved', '{}'::jsonb, 'return_check');
  if result <> 'already_paid' then
    raise exception 'ASSERT: repeated approval was not idempotent';
  end if;
  result := public.apply_payment_transaction_v1('CRP-TEST2345', '6003', 'approved', '{"amountCents":15000}'::jsonb, 'webhook');
  if result <> 'duplicate_payment' then raise exception 'ASSERT: second approval returned %', result; end if;
  result := public.apply_payment_transaction_v1('CRP-TEST2345', '6003', 'approved', '{"amountCents":15000}'::jsonb, 'webhook');
  if result <> 'duplicate_payment'
    or (select count(*) from public.payment_request_events where request_id=r1 and action='duplicate_payment') <> 1
    or (select transaction_id from public.payment_requests where id=r1) <> '6002'
    or (select status from public.payment_requests where id=r1) <> 'paid' then
    raise exception 'ASSERT: second approved transaction was not recorded as a single duplicate';
  end if;
  result := public.apply_payment_transaction_v1('CRP-TEST2345', '6004', 'declined', '{}'::jsonb, 'webhook');
  if result <> 'ignored' or (select status from public.payment_requests where id=r1) <> 'paid' then
    raise exception 'ASSERT: a decline after payment changed a paid request';
  end if;
  result := public.apply_payment_transaction_v1('CRP-UNKNOWN2', '6005', 'approved', '{}'::jsonb, 'webhook');
  if result <> 'unknown_reference' then
    raise exception 'ASSERT: unknown reference was not reported';
  end if;
  begin
    perform public.apply_payment_transaction_v1('CRP-TEST2345', '0', 'approved', '{}'::jsonb, 'webhook');
    raise exception 'ASSERT: sandbox test-mode transaction id 0 accepted';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
  end;
  begin
    perform public.begin_payment_checkout_v1(tok1);
    raise exception 'ASSERT: paid request started a checkout';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_request_not_payable' then raise exception 'ASSERT: wrong error for paid checkout: %', sqlerrm; end if;
  end;
  begin
    perform public.begin_payment_checkout_v1('payY' || repeat('y', 39));
    raise exception 'ASSERT: unknown token started a checkout';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_request_missing' then raise exception 'ASSERT: wrong error for missing checkout: %', sqlerrm; end if;
  end;
  -- Amount mismatch is surfaced as its own event.
  item := public.create_payment_request_v1(c, 5000, 'Mismatch check', v_admin, 'CRP-TEST2352', tok5);
  r5 := (item->>'id')::uuid;
  perform public.apply_payment_transaction_v1('CRP-TEST2352', '6050', 'approved', '{"amountCents":4000}'::jsonb, 'webhook');
  if not exists (select 1 from public.payment_request_events where request_id=r5 and action='amount_mismatch') then
    raise exception 'ASSERT: amount mismatch was not recorded';
  end if;

  -- (f) A fraud hold blocks retry; fraud approval pays.
  item := public.create_payment_request_v1(c, 20000, 'Held payment', v_admin, 'CRP-TEST2347', tok3);
  r3 := (item->>'id')::uuid;
  result := public.apply_payment_transaction_v1('CRP-TEST2347', '7001', 'held', '{"transactionStatus":"FDSPendingReview","responseCode":4}'::jsonb, 'webhook');
  if result <> 'held'
    or (select held_transaction_id from public.payment_requests where id=r3) <> '7001'
    or (select status from public.payment_requests where id=r3) <> 'open'
    or (public.find_payment_request_by_token_v1(tok3)->>'payable')::boolean
    or not (public.find_payment_request_by_token_v1(tok3)->>'held')::boolean then
    raise exception 'ASSERT: fraud hold was not recorded';
  end if;
  begin
    perform public.begin_payment_checkout_v1(tok3);
    raise exception 'ASSERT: held request started a checkout';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
  end;
  result := public.apply_payment_transaction_v1('CRP-TEST2347', '7001', 'approved', '{"amountCents":20000,"transactionStatus":"capturedPendingSettlement"}'::jsonb, 'webhook');
  if result <> 'paid'
    or (select held_transaction_id from public.payment_requests where id=r3) is not null then
    raise exception 'ASSERT: fraud approval did not pay the held request';
  end if;

  -- (g) Cancel; paid requests cannot be cancelled; approval after cancel still pays.
  item := public.create_payment_request_v1(c, 30000, 'Cancel me', v_admin, 'CRP-TEST2348', tok4);
  r4 := (item->>'id')::uuid;
  if not public.cancel_payment_request_v1(r4, v_admin, c) then raise exception 'ASSERT: cancel returned false'; end if;
  if (select status from public.payment_requests where id=r4) <> 'cancelled'
    or public.find_payment_request_by_token_v1(tok4)->>'status' <> 'cancelled' then
    raise exception 'ASSERT: cancel did not cancel';
  end if;
  if not public.cancel_payment_request_v1(r4, v_admin, c)
    or (select count(*) from public.payment_request_events where request_id=r4 and action='cancelled') <> 1 then
    raise exception 'ASSERT: repeated cancel was not idempotent';
  end if;
  if not exists (select 1 from public.events where contact_id=c and event_key='payment_request_cancelled') then
    raise exception 'ASSERT: cancel did not record a timeline event';
  end if;
  begin
    perform public.cancel_payment_request_v1(r1, v_admin, c);
    raise exception 'ASSERT: paid request cancelled';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_request_not_cancellable' then raise exception 'ASSERT: wrong error for paid cancel: %', sqlerrm; end if;
  end;
  begin
    perform public.cancel_payment_request_v1(r4, v_readonly, c);
    raise exception 'ASSERT: readonly actor cancelled';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
  end;
  begin
    perform public.cancel_payment_request_v1(r4, v_admin, gen_random_uuid());
    raise exception 'ASSERT: cancel accepted a mismatched contact';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
  end;
  result := public.apply_payment_transaction_v1('CRP-TEST2348', '8001', 'approved', '{"amountCents":30000}'::jsonb, 'webhook');
  if result <> 'paid'
    or (select status from public.payment_requests where id=r4) <> 'paid'
    or not exists (select 1 from public.payment_request_events where request_id=r4 and action='paid_after_cancel') then
    raise exception 'ASSERT: approval after cancel was not recorded as paid_after_cancel';
  end if;

  -- (h) Webhook notifications are idempotent.
  result := public.begin_payment_webhook_v1('notif-1', 'net.authorize.payment.authcapture.created', '6002', '{"id":"6002"}'::jsonb);
  if result <> 'new' then raise exception 'ASSERT: first webhook begin returned %', result; end if;
  result := public.begin_payment_webhook_v1('notif-1', 'net.authorize.payment.authcapture.created', '6002', '{}'::jsonb);
  if result <> 'retry' then raise exception 'ASSERT: unfinished webhook begin returned %', result; end if;
  perform public.finish_payment_webhook_v1('notif-1', 'processed', r1);
  result := public.begin_payment_webhook_v1('notif-1', 'net.authorize.payment.authcapture.created', '6002', '{}'::jsonb);
  if result <> 'duplicate'
    or (select request_id from public.payment_webhook_events where notification_id='notif-1') <> r1 then
    raise exception 'ASSERT: processed webhook was not reported as a duplicate';
  end if;

  -- (i) Link email queue, eligibility, throttle, and claims.
  item := public.create_payment_request_v1(c, 12500, 'Email link test', v_admin, 'CRP-TEST2346', tok2);
  r2 := (item->>'id')::uuid;
  queued := public.queue_payment_request_email_v1(r2, v_admin, c);
  m1 := (queued->>'messageId')::uuid;
  if queued->>'email' <> 'payment-fixture@example.test'
    or queued->>'templateKey' !~ ('^payment_request:' || r2::text || ':[0-9a-f-]{36}$')
    or not exists (select 1 from public.sequence_enrollments e join public.scheduled_messages m on m.enrollment_id=e.id
      where m.id=m1 and e.payment_request_id=r2 and e.context_key='payment:' || r2::text and e.sequence_key='payment_request'
        and m.delivery_key=m.template_key and m.payload->>'paymentLinkToken'=tok2 and (m.payload->>'amountCents')::integer=12500
        and m.payload->>'firstName'='Pat') then
    raise exception 'ASSERT: queued payment email has an unexpected shape %', queued;
  end if;
  if not public.email_message_is_eligible_v2(m1) then raise exception 'ASSERT: queued payment email is not eligible'; end if;
  update public.contacts set email_suppressed_at=now() where id=c;
  if public.email_message_is_eligible_v2(m1) then raise exception 'ASSERT: suppressed contact remains eligible'; end if;
  update public.contacts set email_suppressed_at=null, marketing_consent=false, unsubscribed_at=now() where id=c;
  if not public.email_message_is_eligible_v2(m1) then raise exception 'ASSERT: marketing unsubscribe blocked a transactional payment email'; end if;
  begin
    perform public.queue_payment_request_email_v1(r2, v_admin, c);
    raise exception 'ASSERT: second queue within 60 seconds accepted';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_email_too_soon' then raise exception 'ASSERT: wrong throttle error: %', sqlerrm; end if;
  end;
  update public.contacts set email_suppressed_at=now() where id=c;
  update public.payment_requests set last_email_queued_at = now() - interval '2 minutes' where id=r2;
  begin
    perform public.queue_payment_request_email_v1(r2, v_admin, c);
    raise exception 'ASSERT: suppressed contact queued a payment email';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_email_suppressed' then raise exception 'ASSERT: wrong suppression error: %', sqlerrm; end if;
  end;
  update public.contacts set email_suppressed_at=null where id=c;
  select count(*) into v_count from public.claim_payment_request_email_v1(m1);
  if v_count <> 1 or (select status::text from public.scheduled_messages where id=m1) <> 'sending' then
    raise exception 'ASSERT: exact payment email claim failed';
  end if;
  select count(*) into v_count from public.claim_payment_request_email_v1(m1);
  if v_count <> 0 then raise exception 'ASSERT: a claimed payment email was claimed twice'; end if;
  queued := public.queue_payment_request_email_v1(r2, v_admin, c);
  m2 := (queued->>'messageId')::uuid;
  if not exists (select 1 from public.claim_due_scheduled_emails_v2(10, false) d where d.message_id=m2) then
    raise exception 'ASSERT: cron claim with live disabled skipped a due payment email';
  end if;
  update public.scheduled_messages set status='scheduled' where id=m2;
  perform public.cancel_payment_request_v1(r2, v_admin, c);
  if public.email_message_is_eligible_v2(m2) or (select status::text from public.scheduled_messages where id=m2) <> 'cancelled' then
    raise exception 'ASSERT: cancelled request kept an eligible link email';
  end if;
  if (select email_send_count from public.payment_requests where id=r2) <> 2 then
    raise exception 'ASSERT: email send count was not tracked';
  end if;

  -- (j) The payment rate-limit bucket is accepted.
  if not public.consume_rate_limit('payment', encode(sha256(convert_to('payment-test', 'UTF8')), 'hex'), 60, 5) then
    raise exception 'ASSERT: payment rate-limit bucket rejected';
  end if;

  -- (j2) Manual card charges: kind 'charge', no public link, in-progress guard.
  begin
    perform public.create_payment_request_v1(c, 1000, 'Bad kind', v_admin, 'CRP-TEST2399', 'payZ' || repeat('z', 39), 'refund');
    raise exception 'ASSERT: unknown kind accepted';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_request_kind_invalid' then raise exception 'ASSERT: wrong error for kind: %', sqlerrm; end if;
  end;
  begin
    perform public.create_payment_request_v1(c, 1000, 'Readonly charge', v_readonly, 'CRP-TEST2399', 'payZ' || repeat('z', 39), 'charge');
    raise exception 'ASSERT: readonly actor created a charge';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_request_actor_invalid' then raise exception 'ASSERT: wrong error for readonly charge: %', sqlerrm; end if;
  end;
  item := public.create_payment_request_v1(c, 7500, 'Manual charge', v_admin, 'CRP-TEST2364', tok7, 'charge');
  r7 := (item->>'id')::uuid;
  if item->>'kind' <> 'charge' or item->'events'->0->'details'->>'kind' <> 'charge'
    or (select charge_started_at from public.payment_requests where id=r7) is null then
    raise exception 'ASSERT: charge row was not created as a charge %', item;
  end if;
  if public.find_payment_request_by_token_v1(tok7) is not null then
    raise exception 'ASSERT: a charge row is served by the public token lookup';
  end if;
  begin
    perform public.begin_payment_checkout_v1(tok7);
    raise exception 'ASSERT: a charge row started a hosted checkout';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_request_missing' then raise exception 'ASSERT: wrong error for charge checkout: %', sqlerrm; end if;
  end;
  begin
    perform public.queue_payment_request_email_v1(r7, v_admin, c);
    raise exception 'ASSERT: a charge row queued a link email';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_request_not_payable' then raise exception 'ASSERT: wrong error for charge email: %', sqlerrm; end if;
  end;
  begin
    perform public.create_payment_request_v1(c, 7500, 'Second charge', v_admin, 'CRP-TEST2365', tok8, 'charge');
    raise exception 'ASSERT: a second open charge started within two minutes';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_charge_in_progress' then raise exception 'ASSERT: wrong error for concurrent charge: %', sqlerrm; end if;
  end;
  -- A hosted-link request is not blocked by an open charge.
  item := public.create_payment_request_v1(c, 2000, 'Link during charge', v_admin, 'CRP-TEST2366', tok9);
  r9 := (item->>'id')::uuid;
  if item->>'kind' <> 'link' then raise exception 'ASSERT: link request during a charge has the wrong kind'; end if;
  -- Real declines report transaction id 0 and must be recorded; approvals with 0 must not.
  result := public.apply_payment_transaction_v1('CRP-TEST2364', '0', 'declined',
    '{"transactionStatus":"declined","responseCode":2,"reason":"This transaction has been declined."}'::jsonb, 'charge');
  if result <> 'failed' or (select status from public.payment_requests where id=r7) <> 'failed' then
    raise exception 'ASSERT: a transaction id 0 decline was not recorded (%)', result;
  end if;
  begin
    perform public.apply_payment_transaction_v1('CRP-TEST2364', '0', 'approved', '{}'::jsonb, 'charge');
    raise exception 'ASSERT: transaction id 0 approval accepted';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_transaction_invalid' then raise exception 'ASSERT: wrong error for id 0 approval: %', sqlerrm; end if;
  end;
  if not public.record_payment_request_event_v1(r7, 'charge_failed', 'Payment Test Admin', '{"code":"E00007"}'::jsonb)
    or not public.record_payment_request_event_v1(r7, 'charge_unknown', 'Payment Test Admin', '{}'::jsonb) then
    raise exception 'ASSERT: charge events were not recorded';
  end if;
  -- A failed charge no longer blocks; an approved one pays the charge row.
  item := public.create_payment_request_v1(c, 7600, 'Retry charge', v_admin, 'CRP-TEST2365', tok8, 'charge');
  r8 := (item->>'id')::uuid;
  result := public.apply_payment_transaction_v1('CRP-TEST2365', '9001', 'approved',
    '{"amountCents":7600,"transactionStatus":"capturedPendingSettlement","responseCode":1,"cardBrand":"Visa","cardLast4":"1111"}'::jsonb, 'charge');
  if result <> 'paid' or not exists (select 1 from public.payment_requests where id=r8 and status='paid' and kind='charge' and transaction_id='9001') then
    raise exception 'ASSERT: an approved charge was not marked paid (%)', result;
  end if;
  -- An open charge past the two-minute window with no marker at all (the Worker
  -- died mid-charge, or charge_unknown failed to record) still blocks, as unresolved.
  update public.payment_requests set status='open', failure_reason=null, failed_at=null, paid_at=null, transaction_id=null,
    transaction_status=null, paid_amount_cents=null, card_brand=null, card_last4=null, charge_started_at=now() - interval '3 minutes'
    where id=r8;
  begin
    perform public.create_payment_request_v1(c, 7700, 'Stale charge window', v_admin, 'CRP-TEST2367', 'payJ' || repeat('j', 39), 'charge');
    raise exception 'ASSERT: a stale open charge without charge_failed stopped blocking';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_charge_unresolved' then raise exception 'ASSERT: wrong error for stale open charge: %', sqlerrm; end if;
  end;
  if exists (select 1 from public.payment_requests where reference='CRP-TEST2367') then
    raise exception 'ASSERT: a blocked stale-window charge left a row behind';
  end if;
  -- A hosted-link request is still not blocked by it.
  item := public.create_payment_request_v1(c, 2050, 'Link during stale charge', v_admin, 'CRP-TEST2374', 'payO' || repeat('o', 39));
  if item->>'kind' <> 'link' then raise exception 'ASSERT: link request blocked by a stale open charge'; end if;
  delete from public.payment_requests where reference='CRP-TEST2374';
  -- An open charge with a charge_failed event (definite rejection whose cancel
  -- failed) does not block.
  perform public.record_payment_request_event_v1(r8, 'charge_failed', 'Payment Test Admin', '{"code":"E00007"}'::jsonb);
  item := public.create_payment_request_v1(c, 7700, 'After definite failure', v_admin, 'CRP-TEST2367', 'payJ' || repeat('j', 39), 'charge');
  if item->>'kind' <> 'charge' then raise exception 'ASSERT: an open charge with charge_failed blocked a new charge'; end if;
  delete from public.payment_requests where reference='CRP-TEST2367';
  -- The paid charge row is restored to paid so the backup below carries it.
  perform public.apply_payment_transaction_v1('CRP-TEST2365', '9001', 'approved',
    '{"amountCents":7600,"cardBrand":"Visa","cardLast4":"1111"}'::jsonb, 'charge');

  -- (j3) An open charge with an unknown outcome blocks new charges regardless of
  -- age until it is checked or cancelled; get_payment_request_v1 reads by id.
  item := public.create_payment_request_v1(c, 8800, 'Unknown outcome charge', v_admin, 'CRP-TEST2368', 'payK' || repeat('k', 39), 'charge');
  r10 := (item->>'id')::uuid;
  perform public.record_payment_request_event_v1(r10, 'charge_unknown', 'Payment Test Admin', '{"code":"NETWORK"}'::jsonb);
  update public.payment_requests set charge_started_at = now() - interval '2 days' where id=r10;
  begin
    perform public.create_payment_request_v1(c, 8800, 'Charge again', v_admin, 'CRP-TEST2369', 'payL' || repeat('l', 39), 'charge');
    raise exception 'ASSERT: a new charge started while an earlier charge outcome is unknown';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_charge_unresolved' then raise exception 'ASSERT: wrong error for unresolved charge: %', sqlerrm; end if;
  end;
  if exists (select 1 from public.payment_requests where reference='CRP-TEST2369') then
    raise exception 'ASSERT: a blocked charge left a row behind';
  end if;
  -- A hosted-link request is not blocked by an unresolved charge.
  item := public.create_payment_request_v1(c, 2100, 'Link during unknown charge', v_admin, 'CRP-TEST2372', 'payM' || repeat('m', 39));
  if item->>'kind' <> 'link' then raise exception 'ASSERT: link request blocked by an unresolved charge'; end if;
  delete from public.payment_requests where reference='CRP-TEST2372';
  -- Read by id: the right contact sees it with its events; others see nothing.
  found_json := public.get_payment_request_v1(r10, c, v_admin);
  if found_json->>'id' <> r10::text or found_json->>'reference' <> 'CRP-TEST2368' or found_json->>'status' <> 'open'
    or not exists (select 1 from jsonb_array_elements(found_json->'events') ev where ev->>'action' = 'charge_unknown') then
    raise exception 'ASSERT: get_payment_request_v1 returned %', found_json;
  end if;
  if public.get_payment_request_v1(r10, gen_random_uuid(), v_admin) is not null
    or public.get_payment_request_v1(gen_random_uuid(), c, v_admin) is not null then
    raise exception 'ASSERT: get_payment_request_v1 returned a request for the wrong contact or id';
  end if;
  begin
    perform public.get_payment_request_v1(r10, c, v_readonly);
    raise exception 'ASSERT: readonly actor read a request by id';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_request_actor_invalid' then raise exception 'ASSERT: wrong error for readonly get: %', sqlerrm; end if;
  end;
  begin
    perform public.get_payment_request_v1(r10, c, gen_random_uuid());
    raise exception 'ASSERT: unknown actor read a request by id';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_request_actor_invalid' then raise exception 'ASSERT: wrong error for unknown actor get: %', sqlerrm; end if;
  end;
  -- A held (still open) unknown charge keeps blocking; cancelling it unblocks.
  result := public.apply_payment_transaction_v1('CRP-TEST2368', '9101', 'held', '{"transactionStatus":"FDSPendingReview"}'::jsonb, 'status_check');
  begin
    perform public.create_payment_request_v1(c, 8800, 'Charge while held', v_admin, 'CRP-TEST2369', 'payL' || repeat('l', 39), 'charge');
    raise exception 'ASSERT: a held unknown charge stopped blocking';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_charge_unresolved' then raise exception 'ASSERT: wrong error for held unresolved charge: %', sqlerrm; end if;
  end;
  perform public.cancel_payment_request_v1(r10, v_admin, c);
  item := public.create_payment_request_v1(c, 8800, 'Charge after cancel', v_admin, 'CRP-TEST2369', 'payL' || repeat('l', 39), 'charge');
  if item->>'kind' <> 'charge' then raise exception 'ASSERT: cancelling the unknown charge did not unblock'; end if;
  -- The new charge is still inside its two-minute window.
  begin
    perform public.create_payment_request_v1(c, 8800, 'Too soon', v_admin, 'CRP-TEST2373', 'payN' || repeat('n', 39), 'charge');
    raise exception 'ASSERT: two-minute guard no longer applies';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
    if sqlerrm <> 'payment_charge_in_progress' then raise exception 'ASSERT: wrong error for two-minute guard: %', sqlerrm; end if;
  end;
  delete from public.payment_requests where reference='CRP-TEST2369';
  -- An unknown charge later resolved as paid (Check status) no longer blocks.
  update public.payment_requests set status='open', cancelled_at=null, cancelled_by=null, held_transaction_id=null where id=r10;
  result := public.apply_payment_transaction_v1('CRP-TEST2368', '9102', 'approved', '{"amountCents":8800}'::jsonb, 'status_check');
  if result <> 'paid' then raise exception 'ASSERT: status check approval returned %', result; end if;
  item := public.create_payment_request_v1(c, 8800, 'Charge after paid', v_admin, 'CRP-TEST2369', 'payL' || repeat('l', 39), 'charge');
  if item->>'kind' <> 'charge' then raise exception 'ASSERT: a paid unknown charge still blocked'; end if;
  delete from public.payment_requests where reference='CRP-TEST2369';

  -- (k) Recoverable trash keeps payment rows but hides the public link.
  select count(*) into v_before from public.payment_requests where contact_id=c;
  insert into public.contact_trash(contact_id,email,name,payload,deleted_by)
    values(c,'payment-fixture@example.test','Pat Payment Fixture','{}'::jsonb,v_admin);
  delete from public.contacts where id=c;
  if (select count(*) from public.payment_requests where contact_id=c) <> v_before then
    raise exception 'ASSERT: recoverable trash deleted payment rows';
  end if;
  if public.find_payment_request_by_token_v1(tok1) is not null or public.list_payment_requests_v1(c) <> '[]'::jsonb
    or public.get_payment_request_v1(r1, c, v_admin) is not null then
    raise exception 'ASSERT: trashed contact payment link still resolves';
  end if;
  insert into public.contacts(id,email,name) values(c,'payment-fixture@example.test','Pat Payment Fixture');
  delete from public.contact_trash where contact_id=c;
  if jsonb_array_length(public.list_payment_requests_v1(c)) <> v_before then
    raise exception 'ASSERT: restored contact lost payment history';
  end if;

  -- Trash removed the contact's enrollments; queue a fresh link email so the
  -- backup below carries a payment enrollment through the restore ordering.
  item := public.create_payment_request_v1(c, 1000, 'Restore ordering', v_admin, 'CRP-TEST2353', tok6);
  r6 := (item->>'id')::uuid;
  perform public.queue_payment_request_email_v1(r6, v_admin, c);
  v_before := v_before + 1;

  -- (l) Backup v4 and contact privacy export v4.
  v_backup := public.export_crm_backup_v4();
  if v_backup->>'version' <> '4'
    or jsonb_array_length(v_backup->'tables'->'payment_requests') <> v_before
    or jsonb_array_length(v_backup->'tables'->'payment_request_events') < 10
    or exists (select 1 from jsonb_array_elements(v_backup->'tables'->'payment_requests') x(row_json)
      where row_json->>'created_by' is not null or row_json->>'cancelled_by' is not null or row_json->>'link_token' is null)
    or exists (select 1 from jsonb_array_elements(v_backup->'tables'->'payment_request_events') x(row_json)
      where row_json->>'actor_id' is not null)
    or public.export_crm_backup_v1()->>'version' <> '4' then
    raise exception 'ASSERT: backup v4 omitted payment rows or exposed staff UUIDs';
  end if;
  v_export := public.export_crm_contact_v1(c);
  if v_export->>'version' <> '4'
    or jsonb_array_length(v_export->'paymentRequests') <> v_before
    or jsonb_array_length(v_export->'creditReportFollowupObligations') <> 0
    or exists (select 1 from jsonb_array_elements(v_export->'paymentRequests') x(row_json)
      where row_json ? 'link_token' or row_json->>'created_by' is not null or row_json->>'cancelled_by' is not null)
    or exists (select 1 from jsonb_array_elements(v_export->'paymentRequestEvents') x(row_json) where row_json->>'actor_id' is not null)
    or v_export::text like '%' || tok1 || '%'
    or public.export_crm_contact_v1(gen_random_uuid()) is not null then
    raise exception 'ASSERT: contact export v4 is wrong or exposed the link token';
  end if;
  -- A v4 round trip restores payment rows before their email enrollments.
  perform public.restore_crm_backup_v1(v_backup);
  if (select count(*) from public.payment_requests where contact_id=c) <> v_before
    or not exists (select 1 from public.sequence_enrollments where payment_request_id=r6)
    or public.find_payment_request_by_token_v1(tok1)->>'status' <> 'paid' then
    raise exception 'ASSERT: v4 restore lost payment rows or their enrollments';
  end if;
  if (select count(*) from public.payment_request_events) <> jsonb_array_length(v_backup->'tables'->'payment_request_events') then
    raise exception 'ASSERT: v4 restore lost payment events';
  end if;
  -- A backup written before the charge migration has no kind or charge_started_at.
  select count(*) into v_links from jsonb_array_elements(v_backup->'tables'->'payment_requests') x(row_json)
    where row_json->>'kind' = 'link';
  v_old := jsonb_set(v_backup, '{tables,payment_requests}', (
    select coalesce(jsonb_agg(x.row_json - 'kind' - 'charge_started_at'), '[]'::jsonb)
    from jsonb_array_elements(v_backup->'tables'->'payment_requests') x(row_json) where x.row_json->>'kind' = 'link'));
  v_old := jsonb_set(v_old, '{tables,payment_request_events}', (
    select coalesce(jsonb_agg(e.row_json), '[]'::jsonb)
    from jsonb_array_elements(v_backup->'tables'->'payment_request_events') e(row_json)
    where e.row_json->>'request_id' in (select l.row_json->>'id'
      from jsonb_array_elements(v_backup->'tables'->'payment_requests') l(row_json) where l.row_json->>'kind' = 'link')));
  perform public.restore_crm_backup_v1(v_old);
  if (select count(*) from public.payment_requests where contact_id=c) <> v_links
    or exists (select 1 from public.payment_requests where kind is distinct from 'link') then
    raise exception 'ASSERT: pre-charge backup did not restore with kind link';
  end if;
  begin
    perform public.restore_crm_backup_v1(jsonb_build_object('format','vance-crm-backup','version',5,'tables','{}'::jsonb));
    raise exception 'ASSERT: unsupported backup version accepted';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if;
  end;

  -- (m) Permanent purge removes payment rows.
  perform public.begin_credit_report_purge_v1(c);
  perform public.purge_crm_contact_v1(c);
  if exists (select 1 from public.payment_requests where contact_id=c)
    or exists (select 1 from public.payment_request_events where request_id in (r1, r2, r3, r4, r5, r6, r7, r8, r9, r10)) then
    raise exception 'ASSERT: permanent purge retained payment rows';
  end if;
end;
$$;
rollback;
