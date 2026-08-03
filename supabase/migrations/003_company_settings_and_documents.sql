-- Multi-industry company settings and document storage hardening.

create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  company_name text not null,
  business_type text not null default 'general',
  asset_label text not null default 'Activos',
  maintenance_label text not null default 'Mantenimientos',
  project_label text not null default 'Proyectos',
  incident_label text not null default 'Novedades',
  primary_color text not null default '#0f766e',
  secondary_color text not null default '#f59e0b',
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_settings_primary_color_hex check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint company_settings_secondary_color_hex check (secondary_color ~ '^#[0-9A-Fa-f]{6}$')
);

insert into public.company_settings (company_id, company_name)
select id, name
from public.companies
on conflict (company_id) do nothing;

alter table public.asset_documents add column if not exists uploaded_by uuid references public.users(id) on delete set null;
alter table public.asset_documents add column if not exists uploaded_at timestamptz;
alter table public.asset_documents add column if not exists version integer not null default 1 check (version > 0);
alter table public.asset_documents add column if not exists related_table text;
alter table public.asset_documents add column if not exists related_id uuid;

alter table public.asset_documents drop constraint if exists asset_documents_file_size_check;
alter table public.asset_documents add constraint asset_documents_file_size_check
  check (file_size is null or file_size between 0 and 20971520);

create index if not exists company_settings_company_id_idx on public.company_settings(company_id);
create index if not exists asset_documents_related_idx on public.asset_documents(company_id, related_table, related_id) where deleted_at is null;

drop trigger if exists company_settings_set_updated_at on public.company_settings;
create trigger company_settings_set_updated_at
before update on public.company_settings
for each row execute function public.set_updated_at();

create or replace function public.ensure_company_settings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.company_settings (company_id, company_name)
  values (new.id, new.name)
  on conflict (company_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ensure_company_settings_after_company on public.companies;
create trigger ensure_company_settings_after_company
after insert on public.companies
for each row execute function public.ensure_company_settings();

alter table public.company_settings enable row level security;

drop policy if exists company_settings_select on public.company_settings;
drop policy if exists company_settings_update on public.company_settings;
drop policy if exists company_settings_insert on public.company_settings;

create policy company_settings_select on public.company_settings
for select using (public.is_company_member(company_id));

create policy company_settings_update on public.company_settings
for update using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));

create policy company_settings_insert on public.company_settings
for insert with check (public.can_manage_company(company_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-files',
  'company-files',
  false,
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  alter publication supabase_realtime add table public.company_settings;
exception when duplicate_object then null;
end $$;

select '003_company_settings_and_documents completed' as result;
