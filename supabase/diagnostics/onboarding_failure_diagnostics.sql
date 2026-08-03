-- Onboarding failure diagnostics.
-- Run in Supabase SQL Editor after login/onboarding issues.

select 'auth.users' as source, id, email, email_confirmed_at, created_at
from auth.users
order by created_at desc;

select 'public.users' as source, *
from public.users
order by created_at desc;

select 'public.companies' as source, *
from public.companies
order by created_at desc;

select 'public.memberships exists' as check_name,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'memberships'
  ) as ok;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'memberships'
  ) then
    raise notice 'Run this query manually: select * from public.memberships order by created_at desc;';
  end if;
end $$;

select
  auth_users.id as auth_user_id,
  auth_users.email,
  public_users.id as app_user_id,
  public_users.company_id,
  companies.name as company_name,
  public_users.role,
  public_users.is_active,
  case
    when public_users.id is null then 'MISSING_PUBLIC_USER'
    when companies.id is null then 'MISSING_COMPANY'
    else 'USER_AND_COMPANY_OK'
  end as status
from auth.users auth_users
left join public.users public_users on public_users.auth_user_id = auth_users.id
left join public.companies companies on companies.id = public_users.company_id
order by auth_users.created_at desc;

select
  trigger_schema,
  trigger_name,
  event_object_schema,
  event_object_table,
  action_statement
from information_schema.triggers
where event_object_schema = 'auth'
  and event_object_table = 'users'
order by trigger_name;

select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'handle_new_auth_user',
    'current_app_user_id',
    'is_company_member',
    'has_company_role'
  )
order by routine_name;

select
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('users', 'companies', 'memberships')
order by tablename, policyname;
