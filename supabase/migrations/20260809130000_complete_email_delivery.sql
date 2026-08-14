create or replace function public.complete_scheduled_email(
  p_message_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_last_error text default null,
  p_sent_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if p_status not in ('sent', 'failed') then
    raise exception 'invalid_status';
  end if;

  update public.scheduled_messages
  set status = p_status::public.message_status,
      provider_message_id = case when p_status = 'sent' then p_provider_message_id else null end,
      last_error = case when p_status = 'failed' then left(coalesce(p_last_error, 'Unknown delivery error'), 500) else null end,
      sent_at = case when p_status = 'sent' then coalesce(p_sent_at, now()) else null end,
      updated_at = now()
  where id = p_message_id and status = 'sending';

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.complete_scheduled_email(uuid, text, text, text, timestamptz)
from public, anon, authenticated;
grant execute on function public.complete_scheduled_email(uuid, text, text, text, timestamptz)
to service_role;

-- The first production test could claim a message but could not mark it because
-- table writes are intentionally denied. Make it retryable; the stable Resend
-- idempotency key prevents the retry from creating a second email.
update public.scheduled_messages
set status = 'scheduled', updated_at = now()
where status = 'sending';

