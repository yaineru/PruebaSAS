-- 035_smtp_email_and_calendar_pro.sql
--
-- Fase 18: per-company SMTP email (so a customer isn't forced to depend on
-- Resend), an email delivery log/queue with retry, and calendar
-- professionalization (private/priority activities, attachments, a private
-- iCal feed token per user, and a public availability-sharing link per
-- user). Idempotent, safe on both a fresh install and the already-live DB.

-- ============ SMTP ============

create table if not exists public.email_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  smtp_host text,
  smtp_port int not null default 587,
  smtp_user text,
  -- AES-256-GCM ciphertext (iv || authTag || ciphertext, base64) - see
  -- lib/email/smtp-crypto.ts. Never stored/returned in plaintext.
  smtp_password_encrypted text,
  smtp_secure boolean not null default false,
  from_email text,
  from_name text,
  reply_to text,
  timeout_ms int not null default 10000,
  max_retries int not null default 3,
  enabled boolean not null default false,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  to_email text not null,
  subject text not null,
  template_key text not null,
  provider text not null default 'SMTP' check (provider in ('SMTP', 'RESEND')),
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED', 'RETRYING', 'CANCELLED')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  next_attempt_at timestamptz not null default now(),
  error_message text,
  smtp_server text,
  attachments jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_log_company_idx on public.email_log(company_id, created_at desc);
create index if not exists email_log_pending_idx on public.email_log(status, next_attempt_at) where status in ('PENDING', 'RETRYING');

drop trigger if exists email_settings_set_updated_at on public.email_settings;
create trigger email_settings_set_updated_at
before update on public.email_settings
for each row execute function public.set_updated_at();

drop trigger if exists email_log_set_updated_at on public.email_log;
create trigger email_log_set_updated_at
before update on public.email_log
for each row execute function public.set_updated_at();

alter table public.email_settings enable row level security;
alter table public.email_log enable row level security;

drop policy if exists email_settings_select on public.email_settings;
drop policy if exists email_settings_write on public.email_settings;
create policy email_settings_select on public.email_settings
for select using (public.can_manage_company(company_id));
create policy email_settings_write on public.email_settings
for all using (public.can_manage_company(company_id)) with check (public.can_manage_company(company_id));

drop policy if exists email_log_select on public.email_log;
create policy email_log_select on public.email_log
for select using (public.can_manage_company(company_id));
-- Inserts/updates to email_log only ever happen via the admin (service-role)
-- client from Server Actions/the cron route, which bypasses RLS by design -
-- deliberately no insert/update policy for the authenticated role.

-- ============ CALENDAR PRO ============

alter table public.activities add column if not exists is_private boolean not null default false;
alter table public.activities add column if not exists priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH'));
alter table public.activities add column if not exists recurrence_rule text;
alter table public.activities add column if not exists recurrence_parent_id uuid references public.activities(id) on delete cascade;

create index if not exists activities_recurrence_parent_idx on public.activities(recurrence_parent_id) where recurrence_parent_id is not null;

-- Private activities: visible only to their owner/creator or someone who can
-- manage operations for the company - everyone else in the company should
-- not even see the title on the shared calendar.
drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities
for select using (
  public.is_company_member(company_id)
  and (
    is_private = false
    or owner_user_id = public.current_app_user_id()
    or created_by = public.current_app_user_id()
    or public.can_manage_operations(company_id)
  )
);

create table if not exists public.activity_attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  mime_type text,
  file_size int,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists activity_attachments_activity_idx on public.activity_attachments(activity_id);

alter table public.activity_attachments enable row level security;

drop policy if exists activity_attachments_select on public.activity_attachments;
drop policy if exists activity_attachments_insert on public.activity_attachments;
drop policy if exists activity_attachments_delete on public.activity_attachments;

create policy activity_attachments_select on public.activity_attachments
for select using (
  exists (
    select 1 from public.activities a
    where a.id = activity_id
      and public.is_company_member(a.company_id)
      and (
        a.is_private = false
        or a.owner_user_id = public.current_app_user_id()
        or a.created_by = public.current_app_user_id()
        or public.can_manage_operations(a.company_id)
      )
  )
);

create policy activity_attachments_insert on public.activity_attachments
for insert with check (
  exists (
    select 1 from public.activities a
    where a.id = activity_id
      and (
        public.can_manage_operations(a.company_id)
        or a.owner_user_id = public.current_app_user_id()
        or a.created_by = public.current_app_user_id()
      )
  )
);

create policy activity_attachments_delete on public.activity_attachments
for delete using (
  exists (
    select 1 from public.activities a
    where a.id = activity_id
      and (
        public.can_manage_operations(a.company_id)
        or a.owner_user_id = public.current_app_user_id()
        or a.created_by = public.current_app_user_id()
      )
  )
);

-- Private, unguessable capability links (an iCal feed URL and a public
-- availability page) - one per user, opt-in (enabled defaults to false).
-- Deliberately keyed by an opaque random token rather than {companyId}/
-- {userId} in the URL: sequential/guessable IDs in a public, unauthenticated
-- route would let anyone enumerate other users' calendars.
create table if not exists public.calendar_share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  ics_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  ics_enabled boolean not null default false,
  public_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  public_enabled boolean not null default false,
  public_visibility text not null default 'BUSY' check (public_visibility in ('BUSY', 'SUMMARY', 'FULL')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists calendar_share_links_set_updated_at on public.calendar_share_links;
create trigger calendar_share_links_set_updated_at
before update on public.calendar_share_links
for each row execute function public.set_updated_at();

alter table public.calendar_share_links enable row level security;

drop policy if exists calendar_share_links_select on public.calendar_share_links;
drop policy if exists calendar_share_links_write on public.calendar_share_links;
create policy calendar_share_links_select on public.calendar_share_links
for select using (user_id = public.current_app_user_id());
create policy calendar_share_links_write on public.calendar_share_links
for all using (user_id = public.current_app_user_id()) with check (user_id = public.current_app_user_id());
-- Deliberately no policy lets anyone read another user's row by token - the
-- public ICS/share routes resolve the token via the service-role admin
-- client (bypasses RLS), then manually re-check company scoping in
-- application code before returning anything.

-- Lets a user invalidate a leaked ICS/public link without support
-- intervention. SECURITY DEFINER only to reach gen_random_bytes() cleanly;
-- scoped to the caller's own row via current_app_user_id(), never takes a
-- target id argument, so it cannot be used to rotate anyone else's tokens.
create or replace function public.regenerate_calendar_share_tokens()
returns table (ics_token text, public_token text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.calendar_share_links
  set ics_token = encode(gen_random_bytes(24), 'hex'),
      public_token = encode(gen_random_bytes(24), 'hex')
  where user_id = public.current_app_user_id()
  returning calendar_share_links.ics_token, calendar_share_links.public_token;
end;
$$;

revoke all on function public.regenerate_calendar_share_tokens() from public, anon;
grant execute on function public.regenerate_calendar_share_tokens() to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.email_log;
exception when duplicate_object then null;
end $$;

select '035_smtp_email_and_calendar_pro completed' as result;
