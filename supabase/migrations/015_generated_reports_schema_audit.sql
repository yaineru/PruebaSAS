-- Schema audit fix for public.generated_reports
-- Root cause: migration 012_reports_professional_layout.sql defines
-- report_metadata / evidence_items / signatures, but that file was never
-- actually executed against the live database (migrations in this project
-- are applied by hand via the SQL Editor, not by an automated runner - see
-- supabase/README.md). Live schema was introspected via the PostgREST
-- OpenAPI endpoint on 2026-07-02 and confirmed these three columns do not
-- exist, which is exactly what produces:
--   "Could not find the 'evidence_items' column of 'generated_reports' in the schema cache"
-- on insert from lib/actions/technical-reports.ts.
--
-- This migration is idempotent and safe to re-run any number of times.

ALTER TABLE public.generated_reports
  ADD COLUMN IF NOT EXISTS report_metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_items jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS signatures jsonb DEFAULT '[]'::jsonb;

-- Backfill any pre-existing rows (inserted before these columns existed) so
-- reads never see NULL where the application code expects an object/array.
UPDATE public.generated_reports
SET report_metadata = COALESCE(report_metadata, '{}'::jsonb),
    evidence_items = COALESCE(evidence_items, '[]'::jsonb),
    signatures = COALESCE(signatures, '[]'::jsonb)
WHERE report_metadata IS NULL
   OR evidence_items IS NULL
   OR signatures IS NULL;

-- PostgREST caches the schema and only reloads it automatically on DDL events
-- coming through its own connection. Force a reload so the new columns are
-- visible to the API immediately instead of waiting for the next deploy/restart.
NOTIFY pgrst, 'reload schema';

SELECT '015_generated_reports_schema_audit completed' AS result;
