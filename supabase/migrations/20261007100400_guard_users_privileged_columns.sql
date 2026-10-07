-- Step 6 — Prevent privilege escalation through direct users UPDATE
-- RLS currently allows an authenticated user to update their own users row.
-- Keep normal profile edits intact, but block privileged identity fields.
create or replace function public.guard_users_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is not null then
    if new.is_platform_admin is distinct from old.is_platform_admin then
      raise exception 'غير مسموح بتعديل صلاحيات المنصة';
    end if;

    if new.organization_id is distinct from old.organization_id then
      raise exception 'غير مسموح بتغيير المؤسسة';
    end if;

    if new.role is distinct from old.role then
      if new.id = auth.uid() or not public.has_permission('users', 'edit') then
        raise exception 'غير مسموح بتعديل الدور';
      end if;
    end if;
  end if;

  return new;
end;
$function$;

revoke execute on function public.guard_users_privileged_columns() from public, anon, authenticated;

drop trigger if exists trg_guard_users_privileged on public.users;
create trigger trg_guard_users_privileged
before update on public.users
for each row
execute function public.guard_users_privileged_columns();
