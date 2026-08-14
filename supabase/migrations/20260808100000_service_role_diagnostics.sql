-- The server-only key needs read access for operational verification and
-- monitoring. RLS remains enforced for browser roles; service_role is the only
-- additional grantee.
grant select on table public.contacts to service_role;
grant select on table public.events to service_role;
grant select on table public.audit_log to service_role;
