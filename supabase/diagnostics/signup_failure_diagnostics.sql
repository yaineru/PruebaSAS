-- Signup failure diagnostics for Supabase Auth trigger failures.
-- Run this in Supabase SQL Editor.

-- 1. Triggers attached to auth.users.
select
  trigger_schema,
  trigger_name,
  event_manipulation,
  event_object_schema,
  event_object_table,
  action_timing,
  action_statement
from information_schema.triggers
where event_object_schema = 'auth'
  and event_object_table = 'users'
order by trigger_name;

-- 2. Public triggers that can be executed indirectly during signup.
select
  trigger_schema,
  trigger_name,
  event_manipulation,
  event_object_schema,
  event_object_table,
  action_timing,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name;

-- 3. Functions required by the signup path.
select
  routine_schema,
  routine_name,
  routine_type,
  security_type,
  data_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'handle_new_auth_user',
    'slugify_company_name',
    'write_audit_log',
    'current_app_user_id',
    'notify_new_user',
    'create_company_notification'
  )
order by routine_name;

-- 4. Expected public tables.
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('companies', 'users', 'memberships', 'notifications', 'audit_logs')
order by table_name;

-- 5. Critical columns used by signup triggers.
select
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'companies' and column_name in ('id', 'name', 'slug'))
    or
    (table_name = 'users' and column_name in ('id', 'company_id', 'auth_user_id', 'user_id', 'email', 'full_name', 'role', 'is_active'))
    or
    (table_name = 'notifications' and column_name in ('id', 'company_id', 'user_id', 'title', 'message', 'event_type', 'entity_table', 'entity_id', 'created_by'))
    or
    (table_name = 'audit_logs' and column_name in ('id', 'company_id', 'actor_id', 'actor_auth_user_id', 'action', 'table_name', 'record_id'))
  )
order by table_name, ordinal_position;

-- 6. NOT NULL columns without defaults in signup-related tables.
select
  table_name,
  column_name,
  data_type,
  udt_name,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('companies', 'users', 'notifications', 'audit_logs')
  and is_nullable = 'NO'
  and column_default is null
order by table_name, ordinal_position;

-- 7. Foreign keys involving signup-related tables.
select
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_schema as foreign_table_schema,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name in ('companies', 'users', 'notifications', 'audit_logs')
order by tc.table_name, tc.constraint_name;

-- 8. Policies on signup-related tables.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('companies', 'users', 'notifications', 'audit_logs')
order by tablename, policyname;

-- 9. RLS status.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('companies', 'users', 'notifications', 'audit_logs')
order by c.relname;

-- 10. Exact source of signup trigger functions.
select
  p.proname,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'handle_new_auth_user',
    'write_audit_log',
    'notify_new_user',
    'create_company_notification'
  )
order by p.proname;

-- 11. Minimal schema assertion for the most common current failure.
select
  case
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'notifications'
        and column_name = 'event_type'
    )
    then 'OK: notifications.event_type exists'
    else 'FAIL: notifications.event_type is missing'
  end as notification_event_type_check;
