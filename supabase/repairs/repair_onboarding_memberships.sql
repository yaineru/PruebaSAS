-- Repair onboarding by introducing memberships as the tenant access source of truth.
-- Run in Supabase SQL Editor.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.app_role as enum ('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'OPERARIO');
exception when duplicate_object then null;
end $$;

alter type public.app_role add value if not exists 'SUPER_ADMIN';
alter type public.app_role add value if not exists 'ADMIN';
alter type public.app_role add value if not exists 'SUPERVISOR';
alter type public.app_role add value if not exists 'OPERARIO';

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

create or replace function public.current_app_user_id()
returns uuid language sql stable security definer set search_path = public as $$
  select users.id
  from public.users
  where users.auth_user_id = auth.uid()
    and coalesce(users.is_active, true) = true
    and users.deleted_at is null
  limit 1;
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.memberships
    where memberships.auth_user_id = auth.uid()
      and memberships.role = 'SUPER_ADMIN'
      and memberships.is_active = true
  );
$$;

create or replace function public.has_company_role(target_company_id uuid, allowed_roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists (
    select 1
    from public.memberships
    where memberships.company_id = target_company_id
      and memberships.auth_user_id = auth.uid()
      and memberships.role = any(allowed_roles)
      and memberships.is_active = true
  );
$$;

create or replace function public.is_company_member(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_company_role(target_company_id, array['ADMIN','SUPERVISOR','OPERARIO']::public.app_role[]);
$$;

create or replace function public.can_manage_company(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_company_role(target_company_id, array['ADMIN']::public.app_role[]);
$$;

create or replace function public.can_manage_operations(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_company_role(target_company_id, array['ADMIN','SUPERVISOR']::public.app_role[]);
$$;

create or replace function public.can_register_operations(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_company_role(target_company_id, array['ADMIN','SUPERVISOR','OPERARIO']::public.app_role[]);
$$;

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
  or public.has_company_role(company_id, array['ADMIN']::public.app_role[])
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

select 'repair_onboarding_memberships completed' as result;
