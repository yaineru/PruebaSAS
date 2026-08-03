-- Commercial notification events for machinery, projects and expirations.
-- Safe to run more than once in Supabase SQL Editor.

create or replace function public.notify_new_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.create_company_notification(
    new.company_id,
    null,
    'Nueva obra',
    new.name,
    'PROJECT_CREATED',
    'projects',
    new.id
  );
  return new;
end;
$$;

create or replace function public.notify_new_asset()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.create_company_notification(
    new.company_id,
    null,
    'Nueva maquina',
    new.name,
    'ASSET_CREATED',
    'assets',
    new.id
  );
  return new;
end;
$$;

create or replace function public.generate_operational_expiration_notifications()
returns integer language plpgsql security definer set search_path = public as $$
declare
  inserted_count integer;
  last_count integer;
begin
  insert into public.notifications (company_id, title, message, event_type, entity_table, entity_id)
  select company_id, 'Poliza proxima a vencer', name, 'INSURANCE_EXPIRING', 'assets', id
  from public.assets
  where deleted_at is null
    and insurance_expiration between current_date and current_date + interval '30 days'
    and not exists (
      select 1 from public.notifications existing
      where existing.company_id = assets.company_id
        and existing.entity_table = 'assets'
        and existing.entity_id = assets.id
        and existing.event_type = 'INSURANCE_EXPIRING'
        and existing.created_at > now() - interval '1 day'
    );

  get diagnostics inserted_count = row_count;

  insert into public.notifications (company_id, title, message, event_type, entity_table, entity_id)
  select company_id, 'Certificado tecnico proximo a vencer', name, 'TECHNICAL_CERTIFICATE_EXPIRING', 'assets', id
  from public.assets
  where deleted_at is null
    and technical_certificate_expiration between current_date and current_date + interval '30 days'
    and not exists (
      select 1 from public.notifications existing
      where existing.company_id = assets.company_id
        and existing.entity_table = 'assets'
        and existing.entity_id = assets.id
        and existing.event_type = 'TECHNICAL_CERTIFICATE_EXPIRING'
        and existing.created_at > now() - interval '1 day'
    );

  get diagnostics last_count = row_count;
  inserted_count := inserted_count + last_count;

  insert into public.notifications (company_id, title, message, event_type, entity_table, entity_id)
  select company_id, 'Mantenimiento proximo', name, 'ASSET_MAINTENANCE_DUE', 'assets', id
  from public.assets
  where deleted_at is null
    and (next_maintenance_date - current_date) in (1, 3, 7, 15, 30)
    and not exists (
      select 1 from public.notifications existing
      where existing.company_id = assets.company_id
        and existing.entity_table = 'assets'
        and existing.entity_id = assets.id
        and existing.event_type = 'ASSET_MAINTENANCE_DUE'
        and existing.created_at > now() - interval '1 day'
    );

  get diagnostics last_count = row_count;
  inserted_count := inserted_count + last_count;

  insert into public.notifications (company_id, title, message, event_type, entity_table, entity_id)
  select company_id, 'Documento vencido', title, 'DOCUMENT_EXPIRED', 'asset_documents', id
  from public.asset_documents
  where deleted_at is null
    and expires_at < current_date
    and not exists (
      select 1 from public.notifications existing
      where existing.company_id = asset_documents.company_id
        and existing.entity_table = 'asset_documents'
        and existing.entity_id = asset_documents.id
        and existing.event_type = 'DOCUMENT_EXPIRED'
        and existing.created_at > now() - interval '1 day'
    );

  get diagnostics last_count = row_count;
  inserted_count := inserted_count + last_count;

  insert into public.notifications (company_id, title, message, event_type, entity_table, entity_id)
  select company_id, 'Documento por vencer', title, 'DOCUMENT_EXPIRING', 'asset_documents', id
  from public.asset_documents
  where deleted_at is null
    and (expires_at - current_date) in (1, 3, 7, 15, 30)
    and not exists (
      select 1 from public.notifications existing
      where existing.company_id = asset_documents.company_id
        and existing.entity_table = 'asset_documents'
        and existing.entity_id = asset_documents.id
        and existing.event_type = 'DOCUMENT_EXPIRING'
        and existing.created_at > now() - interval '1 day'
    );

  get diagnostics last_count = row_count;
  inserted_count := inserted_count + last_count;
  return inserted_count;
end;
$$;

drop trigger if exists notify_project_created on public.projects;
drop trigger if exists notify_asset_created on public.assets;

create trigger notify_project_created
after insert on public.projects
for each row execute function public.notify_new_project();

create trigger notify_asset_created
after insert on public.assets
for each row execute function public.notify_new_asset();

select '002_notifications_commercial_events completed' as result;
