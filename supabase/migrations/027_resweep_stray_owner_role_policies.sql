-- 027_resweep_stray_owner_role_policies.sql
--
-- RC1 audit (2026-07-04): real E2E test (Playwright, throwaway QA company)
-- hit the exact same error 023_sweep_stray_owner_role_policies.sql was
-- written to eliminate - "invalid input value for enum app_role: \"owner\""
-- - while deleting a row from public.assets through the normal authenticated
-- session (RLS enforced). 023's sweep searches pg_policies.qual/with_check
-- for '%owner%' and drops any match; if 023 was actually applied already,
-- this migration is a guaranteed no-op (nothing left to match). It exists in
-- case 023 was never run against this database, or a stray policy referencing
-- the pre-rename 'owner' role reappeared some other way (e.g. a table
-- recreated after 023 ran). Re-running the identical sweep is the safest fix
-- either way - it cannot remove a correctly-written policy, since none of the
-- canonical policies from 001-021 ever reference 'owner'.
--
-- Also widens the search slightly: besides USING/WITH CHECK (qual/with_check),
-- checks policies where the column list of roles (polroles) - not reachable
-- via pg_policies - is irrelevant here since 'owner' would never be a role
-- name, only a role *value* compared against the app_role enum column.
--
-- Fully idempotent: safe to run any number of times.

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') ILIKE '%owner%'
        OR coalesce(with_check, '') ILIKE '%owner%'
      )
  LOOP
    RAISE NOTICE 'Dropping stray policy % on %.%', pol.policyname, pol.schemaname, pol.tablename;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- Defensive re-assertion: guarantee the canonical delete policies from
-- 001_initial_multitenant_schema.sql exist (exact names as declared there),
-- in case a stray same-named policy shadowed them or the sweep above just
-- removed the only delete policy this table had.
DROP POLICY IF EXISTS assets_delete ON public.assets;
CREATE POLICY assets_delete ON public.assets FOR DELETE USING (public.can_manage_company(company_id));

DROP POLICY IF EXISTS maintenance_delete ON public.maintenance_records;
CREATE POLICY maintenance_delete ON public.maintenance_records FOR DELETE USING (public.can_manage_company(company_id));

DROP POLICY IF EXISTS alerts_delete ON public.maintenance_alerts;
CREATE POLICY alerts_delete ON public.maintenance_alerts FOR DELETE USING (public.can_manage_company(company_id));

DROP POLICY IF EXISTS incidents_delete ON public.incidents;
CREATE POLICY incidents_delete ON public.incidents FOR DELETE USING (public.can_manage_company(company_id));

DROP POLICY IF EXISTS projects_delete ON public.projects;
CREATE POLICY projects_delete ON public.projects FOR DELETE USING (public.can_manage_company(company_id));

DROP POLICY IF EXISTS documents_delete ON public.asset_documents;
CREATE POLICY documents_delete ON public.asset_documents FOR DELETE USING (public.can_manage_company(company_id));

DROP POLICY IF EXISTS assignments_delete ON public.asset_assignments;
CREATE POLICY assignments_delete ON public.asset_assignments FOR DELETE USING (public.can_manage_company(company_id));

DROP POLICY IF EXISTS users_delete ON public.users;
CREATE POLICY users_delete ON public.users FOR DELETE USING (public.can_manage_company(company_id));

DROP POLICY IF EXISTS notifications_delete ON public.notifications;
CREATE POLICY notifications_delete ON public.notifications FOR DELETE USING (public.can_manage_company(company_id));

NOTIFY pgrst, 'reload schema';

SELECT '027_resweep_stray_owner_role_policies completed' AS result;
