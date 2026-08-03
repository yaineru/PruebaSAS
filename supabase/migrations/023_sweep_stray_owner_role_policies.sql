-- 023_sweep_stray_owner_role_policies.sql
--
-- Full-app audit (2026-07-03): after finding the dashboard's audit_logs read
-- broken by a stray, untracked RLS policy referencing the pre-rename 'owner'
-- role (fixed narrowly in 022), a real E2E delete test on Activos hit the
-- exact same error - "invalid input value for enum app_role: \"owner\"" -
-- on public.assets specifically. Proven with a direct probe: deleting the
-- same row via the service role (bypasses RLS) succeeds; deleting it via the
-- normal authenticated session (RLS enforced) fails. The tracked
-- `assets_delete` policy (001_initial_multitenant_schema.sql) only checks
-- `can_manage_company(company_id)`, which has no 'owner' reference and is
-- proven working elsewhere - so this can only be a second, differently-named
-- leftover policy on `assets`, from the same old pre-rename schema era as the
-- one on audit_logs. `DROP POLICY IF EXISTS assets_delete` in 001 never
-- touched it because it has a different name.
--
-- Given the same bug has now surfaced independently on two unrelated tables
-- purely by which operations happened to be exercised in testing, this does
-- one global sweep instead of fixing tables one at a time as they're found:
-- every RLS policy in the public schema whose USING or WITH CHECK expression
-- literally mentions 'owner' gets dropped. This is narrowly targeted (a
-- correctly-written policy like `can_manage_company(company_id)` never
-- matches) and doesn't require recreating anything, since every table's
-- canonical policy already exists from the tracked migrations (001-021) and
-- is untouched by this sweep.
--
-- Fully idempotent: safe to run any number of times (matches nothing once
-- the stray policies are gone).

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

NOTIFY pgrst, 'reload schema';

SELECT '023_sweep_stray_owner_role_policies completed' AS result;
