-- Fase 21 (operational/maintainability certification) found a live contradiction
-- between the `incident_media` table's own CHECK constraints (001_initial_
-- multitenant_schema.sql) - which explicitly allow video/mp4 and video/webm
-- uploads up to 50MB (52428800 bytes) for incident evidence - and the
-- `company-files` Storage bucket those uploads actually go through, which was
-- narrowed to 20MB / no video types by migration 003's `on conflict do update`
-- (which fully replaces file_size_limit and allowed_mime_types rather than
-- merging with what 001 originally set). Any incident video upload, or any
-- image between 20-50MB, that the table schema allows has been silently
-- rejected by Storage with a 400 error since migration 003 first ran - the
-- same class of bug migration 034 already fixed once for the `reports` bucket
-- for the same reason (missing image mime types there).
--
-- No UI currently uploads incident video evidence (this repairs the storage
-- layer to match the table's already-declared capability, in case/when that
-- upload UI is built - it does not add new functionality itself).
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'application/pdf','image/jpeg','image/png','image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'video/mp4','video/webm'
    ]
where id = 'company-files';

select '037_fix_company_files_bucket_video_support completed' as result;
