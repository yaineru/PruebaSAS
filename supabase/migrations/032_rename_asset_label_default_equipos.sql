-- 032_rename_asset_label_default_equipos.sql
--
-- Client requirement: rename "Activos" -> "Equipos" everywhere in the UI.
-- company_settings.asset_label drives this label dynamically (see
-- lib/company-settings.ts), but the column has a literal DB-level default of
-- 'Activos' (003_company_settings_and_documents.sql) that was already
-- persisted into every existing row at insert time - changing the app-code
-- default alone does not retroactively update rows already in the database.
--
-- Only rows still at the untouched default ('Activos') are updated; a
-- company that deliberately customized its label to something else is left
-- alone.
--
-- Fully idempotent: safe to run any number of times.

alter table public.company_settings alter column asset_label set default 'Equipos';

update public.company_settings
set asset_label = 'Equipos'
where asset_label = 'Activos';

select '032_rename_asset_label_default_equipos completed' as result;