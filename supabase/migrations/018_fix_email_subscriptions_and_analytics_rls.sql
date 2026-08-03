-- 018_fix_email_subscriptions_and_analytics_rls.sql
-- Fully idempotent: safe to run any number of times.
--
-- Bug found in functional QA (2026-07-02): saving an email notification preference
-- always failed with "new row violates row-level security policy for table
-- email_subscriptions". Root cause in 006_email_webhooks_analytics.sql:
--   1) email_subscriptions only had SELECT and UPDATE policies - there was no INSERT
--      (or DELETE) policy at all, so the upsert()'s INSERT path was rejected outright
--      by the default-deny RLS behavior.
--   2) The SELECT policy (and the analytics_events/analytics_metrics/webhooks admin
--      policies) compared `memberships.user_id = auth.uid()`, but memberships.user_id
--      stores the internal public.users.id, not the Supabase Auth UID - so those
--      policies could never match a real user either.
--
-- Fix: replace all of these with the same public.is_company_member()/
-- public.can_manage_company() helpers already used correctly everywhere else in the
-- schema (e.g. report_templates policies in 004_reports_evidence.sql), plus explicit
-- ownership checks for the per-user tables.

-- === email_subscriptions: add missing insert/delete policies, fix select/update ===
drop policy if exists "members_view_own_subscriptions" on public.email_subscriptions;
drop policy if exists "members_manage_own_subscriptions" on public.email_subscriptions;
drop policy if exists "email_subscriptions_select" on public.email_subscriptions;
drop policy if exists "email_subscriptions_insert" on public.email_subscriptions;
drop policy if exists "email_subscriptions_update" on public.email_subscriptions;
drop policy if exists "email_subscriptions_delete" on public.email_subscriptions;

create policy "email_subscriptions_select" on public.email_subscriptions
  for select using (
    public.is_company_member(company_id)
    and user_id = (select id from public.users where auth_user_id = auth.uid() limit 1)
  );

create policy "email_subscriptions_insert" on public.email_subscriptions
  for insert with check (
    public.is_company_member(company_id)
    and user_id = (select id from public.users where auth_user_id = auth.uid() limit 1)
  );

create policy "email_subscriptions_update" on public.email_subscriptions
  for update using (
    user_id = (select id from public.users where auth_user_id = auth.uid() limit 1)
  )
  with check (
    user_id = (select id from public.users where auth_user_id = auth.uid() limit 1)
  );

create policy "email_subscriptions_delete" on public.email_subscriptions
  for delete using (
    user_id = (select id from public.users where auth_user_id = auth.uid() limit 1)
  );

-- === analytics_events / analytics_metrics: fix select policies (same wrong comparison) ===
drop policy if exists "members_view_company_analytics" on public.analytics_events;
drop policy if exists "analytics_events_select" on public.analytics_events;
create policy "analytics_events_select" on public.analytics_events
  for select using (public.is_company_member(company_id));

drop policy if exists "members_view_company_metrics" on public.analytics_metrics;
drop policy if exists "analytics_metrics_select" on public.analytics_metrics;
create policy "analytics_metrics_select" on public.analytics_metrics
  for select using (public.is_company_member(company_id));

-- Any authenticated company member can record their own usage events; metrics stay
-- write-only from trusted server code (service role bypasses RLS regardless).
drop policy if exists "analytics_events_insert" on public.analytics_events;
create policy "analytics_events_insert" on public.analytics_events
  for insert with check (public.is_company_member(company_id));

-- === webhooks: fix admin-only policy (same wrong comparison) ===
drop policy if exists "admin_manage_webhooks" on public.webhooks;
create policy "admin_manage_webhooks" on public.webhooks
  for all using (public.can_manage_company(company_id))
  with check (public.can_manage_company(company_id));

select '018_fix_email_subscriptions_and_analytics_rls completed' as result;
