-- Email delivery was intentionally disabled while the funnel was being built.
-- Do not release that accumulated test-only backlog when the scheduler goes live.
-- New registrations after this rollout continue to enqueue normally.
update public.scheduled_messages
set status = 'cancelled',
    last_error = 'Cancelled during test scheduler rollout: legacy delivery-disabled backlog',
    updated_at = now()
where status in ('scheduled', 'failed')
  and created_at < timestamptz '2026-08-09 20:15:00+00';

