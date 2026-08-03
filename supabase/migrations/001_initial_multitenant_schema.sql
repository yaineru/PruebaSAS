create extension if not exists "pgcrypto";

do $$ begin
  create type public.app_role as enum ('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'OPERARIO');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.company_status as enum ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.asset_status as enum ('AVAILABLE', 'IN_OPERATION', 'MAINTENANCE', 'RETIRED', 'LOST');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.asset_condition as enum ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.maintenance_type as enum ('PREVENTIVE', 'CORRECTIVE', 'INSPECTION', 'EMERGENCY');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.maintenance_status as enum ('PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.incident_priority as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.incident_status as enum ('ABIERTO', 'EN_PROCESO', 'RESUELTO', 'CERRADO');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_type as enum ('PDF', 'IMAGE', 'CERTIFICATE', 'LICENSE', 'MANUAL', 'OTHER');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.notification_status as enum ('UNREAD', 'READ', 'ARCHIVED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.project_status as enum ('PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.assignment_status as enum ('ACTIVE', 'RETURNED', 'TRANSFERRED', 'CANCELLED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.audit_action as enum ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'PERMISSION_DENIED');
exception when duplicate_object then null;
end $$;

alter type public.app_role add value if not exists 'SUPER_ADMIN';
alter type public.app_role add value if not exists 'ADMIN';
alter type public.app_role add value if not exists 'SUPERVISOR';
alter type public.app_role add value if not exists 'OPERARIO';
alter type public.company_status add value if not exists 'ACTIVE';
alter type public.company_status add value if not exists 'SUSPENDED';
alter type public.company_status add value if not exists 'ARCHIVED';
alter type public.asset_status add value if not exists 'AVAILABLE';
alter type public.asset_status add value if not exists 'IN_OPERATION';
alter type public.asset_status add value if not exists 'MAINTENANCE';
alter type public.asset_status add value if not exists 'RETIRED';
alter type public.asset_status add value if not exists 'LOST';
alter type public.asset_condition add value if not exists 'EXCELLENT';
alter type public.asset_condition add value if not exists 'GOOD';
alter type public.asset_condition add value if not exists 'FAIR';
alter type public.asset_condition add value if not exists 'POOR';
alter type public.asset_condition add value if not exists 'CRITICAL';
alter type public.maintenance_type add value if not exists 'PREVENTIVE';
alter type public.maintenance_type add value if not exists 'CORRECTIVE';
alter type public.maintenance_type add value if not exists 'INSPECTION';
alter type public.maintenance_type add value if not exists 'EMERGENCY';
alter type public.maintenance_status add value if not exists 'PENDING';
alter type public.maintenance_status add value if not exists 'SCHEDULED';
alter type public.maintenance_status add value if not exists 'IN_PROGRESS';
alter type public.maintenance_status add value if not exists 'COMPLETED';
alter type public.maintenance_status add value if not exists 'CANCELLED';
alter type public.maintenance_status add value if not exists 'OVERDUE';
alter type public.incident_priority add value if not exists 'LOW';
alter type public.incident_priority add value if not exists 'MEDIUM';
alter type public.incident_priority add value if not exists 'HIGH';
alter type public.incident_priority add value if not exists 'CRITICAL';
alter type public.incident_status add value if not exists 'ABIERTO';
alter type public.incident_status add value if not exists 'EN_PROCESO';
alter type public.incident_status add value if not exists 'RESUELTO';
alter type public.incident_status add value if not exists 'CERRADO';
alter type public.document_type add value if not exists 'PDF';
alter type public.document_type add value if not exists 'IMAGE';
alter type public.document_type add value if not exists 'CERTIFICATE';
alter type public.document_type add value if not exists 'LICENSE';
alter type public.document_type add value if not exists 'MANUAL';
alter type public.document_type add value if not exists 'OTHER';
alter type public.notification_status add value if not exists 'UNREAD';
alter type public.notification_status add value if not exists 'READ';
alter type public.notification_status add value if not exists 'ARCHIVED';
alter type public.project_status add value if not exists 'PLANNED';
alter type public.project_status add value if not exists 'ACTIVE';
alter type public.project_status add value if not exists 'PAUSED';
alter type public.project_status add value if not exists 'COMPLETED';
alter type public.project_status add value if not exists 'CANCELLED';
alter type public.assignment_status add value if not exists 'ACTIVE';
alter type public.assignment_status add value if not exists 'RETURNED';
alter type public.assignment_status add value if not exists 'TRANSFERRED';
alter type public.assignment_status add value if not exists 'CANCELLED';
alter type public.audit_action add value if not exists 'INSERT';
alter type public.audit_action add value if not exists 'UPDATE';
alter type public.audit_action add value if not exists 'DELETE';
alter type public.audit_action add value if not exists 'LOGIN';
alter type public.audit_action add value if not exists 'LOGOUT';
alter type public.audit_action add value if not exists 'PERMISSION_DENIED';

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tax_id text,
  industry text,
  phone text,
  email text,
  website text,
  address text,
  timezone text not null default 'America/Bogota',
  status public.company_status not null default 'ACTIVE',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint companies_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  avatar_url text,
  phone text,
  job_title text,
  department text,
  role public.app_role not null default 'OPERARIO',
  is_active boolean not null default true,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, email),
  constraint users_email_format check (position('@' in email) > 1)
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  code text not null,
  plate text,
  serial_number text,
  brand text,
  model text,
  year smallint check (year is null or year between 1900 and 2100),
  provider text,
  purchase_date date,
  hour_meter numeric(14,2) not null default 0 check (hour_meter >= 0),
  last_maintenance_date date,
  next_maintenance_date date,
  insurance_expiration date,
  technical_certificate_expiration date,
  description text,
  category text,
  location text,
  acquisition_cost numeric(14,2) not null default 0 check (acquisition_cost >= 0),
  current_value numeric(14,2) check (current_value is null or current_value >= 0),
  status public.asset_status not null default 'AVAILABLE',
  condition public.asset_condition not null default 'GOOD',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, code),
  unique (company_id, plate),
  unique (company_id, serial_number)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  code text,
  description text,
  location text,
  owner_id uuid references public.users(id) on delete set null,
  start_date date,
  due_date date,
  completed_at timestamptz,
  budget numeric(14,2) not null default 0 check (budget >= 0),
  progress smallint not null default 0 check (progress between 0 and 100),
  status public.project_status not null default 'ACTIVE',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, code)
);

