-- 019_fix_report_schedules_preferences_rls.sql
--
-- Found in functional QA of "Programación de informes" (2026-07-03): creating a
-- schedule always failed with "new row violates row-level security policy for
-- table report_schedules". Same root cause class as 018: 017's policies compared
-- `public.users.id = auth.uid()`, but `public.users.id` is the internal row id,
-- not the Supabase Auth UID - so the ADMIN-role subquery could never match the
-- current session and every insert/select/update/delete was rejected outright.
--
-- report_preferences had a second, independent bug: its `user_id` column was
-- declared as `REFERENCES auth.users(id)`, but the only code that writes to it
-- (lib/actions/reports.ts updateReportPreferences) inserts the app's internal
-- public.users.id (same "userId" used everywhere else in the codebase, e.g.
-- generated_reports.generated_by) - so even with correct RLS, every insert would
-- also fail the foreign key constraint. Repointed the FK at public.users(id) to
-- match how the column is actually populated, consistent with report_schedules
-- (created_by/company_id) and every other per-user table in the schema.
--
-- Fully idempotent: safe to run any number of times.

-- === report_schedules: fix all four policies to use auth_user_id ===
DROP POLICY IF EXISTS "Users can view own company schedules" ON public.report_schedules;
DROP POLICY IF EXISTS "Admins can insert schedules" ON public.report_schedules;
DROP POLICY IF EXISTS "Admins can update schedules" ON public.report_schedules;
DROP POLICY IF EXISTS "Admins can delete schedules" ON public.report_schedules;

CREATE POLICY "Users can view own company schedules" ON public.report_schedules
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Admins can insert schedules" ON public.report_schedules
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "Admins can update schedules" ON public.report_schedules
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "Admins can delete schedules" ON public.report_schedules
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() AND role = 'ADMIN')
  );

-- === report_preferences: repoint user_id FK at public.users(id) and fix RLS ===
ALTER TABLE public.report_preferences DROP CONSTRAINT IF EXISTS report_preferences_user_id_fkey;
ALTER TABLE public.report_preferences
  ADD CONSTRAINT report_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Users can view own preferences" ON public.report_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.report_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.report_preferences;

CREATE POLICY "Users can view own preferences" ON public.report_preferences
  FOR SELECT USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Users can update own preferences" ON public.report_preferences
  FOR UPDATE USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Users can insert own preferences" ON public.report_preferences
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';

SELECT '019_fix_report_schedules_preferences_rls completed' AS result;
