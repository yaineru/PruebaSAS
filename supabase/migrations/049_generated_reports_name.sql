-- Permite ponerle un nombre propio a un informe generado, para poder
-- identificarlo después al organizarlo en la vista de carpetas (Proyecto ->
-- Año -> Mes -> Informes, lib/reports/report-folders.ts) - sin esto, cada
-- informe técnico se veía ahí solo como "Informe técnico", indistinguible
-- de los demás del mismo mes.
--
-- Nullable y sin backfill: los informes existentes simplemente no tienen
-- nombre todavía (la UI cae de vuelta a la etiqueta genérica por tipo,
-- igual que hasta ahora) hasta que alguien se lo ponga. Aditivo, reversible
-- con un DROP COLUMN. Idempotente.

ALTER TABLE public.generated_reports
  ADD COLUMN IF NOT EXISTS report_name text;

-- RLS sin cambios: otra columna más en una fila ya protegida por
-- generated_reports_select/update (is_company_member()/
-- can_register_operations(), 007_reports_enhancement.sql).

NOTIFY pgrst, 'reload schema';

SELECT '049_generated_reports_name completed' AS result;