create table if not exists public.asset_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  assigned_to uuid references public.users(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  assigned_at timestamptz not null default now(),
  returned_at timestamptz,
  location text,
  notes text,
  status public.assignment_status not null default 'ACTIVE',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint asset_assignments_return_after_assign check (returned_at is null or returned_at >= assigned_at)
);

create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  maintenance_date date not null default current_date,
  type public.maintenance_type not null default 'PREVENTIVE',
  description text,
  cost numeric(14,2) not null default 0 check (cost >= 0),
  responsible_id uuid references public.users(id) on delete set null,
  responsible_name text,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  due_date date,
  status public.maintenance_status not null default 'PENDING',
  findings text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.maintenance_alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete cascade,
  maintenance_record_id uuid references public.maintenance_records(id) on delete set null,
  title text not null,
  message text,
  priority public.incident_priority not null default 'MEDIUM',
  trigger_at timestamptz,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  status text not null default 'OPEN',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.asset_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  maintenance_record_id uuid references public.maintenance_records(id) on delete set null,
  title text not null,
  type public.document_type not null default 'OTHER',
  category text,
  file_name text,
  file_path text,
  url text,
  mime_type text,
  file_size bigint check (file_size is null or file_size between 0 and 10485760),
  expires_at date,
  status text not null default 'ACTIVE',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint asset_documents_mime_allowed check (
    mime_type is null or mime_type in (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    )
  )
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  reported_by uuid references public.users(id) on delete set null,
  assigned_to uuid references public.users(id) on delete set null,
  title text not null,
  description text,
  priority public.incident_priority not null default 'MEDIUM',
  status public.incident_status not null default 'ABIERTO',
  location text,
  reported_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint incidents_resolved_after_report check (resolved_at is null or resolved_at >= reported_at)
);

