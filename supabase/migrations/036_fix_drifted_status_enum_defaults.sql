-- Fase 20 (client-simulation UX audit) found that creating a project with no
-- "Estado" selected silently saved status = 'active' (lowercase) instead of
-- 'ACTIVE'. Reproduced 100% of the time, with the exact multipart form body
-- confirming the app never sends a status value in that case (correctly
-- relying on the column default) - the bug is in the database itself, not the
-- app code. The project_status enum type had somehow picked up an extra
-- lowercase 'active' label (a Postgres enum can only have new labels added
-- explicitly via ALTER TYPE ... ADD VALUE, never automatically), and the
-- column's DEFAULT had been pointed at that lowercase label instead of the
-- correct 'ACTIVE'. Confirmed live: inserting a genuinely invalid string
-- ('TOTALLY_INVALID_VALUE_ZZZ') was correctly rejected by Postgres, proving
-- project_status really is still an enforced enum - just with the wrong
-- default. The same drift pattern was found on maintenance_records.status
-- (defaults to lowercase 'pending' instead of 'PENDING'); asset_status and
-- incident_status were checked and are NOT affected.
alter table public.projects alter column status set default 'ACTIVE'::public.project_status;
alter table public.maintenance_records alter column status set default 'PENDING'::public.maintenance_status;

-- Repair rows already corrupted by the drifted defaults before this fix.
update public.projects set status = 'ACTIVE'::public.project_status where status::text = 'active';
update public.maintenance_records set status = 'PENDING'::public.maintenance_status where status::text = 'pending';

select '036_fix_drifted_status_enum_defaults completed' as result;
