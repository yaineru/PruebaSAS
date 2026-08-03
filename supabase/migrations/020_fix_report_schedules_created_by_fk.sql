-- 020_fix_report_schedules_created_by_fk.sql
--
-- Found in functional QA of "Programación de informes" (2026-07-03), right after
-- running 019: creating a schedule now passed RLS but failed with
-- "insert or update on table report_schedules violates foreign key constraint
-- report_schedules_created_by_fkey - Key is not present in table users."
--
-- Same bug class as report_preferences.user_id (fixed in 019): 017 declared
-- `created_by UUID NOT NULL REFERENCES auth.users(id)`, but
-- lib/actions/reports.ts createReportSchedule() inserts the app's internal
-- public.users.id (getTenantContext().userId), not the Supabase Auth UID.
-- report_templates.created_by (004_reports_evidence.sql) already correctly
-- references public.users(id) - repointing report_schedules the same way.
--
-- Fully idempotent: safe to run any number of times.

ALTER TABLE public.report_schedules DROP CONSTRAINT IF EXISTS report_schedules_created_by_fkey;
ALTER TABLE public.report_schedules
  ADD CONSTRAINT report_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- created_by must be nullable now that its ON DELETE action is SET NULL instead
-- of the implicit RESTRICT/cascade-less default it had against auth.users(id).
ALTER TABLE public.report_schedules ALTER COLUMN created_by DROP NOT NULL;

NOTIFY pgrst, 'reload schema';

SELECT '020_fix_report_schedules_created_by_fk completed' AS result;
