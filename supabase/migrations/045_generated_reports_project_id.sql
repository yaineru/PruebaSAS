-- Adds a real, FK-backed project association to generated_reports, for the
-- "informes por carpetas" feature (Proyecto -> Año -> Mes -> Informes).
--
-- Root cause this fixes: generated_reports had NO project reference at all.
-- Technical reports only ever stored the project's NAME as free text inside
-- report_metadata.formPayload.projectName, typed by hand on each report -
-- never validated against the real `projects` table. Confirmed against all
-- 8 real historical technical reports from Progrúas S.A.S. (golden tenant,
-- read-only query on 2026-10-23): not one of their typed project names
-- matches a real `projects` row exactly ("Verbena" vs "OBRA VERBENA" is the
-- closest, and still not equal) - grouping by that text would either invent
-- associations from partial name matches (explicitly out of scope) or
-- produce folders that don't correspond to any real project record.
--
-- This migration only ADDS a nullable column and an index - purely additive,
-- no backfill, no data rewritten, nothing dropped, reversible with a single
-- DROP COLUMN. Existing rows get project_id = NULL, which the application
-- treats as "Sin proyecto asignado" - no automatic reclassification of
-- historical reports happens here or anywhere else, per the operator's
-- explicit decision for this feature (ambiguous data stays unassigned
-- rather than being guessed at).
--
-- Idempotent and safe to re-run any number of times.

ALTER TABLE public.generated_reports
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- Supports both "all reports for project X" (folder contents) and "does
-- project X have reports at all" (folder listing) without a per-folder
-- table scan once report volume grows - the same justification used for
-- every other (company_id, ...) index already on this table.
CREATE INDEX IF NOT EXISTS idx_generated_reports_company_project
  ON public.generated_reports(company_id, project_id);

-- RLS is unchanged on purpose: generated_reports_select/insert/update/delete
-- (007_reports_enhancement.sql) already gate every row by company_id via
-- is_company_member()/can_register_operations()/can_manage_company() - a new
-- nullable column on an already-protected row needs no new policy, and
-- `projects` has its own, separate is_company_member() SELECT policy that
-- the application-level join must still go through (never bypassed).

NOTIFY pgrst, 'reload schema';

SELECT '045_generated_reports_project_id completed' AS result;
