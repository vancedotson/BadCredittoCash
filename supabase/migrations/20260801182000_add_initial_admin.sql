do $$
declare
  invited_user_id uuid;
begin
  select id into invited_user_id
  from auth.users
  where lower(email) = 'team@funnelsgenius.com'
  limit 1;

  if invited_user_id is null then
    raise exception 'Auth user team@funnelsgenius.com does not exist';
  end if;

  insert into public.crm_users (user_id, role, display_name)
  values (invited_user_id, 'admin', 'Funnels Genius Team')
  on conflict (user_id) do update
  set role = excluded.role,
      display_name = excluded.display_name;
end;
$$;
