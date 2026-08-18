-- Team management runs exclusively on the server with the Supabase secret key.
-- The original CRM migration granted table access only to authenticated browser
-- sessions, so the server-side admin client could not read or update memberships.
grant select, insert, update, delete on table public.crm_users to service_role;
