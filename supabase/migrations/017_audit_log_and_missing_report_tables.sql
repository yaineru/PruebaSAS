-- Full-app schema audit (2026-07-02), two independent findings fixed together:
--
-- 1) audit_logs: every manual application-level insert across the codebase
--    (uploadEvidence, generateReport, generateTechnicalReport, delete/download report
--    routes, custom fields, images, exports, bulk update) used a schema that never
--    matched the real table (user_id/entity_type/entity_id/changes vs the real
--    actor_id/table_name/record_id/old_values/new_values), and `action` used
--    dozens of free-text values against a strict `audit_action` enum that only had
--    INSERT/UPDATE/DELETE/LOGIN/LOGOUT/PERMISSION_DENIED. Every one of those inserts
--    has been silently failing (mostly unchecked `await`s) since deployment - audit
--    logging for anything except the 9 trigger-covered tables has never worked.
--    The application code was fixed to use the real column names; this migration
--    only needs to widen the enum with the legitimate action categories the app
--    actually uses (never drop/replace the enum, only add to it).
--
-- 2) report_schedules / report_preferences: referenced by lib/actions/reports.ts and
--    app/(app)/admin/report-schedules/page.tsx but were never created - only
--    report_templates and generated_reports (also defined in 007) exist live, meaning
--    007_reports_enhancement.sql was applied partially. Re-created here verbatim from
--    007's original definition, gated by IF NOT EXISTS so this is safe to re-run and
--    won't touch report_templates/generated_reports which already exist.
--
-- Fully idempotent: safe to run any number of times.

-- === 1) Widen audit_action enum with the action categories real code sends ===
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'GENERATE_REPORT';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'DOWNLOAD_REPORT';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'DELETE_REPORT';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'UPLOAD_EVIDENCE';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'GENERATE_TECHNICAL_REPORT';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'CREATE_CUSTOM_FIELD';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'PERFORM_EXPORT';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'UPLOAD_IMAGE';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'DELETE_IMAGE';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'BULK_UPDATE';

-- === 2) Re-create the two report_schedules/report_preferences tables 007 never applied ===
CREATE TABLE IF NOT EXISTS public.report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,
  report_entity TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  frequency TEXT NOT NULL CHECK (frequency IN ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY')),
  day_of_week INTEGER,
  day_of_month INTEGER,
  time_of_day TIME NOT NULL DEFAULT '09:00:00',
  report_format TEXT NOT NULL CHECK (report_format IN ('PDF', 'EXCEL', 'BOTH')),
  template_name TEXT DEFAULT 'standard',
  include_charts BOOLEAN DEFAULT true,
  include_summary BOOLEAN DEFAULT true,
  enabled BOOLEAN DEFAULT true,
  email_recipients TEXT[] DEFAULT '{}',
  last_generated_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  total_runs INTEGER DEFAULT 0,
  failed_runs INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.report_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  default_format TEXT DEFAULT 'PDF',
  default_template TEXT DEFAULT 'standard',
  auto_include_charts BOOLEAN DEFAULT true,
  preferred_export_folder TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_report_schedules_company ON public.report_schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON public.report_schedules(next_run_at, enabled);
CREATE INDEX IF NOT EXISTS idx_report_preferences_user ON public.report_preferences(company_id, user_id);

ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own company schedules" ON public.report_schedules;
DROP POLICY IF EXISTS "Admins can insert schedules" ON public.report_schedules;
DROP POLICY IF EXISTS "Admins can update schedules" ON public.report_schedules;
DROP POLICY IF EXISTS "Admins can delete schedules" ON public.report_schedules;
DROP POLICY IF EXISTS "Users can view own preferences" ON public.report_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.report_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.report_preferences;

CREATE POLICY "Users can view own company schedules" ON public.report_schedules
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Admins can insert schedules" ON public.report_schedules
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "Admins can update schedules" ON public.report_schedules
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "Admins can delete schedules" ON public.report_schedules
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "Users can view own preferences" ON public.report_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own preferences" ON public.report_preferences
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences" ON public.report_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS report_schedules_updated_at ON public.report_schedules;
CREATE TRIGGER report_schedules_updated_at
BEFORE UPDATE ON public.report_schedules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS report_preferences_updated_at ON public.report_preferences;
CREATE TRIGGER report_preferences_updated_at
BEFORE UPDATE ON public.report_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- === 3) report_templates: the admin "Report Template Builder" UI/action/zod schema
--    (components/report-template-builder.tsx, lib/actions/reports.ts createReportTemplate,
--    lib/reports/report-schema.ts reportTemplateSchema) were all built against 007's much
--    richer report_templates definition (slug, layout_type, color_scheme, page/margin
--    settings, etc.). The table that actually exists live matches 004's narrower
--    definition instead (template_type/report_entity NOT NULL + CHECK, filter_config,
--    column_config) - so every template creation attempt fails twice over: missing
--    columns, and missing required NOT NULL fields the UI never collects. Widening the
--    live table (not the UI) preserves the already-built feature, consistent with how
--    generated_reports and report_type were handled above.
ALTER TABLE public.report_templates
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS layout_type TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS color_scheme TEXT DEFAULT 'blue',
  ADD COLUMN IF NOT EXISTS include_logo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_company_info BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_charts BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_data_table BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_summary BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_metrics BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS chart_types TEXT[] DEFAULT '{"line", "bar"}',
  ADD COLUMN IF NOT EXISTS page_size TEXT DEFAULT 'A4',
  ADD COLUMN IF NOT EXISTS orientation TEXT DEFAULT 'portrait',
  ADD COLUMN IF NOT EXISTS margin_top NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS margin_bottom NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS margin_left NUMERIC DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS margin_right NUMERIC DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS header_text TEXT,
  ADD COLUMN IF NOT EXISTS footer_text TEXT,
  ADD COLUMN IF NOT EXISTS custom_css TEXT,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- template_type/report_entity are NOT NULL + CHECK live, but createReportTemplate never
-- supplies them (the UI has no concept of "which entity/format" - it's a generic PDF
-- layout template). Give them defaults so the existing insert keeps working without
-- weakening the constraint for callers that DO specify a value.
ALTER TABLE public.report_templates
  ALTER COLUMN template_type SET DEFAULT 'PDF',
  ALTER COLUMN report_entity SET DEFAULT 'ASSETS';

-- Backfill: slug must be unique-ish and human-derivable; only fill rows inserted before
-- this column existed (none expected in practice since inserts were failing outright).
UPDATE public.report_templates
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS report_templates_company_slug_idx
  ON public.report_templates(company_id, slug)
  WHERE deleted_at IS NULL AND slug IS NOT NULL;

NOTIFY pgrst, 'reload schema';

SELECT '017_audit_log_and_missing_report_tables completed' AS result;
