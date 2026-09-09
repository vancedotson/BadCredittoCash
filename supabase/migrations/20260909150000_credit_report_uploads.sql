-- Private, contact-linked credit reports. Only server-side service_role access;
-- public clients have no table or storage-object read/write policies.
create table public.credit_report_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.events(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.credit_report_uploads (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.credit_report_upload_sessions(id) on delete cascade,
  submission_id uuid not null references public.events(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  bureau text not null check (bureau in ('transunion', 'equifax', 'experian')),
  file_name text not null check (length(file_name) between 5 and 180),
  object_path text not null unique,
  byte_size integer not null check (byte_size between 20 and 15728640),
  uploaded_at timestamptz not null default now(),
  unique (session_id, bureau)
);
create index credit_report_uploads_contact_idx on public.credit_report_uploads(contact_id, uploaded_at desc);
create index credit_report_upload_sessions_expiry_idx on public.credit_report_upload_sessions(expires_at);

alter table public.credit_report_upload_sessions enable row level security;
alter table public.credit_report_uploads enable row level security;
revoke all on table public.credit_report_upload_sessions, public.credit_report_uploads from public, anon, authenticated;
grant all on table public.credit_report_upload_sessions, public.credit_report_uploads to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('credit-reports', 'credit-reports', false, 15728640, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Never add an anonymous/authenticated object policy or generate a public URL.
-- Storage objects are separate from relational cascades. Deployment operations
-- must reconcile unreferenced private objects after contact deletion or an
-- interrupted replacement; deleting a contact revokes all app download access.
