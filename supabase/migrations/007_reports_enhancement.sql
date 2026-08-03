-- FASE 3: Reports Enhancement
-- Purpose: Add support for scheduled reports and report templates
-- Created: 2026-06-11

-- Table: report_schedules
-- Purpose: Store scheduled report generation configurations
CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Schedule info
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL, -- ASSETS, INCIDENTS, MAINTENANCE, etc
  report_entity TEXT NOT NULL,
  
  -- Advanced filters applied
  filters JSONB DEFAULT '{}', -- stores filter values
  
  -- Scheduling
  frequency TEXT NOT NULL CHECK (frequency IN ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY')),
  day_of_week INTEGER, -- 0-6 for WEEKLY
  day_of_month INTEGER, -- 1-31 for MONTHLY
  time_of_day TIME NOT NULL DEFAULT '09:00:00',
  
  -- Format options
  report_format TEXT NOT NULL CHECK (report_format IN ('PDF', 'EXCEL', 'BOTH')),
  template_name TEXT DEFAULT 'standard',
  include_charts BOOLEAN DEFAULT true,
  include_summary BOOLEAN DEFAULT true,
  
  -- Email delivery
  enabled BOOLEAN DEFAULT true,
  email_recipients TEXT[] DEFAULT '{}',
  
  -- Tracking
  last_generated_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  total_runs INTEGER DEFAULT 0,
  failed_runs INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: report_templates
-- Purpose: Store custom report template configurations
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Template info
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  
  -- Layout
  layout_type TEXT DEFAULT 'standard', -- standard, executive, detailed, comparison
  color_scheme TEXT DEFAULT 'blue', -- for styling
  include_logo BOOLEAN DEFAULT true,
  include_company_info BOOLEAN DEFAULT true,
  
  -- Content options
  include_charts BOOLEAN DEFAULT true,
  include_data_table BOOLEAN DEFAULT true,
  include_summary BOOLEAN DEFAULT true,
  include_metrics BOOLEAN DEFAULT true,
  chart_types TEXT[] DEFAULT '{"line", "bar"}',
  
  -- Page settings
  page_size TEXT DEFAULT 'A4', -- A4, Letter, Legal
  orientation TEXT DEFAULT 'portrait', -- portrait, landscape
  margin_top NUMERIC DEFAULT 1.0,
  margin_bottom NUMERIC DEFAULT 1.0,
  margin_left NUMERIC DEFAULT 0.75,
  margin_right NUMERIC DEFAULT 0.75,
  
  -- Custom content
  header_text TEXT,
  footer_text TEXT,
  custom_css TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: generated_reports
-- Purpose: Store history of all generated reports
CREATE TABLE IF NOT EXISTS generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  generated_by UUID NOT NULL REFERENCES auth.users(id),
  schedule_id UUID REFERENCES report_schedules(id) ON DELETE SET NULL,
  
  -- Report metadata
  report_type TEXT NOT NULL,
  report_entity TEXT NOT NULL,
  report_format TEXT NOT NULL CHECK (report_format IN ('PDF', 'EXCEL', 'BOTH')),
  template_name TEXT,
  
  -- Filters applied
  filters JSONB DEFAULT '{}',
  
  -- Generated content
  record_count INTEGER DEFAULT 0,
  file_size_bytes INTEGER,
  file_path TEXT, -- path in Supabase Storage
  file_url TEXT, -- signed URL
  
  -- Status
  status TEXT NOT NULL DEFAULT 'GENERATED' CHECK (status IN ('GENERATING', 'GENERATED', 'FAILED')),
  error_message TEXT,
  
  -- Timing
  generation_time_ms INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: report_preferences
-- Purpose: Store user preferences for reports
CREATE TABLE IF NOT EXISTS report_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  default_format TEXT DEFAULT 'PDF',
  default_template TEXT DEFAULT 'standard',
  auto_include_charts BOOLEAN DEFAULT true,
  preferred_export_folder TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(company_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_schedules_company ON report_schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON report_schedules(next_run_at, enabled);
CREATE INDEX IF NOT EXISTS idx_report_templates_company ON report_templates(company_id);
-- NOTE: an index on report_templates(company_id, slug) used to be created here,
-- but report_templates at this point in a fresh sequential install (001..032)
-- is still 004's narrower definition - "slug" is only added later by 017's
-- ALTER TABLE. That made this line abort a brand-new install outright before
-- 008-032 ever ran. 017 already creates the correct (unique) index on that
-- column once it actually exists, so this one was simply removed rather than
-- reordered.
CREATE INDEX IF NOT EXISTS idx_generated_reports_company ON generated_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_created ON generated_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_generated_reports_schedule ON generated_reports(schedule_id);
CREATE INDEX IF NOT EXISTS idx_report_preferences_user ON report_preferences(company_id, user_id);

-- RLS Policies
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before creating (idempotent)
DROP POLICY IF EXISTS "Users can view own company schedules" ON report_schedules;
DROP POLICY IF EXISTS "Admins can insert schedules" ON report_schedules;
DROP POLICY IF EXISTS "Admins can update schedules" ON report_schedules;
DROP POLICY IF EXISTS "Admins can delete schedules" ON report_schedules;

DROP POLICY IF EXISTS "Users can view templates" ON report_templates;
DROP POLICY IF EXISTS "Admins can manage templates" ON report_templates;
DROP POLICY IF EXISTS "Admins can update templates" ON report_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON report_templates;

DROP POLICY IF EXISTS "Users can view own company reports" ON generated_reports;

DROP POLICY IF EXISTS "Users can view own preferences" ON report_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON report_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON report_preferences;

-- report_schedules: Users can only see their company's schedules
CREATE POLICY "Users can view own company schedules" ON report_schedules
  FOR SELECT USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can insert schedules" ON report_schedules
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "Admins can update schedules" ON report_schedules
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "Admins can delete schedules" ON report_schedules
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- report_templates: Users can view, admins can manage
CREATE POLICY "Users can view templates" ON report_templates
  FOR SELECT USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage templates" ON report_templates
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "Admins can update templates" ON report_templates
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "Admins can delete templates" ON report_templates
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- generated_reports: Users can view own company reports
CREATE POLICY "Users can view own company reports" ON generated_reports
  FOR SELECT USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- report_preferences: Users can manage their own
CREATE POLICY "Users can view own preferences" ON report_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own preferences" ON report_preferences
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences" ON report_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_report_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS report_schedules_updated_at ON report_schedules;
CREATE TRIGGER report_schedules_updated_at
BEFORE UPDATE ON report_schedules
FOR EACH ROW
EXECUTE FUNCTION update_report_schedules_updated_at();

CREATE OR REPLACE FUNCTION update_report_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS report_templates_updated_at ON report_templates;
CREATE TRIGGER report_templates_updated_at
BEFORE UPDATE ON report_templates
FOR EACH ROW
EXECUTE FUNCTION update_report_templates_updated_at();

CREATE OR REPLACE FUNCTION update_report_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS report_preferences_updated_at ON report_preferences;
CREATE TRIGGER report_preferences_updated_at
BEFORE UPDATE ON report_preferences
FOR EACH ROW
EXECUTE FUNCTION update_report_preferences_updated_at();

-- The following block was originally in 004_reports_evidence.sql, which runs
-- before this file and referenced public.generated_reports before it existed -
-- a fresh install replaying 001..024 in order failed here. Relocated to run
-- right after the CREATE TABLE above; harmless/idempotent on the already-live
-- database where these objects already exist one way or another.

-- NOTE: the original version of these three indexes (copy-pasted from
-- report_templates' pattern, which does have deleted_at) referenced
-- generated_reports.deleted_at and .expires_at - neither column exists on
-- this table (it uses hard delete, see app/api/reports/delete/route.ts, and
-- has no expiration column despite the UI copy mentioning a 30-day
-- availability window - that was never actually implemented). Fixed to index
-- only columns that exist; a fresh install would otherwise fail here with
-- "column does not exist".
create index if not exists generated_reports_company_idx on public.generated_reports(company_id);
create index if not exists generated_reports_created_idx on public.generated_reports(company_id, created_at desc);

drop trigger if exists generated_reports_set_updated_at on public.generated_reports;
create trigger generated_reports_set_updated_at
before update on public.generated_reports
for each row execute function public.set_updated_at();

drop trigger if exists audit_generated_reports on public.generated_reports;
create trigger audit_generated_reports
after insert or update or delete on public.generated_reports
for each row execute function public.write_audit_log();

create or replace function public.notify_report_generated()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'READY' then
    perform public.create_company_notification(
      new.company_id,
      new.generated_by,
      'Informe generado',
      'Tu informe ' || new.report_type || ' está listo para descargar',
      'REPORT_GENERATED',
      'generated_reports',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_report_ready on public.generated_reports;
create trigger notify_report_ready
after insert or update on public.generated_reports
for each row execute function public.notify_report_generated();

alter table public.generated_reports enable row level security;

drop policy if exists generated_reports_select on public.generated_reports;
drop policy if exists generated_reports_insert on public.generated_reports;
drop policy if exists generated_reports_update on public.generated_reports;
drop policy if exists generated_reports_delete on public.generated_reports;

create policy generated_reports_select on public.generated_reports
for select using (public.is_company_member(company_id));

create policy generated_reports_insert on public.generated_reports
for insert with check (public.can_register_operations(company_id));

create policy generated_reports_update on public.generated_reports
for update using (public.can_register_operations(company_id))
with check (public.can_register_operations(company_id));

create policy generated_reports_delete on public.generated_reports
for delete using (public.can_manage_company(company_id));

do $$ begin
  alter publication supabase_realtime add table public.generated_reports;
exception when duplicate_object then null;
end $$;
