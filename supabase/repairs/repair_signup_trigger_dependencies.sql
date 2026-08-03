-- Repair migration for signup failures caused by partially applied older schemas.
-- Run this in Supabase SQL Editor, then retry signup.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.app_role as enum ('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'OPERARIO');
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
alter type public.audit_action add value if not exists 'INSERT';
alter type public.audit_action add value if not exists 'UPDATE';
alter type public.audit_action add value if not exists 'DELETE';
alter type public.audit_action add value if not exists 'LOGIN';
alter type public.audit_action add value if not exists 'LOGOUT';
alter type public.audit_action add value if not exists 'PERMISSION_DENIED';

alter table public.users add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;
alter table public.users add column if not exists is_active boolean not null default true;
alter table public.users add column if not exists deleted_at timestamptz;

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
    alter table public.users alter column role drop default;
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
    alter table public.users alter column role set default 'OPERARIO'::public.app_role;
  end if;
end $$;

alter table public.notifications add column if not exists event_type text not null default 'SYSTEM';
alter table public.notifications add column if not exists entity_table text;
alter table public.notifications add column if not exists entity_id uuid;
alter table public.notifications add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.notifications add column if not exists updated_by uuid references public.users(id) on delete set null;
alter table public.notifications add column if not exists updated_at timestamptz not null default now();
alter table public.notifications add column if not exists deleted_at timestamptz;

alter table public.audit_logs add column if not exists actor_auth_user_id uuid references auth.users(id) on delete set null;
alter table public.audit_logs add column if not exists metadata jsonb not null default '{}'::jsonb;

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

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists notify_user_created on public.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create trigger notify_user_created
after insert on public.users
for each row execute function public.notify_new_user();

select 'repair_signup_trigger_dependencies completed' as result;
