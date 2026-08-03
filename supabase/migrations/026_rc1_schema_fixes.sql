-- 026_rc1_schema_fixes.sql
--
-- RC1 stabilization audit (2026-07-04). Four independent, verified issues found
-- while auditing all 25 prior migrations against the actual application code
-- (lib/tenant.ts, lib/actions/reports.ts, lib/actions/tenant-records.ts).
-- Fully idempotent: safe to run any number of times.

-- ============================================================================
-- 1) generated_reports.generated_by still references auth.users(id), but every
--    caller (lib/actions/reports.ts generateReport(), lib/actions/technical-
--    reports.ts generateTechnicalReport()) writes tenant.userId, i.e.
--    public.users.id - a value independent of auth.users.id (confirmed reading
--    handle_new_auth_user(): it never sets users.id, only auth_user_id). This is
--    the exact bug class already fixed for report_schedules.created_by (020),
--    report_preferences.user_id (019), asset_images/image_gallery_settings/
--    custom_fields/export_configurations/export_history (021) - generated_reports
--    itself was the one table that slipped through every prior pass.
-- ============================================================================
ALTER TABLE public.generated_reports DROP CONSTRAINT IF EXISTS generated_reports_generated_by_fkey;
ALTER TABLE public.generated_reports
  ADD CONSTRAINT generated_reports_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.generated_reports ALTER COLUMN generated_by DROP NOT NULL;

-- ============================================================================
-- 2) report_templates was first created by 004_reports_evidence.sql with one set
--    of columns (name/description/template_type/report_entity/filter_config/
--    column_config/is_active). 007_reports_enhancement.sql later tried to create
--    the *same table name* with a different, richer set of columns (slug,
--    layout_type, color_scheme, page_size, orientation, margins, include_*,
--    chart_types, header_text, footer_text, custom_css) - but its
--    `CREATE TABLE IF NOT EXISTS` is a no-op wherever 004 already ran first, so
--    those columns were never actually created. components/report-template-
--    builder.tsx + lib/actions/reports.ts createReportTemplate() write exactly
--    those 007-only columns (see lib/actions/reports.ts ~line 573) - every
--    "Nueva plantilla" submission needs them to exist.
-- ============================================================================
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS layout_type text DEFAULT 'standard';
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS color_scheme text DEFAULT 'blue';
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS include_logo boolean DEFAULT true;
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS include_company_info boolean DEFAULT true;
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS include_charts boolean DEFAULT true;
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS include_data_table boolean DEFAULT true;
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS include_summary boolean DEFAULT true;
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS include_metrics boolean DEFAULT true;
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS chart_types text[] DEFAULT '{"line","bar"}';
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS page_size text DEFAULT 'A4';
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS orientation text DEFAULT 'portrait';
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS margin_top numeric DEFAULT 1.0;
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS margin_bottom numeric DEFAULT 1.0;
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS margin_left numeric DEFAULT 0.75;
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS margin_right numeric DEFAULT 0.75;
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS header_text text;
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS footer_text text;
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS custom_css text;

create index if not exists report_templates_slug_idx on public.report_templates(company_id, slug);

-- ============================================================================
-- 3) Deleting a company cascades to users/assets/projects/maintenance_records/
--    incidents/etc, each of which has an AFTER DELETE audit trigger
--    (write_audit_log(), 001_initial_multitenant_schema.sql) that inserts into
--    audit_logs with the row's company_id - but by the time that cascade fires,
--    the parent companies row is already gone from the table, so the insert
--    violates audit_logs_company_id_fkey and the whole DELETE fails. Confirmed
--    live: this blocked cleanup of two orphaned QA company shells in a prior
--    audit session. Fix: don't let a failed audit insert abort the real
--    operation it's trying to log - this only ever happens on the tail end of a
--    company deletion, where losing that one audit row is a non-issue.
-- ============================================================================
create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  changed_company_id uuid;
  changed_record_id uuid;
  actor_user_id uuid;
