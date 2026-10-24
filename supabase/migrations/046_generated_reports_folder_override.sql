-- Permite reclasificar manualmente a qué carpeta Año/Mes pertenece un
-- informe ya generado, sin tocar su fecha real (formPayload.reportDate o
-- created_at) ni el contenido del PDF - solo dónde aparece en la vista de
-- carpetas (lib/reports/report-folders.ts).
--
-- Caso real que motiva esto: Progrúas pidió poder "meter" los informes
-- sueltos (sin proyecto asignado, o cuya fecha de ejecución no refleja bien
-- dónde deberían archivarse) a una carpeta de año y mes específico a mano.
-- Guardar el año y el mes como enteros separados, en vez de una fecha
-- completa, evita por completo cualquier problema de interpretación de
-- fecha/zona horaria al leerlos de vuelta - no hay ningún string que
-- parsear, solo dos números que se comparan directo.
--
-- Nullable y sin backfill: todo informe existente sigue usando su fecha real
-- (reportDate o created_at) hasta que alguien decida moverlo explícitamente.
-- Purely additive, reversible con un DROP COLUMN. Idempotente.

ALTER TABLE public.generated_reports
  ADD COLUMN IF NOT EXISTS folder_year smallint,
  ADD COLUMN IF NOT EXISTS folder_month smallint;

DO $$ BEGIN
  ALTER TABLE public.generated_reports
    ADD CONSTRAINT generated_reports_folder_month_check CHECK (folder_month IS NULL OR (folder_month BETWEEN 1 AND 12));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS sin cambios: estas dos columnas nuevas viven en filas ya protegidas
-- por generated_reports_select/update (is_company_member()/
-- can_register_operations()) - la misma política que ya exige
-- company_id = la empresa del usuario autenticado para leer o escribir
-- cualquier columna de esta tabla, estas incluidas.

NOTIFY pgrst, 'reload schema';

SELECT '046_generated_reports_folder_override completed' AS result;