create table if not exists public.incident_comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.incident_media (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  mime_type text not null,
  file_size bigint not null check (file_size between 1 and 52428800),
  media_type text not null check (media_type in ('PHOTO', 'VIDEO')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint incident_media_mime_allowed check (
    mime_type in ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm')
  )
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  title text not null,
  message text,
  event_type text not null,
  status public.notification_status not null default 'UNREAD',
  read_at timestamptz,
  entity_table text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.project_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  event_title text not null,
  event_description text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  action public.audit_action not null,
  table_name text not null,
  record_id uuid,
  ip_address inet,
  user_agent text,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Compatibility for databases where an earlier partial schema was executed.
alter table public.users add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;
alter table public.users add column if not exists is_active boolean not null default true;
alter table public.users add column if not exists avatar_url text;
alter table public.users add column if not exists phone text;
alter table public.users add column if not exists job_title text;
alter table public.users add column if not exists department text;
alter table public.users add column if not exists last_seen_at timestamptz;
alter table public.users add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.users add column if not exists updated_by uuid references public.users(id) on delete set null;
alter table public.users add column if not exists updated_at timestamptz not null default now();
alter table public.users add column if not exists deleted_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'role'
      and udt_name <> 'app_role'
  ) then
    alter table public.users
      alter column role drop default;

    alter table public.users
      alter column role type public.app_role
      using case lower(role::text)
        when 'super_admin' then 'SUPER_ADMIN'::public.app_role
        when 'owner' then 'ADMIN'::public.app_role
        when 'admin' then 'ADMIN'::public.app_role
        when 'manager' then 'SUPERVISOR'::public.app_role
        when 'supervisor' then 'SUPERVISOR'::public.app_role
        when 'technician' then 'OPERARIO'::public.app_role
        when 'operario' then 'OPERARIO'::public.app_role
        when 'member' then 'OPERARIO'::public.app_role
        when 'viewer' then 'OPERARIO'::public.app_role
        else 'OPERARIO'::public.app_role
      end;

    alter table public.users
      alter column role set default 'OPERARIO'::public.app_role;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'user_id'
  ) then
    update public.users
    set auth_user_id = user_id
    where auth_user_id is null;
  end if;
end $$;

alter table public.assets add column if not exists plate text;
alter table public.assets add column if not exists brand text;
alter table public.assets add column if not exists year smallint;
alter table public.assets add column if not exists provider text;
alter table public.assets add column if not exists purchase_date date;
alter table public.assets add column if not exists hour_meter numeric(14,2) not null default 0;
alter table public.assets add column if not exists last_maintenance_date date;
alter table public.assets add column if not exists next_maintenance_date date;
alter table public.assets add column if not exists insurance_expiration date;
alter table public.assets add column if not exists technical_certificate_expiration date;
alter table public.assets add column if not exists condition public.asset_condition;
alter table public.assets add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.assets add column if not exists updated_by uuid references public.users(id) on delete set null;
alter table public.assets add column if not exists deleted_at timestamptz;

alter table public.maintenance_records add column if not exists maintenance_date date not null default current_date;
alter table public.maintenance_records add column if not exists type public.maintenance_type;
alter table public.maintenance_records add column if not exists responsible_id uuid references public.users(id) on delete set null;
alter table public.maintenance_records add column if not exists responsible_name text;
alter table public.maintenance_records add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.maintenance_records add column if not exists updated_by uuid references public.users(id) on delete set null;
alter table public.maintenance_records add column if not exists deleted_at timestamptz;

alter table public.projects add column if not exists location text;
alter table public.projects add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.projects add column if not exists updated_by uuid references public.users(id) on delete set null;
alter table public.projects add column if not exists deleted_at timestamptz;

