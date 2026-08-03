-- 030_activities_calendar.sql
--
-- Agenda/calendar module: company activities with type-based colors, and
-- automatic reminders dispatched by an in-process scheduler (see
-- lib/scheduler/reminder-scheduler.ts). Follows this repo's established
-- multitenant RLS pattern (public.current_app_user_id() resolves auth.uid()
-- -> public.users.id -- never compare auth.uid() directly against a
-- users.id-typed column; that exact bug class required 6+ follow-up
-- migrations on other tables: 018-021, 026, 028, 029).
--
-- Fully idempotent: safe to run any number of times.

create table if not exists public.activity_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  color text not null default '#0EA5E9' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  activity_type_id uuid references public.activity_types(id) on delete set null,
  owner_user_id uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  location text,
  notes text,
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED', 'CANCELLED', 'DONE')),
  google_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint activities_end_after_start check (end_at >= start_at)
);

create table if not exists public.activity_reminders (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  offset_minutes int not null check (offset_minutes >= 0),
  channel text not null default 'INAPP' check (channel in ('INAPP', 'EMAIL', 'BOTH')),
  created_at timestamptz not null default now(),
  unique (activity_id, offset_minutes)
);

-- Idempotency lock for the reminder scheduler: the cron tick inserts here
-- FIRST (before creating the notification/email); a unique-constraint
-- conflict means another tick already claimed this reminder, so it's safely
-- skipped. Never touched by user-facing RLS - only the service-role
-- scheduler client writes here.
create table if not exists public.reminder_dispatch_log (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  offset_minutes int not null,
  dispatched_at timestamptz not null default now(),
  unique (activity_id, offset_minutes)
);

alter table public.company_settings add column if not exists timezone text not null default 'America/Bogota';

create index if not exists activities_company_range_idx on public.activities(company_id, start_at, end_at) where deleted_at is null;
create index if not exists activities_owner_idx on public.activities(owner_user_id) where deleted_at is null;
create index if not exists activity_types_company_idx on public.activity_types(company_id);
create index if not exists activity_reminders_activity_idx on public.activity_reminders(activity_id);
create index if not exists reminder_dispatch_log_activity_idx on public.reminder_dispatch_log(activity_id);

drop trigger if exists activities_set_updated_at on public.activities;
create trigger activities_set_updated_at
before update on public.activities
for each row execute function public.set_updated_at();

drop trigger if exists audit_activities on public.activities;
create trigger audit_activities
after insert or update or delete on public.activities
for each row execute function public.write_audit_log();

alter table public.activity_types enable row level security;
alter table public.activities enable row level security;
alter table public.activity_reminders enable row level security;
alter table public.reminder_dispatch_log enable row level security;

drop policy if exists activity_types_select on public.activity_types;
drop policy if exists activity_types_insert on public.activity_types;
drop policy if exists activity_types_update on public.activity_types;
drop policy if exists activity_types_delete on public.activity_types;

create policy activity_types_select on public.activity_types
for select using (public.is_company_member(company_id));

create policy activity_types_insert on public.activity_types
for insert with check (public.can_manage_operations(company_id));

create policy activity_types_update on public.activity_types
for update using (public.can_manage_operations(company_id))
with check (public.can_manage_operations(company_id));

create policy activity_types_delete on public.activity_types
for delete using (public.can_manage_operations(company_id));

drop policy if exists activities_select on public.activities;
drop policy if exists activities_insert on public.activities;
drop policy if exists activities_update on public.activities;
drop policy if exists activities_delete on public.activities;

create policy activities_select on public.activities
for select using (public.is_company_member(company_id));

create policy activities_insert on public.activities
for insert with check (
  public.is_company_member(company_id)
  and created_by = public.current_app_user_id()
);

create policy activities_update on public.activities
for update using (
  public.can_manage_operations(company_id)
  or owner_user_id = public.current_app_user_id()
  or created_by = public.current_app_user_id()
)
with check (
  public.can_manage_operations(company_id)
  or owner_user_id = public.current_app_user_id()
  or created_by = public.current_app_user_id()
);

create policy activities_delete on public.activities
for delete using (
  public.can_manage_operations(company_id)
  or owner_user_id = public.current_app_user_id()
  or created_by = public.current_app_user_id()
);

drop policy if exists activity_reminders_select on public.activity_reminders;
drop policy if exists activity_reminders_insert on public.activity_reminders;
drop policy if exists activity_reminders_update on public.activity_reminders;
drop policy if exists activity_reminders_delete on public.activity_reminders;

create policy activity_reminders_select on public.activity_reminders
for select using (public.is_company_member(company_id));

create policy activity_reminders_insert on public.activity_reminders
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

create policy activity_reminders_update on public.activity_reminders
for update using (
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

create policy activity_reminders_delete on public.activity_reminders
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

-- reminder_dispatch_log: deliberately no policies for the authenticated/anon
-- roles (RLS enabled, zero permissive policies = deny-by-default). Only the
-- service-role scheduler client (lib/supabase/admin.ts) touches this table,
-- and service-role bypasses RLS entirely.

do $$ begin
  alter publication supabase_realtime add table public.activities;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.activity_types;
exception when duplicate_object then null;
end $$;

-- Backs lib/scheduler/reminder-scheduler.ts (the in-process node-cron tick).
-- Kept as a single SQL function rather than reassembling this interval math
-- via PostgREST filters from the JS side, and locked to service_role only
-- since it returns cross-user data (owner_email) that no RLS policy exposes.
-- The 2-minute lower bound caps how far back a missed tick can "catch up"
-- after the process was down, so a restart doesn't fire a backlog of stale
-- reminders all at once.
create or replace function public.get_due_reminders()
returns table (
  reminder_id uuid,
  activity_id uuid,
  company_id uuid,
  offset_minutes int,
  channel text,
  title text,
  start_at timestamptz,
  owner_user_id uuid,
  owner_email text
)
language sql
security definer
set search_path = public
as $$
  select
    ar.id,
    a.id,
    a.company_id,
    ar.offset_minutes,
    ar.channel,
    a.title,
    a.start_at,
    a.owner_user_id,
    u.email
  from public.activities a
  join public.activity_reminders ar on ar.activity_id = a.id
  left join public.users u on u.id = a.owner_user_id
  where a.status = 'SCHEDULED'
    and a.deleted_at is null
    and a.start_at - (ar.offset_minutes || ' minutes')::interval <= now()
    and a.start_at - (ar.offset_minutes || ' minutes')::interval > now() - interval '2 minutes'
    and not exists (
      select 1 from public.reminder_dispatch_log d
      where d.activity_id = a.id and d.offset_minutes = ar.offset_minutes
    );
$$;

revoke all on function public.get_due_reminders() from public;
revoke all on function public.get_due_reminders() from anon;
revoke all on function public.get_due_reminders() from authenticated;
grant execute on function public.get_due_reminders() to service_role;

select '030_activities_calendar completed' as result;
