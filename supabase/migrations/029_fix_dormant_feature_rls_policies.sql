-- 029_fix_dormant_feature_rls_policies.sql
--
-- RC1 certification audit (2026-07-05): a full re-audit of every migration
-- found that asset_images/image_comparisons/image_gallery_settings (008),
-- custom_fields/custom_field_values/custom_field_templates (009), and
-- export_configurations/export_history (010) still compare
-- id/uploaded_by/created_by/exported_by/user_id (public.users.id values)
-- directly to auth.uid() (the Supabase Auth UID) - the same bug class fixed
-- on every other table via 018/019/020/021/026. 021 repointed the *foreign
-- keys* on these exact columns but never touched the RLS, so these 8 tables
-- have had no working permissive policy since 021 ran: every read/write is
-- silently denied for real sessions.
--
-- This has caused zero visible symptoms so far because the frontend for all
-- three features (image galleries/comparisons, custom fields, export
-- configuration) was found to be completely unused dead code in an earlier
-- audit pass and removed - no page in the app queries these tables. Fixed
-- anyway so the schema itself has no broken policies left, matching the
-- corresponding in-place fixes already made to 008/009/010 for fresh installs.
--
-- Fully idempotent: safe to run any number of times.

-- asset_images / image_comparisons / image_gallery_settings (008)
DROP POLICY IF EXISTS "Users can view own company images" ON public.asset_images;
CREATE POLICY "Users can view own company images" ON public.asset_images
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can upload images" ON public.asset_images;
CREATE POLICY "Users can upload images" ON public.asset_images
  FOR INSERT WITH CHECK (
    public.is_company_member(company_id)
    AND uploaded_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "Users can delete own images" ON public.asset_images;
CREATE POLICY "Users can delete own images" ON public.asset_images
  FOR DELETE USING (uploaded_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS "Users can view comparisons" ON public.image_comparisons;
CREATE POLICY "Users can view comparisons" ON public.image_comparisons
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can create comparisons" ON public.image_comparisons;
CREATE POLICY "Users can create comparisons" ON public.image_comparisons
  FOR INSERT WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can view own settings" ON public.image_gallery_settings;
CREATE POLICY "Users can view own settings" ON public.image_gallery_settings
  FOR SELECT USING (user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS "Users can update own settings" ON public.image_gallery_settings;
CREATE POLICY "Users can update own settings" ON public.image_gallery_settings
  FOR UPDATE USING (user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS "Users can insert own settings" ON public.image_gallery_settings;
CREATE POLICY "Users can insert own settings" ON public.image_gallery_settings
  FOR INSERT WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1));

-- custom_fields / custom_field_values / custom_field_templates (009)
DROP POLICY IF EXISTS "Users can view custom fields" ON public.custom_fields;
CREATE POLICY "Users can view custom fields" ON public.custom_fields
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Admins can manage fields" ON public.custom_fields;
CREATE POLICY "Admins can manage fields" ON public.custom_fields
  FOR INSERT WITH CHECK (public.can_manage_company(company_id));

DROP POLICY IF EXISTS "Admins can update fields" ON public.custom_fields;
CREATE POLICY "Admins can update fields" ON public.custom_fields
  FOR UPDATE USING (public.can_manage_company(company_id));

DROP POLICY IF EXISTS "Admins can delete fields" ON public.custom_fields;
CREATE POLICY "Admins can delete fields" ON public.custom_fields
  FOR DELETE USING (public.can_manage_company(company_id));

DROP POLICY IF EXISTS "Users can view field values" ON public.custom_field_values;
CREATE POLICY "Users can view field values" ON public.custom_field_values
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can insert field values" ON public.custom_field_values;
CREATE POLICY "Users can insert field values" ON public.custom_field_values
  FOR INSERT WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can update field values" ON public.custom_field_values;
CREATE POLICY "Users can update field values" ON public.custom_field_values
  FOR UPDATE USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can view templates" ON public.custom_field_templates;
CREATE POLICY "Users can view templates" ON public.custom_field_templates
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Admins can manage templates" ON public.custom_field_templates;
CREATE POLICY "Admins can manage templates" ON public.custom_field_templates
  FOR INSERT WITH CHECK (public.can_manage_company(company_id));

-- export_configurations / export_history (010)
DROP POLICY IF EXISTS "Users can view export configs" ON public.export_configurations;
CREATE POLICY "Users can view export configs" ON public.export_configurations
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can create configs" ON public.export_configurations;
CREATE POLICY "Users can create configs" ON public.export_configurations
  FOR INSERT WITH CHECK (
    public.is_company_member(company_id)
    AND created_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "Users can update own configs" ON public.export_configurations;
CREATE POLICY "Users can update own configs" ON public.export_configurations
  FOR UPDATE USING (created_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS "Users can view export history" ON public.export_history;
CREATE POLICY "Users can view export history" ON public.export_history
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can insert export history" ON public.export_history;
CREATE POLICY "Users can insert export history" ON public.export_history
  FOR INSERT WITH CHECK (
    public.is_company_member(company_id)
    AND exported_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
  );

NOTIFY pgrst, 'reload schema';

SELECT '029_fix_dormant_feature_rls_policies completed' AS result;
