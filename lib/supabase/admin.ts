import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Service-role client with no cookie/session context - required by code that
 * runs outside a request lifecycle (the reminder scheduler's cron tick).
 * Bypasses RLS entirely, so every query here must scope by company_id/user_id
 * explicitly instead of relying on policies.
 */
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!serviceKey) {
    throw new Error("Configura SUPABASE_SECRET_KEY.");
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
