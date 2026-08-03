-- 025_consolidate_memberships_and_fresh_install.sql
--
-- RC1 audit (2026-07-04): a fresh install that only runs the numbered files in
-- supabase/migrations/ (the documented install path) is currently broken in two
-- independent ways that were only discovered because the *live* database has
-- drifted ahead of the tracked migration history via two untracked one-off files
-- meant to be "run manually in the Supabase SQL editor":
-- supabase/repairs/repair_onboarding_memberships.sql and
-- repair_signup_trigger_dependencies.sql. Neither was ever folded into a numbered
-- migration, so they never ran (and never will) on a brand new client install.
--
-- 1) public.memberships does not exist in any numbered migration, yet
--    006_email_webhooks_analytics.sql's RLS policies for email_subscriptions,
--    analytics_events and analytics_metrics reference "memberships m" directly,
--    and lib/tenant.ts / lib/actions/tenant-records.ts query it as their primary
--    tenant-resolution path (falling back to public.users only if the query
--    errors). A fresh install fails inside 006 itself with
--    "relation \"memberships\" does not exist".
-- 2) handle_new_auth_user() as tracked in 001_initial_multitenant_schema.sql only
--    inserts into public.users, not public.memberships - so even after creating
--    the table, brand new signups would never get a membership row.
--
-- This migration folds both repair files into the tracked history (deduplicated
-- against what 001 already defines correctly - is_super_admin/has_company_role/
-- is_company_member/can_manage_company/can_register_operations in 001 already use
-- public.users.auth_user_id correctly and are left untouched here). On the
-- already-live database every statement below is a safe no-op (table/columns/
-- functions/policies already exist in this exact shape); on a fresh install it
-- completes the picture so 001..025 alone is sufficient.
--
-- Fully idempotent: safe to run any number of times, on either database state.

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'OPERARIO',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id),
  unique (company_id, auth_user_id)
);

create index if not exists memberships_company_id_idx on public.memberships(company_id);
create index if not exists memberships_auth_user_id_idx on public.memberships(auth_user_id);
create index if not exists memberships_user_id_idx on public.memberships(user_id);

alter table public.memberships enable row level security;

-- Backfill: one membership row per existing active public.users row that isn't
-- represented yet (covers every account created before this migration existed).
insert into public.memberships (company_id, user_id, auth_user_id, role, is_active)
select users.company_id, users.id, users.auth_user_id, users.role, coalesce(users.is_active, true)
from public.users users
where users.auth_user_id is not null
  and users.company_id is not null
on conflict (company_id, user_id) do update
set auth_user_id = excluded.auth_user_id,
    role = excluded.role,
    is_active = excluded.is_active,
    updated_at = now();

-- handle_new_auth_user() must also populate memberships now, or new signups on a
-- fresh install (or on the live DB, for any signup since memberships was
-- introduced out-of-band) would create a public.users row with no matching
-- membership, breaking lib/tenant.ts's primary lookup path.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_company_id uuid;
  new_app_user_id uuid;
  company_name text;
  company_slug text;
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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

drop policy if exists memberships_select on public.memberships;
drop policy if exists memberships_insert on public.memberships;
drop policy if exists memberships_update on public.memberships;
drop policy if exists memberships_delete on public.memberships;

create policy memberships_select
on public.memberships for select
using (
  auth_user_id = auth.uid()
  or public.can_manage_company(company_id)
);

create policy memberships_insert
on public.memberships for insert
with check (public.can_manage_company(company_id));

create policy memberships_update
on public.memberships for update
using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));

create policy memberships_delete
on public.memberships for delete
using (public.can_manage_company(company_id));

-- 006's email_subscriptions/analytics_events/analytics_metrics SELECT policies
-- (as originally written) compared memberships.user_id = auth.uid() directly -
-- same bug class as 018/019/020/021, just missed because it goes through
-- memberships instead of public.users directly. 018_fix_email_subscriptions_
-- and_analytics_rls.sql (which runs on every install right after 006, long
-- before this file) already replaced those policies by name with the correct
-- is_company_member()/can_manage_company() helpers - those helpers query
-- public.users directly (see 001), not memberships, so this is safe regardless
-- of whether memberships exists yet at that point in the sequence. No further
-- action needed here; noted for the audit trail.

NOTIFY pgrst, 'reload schema';

SELECT '025_consolidate_memberships_and_fresh_install completed' AS result;
