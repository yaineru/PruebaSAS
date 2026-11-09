-- 048_asset_history_offline_idempotency.sql
--
-- Habilita el modo offline para el historial del equipo (public.asset_history,
-- creada en 047). Mismo mecanismo que 043 y 044 para las demás tablas: el
-- dispositivo genera un client_op_id al encolar la operación y lo manda en
-- cada intento de sincronización, así que si la respuesta de un intento que
-- SÍ llegó al servidor se pierde por la red, el reintento choca contra este
-- índice único (23505) en vez de insertar una segunda fila - y la aplicación
-- lo traduce a "ya estaba sincronizado", no a un error.
--
-- Es justo el caso de uso de esta tabla: el operario está frente a la máquina,
-- en una obra donde la señal va y viene, y es quien sabe que se cambió el
-- tornillo. Sin esto, o no puede anotarlo hasta volver a tener señal, o cada
-- reintento con señal intermitente le duplica la entrada en el historial.
--
-- Índice único PARCIAL (`where client_op_id is not null`): las entradas
-- creadas con conexión no llevan client_op_id, y en Postgres varios NULL no
-- chocan entre sí de todas formas - el parcial lo deja explícito y además
-- mantiene el índice del tamaño de lo que realmente se consulta.
--
-- Puramente aditivo: una columna nullable y un índice. Ninguna fila existente
-- se toca. Idempotente: seguro de ejecutar cualquier número de veces.

alter table public.asset_history add column if not exists client_op_id uuid;

create unique index if not exists asset_history_company_client_op_key
  on public.asset_history (company_id, client_op_id)
  where client_op_id is not null;

notify pgrst, 'reload schema';

select '048_asset_history_offline_idempotency completed' as result;
