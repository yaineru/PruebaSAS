-- rc1_owner_bug_diagnostic.sql
--
-- Deleting a row from public.assets (and presumably the other 7 tables 027
-- targeted) still fails live with "invalid input value for enum app_role:
-- \"owner\"" even after 027_resweep_stray_owner_role_policies.sql ran and
-- reported nothing to drop. That means the offending object is NOT a row in
-- pg_policies (027's sweep already covered that exhaustively) - it must be a
-- function body, a check constraint, a trigger, or something else that casts
-- the literal text 'owner' to app_role. This script writes what it finds into
-- a plain table so it can be read back afterward (through the app's
-- service-role client) instead of relying on copying RAISE NOTICE output by
-- hand.
--
-- Safe to run - read-only introspection, only writes to a new diagnostic
-- table under public. Drop that table after reading the results:
--   drop table if exists public._rc1_diag_findings;

create table if not exists public._rc1_diag_findings (
  id serial primary key,
  category text,
  object_name text,
  detail text
);
truncate public._rc1_diag_findings;

-- Function bodies mentioning 'owner'
insert into public._rc1_diag_findings (category, object_name, detail)
select 'function', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosrc ilike '%owner%';

-- Check constraints mentioning 'owner'
insert into public._rc1_diag_findings (category, object_name, detail)
select 'check_constraint', conrelid::regclass::text || '.' || conname, pg_get_constraintdef(oid)
from pg_constraint
where contype = 'c' and pg_get_constraintdef(oid) ilike '%owner%';

-- Any remaining policy mentioning 'owner' (re-check, should be empty if 027 worked)
insert into public._rc1_diag_findings (category, object_name, detail)
select 'policy', schemaname || '.' || tablename || '.' || policyname,
  'USING: ' || coalesce(qual, '(none)') || ' | WITH CHECK: ' || coalesce(with_check, '(none)')
from pg_policies
where schemaname = 'public'
  and (coalesce(qual, '') ilike '%owner%' or coalesce(with_check, '') ilike '%owner%');

-- All triggers on assets specifically (what fires on DELETE FROM assets)
insert into public._rc1_diag_findings (category, object_name, detail)
select 'assets_trigger', trigger_name, action_timing || ' ' || event_manipulation || ' -> ' || action_statement
from information_schema.triggers
where trigger_schema = 'public' and event_object_table = 'assets';

-- Column defaults mentioning 'owner' anywhere in public schema
insert into public._rc1_diag_findings (category, object_name, detail)
select 'column_default', table_name || '.' || column_name, column_default
from information_schema.columns
where table_schema = 'public' and column_default ilike '%owner%';

-- Domains/enums: confirm app_role's actual current values (in case 'owner'
-- somehow got added as a real (if unused) enum value at some point)
insert into public._rc1_diag_findings (category, object_name, detail)
select 'enum_values', 'app_role', string_agg(enumlabel, ', ' order by enumsortorder)
from pg_enum
where enumtypid = 'public.app_role'::regtype;

-- Views mentioning 'owner'
insert into public._rc1_diag_findings (category, object_name, detail)
select 'view', schemaname || '.' || viewname, definition
from pg_views
where schemaname = 'public' and definition ilike '%owner%';

SELECT 'rc1_owner_bug_diagnostic completed - read public._rc1_diag_findings' AS result;
