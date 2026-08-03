-- 024_fix_report_notification_message_encoding.sql
--
-- Full-app audit (2026-07-03): the "Informe generado" notification shown in
-- /notificaciones displayed the literal text "Tu informe MAINTENANCE
-- está listo para descargar" instead of "...está listo...". Root cause:
-- 004_reports_evidence.sql's notify_report_generated() trigger function had a
-- JavaScript-style "á" escape sequence pasted directly into a plain SQL
-- string literal - Postgres does not interpret \uXXXX escapes in a regular
-- '...' string, so it inserted those six literal characters instead of "á"
-- every time a report finished generating. Fixed at the source
-- (004_reports_evidence.sql) for future installs; this re-creates the same
-- function (CREATE OR REPLACE, no schema change) with the correct character
-- for the database this project is already running on.
--
-- Fully idempotent: safe to run any number of times.

create or replace function public.notify_report_generated()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'READY' then
    perform public.create_company_notification(
      new.company_id,
      new.generated_by,
      'Informe generado',
      'Tu informe ' || new.report_type || ' está listo para descargar',
      'REPORT_GENERATED',
      'generated_reports',
      new.id
    );
  end if;
  return new;
end;
$$;

SELECT '024_fix_report_notification_message_encoding completed' AS result;
