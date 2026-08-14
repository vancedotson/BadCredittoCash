alter table public.contacts add column if not exists owner_name text;
alter table public.tasks add column if not exists owner_name text;

create index if not exists contacts_owner_name_idx on public.contacts (owner_name);
create index if not exists tasks_owner_name_idx on public.tasks (owner_name);

comment on column public.contacts.owner_name is
  'CRM assignee label. owner_id may later link the label to a signed-in team member.';
comment on column public.tasks.owner_name is
  'CRM assignee label. owner_id may later link the label to a signed-in team member.';
