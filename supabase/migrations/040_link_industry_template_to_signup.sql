-- 040_link_industry_template_to_signup.sql
--
-- Niche audit (2026-09-07): the industry card a person picks on /register
-- (components/industry-selector.tsx, values from lib/industries.ts) is sent
-- to Supabase Auth as raw_user_meta_data.industry_template_id, but
-- handle_new_auth_user() (last redefined in
-- 025_consolidate_memberships_and_fresh_install.sql) never reads that key -
-- every new company_settings row is created by ensure_company_settings()
-- (003_company_settings_and_documents.sql) with nothing but the column
-- DEFAULTs (business_type='general', asset_label='Equipos', etc), regardless
-- of which industry was selected. This migration closes that gap for
-- signups going forward. It does NOT touch any existing company/company_settings
-- row - see 041_set_progruas_niche.sql for the one, explicit, single-row
-- correction for the real tenant.
--
-- Reuses public.industry_templates (005_industry_templates.sql) as the single
-- source of truth for per-industry labels, instead of duplicating that
-- mapping a third time in SQL (it was already duplicated once, safely, between
-- lib/industries.ts and this table's seed data - see the audit note in
-- 033_rc1_security_hardening.sql:5-7). If the incoming slug doesn't match any
-- active row here (missing, empty, or an unrecognized value), the UPDATE is
-- skipped entirely and company_settings simply keeps its column DEFAULTs -
-- i.e. the exact same "general" behavior as today. No slug allowlist/CHECK
-- is added here on purpose: this table is the allowlist.
--
-- Fully idempotent: safe to run any number of times.

-- Two of the seeded rows drifted from what they should say:
--  - 'machinery' is the same niche as the one real tenant (Progrúas S.A.S.,
--    see 041), so its labels are aligned to match Progrúas' actual terms
--    ("Equipos"/"Novedades") instead of the placeholder "Máquinas"/"Alertas"
--    nobody ever used.
--  - 'veterinary' used "Equipos" as its asset label - literally the same word
--    as machinery - which is what led a vet signup to still feel like a crane
--    company app. Renamed to "Equipo clínico" (clinical equipment: ecógrafos,
--    autoclaves, rayos X - real equipment a vet clinic maintains, not a
--    stand-in for patients/mascotas).
-- Mirrored in lib/industries.ts so the signup card preview matches what the
-- account actually gets.
update public.industry_templates
set asset_label = 'Equipos', incident_label = 'Novedades'
where slug = 'machinery';

update public.industry_templates
set asset_label = 'Equipo clínico'
where slug = 'veterinary';

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_company_id uuid;
  new_app_user_id uuid;
  company_name text;
  company_slug text;
  industry_slug text;
  tpl record;
begin
  company_name := coalesce(new.raw_user_meta_data ->> 'company_name', 'Mi empresa');
  company_slug := public.slugify_company_name(company_name) || '-' || substr(new.id::text, 1, 8);

  insert into public.companies (name, slug)
  values (company_name, company_slug)
  returning id into new_company_id;

  insert into public.users (company_id, auth_user_id, email, full_name, role, is_active)
  values (
    new_company_id,
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    'ADMIN',
    true
  )
  returning id into new_app_user_id;

  insert into public.memberships (company_id, user_id, auth_user_id, role, is_active)
  values (new_company_id, new_app_user_id, new.id, 'ADMIN', true)
  on conflict (company_id, user_id) do update
  set auth_user_id = excluded.auth_user_id,
      role = excluded.role,
      is_active = true,
      updated_at = now();

  -- company_settings for new_company_id was just created (with column
  -- DEFAULTs) by the ensure_company_settings_after_company AFTER INSERT
  -- trigger fired synchronously by the "insert into public.companies" above.
  -- If the selected industry matches a known, active template, override those
  -- defaults with its labels; otherwise leave them untouched (= 'general').
  industry_slug := new.raw_user_meta_data ->> 'industry_template_id';

  if industry_slug is not null and industry_slug <> '' then
    select asset_label, maintenance_label, project_label, incident_label
    into tpl
    from public.industry_templates
    where slug = industry_slug
      and coalesce(is_active, true)
    limit 1;

    if found then
      update public.company_settings
      set business_type = industry_slug,
          asset_label = tpl.asset_label,
          maintenance_label = tpl.maintenance_label,
          project_label = tpl.project_label,
          incident_label = tpl.incident_label
      where company_id = new_company_id;
    end if;
  end if;

  return new;
end;
$$;

NOTIFY pgrst, 'reload schema';

SELECT '040_link_industry_template_to_signup completed' AS result;
