-- 041_set_progruas_niche.sql
--
-- Puntual, single-row correction for the one real tenant, Progrúas S.A.S.
-- (company_id 36aa9ef4-fab3-4703-be65-2c2099540410). Verified by direct
-- read-only query against production before writing this migration
-- (2026-09-07), the row was exactly:
--   business_type='general', asset_label='Equipos',
--   maintenance_label='Mantenimientos', project_label='Proyectos',
--   incident_label='Novedades', primary_color='#0f766e',
--   secondary_color='#f59e0b', logo_url='/branding/progruas-logo.png'
--
-- This sets ONLY business_type - no label, color, or logo column is touched -
-- so the niche module registry (lib/niches.ts) can recognize this tenant as
-- 'machinery' (all 8 modules visible, same as today) without changing a
-- single pixel of what Progrúas currently sees. Guarded to a no-op unless
-- business_type is still exactly 'general' (i.e. unless something already
-- changed it since the row was verified above).
--
-- Fully idempotent: safe to run any number of times.

update public.company_settings
set business_type = 'machinery'
where company_id = '36aa9ef4-fab3-4703-be65-2c2099540410'
  and business_type = 'general';

SELECT '041_set_progruas_niche completed' AS result;
