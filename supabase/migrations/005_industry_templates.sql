-- 005_industry_templates.sql
-- Industry-specific templates with customized terminology

-- Create industry_templates table
create table if not exists industry_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  asset_label text not null default 'Activos',
  maintenance_label text not null default 'Mantenimientos',
  project_label text not null default 'Proyectos',
  incident_label text not null default 'Novedades',
  suggested_color_primary text default '#0f766e',
  suggested_color_secondary text default '#f59e0b',
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create index on slug for fast lookups
create index if not exists idx_industry_templates_slug on industry_templates(slug);

-- Insert predefined industry templates
insert into industry_templates (
  name, slug, description, icon,
  asset_label, maintenance_label, project_label, incident_label,
  suggested_color_primary, suggested_color_secondary
) values
  (
    'Maquinaria & Equipos',
    'machinery',
    'Gestión de maquinaria industrial, herramientas y equipos pesados',
    '⚙️',
    'Máquinas', 'Mantenimientos', 'Proyectos', 'Alertas',
    '#1e40af', '#f59e0b'
  ),
  (
    'Construcción & Obras',
    'construction',
    'Seguimiento de proyectos de construcción y obras civiles',
    '🏗️',
    'Equipos', 'Mantenimientos', 'Obras', 'Incidentes',
    '#b91c1c', '#fbbf24'
  ),
  (
    'Veterinaria & Mascotas',
    'veterinary',
    'Gestión de clínica veterinaria, pacientes y procedimientos',
    '🐾',
    'Equipos', 'Mantenimiento', 'Campañas', 'Consultas',
    '#7c2d12', '#f59e0b'
  ),
  (
    'Salud & Clínicas',
    'healthcare',
    'Gestión de consultorios, hospitales y centros de salud',
    '🏥',
    'Equipos Médicos', 'Mantenimiento', 'Campañas', 'Incidentes',
    '#1e3a8a', '#06b6d4'
  ),
  (
    'Odontología',
    'dental',
    'Gestión de consultorio odontológico y equipos dentales',
    '😁',
    'Equipos Dentales', 'Mantenimiento', 'Tratamientos', 'Citaciones',
    '#4f46e5', '#60a5fa'
  ),
  (
    'Talleres & Mecánica',
    'workshop',
    'Gestión de talleres, reparaciones y servicios técnicos',
    '🔧',
    'Herramientas', 'Mantenimiento', 'Reparaciones', 'Órdenes',
    '#7c2d12', '#ea580c'
  ),
  (
    'Servicios Generales',
    'services',
    'Empresas de servicios, consultoría y outsourcing',
    '📋',
    'Recursos', 'Capacitaciones', 'Proyectos', 'Solicitudes',
    '#0f766e', '#f59e0b'
  ) on conflict (slug) do nothing;

-- Add industry_template_id to companies table (if not already exists)
alter table companies add column if not exists industry_template_id uuid references industry_templates(id);

-- Update existing companies to use default template (only if null)
update companies set industry_template_id = (
  select id from industry_templates where slug = 'services' limit 1
) where industry_template_id is null;

-- Create trigger for updated_at (if not already exists)
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_updated_at_industry_templates'
  ) then
    create trigger set_updated_at_industry_templates
      before update on industry_templates
      for each row
      execute function set_updated_at();
  end if;
end $$;

-- Enable realtime (if not already enabled)
do $$
begin
  alter publication supabase_realtime add table industry_templates;
exception when others then
  null; -- table already in publication or other error
end $$;

comment on table industry_templates is 'Predefined industry templates with customized terminology for different sectors';
comment on column industry_templates.slug is 'URL-friendly identifier for the industry template';
comment on column industry_templates.asset_label is 'Custom label for assets in this industry';
comment on column industry_templates.maintenance_label is 'Custom label for maintenance operations';
