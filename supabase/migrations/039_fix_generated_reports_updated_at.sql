-- 039_fix_generated_reports_updated_at.sql
--
-- 007_reports_enhancement.sql creates public.generated_reports without an
-- updated_at column, but also attaches a generated_reports_set_updated_at
-- trigger (BEFORE UPDATE) that runs the shared set_updated_at() function
-- (001_initial_multitenant_schema.sql), which unconditionally does
-- `new.updated_at = now()`. Every other table using that same trigger has
-- an updated_at column - generated_reports is the one place it was never
-- added, so any UPDATE to this table fails with
-- "record \"new\" has no field \"updated_at\"" (Postgres 42703). Found by
-- running a genuinely fresh install (no manually-added, untracked column
-- like older drifted databases apparently had) and generating a report.
--
-- Fully idempotent: safe to run any number of times.

alter table public.generated_reports
  add column if not exists updated_at timestamptz not null default now();
