-- 044_offline_sync_expand_idempotency.sql
--
-- Ampliación del modo offline (ver 043_offline_sync_idempotency.sql) a Obras,
-- Documentos y Usuarios: mismo mecanismo (client_op_id generado en el
-- dispositivo + índice único por empresa) para que crear uno de estos
-- registros sin conexión y que la sincronización se reintente nunca duplique
-- la fila.
--
-- Puramente aditivo: nueva columna nullable + índice único parcial, ninguna
-- fila existente se toca. Idempotente: seguro de ejecutar cualquier número de
-- veces.

alter table public.projects add column if not exists client_op_id uuid;
alter table public.asset_documents add column if not exists client_op_id uuid;
alter table public.users add column if not exists client_op_id uuid;

create unique index if not exists projects_company_client_op_key
  on public.projects (company_id, client_op_id)
  where client_op_id is not null;

create unique index if not exists asset_documents_company_client_op_key
  on public.asset_documents (company_id, client_op_id)
  where client_op_id is not null;

create unique index if not exists users_company_client_op_key
  on public.users (company_id, client_op_id)
  where client_op_id is not null;

SELECT '044_offline_sync_expand_idempotency completed' AS result;
