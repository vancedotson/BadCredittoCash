alter table public.live_webinar_sessions
  add column stream_provider text not null default 'external'
    check (stream_provider in ('external', 'cloudflare')),
  add column cloudflare_live_input_id text unique
    check (cloudflare_live_input_id is null or cloudflare_live_input_id ~ '^[a-f0-9]{32}$');

alter table public.live_webinar_sessions
  add constraint live_webinar_cloudflare_input_consistency check (
    (stream_provider = 'external' and cloudflare_live_input_id is null)
    or (stream_provider = 'cloudflare' and cloudflare_live_input_id is not null)
  );
