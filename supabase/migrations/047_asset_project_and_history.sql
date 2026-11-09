-- 047_asset_project_and_history.sql
--
-- Dos cambios pedidos por Progrúas S.A.S., ambos sobre el módulo de Equipos:
--
-- 1) ASOCIAR UN EQUIPO A UN PROYECTO (assets.project_id)
--    Hoy `assets` no tiene NINGUNA referencia a `projects`. La única relación
--    equipo<->proyecto que existe en el esquema es `asset_assignments`
--    (001_initial_multitenant_schema.sql:228), una tabla de asignaciones
--    con histórico (assigned_at/returned_at/status) que ningún módulo de la
--    aplicación escribe ni lee todavía: está vacía en el tenant real.
--
--    Se agrega una columna directa en vez de empezar a usar
--    `asset_assignments` porque lo que se pidió es el dato que se muestra al
--    BUSCAR un equipo ("a qué proyecto pertenece este equipo"), es decir el
--    proyecto ACTUAL - un solo valor por equipo, consultable en la misma
--    fila sin join ni subconsulta de "la asignación abierta más reciente".
--    `asset_assignments` queda intacta para cuando se necesite el histórico
--    completo de asignaciones (quién lo tuvo y cuándo lo devolvió), que es
--    un problema distinto y no se toca aquí.
--
--    Es nullable a propósito: un equipo en bodega, recién comprado o entre
--    obras legítimamente no pertenece a ningún proyecto, y los equipos ya
--    registrados quedan en NULL ("Sin proyecto"). No hay backfill ni
--    reclasificación automática - adivinar la obra de un equipo a partir de
--    su `location` en texto libre inventaría asociaciones (mismo criterio
--    que 045_generated_reports_project_id.sql).
--
--    ON DELETE SET NULL: borrar una obra no debe borrar la maquinaria que
--    estuvo en ella, solo dejarla sin proyecto asignado - igual que en
--    maintenance_records.project_id, incidents.project_id y
--    asset_documents.project_id, que ya usan exactamente esta regla.
--
-- 2) HISTORIAL POR EQUIPO (public.asset_history)
--    El pedido es poder abrir un equipo y ver "qué se le ha hecho": no solo
--    los mantenimientos formales, también las intervenciones menores del día
--    a día ("se cambió un tornillo", "se engrasó el cable", "se reapretó el
--    anclaje"). Hoy eso solo cabe en `maintenance_records`, cuyo formulario
--    exige un tipo del enum `maintenance_type` (Preventivo/Correctivo/
--    Inspección/Emergencia), un estado del flujo
--    (Pendiente->Programado->En proceso->Completado) y un responsable - toda
--    la ceremonia de un mantenimiento planificado para anotar un tornillo.
--    El resultado práctico es que esas intervenciones no se registran en
--    ningún lado y el historial real del equipo queda incompleto.
--
--    Esta tabla es el registro libre y cronológico de esas intervenciones:
--    título, nota, fecha, quién lo hizo y (opcional) costo y horómetro del
--    momento. NO reemplaza ni duplica `maintenance_records` - la ficha del
--    equipo muestra un solo timeline que mezcla mantenimientos, novedades,
--    documentos y estas entradas, cada uno identificado por su origen.
--
--    INSERT con can_register_operations (ADMIN/SUPERVISOR/OPERARIO) a
--    propósito: el operario que está frente a la máquina es exactamente
--    quien sabe que se cambió el tornillo, igual que ya puede registrar un
--    mantenimiento o una novedad (maintenance_insert / incidents_insert).
--    UPDATE queda en can_manage_operations y DELETE en can_manage_company,
--    la misma escala que el resto de las tablas operativas.
--
-- Puramente aditiva: una columna nullable, una tabla nueva, índices.
-- No reescribe ni borra datos existentes. Totalmente idempotente: se puede
-- volver a ejecutar cuantas veces se quiera.

-- ---------------------------------------------------------------------------
-- 1) assets.project_id
-- ---------------------------------------------------------------------------

