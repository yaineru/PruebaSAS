-- RC1 certification pass: security hardening found during a full audit.
-- Idempotent, safe to run on both a fresh install and the already-live DB.

-- 1) industry_templates has RLS disabled entirely. It's a shared reference
--    table (no company_id) never actually read by the app (industries shown
--    at signup come from the static lib/industries.ts, not this table), so
--    the correct fix is simply to lock it down rather than design a read
--    policy nobody needs: with RLS enabled and no policies, anon/authenticated
--    lose the default full-table CRUD Postgres grants them, service_role
--    (which bypasses RLS) is unaffected.
alter table public.industry_templates enable row level security;

-- 2) create_company_notification / generate_document_expiration_notifications /
--    generate_operational_expiration_notifications are SECURITY DEFINER with a
--    pinned search_path, but EXECUTE was never revoked from PUBLIC. Because
--    PostgREST exposes every public-schema function as a callable RPC, any
--    authenticated user of any tenant could invoke these directly and
--    insert notifications into (or scan) a company they don't belong to.
--    Trigger-based internal calls (e.g. notify_report_generated calling
--    create_company_notification) are unaffected by this revoke: a
--    SECURITY DEFINER function's internal calls run as the function owner,
--    not as the original caller.
revoke execute on function public.create_company_notification(uuid, uuid, text, text, text, text, uuid) from public, authenticated, anon;
revoke execute on function public.generate_document_expiration_notifications() from public, authenticated, anon;
revoke execute on function public.generate_operational_expiration_notifications() from public, authenticated, anon;

-- 3) notifications RLS never checked user_id, only company_id - any company
--    member could read and mark-as-read/archive every other member's personal
--    notifications (e.g. activity reminders), not just company-wide ones.
--    user_id is nullable (null = company-wide announcement, set = personal).
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
for select using (
  public.is_company_member(company_id)
  and (user_id is null or user_id = public.current_app_user_id())
);

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
for update using (
  public.is_company_member(company_id)
  and (user_id is null or user_id = public.current_app_user_id())
)
with check (
  public.is_company_member(company_id)
  and (user_id is null or user_id = public.current_app_user_id())
);

select '033_rc1_security_hardening completed' as result;
