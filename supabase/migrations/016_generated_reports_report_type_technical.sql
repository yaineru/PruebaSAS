-- Widen generated_reports_report_type_check to accept 'TECHNICAL_REPORT'.
--
-- Audited via a read-only query against pg_constraint on 2026-07-02:
--   CHECK ((report_type = ANY (ARRAY['ASSETS','MAINTENANCE','INCIDENTS','PROJECTS','DOCUMENTS'])))
-- lib/actions/technical-reports.ts inserts report_type = 'TECHNICAL_REPORT' for the
-- client-facing technical service report generated from /informes-tecnicos, which is
-- a distinct report category from the 5 generic entity-export types above (it is not
-- an export of a whole entity table, it's a per-maintenance-visit deliverable with its
-- own template/evidence/signatures). Reusing e.g. 'MAINTENANCE' would misclassify it in
-- history/filtering, so the constraint is widened rather than the code being bent to fit.
--
-- This migration is idempotent: DROP CONSTRAINT IF EXISTS + re-ADD CONSTRAINT with the
-- exact same name is safe to re-run any number of times. It never removes the check
-- entirely - it only replaces it with a strictly wider version of the same allow-list.

ALTER TABLE public.generated_reports
  DROP CONSTRAINT IF EXISTS generated_reports_report_type_check;

ALTER TABLE public.generated_reports
  ADD CONSTRAINT generated_reports_report_type_check
  CHECK (report_type = ANY (ARRAY[
    'ASSETS'::text,
    'MAINTENANCE'::text,
    'INCIDENTS'::text,
    'PROJECTS'::text,
    'DOCUMENTS'::text,
    'TECHNICAL_REPORT'::text
  ]));

NOTIFY pgrst, 'reload schema';

SELECT '016_generated_reports_report_type_technical completed' AS result;
