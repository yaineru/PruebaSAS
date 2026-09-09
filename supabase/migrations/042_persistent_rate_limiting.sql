-- 042_persistent_rate_limiting.sql
--
-- lib/security.ts's assertRateLimit() (sign-in, sign-up, report generation,
-- record delete, etc.) counted attempts in a plain in-memory Map. On Vercel
-- serverless, each invocation can land on a different, short-lived function
-- instance with its own empty Map - the counter almost never accumulates
-- across real attempts, so brute-force protection on /login was close to
-- decorative in production. This was flagged as a known risk in prior
-- audits and never fixed.
--
-- Fix: a small shared table plus a single-statement atomic upsert function,
-- callable by both anon (sign-in/sign-up happen pre-session) and
-- authenticated. The table itself grants nothing to those roles directly -
-- only the SECURITY DEFINER function can touch it - so this cannot be used
-- to read or tamper with another key's counter.
--
-- Purely additive: new table, new function, no existing schema/data touched.
-- Idempotent: safe to run any number of times.

create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 1,
  reset_at timestamptz not null
);

alter table public.rate_limits enable row level security;
-- Deliberately no policies: nothing is granted to anon/authenticated on the
-- table itself (see revokes below) - all access goes through the function.

create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_count integer;
begin
  insert into public.rate_limits (key, count, reset_at)
  values (p_key, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set
      count = case
        when public.rate_limits.reset_at < v_now then 1
        else public.rate_limits.count + 1
      end,
      reset_at = case
        when public.rate_limits.reset_at < v_now then v_now + make_interval(secs => p_window_seconds)
        else public.rate_limits.reset_at
      end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to anon, authenticated;

revoke all on public.rate_limits from anon, authenticated;

SELECT '042_persistent_rate_limiting completed' AS result;
