-- 021_fix_remaining_auth_users_fk_bugs.sql
--
-- Full-app audit (2026-07-03): after finding the same "REFERENCES auth.users(id)
-- but the app writes public.users.id" bug in report_schedules/report_preferences
-- (019, 020), searched every migration for the same pattern and probed each live
-- table with a real insert (service role bypasses RLS but not foreign keys, so
-- this reflects the actual deployed schema, not just the migration source).
--
-- Confirmed broken the same way - every INSERT from the app currently fails with
-- a foreign key violation, so these features have never worked end-to-end:
--   - asset_images.uploaded_by            (lib/actions/images.ts uploadAssetImage)
--   - image_gallery_settings.user_id      (lib/actions/images.ts, gallery prefs)
--   - custom_fields.created_by            (lib/actions/custom-fields.ts)
--   - export_configurations.created_by    (lib/actions/exports.ts)
--   - export_history.exported_by          (lib/actions/exports.ts)
--
-- All five get the same fix as 020: repoint the FK at public.users(id), which is
-- what getTenantContext().userId (lib/tenant.ts) actually returns, consistent
-- with every other correctly-working per-user column in the schema (e.g.
-- report_templates.created_by from 004_reports_evidence.sql).
--
-- Fully idempotent: safe to run any number of times.

ALTER TABLE public.asset_images DROP CONSTRAINT IF EXISTS asset_images_uploaded_by_fkey;
ALTER TABLE public.asset_images
  ADD CONSTRAINT asset_images_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.asset_images ALTER COLUMN uploaded_by DROP NOT NULL;

ALTER TABLE public.image_gallery_settings DROP CONSTRAINT IF EXISTS image_gallery_settings_user_id_fkey;
ALTER TABLE public.image_gallery_settings
  ADD CONSTRAINT image_gallery_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.custom_fields DROP CONSTRAINT IF EXISTS custom_fields_created_by_fkey;
ALTER TABLE public.custom_fields
  ADD CONSTRAINT custom_fields_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.custom_fields ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.export_configurations DROP CONSTRAINT IF EXISTS export_configurations_created_by_fkey;
ALTER TABLE public.export_configurations
  ADD CONSTRAINT export_configurations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.export_configurations ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.export_history DROP CONSTRAINT IF EXISTS export_history_exported_by_fkey;
ALTER TABLE public.export_history
  ADD CONSTRAINT export_history_exported_by_fkey FOREIGN KEY (exported_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.export_history ALTER COLUMN exported_by DROP NOT NULL;

NOTIFY pgrst, 'reload schema';

SELECT '021_fix_remaining_auth_users_fk_bugs completed' AS result;
