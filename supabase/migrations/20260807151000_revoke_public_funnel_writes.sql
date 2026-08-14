revoke all on function public.register_funnel_lead(text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.register_webinar_lead(text, text, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.record_funnel_event(text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.book_funnel_call(text, text, text, timestamptz, timestamptz, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.book_funnel_call_v2(text, text, text, timestamptz, timestamptz, text, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.enqueue_funnel_sequence(text, text, jsonb) from public, anon, authenticated;

grant execute on function public.register_funnel_lead(text, text, text, text, jsonb) to service_role;
grant execute on function public.register_webinar_lead(text, text, text, text, jsonb, text) to service_role;
grant execute on function public.record_funnel_event(text, text, jsonb, text) to service_role;
grant execute on function public.book_funnel_call(text, text, text, timestamptz, timestamptz, text, jsonb, jsonb) to service_role;
grant execute on function public.book_funnel_call_v2(text, text, text, timestamptz, timestamptz, text, jsonb, jsonb, text) to service_role;
grant execute on function public.enqueue_funnel_sequence(text, text, jsonb) to service_role;
