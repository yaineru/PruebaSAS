-- Fase Final "Cliente Real": simulando el uso diario de un cliente real
-- (Progrúas S.A.S.), creé un equipo nuevo sin seleccionar "Estado" (el campo
-- no es obligatorio, a propósito). El registro quedó guardado con
-- status = 'active' (minúscula) en vez de 'AVAILABLE', mostrando el valor
-- crudo sin traducir en toda la interfaz (tabla, ficha del equipo). Es el
-- mismo patrón de drift ya corregido en la migración 036 para
-- projects.status y maintenance_records.status - pero esta vez en
-- assets.status, columna que el comentario de la migración 036 afirmaba
-- explícitamente que NO estaba afectada en ese momento. Es decir, este
-- drift del DEFAULT de columna volvió a producirse después de esa revisión,
-- confirmando que no fue un incidente cerrado sino un riesgo recurrente de
-- esta base de datos.
alter table public.assets alter column status set default 'AVAILABLE'::public.asset_status;

-- Repara los equipos ya creados con el default corrupto.
update public.assets set status = 'AVAILABLE'::public.asset_status where status::text = 'active';

-- Mientras generaba un informe de Equipos para revisar plantillas
-- personalizadas, encontré la misma corrupción - mucho más extendida - en
-- assets.condition: 998 de 1000 equipos (los generados por el seed masivo de
-- Fase 21/22) tienen 'good' (minúscula) en vez de 'GOOD', y uno tiene 'fair'
-- en vez de 'FAIR'. El tipo asset_condition y el default de columna en
-- 001_initial_multitenant_schema.sql ya son correctos ('GOOD' mayúscula) -
-- el drift está solo en el estado actual de la base de datos viva.
alter table public.assets alter column condition set default 'GOOD'::public.asset_condition;
update public.assets set condition = 'GOOD'::public.asset_condition where condition::text = 'good';
update public.assets set condition = 'FAIR'::public.asset_condition where condition::text = 'fair';
update public.assets set condition = 'EXCELLENT'::public.asset_condition where condition::text = 'excellent';
update public.assets set condition = 'POOR'::public.asset_condition where condition::text = 'poor';
update public.assets set condition = 'CRITICAL'::public.asset_condition where condition::text = 'critical';

select '038_fix_asset_status_drift completed' as result;
