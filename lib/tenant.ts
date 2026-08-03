import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ModuleKey } from "@/lib/modules";

export type { ModuleKey } from "@/lib/modules";

export type TenantContext = {
  userId: string;
  authUserId: string;
  companyId: string;
  companyName: string;
  role: string;
};

async function resolveTenantContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authUserId: string
): Promise<TenantContext | null> {
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("user_id, company_id, role, companies!company_id(name)")
    .eq("auth_user_id", authUserId)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!membershipError && membership) {
    const company = Array.isArray(membership.companies) ? membership.companies[0] : membership.companies;

    return {
      userId: membership.user_id,
      authUserId,
      companyId: membership.company_id,
      companyName: company?.name ?? "Empresa",
      role: membership.role
    };
  }

  console.warn("Active membership lookup failed; falling back to users profile", {
    authUserId,
    message: membershipError?.message,
    code: membershipError?.code
  });

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, company_id, role, companies!company_id(name)")
    .eq("auth_user_id", authUserId)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (profileError || !profile) {
    console.warn("Tenant profile lookup failed", {
      authUserId,
      message: profileError?.message,
      code: profileError?.code
    });
    return null;
  }

  const company = Array.isArray(profile.companies) ? profile.companies[0] : profile.companies;

  return {
    userId: profile.id,
    authUserId,
    companyId: profile.company_id,
    companyName: company?.name ?? "Empresa",
    role: profile.role
  };
}

// Both wrapped in React's per-request cache(): app/(app)/layout.tsx already
// calls getTenantContext() once to build the sidebar, and every page under it
// calls it again for its own data - without this, that's 2x the auth +
// membership round trips on literally every page in the app (confirmed
// across 17 page components). cache() dedupes repeat calls with the same
// arguments within a single render pass only - it never persists across
// requests, so there's no staleness/tenant-isolation risk, just one fewer
// redundant round trip per page load.
export const getTenantContextOrNull = cache(async (): Promise<TenantContext | null> => {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  return resolveTenantContext(supabase, user.id);
});

export const getTenantContext = cache(async (): Promise<TenantContext> => {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const tenantContext = await resolveTenantContext(supabase, user.id);

  if (!tenantContext) {
    redirect("/onboarding");
  }

  return tenantContext;
});

export type TenantRowFilters = {
  search?: string;
  searchField?: string;
  filterField?: string;
  filterValue?: string;
};

export async function listTenantRows(table: ModuleKey, companyId: string, filters: TenantRowFilters = {}) {
  const supabase = await createClient();
  let query = supabase
    .from(table)
    .select("*")
    .eq("company_id", companyId);

  if (filters.search && filters.searchField) {
    query = query.ilike(filters.searchField, `%${filters.search}%`);
  }

  if (filters.filterValue && filters.filterField) {
    query = query.eq(filters.filterField, filters.filterValue);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getDashboardStats(companyId: string) {
  const supabase = await createClient();
  const tables: ModuleKey[] = [
    "assets",
    "maintenance_records",
    "asset_documents",
    "projects",
    "users",
    "incidents"
  ];

  const results = await Promise.all(
    tables.map((table) =>
      supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
    )
  );

  return Object.fromEntries(
    tables.map((table, index) => [table, results[index].count ?? 0])
  ) as Record<ModuleKey, number>;
}
