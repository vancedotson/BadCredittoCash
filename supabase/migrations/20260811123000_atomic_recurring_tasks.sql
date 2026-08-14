create or replace function public.complete_task_and_schedule_next(p_task_id uuid)
returns table(completed_now boolean, next_task_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_task public.tasks%rowtype;
  created_task_id uuid;
  next_due_at timestamptz;
begin
  select * into current_task
  from public.tasks
  where id = p_task_id
  for update;

  if not found then
    return;
  end if;

  if current_task.done then
    return query select false, null::uuid;
    return;
  end if;

  update public.tasks
  set done = true, completed_at = now()
  where id = p_task_id;

  if current_task.due_at is not null and current_task.recurrence in ('weekly', 'monthly') then
    next_due_at := case current_task.recurrence
      when 'weekly' then current_task.due_at + interval '7 days'
      else current_task.due_at + interval '1 month'
    end;

    insert into public.tasks (
      contact_id, title, due_at, priority, task_type, owner_id, owner_name,
      notes, recurrence
    ) values (
      current_task.contact_id, current_task.title, next_due_at,
      current_task.priority, current_task.task_type, current_task.owner_id,
      current_task.owner_name, current_task.notes, current_task.recurrence
    )
    returning id into created_task_id;
  end if;

  return query select true, created_task_id;
end;
$$;

revoke all on function public.complete_task_and_schedule_next(uuid) from public, anon;
grant execute on function public.complete_task_and_schedule_next(uuid) to authenticated;

comment on function public.complete_task_and_schedule_next(uuid) is
  'Atomically completes one task and creates at most one next recurring occurrence.';