alter table public.asset_documents add column if not exists type public.document_type;
alter table public.asset_documents add column if not exists maintenance_record_id uuid references public.maintenance_records(id) on delete set null;
alter table public.asset_documents add column if not exists expires_at date;
alter table public.asset_documents add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.asset_documents add column if not exists updated_by uuid references public.users(id) on delete set null;
alter table public.asset_documents add column if not exists deleted_at timestamptz;

alter table public.incidents add column if not exists priority public.incident_priority;
alter table public.incidents add column if not exists location text;
alter table public.incidents add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.incidents add column if not exists updated_by uuid references public.users(id) on delete set null;
alter table public.incidents add column if not exists deleted_at timestamptz;

alter table public.notifications add column if not exists event_type text not null default 'SYSTEM';
alter table public.notifications add column if not exists entity_table text;
alter table public.notifications add column if not exists entity_id uuid;
alter table public.notifications add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.notifications add column if not exists updated_by uuid references public.users(id) on delete set null;
alter table public.notifications add column if not exists updated_at timestamptz not null default now();
alter table public.notifications add column if not exists deleted_at timestamptz;

create index if not exists companies_status_idx on public.companies(status) where deleted_at is null;
create index if not exists users_company_id_idx on public.users(company_id) where deleted_at is null;
create index if not exists users_auth_user_id_idx on public.users(auth_user_id) where deleted_at is null;
create index if not exists users_role_idx on public.users(company_id, role) where deleted_at is null;
create index if not exists assets_company_id_idx on public.assets(company_id) where deleted_at is null;
create index if not exists assets_status_idx on public.assets(company_id, status) where deleted_at is null;
create index if not exists assets_next_maintenance_idx on public.assets(company_id, next_maintenance_date) where deleted_at is null;
create index if not exists assets_document_expiration_idx on public.assets(company_id, insurance_expiration, technical_certificate_expiration) where deleted_at is null;
create index if not exists maintenance_records_due_date_idx on public.maintenance_records(company_id, due_date, status) where deleted_at is null;
create index if not exists maintenance_records_asset_idx on public.maintenance_records(company_id, asset_id, maintenance_date desc) where deleted_at is null;
create index if not exists maintenance_alerts_company_idx on public.maintenance_alerts(company_id, status, trigger_at) where deleted_at is null;
create index if not exists projects_company_status_idx on public.projects(company_id, status) where deleted_at is null;
create index if not exists asset_assignments_company_asset_idx on public.asset_assignments(company_id, asset_id, status) where deleted_at is null;
create index if not exists asset_documents_company_expiry_idx on public.asset_documents(company_id, expires_at) where deleted_at is null;
create index if not exists incidents_company_status_idx on public.incidents(company_id, status, priority) where deleted_at is null;
create index if not exists incident_comments_incident_idx on public.incident_comments(company_id, incident_id) where deleted_at is null;
create index if not exists incident_media_incident_idx on public.incident_media(company_id, incident_id);
create index if not exists notifications_user_status_idx on public.notifications(company_id, user_id, status) where deleted_at is null;
create index if not exists project_history_project_idx on public.project_history(company_id, project_id, created_at desc);
create index if not exists audit_logs_company_created_idx on public.audit_logs(company_id, created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(company_id, actor_id, created_at desc);

create or replace function public.slugify_company_name(value text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(value, 'empresa')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.current_app_user_id()
returns uuid language sql stable security definer set search_path = public as $$
  select users.id
  from public.users
  where users.auth_user_id = auth.uid()
    and users.is_active = true
    and users.deleted_at is null
  limit 1;
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where auth_user_id = auth.uid()
      and role = 'SUPER_ADMIN'
      and is_active = true
      and deleted_at is null
  );
$$;

create or replace function public.has_company_role(target_company_id uuid, allowed_roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists (
    select 1 from public.users
    where company_id = target_company_id
      and auth_user_id = auth.uid()
      and role = any(allowed_roles)
      and is_active = true
      and deleted_at is null
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

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_company_id uuid;
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
  );

  return new;
end;
$$;

create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  changed_company_id uuid;
  changed_record_id uuid;
  actor_user_id uuid;
begin
  if tg_op = 'DELETE' then
    changed_company_id := old.company_id;
    changed_record_id := old.id;
  else
    changed_company_id := new.company_id;
    changed_record_id := new.id;
  end if;

  actor_user_id := public.current_app_user_id();

  insert into public.audit_logs (
    company_id, actor_id, actor_auth_user_id, action, table_name, record_id, old_values, new_values
  )
  values (
    changed_company_id,
    actor_user_id,
    auth.uid(),
    tg_op::public.audit_action,
    tg_table_name,
    changed_record_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

create or replace function public.create_company_notification(
  target_company_id uuid,
  target_user_id uuid,
  notification_title text,
  notification_message text,
  notification_event_type text,
  notification_entity_table text,
  notification_entity_id uuid
)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (
    company_id,
    user_id,
    title,
    message,
    event_type,
    entity_table,
    entity_id,
    created_by
  )
  values (
    target_company_id,
    target_user_id,
    notification_title,
    notification_message,
    notification_event_type,
    notification_entity_table,
    notification_entity_id,
    public.current_app_user_id()
  );
end;
$$;

create or replace function public.notify_new_incident()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.create_company_notification(
    new.company_id,
    null,
    'Nueva novedad',
    new.title,
    'INCIDENT_CREATED',
    'incidents',
    new.id
  );
  return new;
end;
$$;

create or replace function public.notify_new_maintenance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.due_date is not null then
    perform public.create_company_notification(
      new.company_id,
      null,
      'Mantenimiento programado',
      new.title,
      'MAINTENANCE_CREATED',
      'maintenance_records',
      new.id
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_document_expiration()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.expires_at is not null and new.expires_at <= current_date + interval '30 days' then
    perform public.create_company_notification(
      new.company_id,
      null,
      'Documento próximo a vencer',
      new.title,
      'DOCUMENT_EXPIRING',
      'asset_documents',
      new.id
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.create_company_notification(
    new.company_id,
    null,
    'Nuevo usuario',
    new.full_name,
    'USER_CREATED',
    'users',
    new.id
  );
  return new;
end;
$$;

create or replace function public.notify_new_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.create_company_notification(
    new.company_id,
    new.assigned_to,
    'Nueva asignación',
    coalesce(new.notes, 'Se registró una nueva asignación de activo.'),
    'ASSET_ASSIGNED',
    'asset_assignments',
    new.id
  );
  return new;
end;
$$;

create or replace function public.generate_document_expiration_notifications()
returns integer language plpgsql security definer set search_path = public as $$
declare
  inserted_count integer;
begin
  insert into public.notifications (
    company_id,
    title,
    message,
    event_type,
    entity_table,
    entity_id
  )
  select
    documents.company_id,
    'Documento próximo a vencer',
    documents.title,
    'DOCUMENT_EXPIRING',
    'asset_documents',
    documents.id
  from public.asset_documents documents
  where documents.deleted_at is null
    and documents.expires_at between current_date and current_date + interval '30 days'
    and not exists (
      select 1
      from public.notifications existing
      where existing.company_id = documents.company_id
        and existing.entity_table = 'asset_documents'
        and existing.entity_id = documents.id
        and existing.event_type = 'DOCUMENT_EXPIRING'
        and existing.created_at > now() - interval '1 day'
    );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists users_set_updated_at on public.users;
drop trigger if exists companies_set_updated_at on public.companies;
drop trigger if exists assets_set_updated_at on public.assets;
drop trigger if exists maintenance_records_set_updated_at on public.maintenance_records;
drop trigger if exists maintenance_alerts_set_updated_at on public.maintenance_alerts;
drop trigger if exists projects_set_updated_at on public.projects;
drop trigger if exists asset_assignments_set_updated_at on public.asset_assignments;
drop trigger if exists asset_documents_set_updated_at on public.asset_documents;
drop trigger if exists incidents_set_updated_at on public.incidents;
drop trigger if exists incident_comments_set_updated_at on public.incident_comments;
drop trigger if exists notifications_set_updated_at on public.notifications;
drop trigger if exists audit_users on public.users;
drop trigger if exists audit_assets on public.assets;
drop trigger if exists audit_maintenance_records on public.maintenance_records;
drop trigger if exists audit_maintenance_alerts on public.maintenance_alerts;
drop trigger if exists audit_projects on public.projects;
drop trigger if exists audit_asset_assignments on public.asset_assignments;
drop trigger if exists audit_asset_documents on public.asset_documents;
drop trigger if exists audit_incidents on public.incidents;
drop trigger if exists audit_notifications on public.notifications;
drop trigger if exists notify_incident_created on public.incidents;
drop trigger if exists notify_maintenance_created on public.maintenance_records;
drop trigger if exists notify_document_created on public.asset_documents;
drop trigger if exists notify_user_created on public.users;
drop trigger if exists notify_assignment_created on public.asset_assignments;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

create trigger users_set_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger companies_set_updated_at before update on public.companies for each row execute function public.set_updated_at();
create trigger assets_set_updated_at before update on public.assets for each row execute function public.set_updated_at();
create trigger maintenance_records_set_updated_at before update on public.maintenance_records for each row execute function public.set_updated_at();
create trigger maintenance_alerts_set_updated_at before update on public.maintenance_alerts for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger asset_assignments_set_updated_at before update on public.asset_assignments for each row execute function public.set_updated_at();
create trigger asset_documents_set_updated_at before update on public.asset_documents for each row execute function public.set_updated_at();
create trigger incidents_set_updated_at before update on public.incidents for each row execute function public.set_updated_at();
create trigger incident_comments_set_updated_at before update on public.incident_comments for each row execute function public.set_updated_at();
create trigger notifications_set_updated_at before update on public.notifications for each row execute function public.set_updated_at();

create trigger audit_users after insert or update or delete on public.users for each row execute function public.write_audit_log();
create trigger audit_assets after insert or update or delete on public.assets for each row execute function public.write_audit_log();
create trigger audit_maintenance_records after insert or update or delete on public.maintenance_records for each row execute function public.write_audit_log();
create trigger audit_maintenance_alerts after insert or update or delete on public.maintenance_alerts for each row execute function public.write_audit_log();
create trigger audit_projects after insert or update or delete on public.projects for each row execute function public.write_audit_log();
create trigger audit_asset_assignments after insert or update or delete on public.asset_assignments for each row execute function public.write_audit_log();
create trigger audit_asset_documents after insert or update or delete on public.asset_documents for each row execute function public.write_audit_log();
create trigger audit_incidents after insert or update or delete on public.incidents for each row execute function public.write_audit_log();
create trigger audit_notifications after insert or update or delete on public.notifications for each row execute function public.write_audit_log();

create trigger notify_incident_created after insert on public.incidents for each row execute function public.notify_new_incident();
create trigger notify_maintenance_created after insert on public.maintenance_records for each row execute function public.notify_new_maintenance();
create trigger notify_document_created after insert or update of expires_at on public.asset_documents for each row execute function public.notify_document_expiration();
create trigger notify_user_created after insert on public.users for each row execute function public.notify_new_user();
create trigger notify_assignment_created after insert on public.asset_assignments for each row execute function public.notify_new_assignment();

alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.assets enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.maintenance_alerts enable row level security;
alter table public.projects enable row level security;
alter table public.asset_assignments enable row level security;
alter table public.asset_documents enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_comments enable row level security;
alter table public.incident_media enable row level security;
alter table public.notifications enable row level security;
alter table public.project_history enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists companies_select on public.companies;
drop policy if exists companies_update on public.companies;
drop policy if exists users_select on public.users;
drop policy if exists users_insert on public.users;
drop policy if exists users_update on public.users;
drop policy if exists users_delete on public.users;
drop policy if exists assets_select on public.assets;
drop policy if exists assets_insert on public.assets;
drop policy if exists assets_update on public.assets;
drop policy if exists assets_delete on public.assets;
drop policy if exists maintenance_select on public.maintenance_records;
drop policy if exists maintenance_insert on public.maintenance_records;
drop policy if exists maintenance_update on public.maintenance_records;
drop policy if exists maintenance_delete on public.maintenance_records;
drop policy if exists alerts_select on public.maintenance_alerts;
drop policy if exists alerts_insert on public.maintenance_alerts;
drop policy if exists alerts_update on public.maintenance_alerts;
drop policy if exists alerts_delete on public.maintenance_alerts;
drop policy if exists projects_select on public.projects;
drop policy if exists projects_insert on public.projects;
drop policy if exists projects_update on public.projects;
drop policy if exists projects_delete on public.projects;
drop policy if exists assignments_select on public.asset_assignments;
drop policy if exists assignments_insert on public.asset_assignments;
drop policy if exists assignments_update on public.asset_assignments;
drop policy if exists assignments_delete on public.asset_assignments;
drop policy if exists documents_select on public.asset_documents;
drop policy if exists documents_insert on public.asset_documents;
drop policy if exists documents_update on public.asset_documents;
drop policy if exists documents_delete on public.asset_documents;
drop policy if exists incidents_select on public.incidents;
drop policy if exists incidents_insert on public.incidents;
drop policy if exists incidents_update on public.incidents;
drop policy if exists incidents_delete on public.incidents;
drop policy if exists incident_comments_select on public.incident_comments;
drop policy if exists incident_comments_insert on public.incident_comments;
drop policy if exists incident_comments_update on public.incident_comments;
drop policy if exists incident_media_select on public.incident_media;
drop policy if exists incident_media_insert on public.incident_media;
drop policy if exists notifications_select on public.notifications;
drop policy if exists notifications_insert on public.notifications;
drop policy if exists notifications_update on public.notifications;
drop policy if exists notifications_delete on public.notifications;
drop policy if exists project_history_select on public.project_history;
drop policy if exists project_history_insert on public.project_history;
drop policy if exists audit_select on public.audit_logs;
drop policy if exists audit_insert on public.audit_logs;

create policy companies_select on public.companies for select using (public.is_super_admin() or public.is_company_member(id));
create policy companies_update on public.companies for update using (public.can_manage_company(id)) with check (public.can_manage_company(id));

create policy users_select on public.users for select using (public.is_super_admin() or public.is_company_member(company_id));
create policy users_insert on public.users for insert with check (public.can_manage_company(company_id));
create policy users_update on public.users for update using (public.can_manage_company(company_id)) with check (public.can_manage_company(company_id));
create policy users_delete on public.users for delete using (public.can_manage_company(company_id));

create policy assets_select on public.assets for select using (public.is_company_member(company_id));
create policy assets_insert on public.assets for insert with check (public.can_manage_operations(company_id));
create policy assets_update on public.assets for update using (public.can_manage_operations(company_id)) with check (public.can_manage_operations(company_id));
create policy assets_delete on public.assets for delete using (public.can_manage_company(company_id));

create policy maintenance_select on public.maintenance_records for select using (public.is_company_member(company_id));
create policy maintenance_insert on public.maintenance_records for insert with check (public.can_register_operations(company_id));
create policy maintenance_update on public.maintenance_records for update using (public.can_manage_operations(company_id)) with check (public.can_manage_operations(company_id));
create policy maintenance_delete on public.maintenance_records for delete using (public.can_manage_company(company_id));

create policy alerts_select on public.maintenance_alerts for select using (public.is_company_member(company_id));
create policy alerts_insert on public.maintenance_alerts for insert with check (public.can_manage_operations(company_id));
create policy alerts_update on public.maintenance_alerts for update using (public.can_manage_operations(company_id)) with check (public.can_manage_operations(company_id));
create policy alerts_delete on public.maintenance_alerts for delete using (public.can_manage_company(company_id));

create policy projects_select on public.projects for select using (public.is_company_member(company_id));
create policy projects_insert on public.projects for insert with check (public.can_manage_operations(company_id));
create policy projects_update on public.projects for update using (public.can_manage_operations(company_id)) with check (public.can_manage_operations(company_id));
create policy projects_delete on public.projects for delete using (public.can_manage_company(company_id));

create policy assignments_select on public.asset_assignments for select using (public.is_company_member(company_id));
create policy assignments_insert on public.asset_assignments for insert with check (public.can_manage_operations(company_id));
create policy assignments_update on public.asset_assignments for update using (public.can_manage_operations(company_id)) with check (public.can_manage_operations(company_id));
create policy assignments_delete on public.asset_assignments for delete using (public.can_manage_company(company_id));

create policy documents_select on public.asset_documents for select using (public.is_company_member(company_id));
create policy documents_insert on public.asset_documents for insert with check (public.can_manage_operations(company_id));
create policy documents_update on public.asset_documents for update using (public.can_manage_operations(company_id)) with check (public.can_manage_operations(company_id));
create policy documents_delete on public.asset_documents for delete using (public.can_manage_company(company_id));

create policy incidents_select on public.incidents for select using (public.is_company_member(company_id));
create policy incidents_insert on public.incidents for insert with check (public.can_register_operations(company_id));
create policy incidents_update on public.incidents for update using (public.can_manage_operations(company_id)) with check (public.can_manage_operations(company_id));
create policy incidents_delete on public.incidents for delete using (public.can_manage_company(company_id));

create policy incident_comments_select on public.incident_comments for select using (public.is_company_member(company_id));
create policy incident_comments_insert on public.incident_comments for insert with check (public.can_register_operations(company_id));
create policy incident_comments_update on public.incident_comments for update using (public.can_manage_operations(company_id)) with check (public.can_manage_operations(company_id));
create policy incident_media_select on public.incident_media for select using (public.is_company_member(company_id));
create policy incident_media_insert on public.incident_media for insert with check (public.can_register_operations(company_id));

create policy notifications_select on public.notifications for select using (public.is_company_member(company_id));
create policy notifications_insert on public.notifications for insert with check (public.can_manage_operations(company_id));
create policy notifications_update on public.notifications for update using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy notifications_delete on public.notifications for delete using (public.can_manage_company(company_id));

create policy project_history_select on public.project_history for select using (public.is_company_member(company_id));
create policy project_history_insert on public.project_history for insert with check (public.can_manage_operations(company_id));

create policy audit_select on public.audit_logs for select using (public.is_super_admin() or public.can_manage_company(company_id));
create policy audit_insert on public.audit_logs for insert with check (public.is_company_member(company_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-files',
  'company-files',
  false,
  52428800,
  array['application/pdf','image/jpeg','image/png','image/webp','video/mp4','video/webm']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists company_files_read on storage.objects;
drop policy if exists company_files_insert on storage.objects;
drop policy if exists company_files_update on storage.objects;
drop policy if exists company_files_delete on storage.objects;

create policy company_files_read on storage.objects for select
using (
  bucket_id = 'company-files'
  and public.is_company_member((storage.foldername(name))[1]::uuid)
);

create policy company_files_insert on storage.objects for insert
with check (
  bucket_id = 'company-files'
  and public.can_register_operations((storage.foldername(name))[1]::uuid)
);

create policy company_files_update on storage.objects for update
using (
  bucket_id = 'company-files'
  and public.can_manage_operations((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'company-files'
  and public.can_manage_operations((storage.foldername(name))[1]::uuid)
);

create policy company_files_delete on storage.objects for delete
using (
  bucket_id = 'company-files'
  and public.can_manage_company((storage.foldername(name))[1]::uuid)
);

alter table public.assets replica identity full;
alter table public.maintenance_records replica identity full;
alter table public.maintenance_alerts replica identity full;
alter table public.projects replica identity full;
alter table public.asset_assignments replica identity full;
alter table public.asset_documents replica identity full;
alter table public.incidents replica identity full;
alter table public.incident_comments replica identity full;
alter table public.incident_media replica identity full;
alter table public.notifications replica identity full;
alter table public.project_history replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.assets;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.maintenance_records;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.maintenance_alerts;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.projects;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.asset_assignments;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.asset_documents;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.incidents;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.incident_comments;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.incident_media;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.project_history;
exception when duplicate_object then null;
end $$;
