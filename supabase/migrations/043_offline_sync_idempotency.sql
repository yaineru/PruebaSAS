-- 043_offline_sync_idempotency.sql
--
-- Modo offline de campo: un mantenimiento/novedad/equipo creado sin conexión
-- se guarda en una cola local (IndexedDB) y se reintenta al recuperar
-- Internet. Un reintento puede pasar por escenarios donde el cliente no está
-- seguro si el intento anterior realmente llegó a Supabase (ej. la respuesta
-- se perdió por una caída de red justo después de que el insert tuvo éxito) -
-- sin una forma de detectar "esto ya se guardó", reintentar crearía un
-- duplicado real.
--
-- Fix: cada operación de la cola lleva un id generado en el propio
-- dispositivo (client_op_id, un UUID) que viaja con el insert. Una
-- restricción única por (company_id, client_op_id) hace que un reintento con
-- el mismo id nunca duplique la fila - el servidor solo necesita distinguir
-- "ya existe con este id" (éxito idempotente) de cualquier otro error real.
--
-- Puramente aditivo: nueva columna nullable + índice único, ninguna fila
-- existente se toca. Todas las filas históricas quedan con client_op_id NULL
-- (múltiples NULL no violan un índice único en Postgres), así que nada de lo
-- ya sincronizado antes de esta migración se ve afectado.
--
-- Idempotente: seguro de ejecutar cualquier número de veces.

alter table public.maintenance_records add column if not exists client_op_id uuid;
alter table public.incidents add column if not exists client_op_id uuid;
alter table public.assets add column if not exists client_op_id uuid;
alter table public.generated_reports add column if not exists client_op_id uuid;

create unique index if not exists maintenance_records_company_client_op_key
  on public.maintenance_records (company_id, client_op_id)
  where client_op_id is not null;

create unique index if not exists incidents_company_client_op_key
  on public.incidents (company_id, client_op_id)
  where client_op_id is not null;

create unique index if not exists assets_company_client_op_key
  on public.assets (company_id, client_op_id)
  where client_op_id is not null;

create unique index if not exists generated_reports_company_client_op_key
  on public.generated_reports (company_id, client_op_id)
  where client_op_id is not null;

SELECT '043_offline_sync_idempotency completed' AS result;
