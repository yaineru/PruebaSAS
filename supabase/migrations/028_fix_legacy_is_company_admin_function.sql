-- 028_fix_legacy_is_company_admin_function.sql
--
-- RC1 certification (2026-07-05): DELETE on assets (and presumably the other
-- 7 tables 027 targeted) still failed live with "invalid input value for
-- enum app_role: \"owner\"" even after 027's exhaustive sweep of
-- pg_policies.qual/with_check found nothing to drop. Root cause, found via
-- supabase/diagnostics/rc1_owner_bug_diagnostic.sql (introspecting pg_proc
-- instead of just pg_policies): a completely untracked function,
-- public.is_company_admin(target_company_id uuid), never defined in any
-- numbered migration - a leftover from a much older, pre-rename schema
-- version. Its body is:
--
--   select exists (
--     select 1 from public.users
--     where users.company_id = target_company_id
--       and users.user_id = auth.uid()
--       and users.status = 'active'
--       and users.role in ('owner', 'admin')
--       and users.deleted_at is null
--   );
--
-- Every column/value it references belongs to a schema that no longer
-- exists (users.user_id instead of auth_user_id, users.status instead of
-- is_active, lowercase 'owner'/'admin' instead of the current app_role enum
-- values SUPER_ADMIN/ADMIN/SUPERVISOR/OPERARIO). Whichever policy calls
-- is_company_admin() - not found directly by 027's sweep because the literal
-- text "owner" only appears inside this function's body, one level of
-- indirection away from the policy's own USING/WITH CHECK text, which is all
-- 027 searched - triggers Postgres to try casting the literal 'owner' to
-- app_role for the `role in (...)` comparison, which fails immediately
-- because 'owner' was never a valid app_role value.
--
-- Fix: redefine the function (same name/signature, so any policy still
-- calling it keeps working) to delegate to the already-correct
-- can_manage_company(), instead of hunting down every caller individually.
--
-- Fully idempotent: safe to run any number of times.

create or replace function public.is_company_admin(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_manage_company(target_company_id);
$$;

-- Clean up the diagnostic table created by rc1_owner_bug_diagnostic.sql.
drop table if exists public._rc1_diag_findings;

NOTIFY pgrst, 'reload schema';

SELECT '028_fix_legacy_is_company_admin_function completed' AS result;