alter table public.assets
  add column if not exists project_id uuid references public.projects(id) on delete set null;

-- Sirve a las dos consultas que habilita la feature: "todos los equipos del
-- proyecto X" (filtro en el listado de Equipos y enlace desde Obras) y
-- "¿este proyecto tiene equipos?" - sin recorrer la tabla completa por
-- tenant. Mismo patrón (company_id, <fk>) que el resto de los índices de
-- esta base.
create index if not exists idx_assets_company_project
  on public.assets(company_id, project_id);

-- RLS de `assets` sin cambios a propósito: assets_select/insert/update/delete
-- (001_initial_multitenant_schema.sql:967-970) ya filtran cada fila por
-- company_id vía is_company_member()/can_manage_operations()/
-- can_manage_company(). Una columna nullable nueva sobre una fila ya
-- protegida no necesita policy nueva, y `projects` conserva su propia policy
-- is_company_member() para SELECT, que el join de la aplicación sigue
-- atravesando (nunca se evita). La validación de que el project_id elegido
-- pertenece a la misma empresa se hace además en el servidor, en
-- buildFieldsPayload() (lib/actions/tenant-records.ts, FK_TABLE_BY_FIELD).

-- ---------------------------------------------------------------------------
-- 2) public.asset_history
-- ---------------------------------------------------------------------------

create table if not exists public.asset_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  -- Proyecto en el que ocurrió la intervención. Se guarda en la entrada (no
  -- se lee de assets.project_id al mostrarla) porque un equipo se mueve de
  -- obra: si se leyera el proyecto actual, el historial completo del equipo
  -- se reescribiría solo cada vez que cambia de obra y diría que el tornillo
  -- de hace seis meses se cambió en la obra de hoy.
  project_id uuid references public.projects(id) on delete set null,
  event_type text not null default 'INTERVENTION'
    check (event_type in ('INTERVENTION', 'PART_CHANGE', 'INSPECTION', 'TRANSFER', 'NOTE', 'OTHER')),
  title text not null,
  description text,
  performed_at date not null default current_date,
  performed_by_name text,
  -- Horómetro al momento de la intervención. Nullable (a diferencia de
  -- assets.hour_meter, que es `not null default 0`): aquí NULL significa
  -- "no se anotó", que es distinto de "la máquina tenía 0 horas".
  hour_meter numeric(14,2) check (hour_meter is null or hour_meter >= 0),
  cost numeric(14,2) not null default 0 check (cost >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- La consulta real de la ficha del equipo: su historial, más reciente
-- primero. created_at desempata las entradas del mismo día (performed_at es
-- una fecha, no un instante) para que el orden sea estable.
create index if not exists asset_history_company_asset_idx
  on public.asset_history(company_id, asset_id, performed_at desc, created_at desc);

create index if not exists asset_history_company_project_idx
  on public.asset_history(company_id, project_id);

drop trigger if exists asset_history_set_updated_at on public.asset_history;
create trigger asset_history_set_updated_at
before update on public.asset_history
for each row execute function public.set_updated_at();

drop trigger if exists audit_asset_history on public.asset_history;
create trigger audit_asset_history
after insert or update or delete on public.asset_history
for each row execute function public.write_audit_log();

alter table public.asset_history enable row level security;

drop policy if exists asset_history_select on public.asset_history;
drop policy if exists asset_history_insert on public.asset_history;
drop policy if exists asset_history_update on public.asset_history;
drop policy if exists asset_history_delete on public.asset_history;

create policy asset_history_select on public.asset_history
for select using (public.is_company_member(company_id));

create policy asset_history_insert on public.asset_history
for insert with check (public.can_register_operations(company_id));

create policy asset_history_update on public.asset_history
for update using (public.can_manage_operations(company_id))
with check (public.can_manage_operations(company_id));

create policy asset_history_delete on public.asset_history
for delete using (public.can_manage_company(company_id));

notify pgrst, 'reload schema';

select '047_asset_project_and_history completed' as result;
