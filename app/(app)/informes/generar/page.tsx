import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { getBusinessLabels, getCompanySettings } from "@/lib/company-settings";
import { getNicheConfig } from "@/lib/niches";
import { ReportGenerator } from "@/components/report-generator";
import type { ModuleKey } from "@/lib/modules";
import type { ReportEntity } from "@/lib/reports";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Generar Informe"
};

// Los 5 tipos de informe existentes están 1:1 con estos 5 módulos - se
// muestran solo los que el nicho de la empresa deja visibles (mismo registro
// que decide el sidebar, lib/niches.ts), para que Veterinaria no vea
// "Proyectos" como tipo de informe si Obras está oculto.
const REPORT_ENTITY_MODULE: Record<ReportEntity, ModuleKey> = {
  ASSETS: "assets",
  MAINTENANCE: "maintenance_records",
  INCIDENTS: "incidents",
  PROJECTS: "projects",
  DOCUMENTS: "asset_documents"
};

export default async function GenerateReportPage() {
  const tenant = await getTenantContext();

  // Only ADMIN and SUPERVISOR can generate reports
  if (!["ADMIN", "SUPERVISOR"].includes(tenant.role)) {
    redirect("/");
  }

  const settings = await getCompanySettings(tenant.companyId, tenant.companyName);
  const niche = getNicheConfig(settings.businessType);
  const visibleEntities = (Object.keys(REPORT_ENTITY_MODULE) as ReportEntity[]).filter((entity) =>
    niche.visibleModules.includes(REPORT_ENTITY_MODULE[entity])
  );

  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("report_templates")
    .select("id,name,color_scheme")
    .eq("company_id", tenant.companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/10 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Generar Informe</h1>
          <p className="text-muted-foreground mt-2">
            Crea informes profesionales en PDF o Excel con datos filtrados
          </p>
        </div>

        <ReportGenerator
          companyId={tenant.companyId}
          templates={templates || []}
          businessLabels={getBusinessLabels(settings)}
          visibleEntities={visibleEntities}
        />
      </div>
    </div>
  );
}
