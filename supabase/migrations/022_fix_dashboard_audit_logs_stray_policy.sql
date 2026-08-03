-- 022_fix_dashboard_audit_logs_stray_policy.sql
--
-- Full-app audit (2026-07-03): the dashboard's "Actividad reciente" query
-- (lib/dashboard.ts, selecting from audit_logs) always failed with
-- "invalid input value for enum app_role: \"owner\"" - reproduced directly
-- against PostgREST with the real session, isolated to this exact table.
--
-- Investigation ruled out every tracked source: no migration file, RLS policy,
-- helper function (is_super_admin/can_manage_company/has_company_role), or
-- table/view definition anywhere in supabase/migrations or supabase/repairs
-- casts the literal 'owner' - the only occurrences are inside one-time,
-- already-executed data-migration CASE expressions that map the *old*
-- pre-rename role scheme ('owner'/'admin'/'manager'/...) to the current
-- SUPER_ADMIN/ADMIN/SUPERVISOR/OPERARIO enum (001_initial_multitenant_schema.sql
-- and supabase/repairs/repair_signup_trigger_dependencies.sql). PostgREST's own
-- exposed schema confirms `audit_logs` is the plain table (not a view) and the
-- `app_role` enum only has the 4 current values - never 'owner'.
--
-- Query behavior (fetching rows fails, `count`-only HEAD requests succeed)
-- points at an extra, differently-named RLS policy on audit_logs left over
-- from that pre-rename schema (`DROP POLICY IF EXISTS audit_select` in 001
-- only ever removes a policy literally named "audit_select" - a stray
-- policy under a different name from before the app_role rename would never
-- have been touched by any tracked migration and would still be OR'd into
-- every SELECT). Since Postgres doesn't expose policy names to PostgREST,
-- this drops every existing policy on audit_logs by querying pg_policies
-- directly and recreates only the two canonical ones from 001.
--
-- Fully idempotent: safe to run any number of times.

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_logs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.audit_logs', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY audit_select ON public.audit_logs
  FOR SELECT USING (public.is_super_admin() OR public.can_manage_company(company_id));

CREATE POLICY audit_insert ON public.audit_logs
  FOR INSERT WITH CHECK (public.is_company_member(company_id));

NOTIFY pgrst, 'reload schema';

SELECT '022_fix_dashboard_audit_logs_stray_policy completed' AS result;
