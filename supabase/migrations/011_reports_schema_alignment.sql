-- Align generated_reports schema with the report generator implementation
-- This migration is safe to re-run and only adds missing columns/compatibility fields.

-- NOTE (RC1 fresh-install audit, 2026-07-05): the two ADD COLUMN blocks below
-- were originally split apart, with the first UPDATE (originally right after
-- the first block) referencing file_format/row_count/filters_applied before
-- the second block created them. That only worked on the already-live
-- database, where those three columns already existed out-of-band before this
-- file first ran; a fresh install hit "column does not exist" here. Both
-- ADD COLUMN blocks now run first, so every column referenced below already
-- exists by the time either UPDATE runs.
ALTER TABLE public.generated_reports
  ADD COLUMN IF NOT EXISTS report_entity text,
  ADD COLUMN IF NOT EXISTS report_format text,
  ADD COLUMN IF NOT EXISTS template_name text,
  ADD COLUMN IF NOT EXISTS record_count integer,
  ADD COLUMN IF NOT EXISTS file_size_bytes integer,
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS filters jsonb,
  ADD COLUMN IF NOT EXISTS generation_time_ms integer,
  ADD COLUMN IF NOT EXISTS error_message text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'generated_reports' AND column_name = 'file_format'
  ) THEN
    ALTER TABLE public.generated_reports ADD COLUMN file_format text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'generated_reports' AND column_name = 'row_count'
  ) THEN
    ALTER TABLE public.generated_reports ADD COLUMN row_count integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'generated_reports' AND column_name = 'filters_applied'
  ) THEN
    ALTER TABLE public.generated_reports ADD COLUMN filters_applied jsonb;
  END IF;
END $$;

UPDATE public.generated_reports
SET report_entity = COALESCE(report_entity, report_type),
    report_format = COALESCE(report_format, file_format),
    template_name = COALESCE(template_name, 'standard'),
    record_count = COALESCE(record_count, row_count, 0),
    file_size_bytes = COALESCE(file_size_bytes, file_size_bytes),
    filters = COALESCE(filters, filters_applied, '{}'::jsonb)
WHERE report_entity IS NULL
   OR report_format IS NULL
   OR template_name IS NULL
   OR record_count IS NULL
   OR filters IS NULL;

ALTER TABLE public.generated_reports
  ALTER COLUMN report_entity SET DEFAULT 'ASSETS',
  ALTER COLUMN report_format SET DEFAULT 'PDF',
  ALTER COLUMN template_name SET DEFAULT 'standard',
  ALTER COLUMN record_count SET DEFAULT 0,
  ALTER COLUMN status SET DEFAULT 'GENERATING';

UPDATE public.generated_reports
SET file_format = COALESCE(file_format, report_format),
    row_count = COALESCE(row_count, record_count, 0),
    filters_applied = COALESCE(filters_applied, filters, '{}'::jsonb)
WHERE file_format IS NULL OR row_count IS NULL OR filters_applied IS NULL;
