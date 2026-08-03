import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";

export default async function LegacyAuditPage() {
  const tenant = await getTenantContext();

  if (tenant.role !== "SUPER_ADMIN") {
    notFound();
  }

  const { redirect } = await import("next/navigation");
  redirect("/super-admin/auditoria");
}
