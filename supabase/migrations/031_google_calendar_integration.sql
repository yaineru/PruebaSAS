-- 031_google_calendar_integration.sql
--
-- Per-user Google Calendar OAuth connections. Tokens are encrypted at the
-- application layer (AES-256-GCM, see lib/google/token-crypto.ts) before
-- insert - deliberately NOT pgcrypto/pgp_sym_encrypt in SQL, since the
-- encryption secret would otherwise appear as a literal in every query and
-- end up in Postgres logs/pg_stat_statements.
--
-- RLS is intentionally stricter than the usual company-wide pattern: only
-- the owning user can read/write their own connection row, not even a
-- company ADMIN (this table holds encrypted refresh tokens for a personal
-- Google account, not shared company data).
--
-- Fully idempotent: safe to run any number of times.

create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null unique references public.users(id) on delete cascade,
  google_account_email text,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  token_expiry timestamptz not null,
  sync_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.activities add column if not exists google_event_id text;

create index if not exists google_calendar_connections_company_idx on public.google_calendar_connections(company_id);

drop trigger if exists google_calendar_connections_set_updated_at on public.google_calendar_connections;
create trigger google_calendar_connections_set_updated_at
before update on public.google_calendar_connections
for each row execute function public.set_updated_at();

alter table public.google_calendar_connections enable row level security;

drop policy if exists google_calendar_connections_select on public.google_calendar_connections;
drop policy if exists google_calendar_connections_insert on public.google_calendar_connections;
drop policy if exists google_calendar_connections_update on public.google_calendar_connections;
drop policy if exists google_calendar_connections_delete on public.google_calendar_connections;

create policy google_calendar_connections_select on public.google_calendar_connections
for select using (user_id = public.current_app_user_id());

create policy google_calendar_connections_insert on public.google_calendar_connections
for insert with check (
  user_id = public.current_app_user_id()
  and public.is_company_member(company_id)
);

create policy google_calendar_connections_update on public.google_calendar_connections
for update using (user_id = public.current_app_user_id())
with check (user_id = public.current_app_user_id());

create policy google_calendar_connections_delete on public.google_calendar_connections
for delete using (user_id = public.current_app_user_id());

select '031_google_calendar_integration completed' as result;
