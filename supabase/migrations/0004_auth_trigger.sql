-- =====================================================================
-- Auto-create a `profile` row whenever a new auth.users row is created.
-- Role/department default to SALES_MANAGER unless overridden via the
-- `role` / `department_code` keys in raw_user_meta_data (used by the
-- seed script to provision one demo account per persona).
-- =====================================================================

create or replace function handle_new_user()
returns trigger as $$
declare
  v_role user_role;
  v_dept_id uuid;
begin
  v_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::user_role,
    'SALES_MANAGER'
  );

  select id into v_dept_id
  from department
  where code = coalesce(
    (new.raw_user_meta_data ->> 'department_code')::department_code,
    'SALES'
  );

  insert into profile (id, full_name, email, role, department_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    v_role,
    v_dept_id
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
