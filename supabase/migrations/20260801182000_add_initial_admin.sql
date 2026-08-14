do $$
declare
  invited_user_id uuid;
begin
  select id into invited_user_id
  from auth.users
  where lower(email) = 'team@funnelsgenius.com'
  limit 1;

  -- A clean local/test database does not contain the production auth user.
  -- Link the initial admin only when that user has already been invited.
  if invited_user_id is not null then
    insert into public.crm_users (user_id, role, display_name)
    values (invited_user_id, 'admin', 'Funnels Genius Team')
    on conflict (user_id) do update
    set role = excluded.role,
        display_name = excluded.display_name;
  end if;
end;
$$;
