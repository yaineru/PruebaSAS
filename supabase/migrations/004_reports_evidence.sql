-- Reports and Evidence Module
-- Adds professional reporting capabilities and before/after evidence for maintenance and incidents.

-- Extend document_type enum to include Office formats
do $$ begin
  alter type public.document_type add value if not exists 'DOCX';
  alter type public.document_type add value if not exists 'XLSX';
  alter type public.document_type add value if not exists 'PPTX';
exception when duplicate_object then null;
end $$;

-- Create report_templates table
create table if not exists public.report_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  template_type text not null check (template_type in ('PDF', 'EXCEL')),
  report_entity text not null check (report_entity in ('ASSETS', 'MAINTENANCE', 'INCIDENTS', 'PROJECTS', 'DOCUMENTS')),
  filter_config jsonb not null default '{}'::jsonb,
  column_config jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, name),
  constraint report_templates_company_idx unique (company_id, id)
);

-- NOTE: generated_reports table is created in 007_reports_enhancement.sql
-- This file previously created it but now consolidated in 007 for consistency
-- Keeping this comment for reference of the original schema attempt

-- Add evidence fields to maintenance_records
alter table public.maintenance_records add column if not exists evidence_before_url text;
alter table public.maintenance_records add column if not exists evidence_after_url text;
alter table public.maintenance_records add column if not exists observations text;

-- Add evidence fields to incidents
alter table public.incidents add column if not exists evidence_before_url text;
alter table public.incidents add column if not exists evidence_after_url text;
alter table public.incidents add column if not exists observations text;

-- Extend asset_documents mime_type constraint to include office formats
alter table public.asset_documents drop constraint if exists asset_documents_mime_allowed;
alter table public.asset_documents add constraint asset_documents_mime_allowed check (
  mime_type is null or mime_type in (
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  )
);

-- Update storage bucket to allow larger files for reports
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reports',
  'reports',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Create indexes for performance
create index if not exists report_templates_company_idx on public.report_templates(company_id) where deleted_at is null;
create index if not exists report_templates_active_idx on public.report_templates(company_id, is_active) where deleted_at is null;
-- NOTE: generated_reports indexes/triggers/RLS moved to the end of
-- 007_reports_enhancement.sql (that's where the table is actually created) so
-- a fresh install replays in a working order.

-- Set updated_at triggers
drop trigger if exists report_templates_set_updated_at on public.report_templates;
create trigger report_templates_set_updated_at
before update on public.report_templates
for each row execute function public.set_updated_at();

-- Audit triggers
drop trigger if exists audit_report_templates on public.report_templates;
create trigger audit_report_templates
after insert or update or delete on public.report_templates
for each row execute function public.write_audit_log();

-- Enable RLS
alter table public.report_templates enable row level security;

-- Drop old policies if they exist
drop policy if exists report_templates_select on public.report_templates;
drop policy if exists report_templates_insert on public.report_templates;
drop policy if exists report_templates_update on public.report_templates;
drop policy if exists report_templates_delete on public.report_templates;

-- RLS Policies for report_templates
create policy report_templates_select on public.report_templates
for select using (public.is_company_member(company_id));

create policy report_templates_insert on public.report_templates
for insert with check (public.can_manage_company(company_id));

create policy report_templates_update on public.report_templates
for update using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));

create policy report_templates_delete on public.report_templates
for delete using (public.can_manage_company(company_id));

-- Storage policies for reports bucket
drop policy if exists reports_read on storage.objects;
drop policy if exists reports_insert on storage.objects;
drop policy if exists reports_delete on storage.objects;

create policy reports_read on storage.objects for select
using (
  bucket_id = 'reports'
  and public.is_company_member((storage.foldername(name))[1]::uuid)
);

create policy reports_insert on storage.objects for insert
with check (
  bucket_id = 'reports'
  and public.can_register_operations((storage.foldername(name))[1]::uuid)
);

create policy reports_delete on storage.objects for delete
using (
  bucket_id = 'reports'
  and public.can_manage_company((storage.foldername(name))[1]::uuid)
);

-- Enable Realtime for reports
do $$ begin
  alter publication supabase_realtime add table public.report_templates;
exception when duplicate_object then null;
end $$;
-- NOTE: generated_reports realtime publication moved to the end of
-- 007_reports_enhancement.sql, see note above.

select '004_reports_evidence completed' as result;
