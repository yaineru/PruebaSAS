-- 006_email_webhooks_analytics.sql
-- Email subscriptions, webhooks, and analytics infrastructure

-- Email Subscriptions Table
create table if not exists email_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  event_type text not null,
  -- event_type values: REPORT_GENERATED, MAINTENANCE_DUE, INCIDENT_CREATED, DOCUMENT_EXPIRING, etc.
  enabled boolean default true,
  frequency text default 'IMMEDIATE',
  -- frequency: IMMEDIATE, DAILY_DIGEST, WEEKLY_DIGEST
  last_sent_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint unique_subscription unique(company_id, user_id, event_type, frequency)
);

-- Email Log Table
create table if not exists email_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  event_type text not null,
  subject text not null,
  recipient_email text not null,
  status text not null default 'PENDING',
  -- status: PENDING, SENT, FAILED, BOUNCED
  error_message text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Webhooks Table
create table if not exists webhooks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  created_by uuid not null references users(id) on delete set null,
  name text not null,
  description text,
  url text not null,
  secret text not null,
  -- secret for HMAC validation
  events text[] not null,
  -- array of event types: REPORT_GENERATED, INCIDENT_CREATED, etc.
  active boolean default true,
  retry_count integer default 3,
  timeout_seconds integer default 30,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Webhook Deliveries Table
create table if not exists webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references webhooks(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  status text not null,
  -- status: PENDING, SUCCESS, FAILED
  response_status_code integer,
  response_body text,
  error_message text,
  attempt_count integer default 0,
  next_retry_at timestamp with time zone,
  last_attempted_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Analytics Events Table
create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  event_name text not null,
  -- event_name: PAGE_VIEW, BUTTON_CLICK, FORM_SUBMIT, REPORT_GENERATED, etc.
  event_category text,
  properties jsonb,
  -- flexibility for custom properties
  page_url text,
  user_agent text,
  ip_address text,
  created_at timestamp with time zone default now()
);

-- Analytics Metrics Table (Materialized View Data)
create table if not exists analytics_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  metric_name text not null,
  metric_date date not null,
  metric_value integer not null,
  -- metric_name examples: REPORTS_GENERATED, INCIDENTS_CREATED, USERS_ACTIVE, etc.
  created_at timestamp with time zone default now(),
  constraint unique_metric unique(company_id, metric_name, metric_date)
);

-- Indexes
create index if not exists idx_email_subscriptions_company on email_subscriptions(company_id);
create index if not exists idx_email_subscriptions_user on email_subscriptions(user_id);
create index if not exists idx_email_logs_company on email_logs(company_id);
create index if not exists idx_email_logs_status on email_logs(status);
create index if not exists idx_webhooks_company on webhooks(company_id);
create index if not exists idx_webhook_deliveries_webhook on webhook_deliveries(webhook_id);
create index if not exists idx_webhook_deliveries_status on webhook_deliveries(status);
create index if not exists idx_analytics_events_company on analytics_events(company_id);
create index if not exists idx_analytics_events_event on analytics_events(event_name);
create index if not exists idx_analytics_events_date on analytics_events(created_at);
create index if not exists idx_analytics_metrics_company on analytics_metrics(company_id);
create index if not exists idx_analytics_metrics_date on analytics_metrics(metric_date);

-- Triggers
drop trigger if exists set_updated_at_email_subscriptions on email_subscriptions;
create trigger set_updated_at_email_subscriptions
  before update on email_subscriptions
  for each row
  execute function set_updated_at();

drop trigger if exists set_updated_at_webhooks on webhooks;
create trigger set_updated_at_webhooks
  before update on webhooks
  for each row
  execute function set_updated_at();

-- RLS Policies
alter table email_subscriptions enable row level security;
alter table email_logs enable row level security;
alter table webhooks enable row level security;
alter table webhook_deliveries enable row level security;
alter table analytics_events enable row level security;
alter table analytics_metrics enable row level security;

-- RLS: email_subscriptions
--
-- NOTE (RC1 fresh-install audit, 2026-07-04): these four policies originally
-- queried public.memberships directly, but that table isn't created until
-- 025_consolidate_memberships_and_fresh_install.sql - 19 files later. Postgres
-- validates that relations referenced in a CREATE POLICY expression exist at
-- creation time, so a fresh install replaying 001..027 in order aborted right
-- here with "relation \"memberships\" does not exist", and nothing from 007
-- onward (including 025 itself) ever ran. 018_fix_email_subscriptions_and_
-- analytics_rls.sql already replaces these same policy names with correct
-- is_company_member()/can_manage_company() versions (both defined in 001,
-- using public.users directly, no memberships dependency) - using those
-- helpers here instead of the raw memberships query removes the forward
-- reference without changing anything on the already-live database, where
-- 018 already overwrote these policies by name.
drop policy if exists "members_view_own_subscriptions" on email_subscriptions;
create policy "members_view_own_subscriptions" on email_subscriptions
  for select using (
    is_company_member(email_subscriptions.company_id)
  );

drop policy if exists "members_manage_own_subscriptions" on email_subscriptions;
create policy "members_manage_own_subscriptions" on email_subscriptions
  for update using (
    user_id = (select id from users where auth_user_id = auth.uid() limit 1)
  );

-- RLS: webhooks
drop policy if exists "admin_manage_webhooks" on webhooks;
create policy "admin_manage_webhooks" on webhooks
  for all using (
    can_manage_company(webhooks.company_id)
  );

-- RLS: analytics
drop policy if exists "members_view_company_analytics" on analytics_events;
create policy "members_view_company_analytics" on analytics_events
  for select using (
    is_company_member(analytics_events.company_id)
  );

drop policy if exists "members_view_company_metrics" on analytics_metrics;
create policy "members_view_company_metrics" on analytics_metrics
  for select using (
    is_company_member(analytics_metrics.company_id)
  );

-- Realtime Publications
do $$ begin
  alter publication supabase_realtime add table email_subscriptions;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table webhook_deliveries;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table analytics_metrics;
exception when duplicate_object then null;
end $$;

-- Comments
comment on table email_subscriptions is 'User preferences for email notifications per event type';
comment on table webhooks is 'Registered webhooks for company integrations';
comment on table webhook_deliveries is 'History of webhook delivery attempts';
comment on table analytics_events is 'Raw analytics events for usage tracking';
comment on table analytics_metrics is 'Aggregated metrics for dashboard visualization';