begin
  if tg_op = 'DELETE' then
    changed_company_id := old.company_id;
    changed_record_id := old.id;
  else
    changed_company_id := new.company_id;
    changed_record_id := new.id;
  end if;

  actor_user_id := public.current_app_user_id();

  begin
    insert into public.audit_logs (
      company_id, actor_id, actor_auth_user_id, action, table_name, record_id, old_values, new_values
    )
    values (
      changed_company_id,
      actor_user_id,
      auth.uid(),
      tg_op::public.audit_action,
      tg_table_name,
      changed_record_id,
      case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
      case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
    );
  exception when foreign_key_violation then
    -- Parent company (or other referenced row) no longer exists, e.g. this is a
    -- cascade delete triggered by deleting the company itself. Skip the audit
    -- row rather than aborting the real delete.
    null;
  end;

  return coalesce(new, old);
end;
$$;

-- ============================================================================
-- 4) report_templates/generated_reports each ended up with two independent sets
--    of RLS policies: the correct ones from 004_reports_evidence.sql
--    (is_company_member()/can_manage_company()/can_register_operations()) and a
--    second, English-named set from 007_reports_enhancement.sql that compares
--    `id = auth.uid()` directly - always false, since public.users.id is never
--    equal to the Supabase Auth UID. Harmless today only because Postgres ORs
--    permissive policies together and 004's policies already grant the correct
--    access - but it's dead weight that misleads anyone reading the policy list.
--    Dropping the always-false 007 policies changes no actual behavior.
-- ============================================================================
DROP POLICY IF EXISTS "Users can view templates" ON public.report_templates;
DROP POLICY IF EXISTS "Admins can manage templates" ON public.report_templates;
DROP POLICY IF EXISTS "Admins can update templates" ON public.report_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON public.report_templates;
DROP POLICY IF EXISTS "Users can view own company reports" ON public.generated_reports;

-- ============================================================================
-- 5) Missing indexes on foreign-key columns (Postgres does not auto-index FKs).
--    Additive only, no behavior change.
-- ============================================================================
create index if not exists users_created_by_idx on public.users(created_by);
create index if not exists users_updated_by_idx on public.users(updated_by);
create index if not exists assets_created_by_idx on public.assets(created_by);
create index if not exists assets_updated_by_idx on public.assets(updated_by);
create index if not exists projects_owner_id_idx on public.projects(owner_id);
create index if not exists projects_created_by_idx on public.projects(created_by);
create index if not exists projects_updated_by_idx on public.projects(updated_by);
create index if not exists asset_assignments_assigned_to_idx on public.asset_assignments(assigned_to);
create index if not exists maintenance_records_created_by_idx on public.maintenance_records(created_by);
create index if not exists maintenance_records_updated_by_idx on public.maintenance_records(updated_by);
create index if not exists maintenance_alerts_created_by_idx on public.maintenance_alerts(created_by);
create index if not exists asset_documents_created_by_idx on public.asset_documents(created_by);
create index if not exists incidents_reported_by_idx on public.incidents(reported_by);
create index if not exists incidents_assigned_to_idx on public.incidents(assigned_to);
create index if not exists incident_comments_author_id_idx on public.incident_comments(author_id);
create index if not exists notifications_created_by_idx on public.notifications(created_by);
create index if not exists project_history_created_by_idx on public.project_history(created_by);

create index if not exists generated_reports_generated_by_idx on public.generated_reports(generated_by);
create index if not exists report_templates_created_by_idx on public.report_templates(created_by);
create index if not exists report_schedules_created_by_idx on public.report_schedules(created_by);
create index if not exists asset_images_uploaded_by_idx on public.asset_images(uploaded_by);
create index if not exists asset_images_maintenance_record_id_idx on public.asset_images(maintenance_record_id);
create index if not exists asset_images_incident_id_idx on public.asset_images(incident_id);
create index if not exists image_comparisons_maintenance_record_id_idx on public.image_comparisons(maintenance_record_id);
create index if not exists image_comparisons_incident_id_idx on public.image_comparisons(incident_id);
create index if not exists custom_fields_created_by_idx on public.custom_fields(created_by);
create index if not exists custom_field_templates_industry_template_id_idx on public.custom_field_templates(industry_template_id);
create index if not exists export_configurations_created_by_idx on public.export_configurations(created_by);
create index if not exists export_history_exported_by_idx on public.export_history(exported_by);
create index if not exists analytics_events_user_id_idx on public.analytics_events(user_id);

NOTIFY pgrst, 'reload schema';

SELECT '026_rc1_schema_fixes completed' AS result;
