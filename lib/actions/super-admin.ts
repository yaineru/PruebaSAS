"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { assertSameOrigin, assertRateLimit } from "@/lib/security";
import { getNicheConfig } from "@/lib/niches";

export type CompanyOverviewRow = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  businessType: string;
  adminEmail: string | null;
  adminName: string | null;
  userCount: number;
};

// Vista mínima para operar los primeros clientes sin entrar a Supabase a
// mano: quién se registró, con qué nicho, cuándo y su estado. No es un CRM -
// sólo lo necesario para saber quién existe y poder suspender/reactivar.
// SUPER_ADMIN puede leer companies/company_settings/users de cualquier
// empresa vía RLS normal (has_company_role hace OR con is_super_admin()),
// así que esto no necesita el cliente de service-role.
export async function listCompaniesOverview(): Promise<CompanyOverviewRow[]> {
  const tenant = await getTenantContext();
  if (tenant.role !== "SUPER_ADMIN") {
    throw new Error("Se requiere rol de Super Administrador.");
  }

  const supabase = await createClient();

  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id, name, status, created_at")
    .order("created_at", { ascending: false });

  if (companiesError) {
    throw new Error(companiesError.message);
  }
  if (!companies || companies.length === 0) return [];

  const companyIds = companies.map((c) => c.id);

  const [{ data: settingsRows }, { data: userRows }] = await Promise.all([
    supabase.from("company_settings").select("company_id, business_type").in("company_id", companyIds),
    supabase.from("users").select("company_id, email, full_name, role").in("company_id", companyIds)
  ]);

  const settingsByCompany = new Map((settingsRows ?? []).map((row) => [row.company_id, row.business_type]));
  const usersByCompany = new Map<string, { email: string; full_name: string | null; role: string }[]>();
  for (const row of userRows ?? []) {
    const list = usersByCompany.get(row.company_id) ?? [];
    list.push(row);
    usersByCompany.set(row.company_id, list);
  }

  return companies.map((company) => {
    const users = usersByCompany.get(company.id) ?? [];
    const admin = users.find((u) => u.role === "ADMIN") ?? users[0] ?? null;
    const businessType = settingsByCompany.get(company.id) ?? "general";

    return {
      id: company.id,
      name: company.name,
      status: company.status,
      createdAt: company.created_at,
      businessType: getNicheConfig(businessType).slug,
      adminEmail: admin?.email ?? null,
      adminName: admin?.full_name ?? null,
      userCount: users.length
    };
  });
}

export async function toggleCompanyStatus(companyId: string, nextStatus: "ACTIVE" | "SUSPENDED") {
  try {
    await assertSameOrigin();
    await assertRateLimit("toggle-company-status", 20);

    const tenant = await getTenantContext();
    if (tenant.role !== "SUPER_ADMIN") {
      return { success: false, error: "Se requiere rol de Super Administrador." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("companies")
      .update({ status: nextStatus })
      .eq("id", companyId)
      .select("id");

    if (error) {
      return { success: false, error: "No se pudo actualizar el estado de la empresa." };
    }
    if (!data || data.length === 0) {
      return { success: false, error: "No se encontró la empresa o no tienes permisos sobre ella." };
    }

    revalidatePath("/super-admin/empresas");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado." };
  }
}
