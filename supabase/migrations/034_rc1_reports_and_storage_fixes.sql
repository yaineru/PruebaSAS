-- RC1 certification pass, part 2: correctness fixes found while load-testing
-- the Informes module and re-checking Storage policies against real app code.
-- Idempotent, safe on both a fresh install and the already-live DB.

-- 1) generated_reports.status only allowed ('GENERATING','GENERATED','FAILED'),
--    but every successful report path (lib/actions/reports.ts,
--    lib/actions/technical-reports.ts) writes status='READY' on success, and
--    the notify_report_generated() trigger (007_reports_enhancement.sql) was
--    written expecting 'READY' to be legal. On a DB where this was never
--    patched out of band, the final status update after every successful
--    generation would throw a check-violation, permanently leaving the row
--    at 'GENERATING' even though the file was already uploaded. Widening
--    defensively covers both cases (already-patched or not) and adds
--    'EXPIRED', which lib/reports.ts's TS type already anticipates.
alter table public.generated_reports drop constraint if exists generated_reports_status_check;
alter table public.generated_reports add constraint generated_reports_status_check
  check (status in ('GENERATING', 'GENERATED', 'READY', 'FAILED', 'EXPIRED'));

-- 2) company-files Storage DELETE policy required can_manage_company (ADMIN
--    only) for every object in the bucket, but the asset_images table's own
--    DELETE policy allows the uploader to remove their own photo regardless
--    of role. Net effect: a SUPERVISOR/OPERARIO who uploads their own asset
--    photo (upload only requires can_register_operations, which includes
--    them) could never actually delete or replace it - deleteAssetImage
--    removes the Storage object first and always failed with a permissions
--    error for non-admins. Scoped strictly to the asset-images subfolder
--    (path shape {company_id}/asset-images/{asset_id}/...) so document
--    deletion (company-files/{company_id}/documents/...) stays admin-only,
--    unchanged.
drop policy if exists company_files_delete on storage.objects;
create policy company_files_delete on storage.objects for delete
using (
  bucket_id = 'company-files'
  and (
    public.can_manage_company((storage.foldername(name))[1]::uuid)
    or (
      (storage.foldername(name))[2] = 'asset-images'
      and owner = auth.uid()
    )
  )
);

-- 3) The "reports" bucket only allowed application/pdf and .xlsx (it was
--    designed to hold generated report files only). Technical report
--    evidence photos now upload straight from the browser into this same
--    bucket (components/technical-report-form.tsx, replacing the old
--    filesystem-write path, which broke on Vercel's read-only filesystem and
--    served files with no auth/expiry) - without widening the allowlist,
--    every evidence photo upload fails with a 400 "invalid_mime_type"
--    (confirmed live: `image/png is not supported`).
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp'
]
where id = 'reports';

select '034_rc1_reports_and_storage_fixes completed' as result;
